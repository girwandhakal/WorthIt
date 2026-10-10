import type { ObservedOrderItem, OrderPageKind } from '../../domain/orders';
import { findAllPricesInCents } from '../../shared/currency';
import { localIsoDate, toIsoDate } from '../../shared/dates';
import { cleanText } from '../retailer-adapter';
import { asinFromHref } from './extract-cart';
import {
  AMAZON_ORIGIN,
  ORDER_CONFIRMATION_PATH,
  ORDER_CONTAINER_SELECTORS,
  ORDER_DETAILS_PATH,
  ORDER_EXCLUDED_REGIONS,
  ORDER_HEADER_CELL_SELECTORS,
  ORDER_HISTORY_PATH,
  ORDER_ID_PATTERN,
  ORDER_ID_SELECTORS,
  ORDER_ITEM_PRICE_SELECTORS,
  ORDER_ITEM_QUANTITY_SELECTORS,
  ORDER_ITEM_SELECTORS,
  ORDER_ITEM_TITLE_SELECTORS,
  ORDER_STATUS_SELECTORS,
  PRODUCT_LINK_SELECTOR,
} from './selectors';

export function amazonOrderPageKind(url: URL): OrderPageKind | null {
  if (url.origin !== AMAZON_ORIGIN) return null;
  if (ORDER_CONFIRMATION_PATH.test(url.pathname)) return 'confirmation';
  if (ORDER_HISTORY_PATH.test(url.pathname)) return 'history';
  if (ORDER_DETAILS_PATH.test(url.pathname)) return 'details';
  return null;
}

/**
 * Reads purchased item rows from Amazon order pages. Only the order number,
 * the "Order placed" header cell, shipment status, and item rows are read;
 * recipient/address, payment, account, and form regions are skipped.
 */
export function extractAmazonOrders(doc: Document, now: Date): ObservedOrderItem[] {
  const containers = findAll(doc, ORDER_CONTAINER_SELECTORS);
  const roots = containers.length > 0 ? containers : [doc.querySelector('main, #a-page') ?? doc.body];
  const items: ObservedOrderItem[] = [];
  for (const root of roots) {
    const orderId = ORDER_ID_PATTERN.exec(textOf(first(root, ORDER_ID_SELECTORS)))?.[1] ?? null;
    const orderDate = orderPlacedDate(root) ?? (containers.length === 0 ? localIsoDate(now) : null);
    const status = statusFrom(textOf(first(root, ORDER_STATUS_SELECTORS)));
    for (const row of findAll(root, ORDER_ITEM_SELECTORS)) {
      const link = row.querySelector(PRODUCT_LINK_SELECTOR);
      const title = cleanText(first(row, ORDER_ITEM_TITLE_SELECTORS)?.textContent) ?? cleanText(link?.textContent);
      if (!title) continue;
      const quantity = /(\d{1,3})/.exec(textOf(first(row, ORDER_ITEM_QUANTITY_SELECTORS)))?.[1];
      const unitPrice = findAllPricesInCents(textOf(first(row, ORDER_ITEM_PRICE_SELECTORS)))[0] ?? null;
      const qty = quantity ? Number(quantity) : 1;
      items.push({
        title: title.slice(0, 300),
        retailerItemId: asinFromHref(link?.getAttribute('href')) ?? null,
        quantity: qty,
        linePriceCents: unitPrice !== null ? unitPrice * qty : null,
        orderId,
        orderDate,
        status,
      });
    }
  }
  return items.slice(0, 200);
}

function orderPlacedDate(root: Element): string | null {
  for (const cell of findAll(root, ORDER_HEADER_CELL_SELECTORS)) {
    const text = textOf(cell);
    const match = /order placed\s*(.+)$/i.exec(text);
    if (match) return toIsoDate(match[1]!.trim());
  }
  return null;
}

function statusFrom(text: string): ObservedOrderItem['status'] {
  if (/cancel/i.test(text)) return 'canceled';
  if (/refund/i.test(text)) return 'refunded';
  if (/return/i.test(text)) return 'returned';
  return 'purchased';
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
  return findAll(root, selectors)[0] ?? null;
}

function textOf(el: Element | null): string {
  return cleanText(el?.textContent) ?? '';
}
