import { CART_SNAPSHOT_VERSION, type CartItem, type CartSnapshot, type ExtractionIssue } from '../../domain/cart';
import { findAllPricesInCents, parsePriceToCents } from '../../shared/currency';
import { WORTH_IT_HOST_TAG, cleanText } from '../retailer-adapter';
import {
  BRAND_SELECTORS,
  CART_COUNT_PATTERN,
  CART_HEADING_SELECTORS,
  CURRENT_QUANTITY_PATTERN,
  EXCLUDED_REGION_SELECTORS,
  GROUPED_LINE_ROW_SELECTOR,
  ITEM_ID_FROM_URL,
  LINE_ITEM_SELECTORS,
  LINE_PRICE_SELECTORS,
  PACKAGE_SIZE_SELECTORS,
  PRODUCT_LINK_SELECTOR,
  QUANTITY_INPUT_SELECTORS,
  QUANTITY_TEXT_SELECTORS,
  SUBTOTAL_SELECTORS,
  TITLE_SELECTORS,
  UNAVAILABLE_PATTERN,
  UNIT_PRICE_SELECTORS,
  UNIT_PRICE_TEXT,
  WAS_PRICE_SELECTORS,
  WAS_PRICE_TEXT,
} from './selectors';


/**
 * Reads the visible Walmart cart rows into a normalized snapshot. Read-only:
 * it only queries the DOM and never dispatches events or edits nodes.
 */
export function extractWalmartCart(doc: Document, url: URL, now: Date): CartSnapshot {
  const lines = findLineContainers(doc);
  const items = lines.map((line, position) => extractLine(line, position, url));
  return {
    version: CART_SNAPSHOT_VERSION,
    merchant: 'walmart',
    pageUrl: `${url.origin}${url.pathname}`,
    observedAt: now.toISOString(),
    items: dedupeKeys(items),
    subtotalCents: firstPrice(doc, SUBTOTAL_SELECTORS),
    displayedItemCount: displayedCount(doc),
  };
}

function displayedCount(doc: Document): number | null {
  for (const selector of CART_HEADING_SELECTORS) {
    const heading = doc.querySelector(selector);
    // The count may sit inside the heading or right next to it ("Cart" + "(1 item)").
    const match = CART_COUNT_PATTERN.exec(heading?.textContent ?? '') ?? CART_COUNT_PATTERN.exec(heading?.parentElement?.textContent ?? '');
    if (match) return Number(match[1]);
  }
  return null;
}

function findLineContainers(doc: Document): Element[] {
  for (const selector of LINE_ITEM_SELECTORS) {
    const found = Array.from(doc.querySelectorAll(selector)).filter(isActiveCartLine);
    // Keep only outermost matches so nested test ids do not double count.
    const outermost = found.filter((el) => !found.some((other) => other !== el && other.contains(el)));
    if (outermost.length > 0) return outermost.flatMap(splitGroupedLines);
  }
  return heuristicLineContainers(doc);
}

/** Walmart may use one tile hook for several list rows, each with its own price and quantity. */
function splitGroupedLines(container: Element): Element[] {
  const rows = Array.from(container.querySelectorAll(GROUPED_LINE_ROW_SELECTOR))
    .filter((row) => isActiveCartLine(row) && row.querySelector(PRODUCT_LINK_SELECTOR));
  const leaves = rows.filter((row) => !rows.some((other) => other !== row && row.contains(other)));
  if (leaves.length < 2) return [container];
  const links = Array.from(container.querySelectorAll(PRODUCT_LINK_SELECTOR)).filter(isActiveCartLine);
  // Split only when every active product link belongs to one of the rows.
  return links.every((link) => leaves.some((row) => row.contains(link))) ? leaves : [container];
}

/**
 * Fallback when no known line container hook exists: start from each product
 * link and climb to the largest ancestor that still holds exactly one product.
 */
