import { reversalStatus } from '../../domain/history';
import type { ObservedOrderItem, OrderPageKind } from '../../domain/orders';
import { localIsoDate, toIsoDate } from '../../shared/dates';
import { parsePriceToCents } from '../../shared/currency';
import { cleanText } from '../retailer-adapter';
import { itemIdFromHref } from './extract-cart';
import {
  ORDER_CONFIRMATION_PATH,
  ORDER_CONTAINER_SELECTORS,
  ORDER_DATE_SELECTORS,
  ORDER_DETAILS_PATH,
  ORDER_EXCLUDED_REGIONS,
  ORDER_ITEM_PRICE_SELECTORS,
  ORDER_ITEM_QUANTITY_SELECTORS,
  ORDER_ITEM_SELECTORS,
  ORDER_NUMBER_SELECTORS,
  ORDER_STATUS_SELECTORS,
  PRODUCT_LINK_SELECTOR,
  PURCHASE_HISTORY_PATH,
  TITLE_SELECTORS,
  WALMART_ORIGIN,
} from './selectors';

export function walmartOrderPageKind(url: URL): OrderPageKind | null {
  if (url.origin !== WALMART_ORIGIN) return null;
  if (ORDER_CONFIRMATION_PATH.test(url.pathname)) return 'confirmation';
  if (PURCHASE_HISTORY_PATH.test(url.pathname)) return 'history';
  if (ORDER_DETAILS_PATH.test(url.pathname)) return 'details';
  return null;
}

/**
 * Reads purchased item rows from a Walmart order page. It queries only order
 * header fields (number, date, status) and item rows, and skips anything
 * inside payment, address, account, or form regions; it never reads those
 * regions' text.
 */
export function extractWalmartOrders(doc: Document, now: Date): ObservedOrderItem[] {
  const containers = findAll(doc, ORDER_CONTAINER_SELECTORS);
  const roots = containers.length > 0 ? containers : [doc.querySelector('main') ?? doc.body];
  const items: ObservedOrderItem[] = [];
  for (const root of roots) {
    const orderId = cleanText(first(root, ORDER_NUMBER_SELECTORS)?.textContent)?.replace(/^order\s*(number|#)?:?\s*#?/i, '') ?? null;
    const orderDate = toIsoDate(cleanText(first(root, ORDER_DATE_SELECTORS)?.textContent)?.replace(/^(order date|placed on|ordered on|purchased on):?\s*/i, '') ?? null);
    const orderStatus = cleanText(first(root, ORDER_STATUS_SELECTORS)?.textContent);
    for (const row of findAll(root, ORDER_ITEM_SELECTORS)) {
      const link = row.querySelector(PRODUCT_LINK_SELECTOR);
      const title =
        firstText(row, TITLE_SELECTORS) ?? cleanText(link?.textContent) ?? cleanText(link?.getAttribute('aria-label'));
      if (!title) continue;
      const quantityText = cleanText(first(row, ORDER_ITEM_QUANTITY_SELECTORS)?.textContent) ?? '';
      const quantityMatch = /(\d{1,3})/.exec(quantityText);
      items.push({
        title: title.slice(0, 300),
        retailerItemId: itemIdFromHref(link?.getAttribute('href')) ?? null,
        quantity: quantityMatch ? Number(quantityMatch[1]) || null : null,
        linePriceCents: parsePriceToCents(first(row, ORDER_ITEM_PRICE_SELECTORS)?.textContent),
        orderId: orderId ? orderId.slice(0, 80) : null,
        orderDate: orderDate ?? (containers.length === 0 ? localIsoDate(now) : null),
        status: reversalStatus(cleanText(row.querySelector('[data-testid="item-status"]')?.textContent) ?? orderStatus ?? '') ?? 'purchased',
      });
    }
  }
  return items.slice(0, 200);
}

function isExcluded(el: Element): boolean {
  return ORDER_EXCLUDED_REGIONS.some((selector) => el.closest(selector) !== null);
}

function findAll(root: ParentNode, selectors: readonly string[]): Element[] {
  for (const selector of selectors) {
    const found = Array.from(root.querySelectorAll(selector)).filter((el) => !isExcluded(el));
    if (found.length > 0) return found;
  }
  return [];
}

function first(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el && !isExcluded(el)) return el;
  }
  return null;
}

function firstText(root: ParentNode, selectors: readonly string[]): string | null {
  return cleanText(first(root, selectors)?.textContent);
}
