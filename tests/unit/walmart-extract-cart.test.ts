import { describe, expect, it } from 'vitest';
import { walmartAdapter } from '../../src/adapters/walmart';
import { extractWalmartCart, itemIdFromHref } from '../../src/adapters/walmart/extract-cart';
import { cartSnapshotSchema } from '../../src/domain/cart';
import { loadRetailerDocument } from '../helpers/fixtures';

const CART_URL = new URL('https://www.walmart.com/cart');
const NOW = new Date('2026-10-10T12:00:00Z');

function extract(file: string) {
  return extractWalmartCart(loadRetailerDocument('walmart', file), CART_URL, NOW);
}

describe('walmart cart route', () => {
  it.each([
    ['https://www.walmart.com/cart', true],
    ['https://www.walmart.com/cart/', true],
    ['https://www.walmart.com/cart?source=pac', true],
    ['https://www.walmart.com/checkout', false],
    ['https://www.walmart.com/checkout/review-order', false],
    ['https://www.walmart.com/ip/123456', false],
    ['https://www.walmart.com/cart/checkout', false],
    ['https://www.walmart.com.evil.example/cart', false],
    ['https://walmart.com/cart', false],
  ])('%s -> %s', (url, expected) => {
    expect(walmartAdapter.isCartRoute(new URL(url))).toBe(expected);
  });
});

describe('itemIdFromHref', () => {
  it.each([
    ['/ip/Horizon-Organic/10309701', '10309701'],
    ['https://www.walmart.com/ip/Eggs/10324125?classType=REGULAR', '10324125'],
    ['/ip/10306800', '10306800'],
    ['/ip/Name-Only', undefined],
    [null, undefined],
  ])('%s -> %s', (href, id) => {
    expect(itemIdFromHref(href)).toBe(id);
  });
});

