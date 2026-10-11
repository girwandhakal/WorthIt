import type { CartSnapshot, Merchant } from '../domain/cart';
import type { ProductFactsMap } from '../domain/product-facts';
import type { ObservedOrderItem, OrderPageKind } from '../domain/orders';

/** Host element of Worth It's own UI; never read as part of a retailer page. */
export const WORTH_IT_HOST_TAG = 'worth-it-panel';

/**
 * Everything retailer-specific lives behind this interface. Assessment rules
 * and UI only ever see the normalized models.
 */
export interface RetailerAdapter {
  merchant: Merchant;
  /** True only on the retailer's cart route. The review never runs elsewhere. */
  isCartRoute(url: URL): boolean;
  /** Reads visible cart rows into a normalized snapshot. Never mutates the page. */
  extractCart(doc: Document, url: URL, now: Date): CartSnapshot;
  /**
   * Reads each cart item's own product page (ingredients, Nutrition Facts,
   * category) so the review can judge the item itself. Optional; an item it
   * can't read is simply left out and reported as unknown.
   */
  loadProductFacts?(itemIds: readonly string[]): Promise<ProductFactsMap>;
  /**
   * The product facts already read, with no request. `complete` is true when nothing is left to load, so
   * the review can start at once from the cart page and add the rest when it arrives.
   */
  knownProductFacts?(itemIds: readonly string[]): { facts: ProductFactsMap; complete: boolean };
  /**
   * True when the click target is the retailer's checkout control. Worth It holds that
   * first click once, when it has something to show, and never clicks anything itself.
   */
  isCheckoutControl?(target: Element): boolean;
  /** Opt-in purchase recording: which order page this is, if any. */
  orderPageKind(url: URL): OrderPageKind | null;
  /** Reads purchased item rows only; never payment, address, or account fields. */
  extractOrders(doc: Document, now: Date): ObservedOrderItem[];
}

/**
 * Recognizes a checkout control by the retailer's own markers first, then by
 * its visible label ("Continue to checkout", "Check out", "Proceed to checkout").
 * Worth It's own panel never matches.
 */
export function matchesCheckoutControl(target: Element, selectors: readonly string[]): boolean {
  if (target.closest(WORTH_IT_HOST_TAG)) return false;
  if (selectors.some((selector) => target.closest(selector))) return true;
  const control = target.closest('button, a, input[type="submit"], input[type="button"], [role="button"]');
  if (!control) return false;
  const label = cleanText(control instanceof HTMLInputElement ? control.value : (control.getAttribute('aria-label') ?? control.textContent)) ?? '';
  return label.length <= 60 && /^(continue to |proceed to |go to )?check ?out\b/i.test(label);
}

/** Normalizes whitespace in page text and returns null for empty strings. */
export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}