function heuristicLineContainers(doc: Document): Element[] {
  const root = doc.querySelector('main') ?? doc.body;
  const links = Array.from(root.querySelectorAll(PRODUCT_LINK_SELECTOR)).filter(isActiveCartLine);
  const containers: Element[] = [];
  for (const link of links) {
    const ownId = itemIdFromHref(link.getAttribute('href'));
    let candidate: Element = link;
    let parent = link.parentElement;
    while (parent && parent !== root && countDistinctProducts(parent) === 1) {
      candidate = parent;
      parent = parent.parentElement;
    }
    const hasPrice = findAllPricesInCents(candidate.textContent ?? '').length > 0;
    if (hasPrice && ownId !== undefined && !containers.includes(candidate)) containers.push(candidate);
  }
  return containers;
}

function countDistinctProducts(el: Element): number {
  const ids = new Set<string>();
  for (const link of Array.from(el.querySelectorAll(PRODUCT_LINK_SELECTOR))) {
    ids.add(itemIdFromHref(link.getAttribute('href')) ?? link.getAttribute('href') ?? '');
  }
  return ids.size;
}

function isActiveCartLine(el: Element): boolean {
  if (el.closest(WORTH_IT_HOST_TAG)) return false;
  return !EXCLUDED_REGION_SELECTORS.some((selector) => el.closest(selector) !== null);
}

function extractLine(line: Element, position: number, pageUrl: URL): CartItem {
  const issues: ExtractionIssue[] = [];
  const link = line.querySelector(PRODUCT_LINK_SELECTOR);
  const href = link?.getAttribute('href') ?? null;
  const productUrl = href ? safeAbsoluteUrl(href, pageUrl) : null;
  const retailerItemId = itemIdFromHref(href) ?? null;

  const title =
    firstText(line, TITLE_SELECTORS) ?? cleanText(link?.textContent) ?? cleanText(link?.getAttribute('aria-label'));
  if (!title) issues.push('missing_title');

  const quantity = readQuantity(line);
  if (quantity === null) issues.push('missing_quantity');

  const unavailable = UNAVAILABLE_PATTERN.test(line.textContent ?? '');
  if (unavailable) issues.push('unavailable');

  const price = readPrices(line, quantity);
  if (price.issue) issues.push(price.issue);

  const coreMissing = [title, quantity, price.linePriceCents].filter((v) => v === null).length;
  const confidence: CartItem['confidence'] = coreMissing === 0 ? 'high' : coreMissing === 3 ? 'low' : 'partial';

  return {
    key: retailerItemId
      ? `walmart:${retailerItemId}`
      : title
        ? `walmart:title:${title.toLowerCase().slice(0, 200)}`
        : `walmart:position:${position}`,
    merchant: 'walmart',
    position,
    retailerItemId,
    productUrl,
    title: title ? title.slice(0, 500) : null,
    brand: firstText(line, BRAND_SELECTORS),
    quantity,
    unitPriceCents: price.unitPriceCents,
    linePriceCents: price.linePriceCents,
    wasLinePriceCents: price.wasLinePriceCents,
    currency: 'USD',
    priceSource: price.source,
    packageSize: firstText(line, PACKAGE_SIZE_SELECTORS)?.slice(0, 100) ?? null,
    issues,
    confidence,
  };
}

interface PriceReading {
  linePriceCents: number | null;
  unitPriceCents: number | null;
  wasLinePriceCents: number | null;
  source: CartItem['priceSource'];
  issue: ExtractionIssue | null;
}

