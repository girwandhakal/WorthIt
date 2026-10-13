import { describe, expect, it } from 'vitest';
import { walmartAdapter } from '../../src/adapters/walmart';
import { extractWalmartCart, itemIdFromHref, priceTextOf, readImage } from '../../src/adapters/walmart/extract-cart';
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

describe('items with a sale price (Rollback), as walmart.com renders them (transcribed 2026-10-10)', () => {
  const cheetos = () => extract('cart-rollback-2026-10.html').items.find((item) => item.retailerItemId === '36915845')!;

  it('reads the current price, not the Was price or the amount saved', () => {
    expect(cheetos()).toMatchObject({
      title: 'Cheetos Puff Cheese Flavored Snack Chips, 8 oz',
      quantity: 1,
      linePriceCents: 397,
      unitPriceCents: 397,
      wasLinePriceCents: 443,
      priceSource: 'line_price',
      confidence: 'high',
      issues: [],
    });
  });

  it('still reads the other rows of the same four-item cart', () => {
    const cart = extract('cart-rollback-2026-10.html');
    expect(cart.items.map((item) => [item.retailerItemId, item.linePriceCents, item.issues])).toEqual([
      ['16275314128', 268, []],
      ['43981978', 564, []],
      ['10309701', 596, []],
      ['36915845', 397, []],
    ]);
    expect(cart.displayedItemCount).toBe(4);
  });

  /** One list row with the given price markup, in the same tile structure. */
  function row(priceHtml: string, quantity = 1) {
    const html = `<main><h1>Cart (1 item)</h1><div data-testid="product-tile-container"><ul><li>
      <a href="/ip/seort/36915845"><div data-testid="productName">Cheetos Puff Cheese Flavored Snack Chips, 8 oz</div></a>
      ${priceHtml}<span data-testid="quantity-label">${quantity}</span></li></ul></div></main>`;
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
    return extractWalmartCart(doc, CART_URL, NOW).items[0]!;
  }

  it('reads the line total for a quantity above one', () => {
    const item = row('<span class="ld_Ec">Current price $7.94, Was $8.86, You save $0.92</span>', 2);
    expect(item).toMatchObject({ quantity: 2, linePriceCents: 794, unitPriceCents: 397, wasLinePriceCents: 886, issues: [] });
  });

  it('reads "Now" and "Sale price" labels, and ignores the order the amounts come in', () => {
    expect(row('<span class="ld_Ec">Was $7.99, Now $5.99</span>')).toMatchObject({ linePriceCents: 599, wasLinePriceCents: 799, issues: [] });
    expect(row('<span class="ld_Ec">You save $2.00, Sale price $5.99, Reg. $7.99</span>')).toMatchObject({ linePriceCents: 599, issues: [] });
  });

  it('with no labeled current price, never mistakes a struck-through or saved amount for the price', () => {
    const item = row(
      '<span class="strike">$4.43</span><div aria-label="You save $0.46"><span>You save</span><span>$0.46</span></div>',
    );
    expect(item.linePriceCents).toBeNull();
    expect(item.issues).toEqual(['missing_price']);
  });

  it('uses the one plain amount that is left once the old price and the saving are set aside', () => {
    const item = row(
      '<span>$3.97</span><span class="strike">$4.43</span><div aria-label="You save $0.46"><span>You save</span><span>$0.46</span></div>',
    );
    expect(item).toMatchObject({ linePriceCents: 397, wasLinePriceCents: 443, issues: [] });
  });

  it('still reports two unlabeled competing prices as ambiguous instead of guessing', () => {
    const item = row('<span>$3.97</span><span>$4.99</span>');
    expect(item.linePriceCents).toBeNull();
    expect(item.issues).toEqual(['ambiguous_price']);
  });

  it('keeps per-unit prices out of the line price on a sale row', () => {
    const item = row('<span class="ld_Ec">Current price $3.97, Was $4.43, You save $0.46</span><div>49.6 ¢/oz</div><div>$0.50/oz</div>');
    expect(item).toMatchObject({ linePriceCents: 397, unitPriceCents: 50, issues: [] });
  });
});

describe('a cart with a sale item is reviewed like any other', () => {
  it('reports no unreadable price for the Rollback item', async () => {
    const { reviewCart } = await import('../../src/background/review-cart');
    const { reviewContext } = await import('../helpers/background');
    const review = reviewCart(extract('cart-rollback-2026-10.html'), reviewContext());
    const item = review.assessment.items.find((candidate) => candidate.retailerItemId === '36915845')!;
    expect(item.linePriceCents).toBe(397);
    expect(item.shareOfCartBps).not.toBeNull();
    expect(review.findings.some((finding) => finding.kind === 'uncertain')).toBe(false);
    expect(review.assessment.readableTotalCents).toBe(268 + 564 + 596 + 397);
  });
});

