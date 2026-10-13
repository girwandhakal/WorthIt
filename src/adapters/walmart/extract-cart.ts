import { CART_SNAPSHOT_VERSION, type CartItem, type CartSnapshot, type ExtractionIssue } from '../../domain/cart';
import { findAllPricesInCents, findPriceMentions, parsePriceToCents, withoutSquashedCopies } from '../../shared/currency';
import { WORTH_IT_HOST_TAG, cleanText } from '../retailer-adapter';
import {
  BRAND_SELECTORS,
  CART_COUNT_PATTERN,
  CURRENT_PRICE_LABEL,
  CART_HEADING_SELECTORS,
  CURRENT_QUANTITY_PATTERN,
  EXCLUDED_REGION_SELECTORS,
  GROUPED_LINE_ROW_SELECTOR,
  IMAGE_HOST,
  ITEM_ID_FROM_URL,
  LINE_ITEM_SELECTORS,
  LINE_PRICE_SELECTORS,
  NON_PRODUCT_IMAGE_PATH,
  PACKAGE_SIZE_SELECTORS,
  PRODUCT_IMAGE_PATH,
  PRODUCT_LINK_SELECTOR,
  QUANTITY_INPUT_SELECTORS,
  QUANTITY_TEXT_SELECTORS,
  REWARD_LABEL,
  REWARD_SUFFIX,
  REWARD_TEXT,
  SAVING_LABEL,
  SAVING_TEXT,
  STRIKE_SELECTORS,
  SUBTOTAL_SELECTORS,
  TITLE_SELECTORS,
  UNAVAILABLE_PATTERN,
  UNIT_PRICE_SELECTORS,
  UNIT_PRICE_TEXT,
  UNIT_SUFFIX,
  WAS_PRICE_LABEL,
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
    if (outermost.length > 0) {
      const known = outermost.flatMap(splitGroupedLines);
      return [...known, ...rowsOutsideKnownSections(doc, known)].sort(byDocumentOrder);
    }
  }
  return heuristicLineContainers(doc);
}

/**
 * Walmart groups the cart by how items arrive (pickup, delivery, shipping) and a section can be marked up
 * differently from the rest, so the known hook finds some rows and misses a whole section, such as the
 * items that ship. Rows the known hook missed are found from their product links, and only when they look
 * like cart rows (they have a quantity), so a recommendation tile with a price is not taken for a cart item.
 */
function rowsOutsideKnownSections(doc: Document, known: readonly Element[]): Element[] {
  return heuristicLineContainers(doc).filter(
    (candidate) => !known.some((row) => row === candidate || row.contains(candidate) || candidate.contains(row)) && readQuantity(candidate) !== null,
  );
}