describe('extractWalmartCart', () => {
  it('reads every active line of a mixed cart and skips saved-for-later', () => {
    const snapshot = extract('cart-mixed.html');
    expect(cartSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.items).toHaveLength(7);
    expect(snapshot.items.map((item) => item.retailerItemId)).toEqual([
      '10309701',
      '47088920',
      '5308263928',
      '15610624',
      '18256507800',
      '17741466139',
      '656700117',
    ]);
    expect(snapshot.items.map((item) => item.linePriceCents)).toEqual([596, 298, 797, 297, 2497, 397, 497]);
    expect(snapshot.items.every((item) => item.quantity === 1 && item.confidence === 'high')).toBe(true);
    expect(snapshot.subtotalCents).toBe(5379);
    expect(snapshot.items[0]).toMatchObject({
      key: 'walmart:10309701',
      title: 'Horizon Organic Vitamin D Whole Milk, 64 fl oz',
      productUrl: 'https://www.walmart.com/ip/Horizon-Organic-Vitamin-D-Whole-Milk-64-fl-oz/10309701',
      unitPriceCents: 596,
      priceSource: 'line_price',
      currency: 'USD',
      issues: [],
    });
  });

  it('reads product thumbnails only from Walmart’s image CDN', () => {
    const items = extract('cart-mixed.html').items;
    const image = (id: string) => items.find((item) => item.retailerItemId === id)?.imageUrl;
    expect(image('18256507800')).toBe('https://i5.walmartimages.com/seo/Stanley-Quencher-H2-0-FlowState-Tumbler-30-oz_fixture.jpeg?odnHeight=117&odnWidth=117&odnBg=FFFFFF');
    // A lazy-loaded image: the placeholder data URI is skipped and data-src is used.
    expect(image('656700117')).toBe('https://i5.walmartimages.com/asr/skittles-fixture.jpeg');
    // Another host is never loaded.
    expect(image('17741466139')).toBeNull();
    expect(image('10309701')).toBeNull();
  });

  it('records a quantity change and keeps the displayed line price', () => {
    const doc = loadRetailerDocument('walmart', 'cart-mixed.html');
    const firstLine = doc.querySelector('[data-testid="cart-line-item"]')!;
    firstLine.querySelector('select')!.value = '3';
    firstLine.querySelector('[data-testid="line-price"] span')!.textContent = '$17.88';
    const item = extractWalmartCart(doc, CART_URL, NOW).items[0]!;
    expect(item.quantity).toBe(3);
    expect(item.linePriceCents).toBe(1788);
    expect(item.unitPriceCents).toBe(596);
  });

  it('falls back to structural heuristics, handling discounts and per-unit prices', () => {
    const snapshot = extract('cart-heuristic.html');
    expect(snapshot.items).toHaveLength(2);
    const [eggs, beans] = snapshot.items;
    expect(eggs).toMatchObject({
      retailerItemId: '10324125',
      title: "Eggland's Best Large White Eggs, 12 Count",
      quantity: 2,
      linePriceCents: 774,
      unitPriceCents: 387,
      wasLinePriceCents: 850,
      productUrl: 'https://www.walmart.com/ip/Egglands-Best-Large-White-Eggs-12-Count/10324125',
      confidence: 'high',
    });
    expect(beans).toMatchObject({ retailerItemId: '10306800', quantity: 1, linePriceCents: 153, issues: [] });
  });

  it('marks missing and ambiguous data instead of guessing', () => {
    const snapshot = extract('cart-missing-data.html');
    const byId = Object.fromEntries(snapshot.items.map((item) => [item.retailerItemId, item]));
    expect(byId['10309153']).toMatchObject({ linePriceCents: 1_88, issues: [], confidence: 'high' });
    expect(byId['15529427']).toMatchObject({
      linePriceCents: null,
      priceSource: 'unknown',
      issues: ['missing_price'],
      confidence: 'partial',
    });
    expect(byId['15754607']).toMatchObject({ title: null, issues: ['missing_title'], linePriceCents: 557 });
    expect(byId['578550306']).toMatchObject({ linePriceCents: null, issues: ['ambiguous_price'] });
    expect(byId['37858875']!.issues).toEqual(expect.arrayContaining(['unavailable', 'missing_quantity']));
  });

  it('ignores the Worth It panel host when reading the page', () => {
    const doc = loadRetailerDocument('walmart', 'cart-normal.html');
    const host = doc.createElement('worth-it-panel');
    host.innerHTML = '<div data-testid="cart-line-item"><a href="/ip/x/123456">Fake</a> $9.99</div>';
    doc.body.append(host);
    expect(extractWalmartCart(doc, CART_URL, NOW).items).toHaveLength(3);
  });

  it('returns an empty snapshot for an empty cart', () => {
    const doc = new DOMParser().parseFromString('<main><h1>Your cart is empty</h1></main>', 'text/html');
    const snapshot = extractWalmartCart(doc, CART_URL, NOW);
    expect(snapshot.items).toEqual([]);
    expect(snapshot.subtotalCents).toBeNull();
  });

  it('never mutates the page', () => {
    const doc = loadRetailerDocument('walmart', 'cart-mixed.html');
    const before = doc.documentElement.outerHTML;
    extractWalmartCart(doc, CART_URL, NOW);
    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe('live walmart.com cart markup (transcribed 2026-10-10)', () => {
  const snapshot = () => extract('cart-live-2026-10.html');

  it('reads each list row inside a shared tile container with visually split prices', () => {
    const cart = extract('cart-cheese-2026-10.html');
    expect(cart.items).toHaveLength(2);
    expect(cart.items[0]).toMatchObject({
      retailerItemId: '43981978',
      title: 'Kraft Natural Mild Cheddar Shredded Cheese, 16 oz Bag',
      quantity: 1,
      linePriceCents: 564,
      unitPriceCents: 564,
      confidence: 'high',
      issues: [],
    });
    expect(cart.items[1]).toMatchObject({ retailerItemId: '10309701', quantity: 1, linePriceCents: 596, issues: [] });
  });

  it('keeps each grouped row’s quantity and unreadable price independent', () => {
    const doc = loadRetailerDocument('walmart', 'cart-cheese-2026-10.html');
    const rows = doc.querySelectorAll('li');
    rows[0]!.querySelector('.ld_Ec + [aria-hidden]')!.parentElement!.textContent = 'Price unavailable';
    rows[1]!.querySelector('[data-testid="quantity-label"]')!.textContent = '2';
    rows[1]!.querySelector('.column2 .ld_Ec')!.textContent = '$11.92';
    const cart = extractWalmartCart(doc, CART_URL, NOW);
    expect(cart.items[0]).toMatchObject({ quantity: 1, linePriceCents: null, issues: ['missing_price'] });
    expect(cart.items[1]).toMatchObject({ quantity: 2, linePriceCents: 1192, unitPriceCents: 596, issues: [] });
  });

  it('keeps separate grouped rows even when they contain the same product', () => {
    const doc = loadRetailerDocument('walmart', 'cart-cheese-2026-10.html');
    const first = doc.querySelector('li')!;
    first.parentElement!.append(first.cloneNode(true));
    expect(extractWalmartCart(doc, CART_URL, NOW).items.map((item) => item.key)).toEqual([
      'walmart:43981978', 'walmart:10309701', 'walmart:43981978#2',
    ]);
  });

  it('reads product tiles with quantity steppers and ignores recommendation carousels', () => {
    const items = snapshot().items;
    expect(items.map((item) => [item.retailerItemId, item.title, item.quantity, item.linePriceCents, item.unitPriceCents])).toEqual([
      ['10309701', 'Horizon Organic Vitamin D Whole Milk, Vitamin D Whole, 64 fl oz Carton', 1, 596, 596],
      ['18256507800', 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz', 2, 4994, 2497],
    ]);
    expect(items.every((item) => item.issues.length === 0 && item.confidence === 'high')).toBe(true);
  });

  it('reads the item count shown beside the heading', () => {
    expect(snapshot().displayedItemCount).toBe(3);
  });

  it('matches what Walmart says (2 lines, 3 units), so no unread-lines warning', async () => {
    const { unreadLinesFinding } = await import('../../src/background/review-cart');
    expect(unreadLinesFinding(snapshot())).toBeNull();
  });
});
