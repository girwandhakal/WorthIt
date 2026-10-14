import { describe, expect, it } from 'vitest';
import { amazonAdapter } from '../../src/adapters/amazon';
import { reviewCart } from '../../src/background/review-cart';
import { cartSnapshotSchema } from '../../src/domain/cart';
import { purchase } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';
import { loadRetailerDocument } from '../helpers/fixtures';

const CART_URL = new URL('https://www.amazon.com/gp/cart/view.html?ref_=nav_cart');
const NOW = new Date('2026-10-10T12:00:00Z');
const read = (file: string) => amazonAdapter.extractCart(loadRetailerDocument('amazon', file), CART_URL, NOW);

describe('Amazon routes', () => {
  it.each([
    ['https://www.amazon.com/gp/cart/view.html', true],
    ['https://www.amazon.com/gp/cart/view.html/ref=nav_cart', true],
    ['https://www.amazon.com/cart', true],
    ['https://www.amazon.com/gp/buy/spc/handlers/display.html', false],
    ['https://www.amazon.com/checkout/p/p-123/spc', false],
    ['https://www.amazon.com/dp/B0WITEST01', false],
    ['https://www.amazon.com.evil.example/cart', false],
  ])('cart route %s -> %s', (url, expected) => {
    expect(amazonAdapter.isCartRoute(new URL(url))).toBe(expected);
  });

  it.each([
    ['https://www.amazon.com/gp/css/order-history?ref_=nav_orders_first', 'history'],
    ['https://www.amazon.com/your-orders/orders', 'history'],
    ['https://www.amazon.com/gp/your-account/order-details?orderID=112-1', 'details'],
    ['https://www.amazon.com/gp/buy/thankyou/handlers/display.html', 'confirmation'],
    ['https://www.amazon.com/gp/buy/spc/handlers/display.html', null],
    ['https://www.walmart.com/orders', null],
  ])('order page %s -> %s', (url, kind) => {
    expect(amazonAdapter.orderPageKind(new URL(url))).toBe(kind);
  });
});

describe('extractAmazonCart', () => {
  it('maps active cart rows to the shared model and skips saved items', () => {
    const snapshot = read('cart.html');
    expect(cartSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot).toMatchObject({ merchant: 'amazon', subtotalCents: 7296, displayedItemCount: 4 });
    expect(snapshot.items.map((item) => [item.key, item.quantity, item.unitPriceCents, item.linePriceCents])).toEqual([
      ['amazon:B0WITEST01', 1, 2799, 2799],
      ['amazon:B0WITEST02', 2, 1249, 2498],
      ['amazon:B0WITEST03', 1, 1999, 1999],
    ]);
    expect(snapshot.items[1]).toMatchObject({
      title: 'Amazon Basics AA Alkaline Batteries, 20 Count',
      productUrl: 'https://www.amazon.com/dp/B0WITEST02',
      wasLinePriceCents: 2998,
      priceSource: 'unit_price_times_quantity',
      confidence: 'high',
    });
  });

  it('reports missing, ambiguous, and unavailable data instead of guessing', () => {
    const snapshot = read('cart-missing-data.html');
    expect(snapshot.items.map((item) => [item.title, item.issues, item.linePriceCents])).toEqual([
      ['Item With No Price Shown', ['missing_price'], null],
      ['Item With Two Prices', ['ambiguous_price'], null],
      ['Item Without Quantity', ['missing_quantity', 'unavailable'], null],
    ]);
    expect(snapshot.items[2]!.retailerItemId).toBe('B0WITEST06');
  });

  it('reflects a rerendered quantity change', () => {
    const doc = loadRetailerDocument('amazon', 'cart.html');
    const row = doc.querySelector('[data-asin="B0WITEST01"]')!;
    row.setAttribute('data-quantity', '3');
    expect(amazonAdapter.extractCart(doc, CART_URL, NOW).items[0]).toMatchObject({ quantity: 3, linePriceCents: 8397 });
  });

});

describe('shared assessment on Amazon data (no retailer-specific rules)', () => {
  it('has no reviewed reference data, so product checks are unknown and nothing is guessed', () => {
    const review = reviewCart(read('cart.html'), reviewContext());
    expect(review.findings).toEqual([]);
    expect(review.assessment.items.every((item) => item.purposeClass === 'unknown' && item.primary === null)).toBe(true);
  });

  it('says nothing about a repeat while it cannot tell whether the item is food', () => {
    // Amazon rows carry no category and no product page is read yet, so food or not is unknown.
    const history = [purchase('Owala FreeSip Insulated Stainless Steel Water Bottle, 24 oz', '2026-09-20', { merchant: 'Amazon', retailerItemId: 'B0WITEST01' })];
    const review = reviewCart(read('cart.html'), reviewContext({ history }));
    expect(review.findings).toEqual([]);
  });

  it('flags unread lines using Amazon’s own item count', () => {
    const review = reviewCart(read('cart-missing-data.html'), reviewContext());
    expect(review.findings.at(-1)?.text).toBe(
      "Amazon shows 5 items, but Worth It could read only 3. Amazon's page may have changed, so this review may be incomplete.",
    );
  });
});

describe('extractAmazonOrders', () => {
  it('reads item rows, order numbers, dates, and status', () => {
    expect(amazonAdapter.extractOrders(loadRetailerDocument('amazon', 'orders.html'), NOW)).toEqual([
      {
        title: 'Owala FreeSip Insulated Stainless Steel Water Bottle, 24 oz',
        retailerItemId: 'B0WITEST01',
        quantity: 1,
        linePriceCents: 2799,
        orderId: '112-1234567-7654321',
        orderDate: '2026-09-20',
        status: 'purchased',
      },
      {
        title: 'Wireless Earbuds',
        retailerItemId: 'B0WITEST07',
        quantity: 2,
        linePriceCents: 3800,
        orderId: '112-7777777-1111111',
        orderDate: '2026-08-02',
        status: 'returned',
      },
    ]);
  });

  it('never reads recipient, payment, or account content', () => {
    const doc = loadRetailerDocument('amazon', 'orders.html');
    const seen: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true,
      get(this: Node) {
        const value = descriptor.get!.call(this) as string;
        seen.push(value);
        return value;
      },
    });
    try {
      amazonAdapter.extractOrders(doc, NOW);
    } finally {
      Object.defineProperty(Node.prototype, 'textContent', descriptor);
    }
    expect(seen.join('\n')).not.toContain('SENTINEL');
  });
});

