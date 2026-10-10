import { assessCart, type AssessmentInputs } from '../../src/assessment/assess-cart';
import { referenceProduct } from '../../src/assessment/reference/products';
import { extractWalmartCart } from '../../src/adapters/walmart/extract-cart';
import type { CartItem, CartSnapshot } from '../../src/domain/cart';
import type { ItemAssessment } from '../../src/domain/finding';
import type { ClarificationAnswer, ClarificationRecord, PurchaseRecord } from '../../src/domain/history';
import { dedupeKeyFor } from '../../src/domain/history';
import { loadRetailerDocument } from './fixtures';

export const TODAY = '2026-10-10';

/** A cart line for a reference product at its reference price (or overrides). */
export function line(itemId: string, overrides: Partial<CartItem> = {}, position = 0): CartItem {
  const reference = referenceProduct(itemId);
  const quantity = overrides.quantity ?? 1;
  const linePriceCents = overrides.linePriceCents !== undefined ? overrides.linePriceCents : (reference?.priceCents ?? 100) * quantity;
  return {
    key: `walmart:${itemId}`,
    merchant: 'walmart',
    position,
    retailerItemId: itemId,
    productUrl: `https://www.walmart.com/ip/${itemId}`,
    title: reference?.name ?? `Item ${itemId}`,
    brand: null,
    quantity,
    unitPriceCents: null,
    linePriceCents,
    wasLinePriceCents: null,
    currency: 'USD',
    priceSource: linePriceCents === null ? 'unknown' : 'line_price',
    packageSize: null,
    issues: linePriceCents === null ? ['missing_price'] : [],
    confidence: linePriceCents === null ? 'partial' : 'high',
    ...overrides,
  };
}

export function snapshot(items: CartItem[]): CartSnapshot {
  return {
    version: 1,
    merchant: 'walmart',
    pageUrl: 'https://www.walmart.com/cart',
    observedAt: '2026-10-10T12:00:00.000Z',
    items: items.map((item, position) => ({ ...item, position })),
    subtotalCents: null,
  };
}

export function walkthroughSnapshot(): CartSnapshot {
  return extractWalmartCart(loadRetailerDocument('walmart', 'cart-mixed.html'), new URL('https://www.walmart.com/cart'), new Date());
}

let recordCounter = 0;
export function purchase(title: string, purchasedOn: string, overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  const base = {
    source: 'synthetic_gmail' as const,
    merchant: 'Walmart',
    title,
    retailerItemId: null,
    orderId: null,
    purchasedOn,
    quantity: 1,
    linePriceCents: 1000,
    status: 'purchased' as const,
    description: null,
    gmailMessageId: null,
    ...overrides,
  };
  return {
    ...base,
    id: overrides.id ?? `record-${recordCounter++}`,
    incomplete: false,
    dedupeKey: dedupeKeyFor(base),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

/** The walkthrough's synthetic receipt: a 30 oz tumbler bought 20 days ago. */
export const tumblerReceipt = () =>
  purchase('Stanley Quencher H2.0 FlowState Tumbler, 30 oz', '2026-09-20', { retailerItemId: '18256507800' });

export function answer(itemId: string, value: ClarificationAnswer): ClarificationRecord {
  return {
    id: `repeat_purpose:walmart:${itemId}`,
    questionId: 'repeat_purpose',
    itemMatchKey: `walmart:${itemId}`,
    itemTitle: 'x',
    answer: value,
    answeredAt: '2026-10-10T12:00:00Z',
  };
}

export function assess(cart: CartSnapshot, inputs: Partial<AssessmentInputs> = {}) {
  return assessCart({
    snapshot: cart,
    history: [],
    clarifications: [],
    preferences: { allergens: [], dietaryPreferences: [] },
    today: TODAY,
    ...inputs,
  });
}

export function byId(items: readonly ItemAssessment[], itemId: string): ItemAssessment {
  const found = items.find((item) => item.retailerItemId === itemId);
  if (!found) throw new Error(`No assessment for ${itemId}`);
  return found;
}

export const criterion = (item: ItemAssessment, id: string) => item.criteria.find((result) => result.criterion === id)!;
