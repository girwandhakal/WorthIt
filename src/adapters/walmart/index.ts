import { matchesCheckoutControl, type RetailerAdapter } from '../retailer-adapter';
import { extractWalmartCart } from './extract-cart';
import type { ProductFacts } from '../../domain/product-facts';
import { extractWalmartOrders, walmartOrderPageKind } from './extract-orders';
import { BlockedError, knownProductFacts, loadProductFacts, type Breaker } from './product-facts';
import { CART_PATH, CHECKOUT_CONTROL_SELECTORS, WALMART_ORIGIN } from './selectors';

/** Facts live for the life of the page, so editing a quantity doesn't refetch every product. */
const factsCache = new Map<string, ProductFacts | null>();
/** One bot check pauses every later request from this page. */
const breaker: Breaker = { trippedAt: null };

export const walmartAdapter: RetailerAdapter = {
  merchant: 'walmart',
  isCartRoute: (url) => url.origin === WALMART_ORIGIN && CART_PATH.test(url.pathname),
  extractCart: extractWalmartCart,
  isCheckoutControl: (target) => matchesCheckoutControl(target, CHECKOUT_CONTROL_SELECTORS),
  orderPageKind: walmartOrderPageKind,
  extractOrders: extractWalmartOrders,
  knownProductFacts: (itemIds) => knownProductFacts(itemIds, factsCache),
  loadProductFacts: (itemIds) =>
    loadProductFacts(itemIds, {
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
    }),
};
