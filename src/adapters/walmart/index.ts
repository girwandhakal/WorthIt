import { matchesCheckoutControl, type RetailerAdapter } from '../retailer-adapter';
import { extractWalmartCart } from './extract-cart';
import type { ProductFacts } from '../../domain/product-facts';
import { extractWalmartOrders, walmartOrderPageKind } from './extract-orders';
import { loadStoredFacts, saveStoredFacts, type FactsStorage, type StoredFacts } from './facts-store';
import { BlockedError, knownProductFacts, loadProductFacts, type Breaker } from './product-facts';
import { CART_PATH, CHECKOUT_CONTROL_SELECTORS, WALMART_ORIGIN } from './selectors';

export interface WalmartAdapterOptions {
  /** Where to keep product labels between page loads. Without it they live only for the life of the page. */
  factsStorage?: FactsStorage;
  now?: () => number;
}

export function createWalmartAdapter({ factsStorage, now = Date.now }: WalmartAdapterOptions = {}): RetailerAdapter {
  /** Facts live for the life of the page, so editing a quantity doesn't refetch every product. */
  const factsCache = new Map<string, ProductFacts | null>();
  /** When each readable label was read, so saved labels expire a day after they were read, not after they were last used. */
  const readAt = new Map<string, number>();
  /** One bot check pauses every later request from this page. */
  const breaker: Breaker = { trippedAt: null };

  let warm: Promise<void> | null = null;
  /** Brings in the labels saved by earlier visits, once, so a repeat visit starts with them. */
  const warmUp = () =>
    (warm ??= factsStorage
      ? loadStoredFacts(factsStorage, now()).then((stored) => {
          for (const [id, entry] of stored) {
            if (factsCache.has(id)) continue;
            factsCache.set(id, entry.facts);
            readAt.set(id, entry.at);
          }
        })
      : Promise.resolve());

  /** Saves any labels read since the last save. */
  const remember = () => {
    if (!factsStorage) return;
    let learned = false;
    for (const [id, facts] of factsCache) {
      if (facts && !readAt.has(id)) {
        readAt.set(id, now());
        learned = true;
      }
    }
    if (!learned) return;
    const entries: StoredFacts = new Map();
    for (const [id, facts] of factsCache) if (facts) entries.set(id, { at: readAt.get(id)!, facts });
    void saveStoredFacts(factsStorage, entries, now());
  };

  return {
    merchant: 'walmart',
    isCartRoute: (url) => url.origin === WALMART_ORIGIN && CART_PATH.test(url.pathname),
    extractCart: extractWalmartCart,
    isCheckoutControl: (target) => matchesCheckoutControl(target, CHECKOUT_CONTROL_SELECTORS),
    orderPageKind: walmartOrderPageKind,
    extractOrders: extractWalmartOrders,
    warmUp,
    knownProductFacts: (itemIds) => knownProductFacts(itemIds, factsCache),
    loadProductFacts: async (itemIds) => {
      await warmUp().catch(() => undefined);
      const facts = await loadProductFacts(itemIds, {
        cache: factsCache,
        breaker,
        // Same-origin read of the product page the shopper could open themselves; nothing is sent elsewhere.
        fetchHtml: async (itemId, signal) => {
          const response = await fetch(`${WALMART_ORIGIN}/ip/${itemId}`, { credentials: 'same-origin', headers: { accept: 'text/html' }, signal });
          if ([403, 412, 429].includes(response.status)) throw new BlockedError(String(response.status));
          if (response.status === 404) return null; // the page really doesn't exist: remember that
          if (!response.ok) throw new Error(`HTTP ${response.status}`); // transient: leave it uncached so a later review retries
          return response.text();
        },
      });
      remember();
      return facts;
    },
  };
}

/** The adapter without saved labels (tests, and anywhere there is no extension storage). */
export const walmartAdapter: RetailerAdapter = createWalmartAdapter();
