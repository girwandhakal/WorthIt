import { CART_SNAPSHOT_VERSION, type CartItem, type CartSnapshot, type ExtractionIssue } from '../../domain/cart';
import { findAllPricesInCents, parsePriceToCents } from '../../shared/currency';
import { WORTH_IT_HOST_TAG, cleanText } from '../retailer-adapter';
import {
  ACTIVE_CART_SELECTORS,
  ASIN_FROM_URL,
  ASIN_PATTERN,
  EXCLUDED_CART_REGIONS,
  ITEM_COUNT_PATTERN,
  LINE_ITEM_SELECTOR,
  PRICE_SELECTORS,
  PRODUCT_LINK_SELECTOR,
  QUANTITY_INPUT_SELECTORS,
  QUANTITY_TEXT_SELECTORS,
  SUBTOTAL_AMOUNT_SELECTORS,
  SUBTOTAL_LABEL_SELECTORS,
  TITLE_SELECTORS,
  UNAVAILABLE_PATTERN,
  WAS_PRICE_SELECTORS,
} from './selectors';

/**
 * Reads the active Amazon cart into the shared normalized snapshot. Amazon
 * shows a per-unit price on each row, so the line price is unit × quantity.
 * Read-only: queries the DOM and never dispatches events or edits nodes.
 */
export function extractAmazonCart(doc: Document, url: URL, now: Date): CartSnapshot {
  const root = ACTIVE_CART_SELECTORS.map((selector) => doc.querySelector(selector)).find(Boolean) ?? doc.body;
  const lines = Array.from(root.querySelectorAll(LINE_ITEM_SELECTOR)).filter(
    (el) => !el.closest(WORTH_IT_HOST_TAG) && !EXCLUDED_CART_REGIONS.some((selector) => el.closest(selector)),
  );
  const items = lines.map((line, position) => extractLine(line, position, url));
  return {
    version: CART_SNAPSHOT_VERSION,
    merchant: 'amazon',
    pageUrl: `${url.origin}${url.pathname}`,
    observedAt: now.toISOString(),
    items: dedupeKeys(items),
    subtotalCents: firstPrice(doc, SUBTOTAL_AMOUNT_SELECTORS),
    displayedItemCount: displayedCount(doc),
  };
}

function extractLine(line: Element, position: number, pageUrl: URL): CartItem {
  const issues: ExtractionIssue[] = [];
  const link = line.querySelector(PRODUCT_LINK_SELECTOR);
  const href = link?.getAttribute('href') ?? null;
  const dataAsin = line.getAttribute('data-asin')?.trim() ?? '';
  const asin = ASIN_PATTERN.test(dataAsin) ? dataAsin : (asinFromHref(href) ?? null);

  const title = firstText(line, TITLE_SELECTORS) ?? cleanText(link?.textContent);
  if (!title) issues.push('missing_title');

  const quantity = readQuantity(line);
  if (quantity === null) issues.push('missing_quantity');

  if (UNAVAILABLE_PATTERN.test(line.textContent ?? '')) issues.push('unavailable');

  let unitPriceCents = dollarsAttribute(line.getAttribute('data-price'));
  if (unitPriceCents === null) {
    const candidates = new Set(PRICE_SELECTORS.flatMap((selector) => Array.from(line.querySelectorAll(selector), (el) => parsePriceToCents(el.textContent))));
    candidates.delete(null);
    if (candidates.size === 1) unitPriceCents = [...candidates][0] ?? null;
    else if (candidates.size > 1) issues.push('ambiguous_price');
  }
  const linePriceCents = unitPriceCents !== null && quantity !== null ? unitPriceCents * quantity : null;
  if (unitPriceCents === null && !issues.includes('ambiguous_price')) issues.push('missing_price');
  const wasUnit = firstPrice(line, WAS_PRICE_SELECTORS);

  const coreMissing = [title, quantity, linePriceCents].filter((value) => value === null).length;
  return {
    key: asin ? `amazon:${asin}` : title ? `amazon:title:${title.toLowerCase().slice(0, 200)}` : `amazon:position:${position}`,
    merchant: 'amazon',
    position,
    retailerItemId: asin,
    productUrl: asin ? `https://www.amazon.com/dp/${asin}` : href ? safeUrl(href, pageUrl) : null,
    title: title ? title.slice(0, 500) : null,
    brand: null,
    quantity,
    unitPriceCents,
    linePriceCents,
    wasLinePriceCents: wasUnit !== null && quantity !== null && wasUnit !== unitPriceCents ? wasUnit * quantity : null,
    currency: 'USD',
    priceSource: linePriceCents === null ? 'unknown' : 'unit_price_times_quantity',
    packageSize: null,
    issues,
    confidence: coreMissing === 0 ? 'high' : coreMissing === 3 ? 'low' : 'partial',
  };
}

function readQuantity(line: Element): number | null {
  const fromAttribute = parseQuantity(line.getAttribute('data-quantity'));
  if (fromAttribute !== null) return fromAttribute;
  for (const selector of QUANTITY_INPUT_SELECTORS) {
    const input = line.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    if (input) return parseQuantity(input.value);
  }
  for (const selector of QUANTITY_TEXT_SELECTORS) {
    const value = parseQuantity(line.querySelector(selector)?.textContent);
    if (value !== null) return value;
  }
  return null;
}

function parseQuantity(value: string | null | undefined): number | null {
  const match = /(\d{1,3})/.exec(value ?? '');
  if (!match) return null;
  const quantity = Number(match[1]);
  return quantity >= 1 && quantity <= 999 ? quantity : null;
}

/** `data-price="12.99"` → 1299; anything else → null. */
function dollarsAttribute(value: string | null): number | null {
  if (!value || !/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) return null;
  return parsePriceToCents(`$${value.trim()}`);
}

function displayedCount(doc: Document): number | null {
  for (const selector of SUBTOTAL_LABEL_SELECTORS) {
    const match = ITEM_COUNT_PATTERN.exec(doc.querySelector(selector)?.textContent ?? '');
    if (match) return Number(match[1]);
  }
  return null;
}

export function asinFromHref(href: string | null | undefined): string | undefined {
  return href ? ASIN_FROM_URL.exec(href)?.[1] : undefined;
}

function firstText(root: ParentNode, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const text = cleanText(root.querySelector(selector)?.textContent);
    if (text) return text;
  }
  return null;
}

function firstPrice(root: ParentNode, selectors: readonly string[]): number | null {
  for (const selector of selectors) {
    const prices = findAllPricesInCents(root.querySelector(selector)?.textContent ?? '');
    if (prices.length > 0) return prices[0]!;
  }
  return null;
}

function safeUrl(href: string, base: URL): string | null {
  try {
    const url = new URL(href, base);
    return url.protocol === 'https:' ? `${url.origin}${url.pathname}` : null;
  } catch {
    return null;
  }
}

function dedupeKeys(items: CartItem[]): CartItem[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = seen.get(item.key) ?? 0;
    seen.set(item.key, count + 1);
    return count === 0 ? item : { ...item, key: `${item.key}#${count + 1}` };
  });
}