describe('readImage: the thumbnail Walmart shows for the line', () => {
  const line = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html; // test markup only
    return el;
  };
  const PHOTO = 'https://i5.walmartimages.com/seo/Great-Value-Whole-Milk_abc123.jpeg';

  it('prefers the product photo over a badge or icon from the same CDN, whichever comes first', () => {
    const badge = '<img src="https://i5.walmartimages.com/dfw/63fd9f59/rollback-badge.svg" alt="">';
    expect(readImage(line(`${badge}<img src="${PHOTO}?odnHeight=117">`))).toBe(`${PHOTO}?odnHeight=117`);
  });

  it('never uses an icon when the line has no product photo', () => {
    expect(readImage(line('<img src="https://i5.walmartimages.com/dfw/63fd9f59/pickup-icon.svg" alt="">'))).toBeNull();
  });

  it('reads protocol-relative links, srcset entries, and <picture> sources', () => {
    expect(readImage(line('<img src="//i5.walmartimages.com/seo/Eggs_1.jpeg">'))).toBe('https://i5.walmartimages.com/seo/Eggs_1.jpeg');
    expect(readImage(line('<img srcset="https://i5.walmartimages.com/seo/Eggs_2.jpeg 1x, https://i5.walmartimages.com/seo/Eggs_2b.jpeg 2x">'))).toBe(
      'https://i5.walmartimages.com/seo/Eggs_2.jpeg',
    );
    expect(readImage(line('<picture><source srcset="https://i5.walmartimages.com/asr/abc-3.jpeg"><img alt=""></picture>'))).toBe(
      'https://i5.walmartimages.com/asr/abc-3.jpeg',
    );
  });

  it('ignores other hosts and non-https links', () => {
    expect(readImage(line('<img src="https://tracker.example.com/seo/x.jpeg"><img src="http://i5.walmartimages.com/seo/y.jpeg">'))).toBeNull();
  });
});

describe('prices Walmart draws in pieces', () => {
  const html = (inner: string) =>
    `<!doctype html><html><body><main><h1>Cart (1 item)</h1><div data-testid="cart-line-item">
      <a href="/ip/Fresh-Hass-Avocados-Each/44390949"><span data-testid="productName">Fresh Hass Avocados, Each</span></a>
      ${inner}
      <select aria-label="Quantity"><option value="2" selected>2</option></select>
    </div></main></body></html>`;
  const read = (inner: string) => extractWalmartCart(new DOMParser().parseFromString(html(inner), 'text/html'), CART_URL, NOW).items[0]!;

  it('puts a split price back together: "$", "0", "73" is $0.73, not $73', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>$</span><span>0</span><span>73</span>';
    expect(priceTextOf(el)).toBe('$0.73');
    el.innerHTML = 'Now <span>$</span><span>1,347</span><span>00</span>';
    expect(priceTextOf(el)).toBe('Now $1,347.00');
    el.innerHTML = '<span>$4.18</span>';
    expect(priceTextOf(el)).toBe('$4.18');
  });

  it('reads the line price from a split-price hook', () => {
    const item = read('<div data-testid="line-price"><span>$</span><span>1</span><span>46</span></div>');
    expect(item.linePriceCents).toBe(146);
    expect(item.quantity).toBe(2);
    expect(item.unitPriceCents).toBe(73);
    expect(item.issues).toEqual([]);
  });

  it('is not confused by a price written twice (once with its decimal point squashed out)', () => {
    const item = read('<div><span aria-label="current price $0.73">$0.73</span><span class="sr">$073</span></div>');
    expect(item.linePriceCents).toBe(73);
    expect(item.issues).toEqual([]);
  });

  it('reads an "each (est.)" price once, not as two prices', () => {
    const item = read('<div><span>Price $0.20 each (est.)</span><span>$020</span><span>50.0 ¢/lb</span></div>');
    expect(item.linePriceCents).toBe(20);
    expect(item.issues).toEqual([]);
  });
});

