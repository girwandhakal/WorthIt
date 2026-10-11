import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BLOCKED_COOLDOWN_MS,
  BlockedError,
  MAX_PAGES_PER_REVIEW,
  knownProductFacts,
  loadProductFacts,
  parseAmount,
  parseProductPage,
  type Breaker,
} from '../../src/adapters/walmart/product-facts';
import type { ProductFacts } from '../../src/domain/product-facts';
import { PAGES, productPageHtml } from '../helpers/product-page';

describe('parseProductPage', () => {
  it('reads category, ingredients, and the Nutrition Facts that matter', () => {
    const facts = parseProductPage(productPageHtml(PAGES.skittles), '656700117')!;
    expect(facts.name).toMatch(/Skittles/);
    expect(facts.categoryPath).toEqual(['Food', 'Candy', 'Fruit Flavored & Sour Candy', 'Fruit Flavored Candy']);
    expect(facts.ingredients).toMatch(/^SUGAR, CORN SYRUP/);
    expect(facts.nutrition).toMatchObject({ addedSugarG: 21, sodiumMg: 5, transFatG: null, servingSize: '1 serving' });
  });

  it('leaves absent label fields null instead of guessing', () => {
    const facts = parseProductPage(productPageHtml(PAGES.bananas), '44390948')!;
    expect(facts.ingredients).toBe('BANANAS, RAW');
    expect(facts.nutrition).toBeNull();
    const plush = parseProductPage(productPageHtml(PAGES.plush), '17741466139')!;
    expect(plush.ingredients).toBeNull();
    expect(plush.categoryPath).toEqual(['Collectibles', 'Collectible Plush']);
  });

  it('rejects a page for a different product, a bot check, and malformed data', () => {
    expect(parseProductPage(productPageHtml(PAGES.milk), '99999999')).toBeNull();
    expect(parseProductPage('<html><body>Robot or human?</body></html>', '10309701')).toBeNull();
    expect(parseProductPage('<script id="__NEXT_DATA__" type="application/json">{not json</script>', '10309701')).toBeNull();
    expect(parseProductPage('<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>', '10309701')).toBeNull();
  });

  it('reads trans fat and added sugars from nested label rows', () => {
    const facts = parseProductPage(
      productPageHtml({
        id: '90000002',
        name: 'Test crackers',
        path: ['Food', 'Snacks'],
        ingredients: 'FLOUR',
        nutrition: { 'Total Fat': '4g', 'Trans Fat': '0.5g', Sodium: '210mg', 'Total Carbohydrate': '20g', 'Added Sugars': '2g' },
      }),
      '90000002',
    )!;
    expect(facts.nutrition).toMatchObject({ transFatG: 0.5, sodiumMg: 210, addedSugarG: 2 });
  });
});

describe('parseAmount', () => {
  it.each([
    ['21g', 'g', 21],
    ['170 mg', 'mg', 170],
    ['0g', 'g', 0],
    ['<1g', 'g', 0.5],
    ['Less than 1g', 'g', 0.5],
    ['0.5g', 'g', 0.5],
  ] as const)('%s → %s', (raw, unit, expected) => {
    expect(parseAmount(raw, unit)).toBe(expected);
  });

  it('rejects other units, percentages, and junk', () => {
    expect(parseAmount('21mg', 'g')).toBeNull();
    expect(parseAmount('42%', 'g')).toBeNull();
    expect(parseAmount('n/a', 'mg')).toBeNull();
    expect(parseAmount(undefined, 'g')).toBeNull();
  });
});

