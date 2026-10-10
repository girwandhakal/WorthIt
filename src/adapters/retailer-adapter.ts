import type { CartSnapshot, Merchant } from '../domain/cart';

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
}

/** Normalizes whitespace in page text and returns null for empty strings. */
export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}