function byDocumentOrder(a: Element, b: Element): number {
  return a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
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
    imageUrl: readImage(line),
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
  let wasLinePriceCents = firstPrice(line, WAS_PRICE_SELECTORS);
  let unitPriceCents = firstPrice(line, UNIT_PRICE_SELECTORS);
  let linePriceCents = firstPrice(line, LINE_PRICE_SELECTORS);

  if (linePriceCents === null) {
    // Fallback: read each dollar amount with the words around it, and use only the amount that is the price
    // now. A "Was" price, a "You save" amount, a struck-through price, and a per-unit price are all set aside.
    const mentions = priceMentions(line);
    wasLinePriceCents ??= mentions.find((mention) => mention.role === 'was')?.cents ?? null;
    unitPriceCents ??= mentions.find((mention) => mention.role === 'unit')?.cents ?? null;
    // An amount the page labels "current price" beats any unlabeled one.
    const labeled = new Set(mentions.filter((mention) => mention.role === 'current').map((mention) => mention.cents));
    const candidates = labeled.size > 0 ? labeled : new Set(mentions.filter((mention) => mention.role === 'plain').map((mention) => mention.cents));
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

type PriceRole = 'current' | 'was' | 'saving' | 'unit' | 'plain';

/** Every dollar amount in the line, each with what it is according to its label, markup, and surroundings. */
function priceMentions(line: Element): Array<{ cents: number; role: PriceRole }> {
  const mentions: Array<{ cents: number; role: PriceRole; decimal: boolean; digits: string }> = [];
  for (const node of priceTextNodes(line)) {
    const text = node.textContent ?? '';
    let previousEnd = 0;
    for (const { cents, start, end, decimal, digits } of findPriceMentions(text)) {
      mentions.push({ cents, decimal, digits, role: roleOfAmount(node, text.slice(previousEnd, start), text.slice(end)) });
      previousEnd = end;
    }
  }
  // A price repeated elsewhere in the row with its decimal point squashed out ("$073") is not a second price.
  return withoutSquashedCopies(mentions);
}

/** `before` and `after` are the words next to the amount inside its own text node. */
function roleOfAmount(node: Text, before: string, after: string): PriceRole {
  // The words right before it name it ("Current price", "Was", "You save").
  if (CURRENT_PRICE_LABEL.test(before)) return 'current';
  if (WAS_PRICE_LABEL.test(before)) return 'was';
  if (SAVING_LABEL.test(before)) return 'saving';
  // A reward or offer beside the price ("Get $2.00 Walmart Cash") is not the price.
  if (REWARD_LABEL.test(before) || REWARD_SUFFIX.test(after)) return 'saving';
  const parent = node.parentElement;
  const parentText = parent?.textContent ?? '';
  if (UNIT_SUFFIX.test(after) || UNIT_PRICE_TEXT.test(parentText)) return 'unit';
  // Old prices: <s>, <del>, a "strike" class, or text drawn with a line through it.
  if (parent && (isStruck(parent) || isInside(node, WAS_PRICE_SELECTORS))) return 'was';
  // The nearest label on an enclosing element ("Was $4.43", "You save $0.46").
  const label = nearestAmountLabel(parent);
  if (label !== null) {
    if (WAS_PRICE_TEXT.test(label)) return 'was';
    if (SAVING_TEXT.test(label) || REWARD_TEXT.test(label)) return 'saving';
  }
  if (parentText.length <= 80 && REWARD_TEXT.test(parentText)) return 'saving';
  if (WAS_PRICE_TEXT.test(parentText)) return 'was';
  if (parent && isSavingContext(parent)) return 'saving';
  return 'plain';
}

function isStruck(el: Element): boolean {
  if (STRIKE_SELECTORS.some((selector) => el.closest(selector) !== null)) return true;
  try {
    return el.ownerDocument.defaultView?.getComputedStyle(el).textDecorationLine.includes('line-through') ?? false;
  } catch {
    return false;
  }
}

/** The aria-label of the closest enclosing element whose label itself holds an amount (not a product-level label). */
function nearestAmountLabel(el: Element | null): string | null {
  for (let current = el; current; current = current.parentElement) {
    const label = current.getAttribute('aria-label');
    if (label && findPriceMentions(label).length > 0 && label.length <= 80) return label;
    if (current.matches('li, [data-testid="product-tile-container"], main')) break;
  }
  return null;
}

/** True when the amount sits in a short block of text that says it is a saving ("You save" next to "$0.46"). */
function isSavingContext(el: Element): boolean {
  for (let current: Element | null = el, depth = 0; current && depth < 3; current = current.parentElement, depth++) {
    const text = current.textContent ?? '';
    if (text.length > 40 || new Set(findPriceMentions(text).map((mention) => mention.cents)).size > 1) return false;
    if (SAVING_TEXT.test(text)) return true;
  }
  return false;
}

/**
 * The line's product thumbnail, only from Walmart's image CDN over https. The CDN also serves fonts, icons,
 * and badges (under /dfw/), so a product photo (/seo/ or /asr/) is preferred over anything else, and an
 * icon is never used when no photo is found.
 */
export function readImage(line: Element): string | null {
  const urls: URL[] = [];
  for (const el of Array.from(line.querySelectorAll('img, source'))) {
    const srcset = (attr: string) => el.getAttribute(attr)?.trim().split(/[\s,]+/)[0];
    // currentSrc is what the browser actually chose (srcset, <picture>); the attributes cover lazy loading.
    const candidates = [(el as HTMLImageElement).currentSrc, el.getAttribute('src'), el.getAttribute('data-src'), srcset('srcset'), srcset('data-srcset')];
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        // Protocol-relative and root-relative links resolve against Walmart itself.
        const url = new URL(candidate, 'https://www.walmart.com/');
        if (url.protocol === 'https:' && IMAGE_HOST.test(url.hostname)) urls.push(url);
      } catch {
        // Malformed: not a CDN thumbnail.
      }
    }
  }
  const photo = urls.find((url) => PRODUCT_IMAGE_PATH.test(url.pathname)) ?? urls.find((url) => !NON_PRODUCT_IMAGE_PATH.test(url.pathname));
  return photo ? photo.href.slice(0, 2000) : null;
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

/**
 * An element's text, with a price Walmart draws as separate spans ("$", "0", "73") put back together as
 * "$0.73". Joined as plain text they read "$073", which is not a price.
 */
export function priceTextOf(el: Element): string {
  const pieces: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const piece = (node.textContent ?? '').trim();
    if (piece) pieces.push(piece);
  }
  const joined: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const [dollar, whole, cents] = [pieces[i], pieces[i + 1], pieces[i + 2]];
    if (dollar === '$' && whole !== undefined && /^\d{1,3}(?:,\d{3})*$/.test(whole) && cents !== undefined && /^\d{2}$/.test(cents)) {
      joined.push(`$${whole}.${cents}`);
      i += 2;
    } else {
      joined.push(pieces[i]!);
    }
  }
  // Without a split price the text is unchanged (the pieces rejoined as the page wrote them).
  return joined.length === pieces.length ? (el.textContent ?? '') : joined.join(' ');
}

function firstPrice(root: ParentNode, selectors: readonly string[]): number | null {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (!el) continue;
    const cents = parsePriceToCents(el.getAttribute('content') ? `$${el.getAttribute('content')}` : priceTextOf(el));
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
