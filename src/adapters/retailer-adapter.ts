import type { CartSnapshot, Merchant } from '../domain/cart';
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
  /** Opt-in purchase recording: which order page this is, if any. */
  orderPageKind(url: URL): OrderPageKind | null;
  /** Reads purchased item rows only; never payment, address, or account fields. */
  extractOrders(doc: Document, now: Date): ObservedOrderItem[];
}

/** Normalizes whitespace in page text and returns null for empty strings. */
export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}