function readPrices(line: Element, quantity: number | null): PriceReading {
  const wasLinePriceCents = firstPrice(line, WAS_PRICE_SELECTORS);
  let unitPriceCents = firstPrice(line, UNIT_PRICE_SELECTORS);
  let linePriceCents = firstPrice(line, LINE_PRICE_SELECTORS);

  if (linePriceCents === null) {
    // Fallback: collect price text that is neither a was/strikethrough price
    // nor a per-unit price. Use it only when exactly one candidate remains.
    const candidates = new Set<number>();
    for (const text of priceTextNodes(line)) {
      const parentText = text.parentElement?.textContent ?? '';
      if (isInside(text, WAS_PRICE_SELECTORS) || WAS_PRICE_TEXT.test(parentText)) continue;
      if (UNIT_PRICE_TEXT.test(parentText)) {
        unitPriceCents ??= parsePriceToCents(text.textContent);
        continue;
      }
      for (const cents of findAllPricesInCents(text.textContent ?? '')) candidates.add(cents);
    }
    if (candidates.size === 1) {
      linePriceCents = [...candidates][0] ?? null;
    } else if (candidates.size > 1) {
      return { linePriceCents: null, unitPriceCents, wasLinePriceCents, source: 'unknown', issue: 'ambiguous_price' };
    }
  }

  if (linePriceCents !== null) {
    if (unitPriceCents === null && quantity !== null && linePriceCents % quantity === 0) {
      unitPriceCents = linePriceCents / quantity;
    }
    return { linePriceCents, unitPriceCents, wasLinePriceCents, source: 'line_price', issue: null };
  }
  if (unitPriceCents !== null && quantity !== null) {
    return {
      linePriceCents: unitPriceCents * quantity,
      unitPriceCents,
      wasLinePriceCents,
      source: 'unit_price_times_quantity',
      issue: null,
    };
  }
  return { linePriceCents: null, unitPriceCents, wasLinePriceCents, source: 'unknown', issue: 'missing_price' };
}

function readQuantity(line: Element): number | null {
  for (const selector of QUANTITY_INPUT_SELECTORS) {
    const input = line.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    if (input) return parseQuantity(input.value);
  }
  for (const selector of QUANTITY_TEXT_SELECTORS) {
    const el = line.querySelector(selector);
    if (!el) continue;
    const fromText = parseQuantity(el.textContent);
    if (fromText !== null) return fromText;
    const fromLabel = parseQuantity(el.getAttribute('aria-label'));
    if (fromLabel !== null) return fromLabel;
  }
  for (const button of Array.from(line.querySelectorAll('button[aria-label]'))) {
    const current = CURRENT_QUANTITY_PATTERN.exec(button.getAttribute('aria-label') ?? '');
    if (current) return parseQuantity(current[1]);
  }
  const qtyText = /\bQty:?\s*(\d{1,3})\b/i.exec(line.textContent ?? '');
  return qtyText ? parseQuantity(qtyText[1]) : null;
}

function parseQuantity(value: string | null | undefined): number | null {
  const match = /(\d{1,3})/.exec(value ?? '');
  if (!match) return null;
  const quantity = Number(match[1]);
  return quantity >= 1 && quantity <= 999 ? quantity : null;
}

function priceTextNodes(root: Element): Text[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes('$')) nodes.push(node as Text);
  }
  return nodes;
}

function isInside(node: Node, selectors: readonly string[]): boolean {
  const el = node.parentElement;
  return el !== null && selectors.some((selector) => el.closest(selector) !== null);
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
    const el = root.querySelector(selector);
    if (!el) continue;
    const cents = parsePriceToCents(el.getAttribute('content') ? `$${el.getAttribute('content')}` : el.textContent);
    if (cents !== null) return cents;
  }
  return null;
}

export function itemIdFromHref(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  return ITEM_ID_FROM_URL.exec(href)?.[1];
}

function safeAbsoluteUrl(href: string, base: URL): string | null {
  try {
    const url = new URL(href, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? `${url.origin}${url.pathname}` : null;
  } catch {
    return null;
  }
}

/** Two lines for the same product (rare) get distinct keys. */
function dedupeKeys(items: CartItem[]): CartItem[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = seen.get(item.key) ?? 0;
    seen.set(item.key, count + 1);
    return count === 0 ? item : { ...item, key: `${item.key}#${count + 1}` };
  });
}
