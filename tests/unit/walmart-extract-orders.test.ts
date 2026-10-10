import { describe, expect, it } from 'vitest';
import { extractWalmartOrders, walmartOrderPageKind } from '../../src/adapters/walmart/extract-orders';
import { loadRetailerDocument } from '../helpers/fixtures';

const NOW = new Date(2026, 9, 10, 12);

describe('walmartOrderPageKind', () => {
  it.each([
    ['https://www.walmart.com/orders', 'history'],
    ['https://www.walmart.com/orders/', 'history'],
    ['https://www.walmart.com/orders/2000555-12345', 'details'],
    ['https://www.walmart.com/checkout/thankyou', 'confirmation'],
    ['https://www.walmart.com/checkout', null],
    ['https://www.walmart.com/checkout/review-order', null],
    ['https://www.walmart.com/cart', null],
    ['https://www.walmart.com/account/profile', null],
  ])('%s -> %s', (url, kind) => {
    expect(walmartOrderPageKind(new URL(url))).toBe(kind);
  });
});

describe('extractWalmartOrders', () => {
  it('reads only item rows from the purchase-history page', () => {
    const items = extractWalmartOrders(loadRetailerDocument('walmart', 'orders-history.html'), NOW);
    expect(items).toEqual([
      {
        title: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
        retailerItemId: '18256507800',
        quantity: 1,
        linePriceCents: 2497,
        orderId: '2000555-12345',
        orderDate: '2026-09-20',
        status: 'purchased',
      },
      {
        title: 'Great Value Large White Eggs, 12 Count',
        retailerItemId: '145051970',
        quantity: 2,
        linePriceCents: 334,
        orderId: '2000555-12345',
        orderDate: '2026-09-20',
        status: 'purchased',
      },
      {
        title: 'Monster 16.4 ft LED Strip Lights',
        retailerItemId: '18110413708',
        quantity: 1,
        linePriceCents: 1488,
        orderId: '2000999-11111',
        orderDate: '2026-08-30',
        status: 'canceled',
      },
    ]);
  });

  it('never reads payment, address, account, or sign-in content', () => {
    for (const file of ['orders-history.html', 'order-confirmation.html']) {
      const output = JSON.stringify(extractWalmartOrders(loadRetailerDocument('walmart', file), NOW));
      expect(output).not.toMatch(/SENTINEL|Visa|Fictional Way/);
    }
  });

  it('does not query text inside excluded regions', () => {
    const doc = loadRetailerDocument('walmart', 'orders-history.html');
    const read: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true,
      get(this: Node) {
        read.push(descriptor.get!.call(this) as string);
        return descriptor.get!.call(this);
      },
    });
    try {
      extractWalmartOrders(doc, NOW);
    } finally {
      Object.defineProperty(Node.prototype, 'textContent', descriptor);
    }
    expect(read.join('\n')).not.toContain('SENTINEL');
  });

  it('reads the order confirmation page, leaving unknown prices unknown', () => {
    const items = extractWalmartOrders(loadRetailerDocument('walmart', 'order-confirmation.html'), NOW);
    expect(items).toEqual([
      expect.objectContaining({ retailerItemId: '10309701', linePriceCents: 596, orderId: '2000777-22222', orderDate: '2026-10-09' }),
      expect.objectContaining({ retailerItemId: '17741466139', quantity: 1, linePriceCents: null }),
    ]);
  });
});