describe('loadProductFacts', () => {
  const page = (id: string) => productPageHtml({ id, name: `Item ${id}`, path: ['Food'], ingredients: 'WATER', nutrition: null });

  it('fetches each distinct valid ID once, with limited concurrency, and caches results', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchHtml = vi.fn(async (id: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return page(id);
    });
    const cache = new Map<string, ProductFacts | null>();
    const ids = ['10000001', '10000002', '10000003', '10000004', '10000005', '10000001', 'not-an-id', '../etc'];
    const facts = await loadProductFacts(ids, { fetchHtml, cache, concurrency: 2, spacingMs: 0 });
    expect(Object.keys(facts).sort()).toEqual(['10000001', '10000002', '10000003', '10000004', '10000005']);
    expect(fetchHtml).toHaveBeenCalledTimes(5);
    expect(peak).toBeLessThanOrEqual(2);

    await loadProductFacts(['10000001', '10000002'], { fetchHtml, cache, spacingMs: 0 });
    expect(fetchHtml).toHaveBeenCalledTimes(5);
  });

  it('leaves out items that fail, time out, or return an unrecognized page, without throwing', async () => {
    const fetchHtml = vi.fn(async (id: string, signal: AbortSignal) => {
      if (id === '10000001') throw new Error('offline');
      if (id === '10000002') return null;
      if (id === '10000003') return '<html>Some other page</html>';
      if (id === '10000004') return new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return page(id);
    });
    const facts = await loadProductFacts(['10000001', '10000002', '10000003', '10000004', '10000005'], { fetchHtml, pageTimeoutMs: 20, spacingMs: 0 });
    expect(Object.keys(facts)).toEqual(['10000005']);
  });

  it('stops waiting at the overall deadline', async () => {
    const fetchHtml = (_id: string, signal: AbortSignal) =>
      new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const started = Date.now();
    const facts = await loadProductFacts(['10000001', '10000002'], { fetchHtml, pageTimeoutMs: 5_000, totalTimeoutMs: 30, spacingMs: 0 });
    expect(facts).toEqual({});
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  describe('being gentle with the retailer', () => {
    const ids = (count: number) => Array.from({ length: count }, (_, index) => String(20000000 + index));

    it('stops at the first bot check and does not ask again until the cooldown passes', async () => {
      const breaker: Breaker = { trippedAt: null };
      let clock = 1_000_000;
      const fetchHtml = vi.fn(async (id: string) => (id === '20000001' ? '<html><title>Robot or human?</title></html>' : page(id)));
      const options = { fetchHtml, breaker, now: () => clock, spacingMs: 0, concurrency: 1 };

      const first = await loadProductFacts(ids(6), options);
      expect(Object.keys(first)).toEqual(['20000000']);
      expect(fetchHtml).toHaveBeenCalledTimes(2); // the good page, then the bot check; nothing after
      expect(breaker.trippedAt).toBe(clock);

      clock += 60_000;
      await loadProductFacts(ids(6), options);
      expect(fetchHtml).toHaveBeenCalledTimes(2);

      clock += BLOCKED_COOLDOWN_MS;
      await loadProductFacts(['20000009'], options);
      expect(fetchHtml).toHaveBeenCalledTimes(3);
    });

    it('treats an explicit block (HTTP 403/412/429) the same way', async () => {
      const breaker: Breaker = { trippedAt: null };
      const fetchHtml = vi.fn(async () => {
        throw new BlockedError('429');
      });
      await loadProductFacts(ids(5), { fetchHtml, breaker, spacingMs: 0, concurrency: 1 });
      expect(fetchHtml).toHaveBeenCalledTimes(1);
      expect(breaker.trippedAt).not.toBeNull();
    });

    it('never requests more than the per-review cap, and spaces requests out', async () => {
      const starts: number[] = [];
      const fetchHtml = vi.fn(async (id: string) => {
        starts.push(Date.now());
        return page(id);
      });
      const facts = await loadProductFacts(ids(MAX_PAGES_PER_REVIEW + 10), { fetchHtml, concurrency: 5, spacingMs: 0 });
      expect(fetchHtml).toHaveBeenCalledTimes(MAX_PAGES_PER_REVIEW);
      expect(Object.keys(facts)).toHaveLength(MAX_PAGES_PER_REVIEW);

      const spaced: number[] = [];
      await loadProductFacts(['30000001', '30000002', '30000003'], {
        fetchHtml: async (id) => {
          spaced.push(Date.now());
          return page(id);
        },
        concurrency: 1,
        spacingMs: 40,
      });
      expect(spaced[2]! - spaced[0]!).toBeGreaterThanOrEqual(70);
    });
  });
});

describe('loadProductFacts: overlapping and transient failures', () => {
  const page = (id: string) => productPageHtml({ id, name: 'Item ' + id, path: ['Food'], ingredients: 'WATER', nutrition: null });

  it('an overlapping review waits for in-flight pages instead of asking Walmart again', async () => {
    const fetchHtml = vi.fn(async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return page(id);
    });
    const cache = new Map<string, ProductFacts | null>();
    const [first, second] = await Promise.all([
      loadProductFacts(['40000001', '40000002'], { fetchHtml, cache, spacingMs: 0 }),
      loadProductFacts(['40000001', '40000002'], { fetchHtml, cache, spacingMs: 0 }),
    ]);
    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(Object.keys(first).sort()).toEqual(['40000001', '40000002']);
    expect(Object.keys(second).sort()).toEqual(['40000001', '40000002']);
  });

  it('retries an item after a transient error but remembers a page that does not exist', async () => {
    const cache = new Map<string, ProductFacts | null>();
    const fetchHtml = vi.fn(async (id: string): Promise<string | null> => {
      if (id === '40000003') throw new Error('HTTP 503');
      return null; // 404
    });
    await loadProductFacts(['40000003', '40000004'], { fetchHtml, cache, spacingMs: 0 });
    await loadProductFacts(['40000003', '40000004'], { fetchHtml, cache, spacingMs: 0 });
    expect(fetchHtml.mock.calls.filter(([id]) => id === '40000003')).toHaveLength(2); // transient: asked again
    expect(fetchHtml.mock.calls.filter(([id]) => id === '40000004')).toHaveLength(1); // 404: remembered
  });
});

describe('Walmart adapter product-page fetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not cache a 503, caches a 404, and stops at a 429', async () => {
    const { walmartAdapter } = await import('../../src/adapters/walmart');
    const statuses: Record<string, number> = { '50000001': 503, '50000002': 404 };
    const fetchMock = vi.fn(async (url: string) => {
      const id = url.split('/').pop()!;
      return new Response('', { status: statuses[id] ?? 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await walmartAdapter.loadProductFacts!(['50000001', '50000002']);
    await walmartAdapter.loadProductFacts!(['50000001', '50000002']);
    const calls = fetchMock.mock.calls.map(([url]) => String(url).split('/').pop());
    expect(calls.filter((id) => id === '50000001')).toHaveLength(2);
    expect(calls.filter((id) => id === '50000002')).toHaveLength(1);
  });
});

describe('knownProductFacts', () => {
  const milk = parseProductPage(productPageHtml({ ...PAGES.milk, id: '90000001' }), '90000001') as ProductFacts;

  it('returns what is cached without any request, and says whether anything is left to load', () => {
    const cache = new Map<string, ProductFacts | null>([['90000001', milk], ['90000002', null]]);
    expect(knownProductFacts(['90000001', '90000002'], cache)).toEqual({ facts: { '90000001': milk }, complete: true });
    expect(knownProductFacts(['90000001', '90000003'], cache)).toEqual({ facts: { '90000001': milk }, complete: false });
  });

  it('ignores IDs it would never request, and has nothing to load for an empty cart', () => {
    expect(knownProductFacts(['not-an-id', '1'], new Map())).toEqual({ facts: {}, complete: true });
    expect(knownProductFacts([], new Map())).toEqual({ facts: {}, complete: true });
  });
});