describe('a row with a reward or offer next to its price (real Walmart markup, Oct 2026)', () => {
  /** One row of the live cart: the price shown twice (text and split spans), then a Walmart Cash offer. */
  const row = (promo: string) => `<li>
    <h4>Blue Bunny Vanilla Bean Flavored Ice Cream, 48 fl oz</h4>
    <span data-testid="badgeTagComponent" role="group"><span>Bought 1 time</span></span>
    <a href="/ip/Blue-Bunny-Vanilla-Bean-Flavored-Ice-Cream-48-fl-oz/10449587" aria-label="Blue Bunny Vanilla Bean Flavored Ice Cream, 48 fl oz, 1 in cart">
      <img data-testid="productTileImage" src="https://i5.walmartimages.com/seo/Blue-Bunny-Vanilla_abc.jpeg" alt="">
    </a>
    <div><span>$3.87</span><div aria-hidden="true"><span>$</span><span>3</span><span>87</span></div></div>
    <a href="/ip/Blue-Bunny-Vanilla-Bean-Flavored-Ice-Cream-48-fl-oz/10449587"><div data-testid="productName"><span>Blue Bunny Vanilla Bean Flavored Ice Cream, 48 fl oz</span></div></a>
    ${promo}
    <button aria-label="Decrease quantity Blue Bunny Vanilla Bean Flavored Ice Cream, 48 fl oz, Current Quantity 1"></button>
    <button aria-label="Increase quantity Blue Bunny Vanilla Bean Flavored Ice Cream, 48 fl oz, Current Quantity 1"></button>
    <button aria-label="Remove Blue Bunny Vanilla Bean Flavored Ice Cream, 48 fl oz">Remove</button>
  </li>`;
  const cart = (promo: string) =>
    `<!doctype html><html><body><main><h1>Cart (1 item)</h1><section data-testid="product-tile-container"><ul>${row(promo)}</ul></section></main></body></html>`;
  const read = (promo: string) => extractWalmartCart(new DOMParser().parseFromString(cart(promo), 'text/html'), CART_URL, NOW).items[0]!;

  it.each([
    ['Walmart Cash', '<div><label aria-label="Get $2.00 Walmart Cash Walmart Plus, Manufacturer offer">Get $2.00 Walmart Cash</label><div>Manufacturer offer | Buy 2</div></div>'],
    ['cash back', '<div><span>Earn $1.50 cash back</span></div>'],
    ['a coupon', '<div><span>Clip coupon: $0.50 off</span></div>'],
    ['a rebate', '<div><span>$2.00 rebate with purchase</span></div>'],
  ])('reads the price, not the amount from %s', (_name, promo) => {
    const item = read(promo);
    expect(item.linePriceCents).toBe(387);
    expect(item.quantity).toBe(1);
    expect(item.issues).toEqual([]);
  });

  it('still reports an honestly ambiguous price as unknown', () => {
    const item = read('<div><span>$5.00</span></div>');
    expect(item.linePriceCents).toBeNull();
    expect(item.issues).toContain('ambiguous_price');
  });
});

describe('items that ship are in a section of their own', () => {
  const row = (id: string, name: string, price: string, hook: string) => `
    <li ${hook}>
      <a href="/ip/${name.replace(/ /g, '-')}/${id}"><span>${name}</span></a>
      <div>Current price $${price}</div>
      <select aria-label="Quantity"><option value="1" selected>1</option></select>
    </li>`;
  const page = (shipping: string) =>
    new DOMParser().parseFromString(
      `<html><body><main>
        <h1>Cart (3 items)</h1>
        <section aria-label="Delivery from store"><ul>
          ${row('10309701', 'Horizon Organic Whole Milk', '4.99', 'data-testid="product-tile-container"')}
          ${row('145051970', 'Great Value Large Eggs', '3.12', 'data-testid="product-tile-container"')}
        </ul></section>
        <section aria-label="Shipping"><ul>${shipping}</ul></section>
        <div data-testid="you-may-like"><a href="/ip/Some-Other-Thing/5550001">Some Other Thing</a><div>$9.99</div><button>Add</button></div>
      </main></body></html>`,
      'text/html',
    );
  const read = (doc: Document) => extractWalmartCart(doc, CART_URL, NOW).items.map((item) => [item.retailerItemId, item.quantity, item.linePriceCents]);

  it('reads the shipped item even though its section has no known row hook', () => {
    const doc = page(row('101010101', 'Barbie Dream Besties Doll', '19.97', 'class="ship-row"'));
    expect(read(doc)).toEqual([
      ['10309701', 1, 499],
      ['145051970', 1, 312],
      ['101010101', 1, 1997],
    ]);
  });

  it('keeps the order of the page, and does not take a recommendation tile for a cart item', () => {
    const doc = page(row('101010101', 'Barbie Dream Besties Doll', '19.97', 'class="ship-row"') + row('202020202', 'Glass Vase', '12.99', 'class="ship-row"'));
    expect(read(doc).map(([id]) => id)).toEqual(['10309701', '145051970', '101010101', '202020202']);
  });
});
