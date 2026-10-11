import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWalmartAdapter } from '../../src/adapters/walmart';
import {
  FACTS_MAX_ENTRIES,
  FACTS_STORAGE_KEY,
  FACTS_TTL_MS,
  clearStoredFacts,
  loadStoredFacts,
  saveStoredFacts,
  type FactsStorage,
  type StoredFacts,
} from '../../src/adapters/walmart/facts-store';
import { parseProductPage } from '../../src/adapters/walmart/product-facts';
import type { ProductFacts } from '../../src/domain/product-facts';
import { PAGES, productPageHtml } from '../helpers/product-page';

const NOW = 1_800_000_000_000;
const factsFor = (id: string) => parseProductPage(productPageHtml({ ...PAGES.skittles, id }), id) as ProductFacts;

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const storage: FactsStorage = {
    get: async (key) => (data.has(key) ? { [key]: structuredClone(data.get(key)) } : {}),
    set: async (items) => void Object.entries(items).forEach(([key, value]) => data.set(key, structuredClone(value))),
    remove: async (key) => void data.delete(key),
  };
  return { storage, data };
}

describe('saved product labels', () => {
  it('round-trips readable labels with the time they were read', async () => {
    const { storage } = memoryStorage();
    await saveStoredFacts(storage, new Map([['90000001', { at: NOW - 1000, facts: factsFor('90000001') }]]), NOW);
    const loaded = await loadStoredFacts(storage, NOW);
    expect([...loaded.keys()]).toEqual(['90000001']);
    expect(loaded.get('90000001')).toEqual({ at: NOW - 1000, facts: factsFor('90000001') });
  });

  it('drops labels older than a day, from the future, or not shaped like a label', async () => {
    const good = { at: NOW - 1000, facts: factsFor('90000001') };
    const { storage } = memoryStorage({
      [FACTS_STORAGE_KEY]: {
        '90000001': good,
        '90000002': { at: NOW - FACTS_TTL_MS, facts: factsFor('90000002') },
        '90000003': { at: NOW + 60_000, facts: factsFor('90000003') },
        '90000004': { at: NOW - 1000, facts: { itemId: '90000004', ingredients: 42 } },
        // A label saved under the wrong item ID is not trusted.
        '90000005': { at: NOW - 1000, facts: factsFor('90000001') },
        '90000006': 'junk',
      },
    });
    expect([...(await loadStoredFacts(storage, NOW)).keys()]).toEqual(['90000001']);
  });

  it('treats unreadable or malformed storage as empty, and never throws', async () => {
    const broken: FactsStorage = { get: async () => Promise.reject(new Error('storage offline')), set: async () => Promise.reject(new Error('x')), remove: async () => undefined };
    expect((await loadStoredFacts(broken, NOW)).size).toBe(0);
    await expect(saveStoredFacts(broken, new Map(), NOW)).resolves.toBeUndefined();
    expect((await loadStoredFacts(memoryStorage({ [FACTS_STORAGE_KEY]: ['not', 'a', 'record'] }).storage, NOW)).size).toBe(0);
  });

  it('keeps only the newest labels up to the cap', async () => {
    const { storage, data } = memoryStorage();
    const entries: StoredFacts = new Map();
    for (let i = 0; i < FACTS_MAX_ENTRIES + 5; i++) {
      const id = String(10_000_000 + i);
      entries.set(id, { at: NOW - 10_000 + i, facts: factsFor(id) });
    }
    await saveStoredFacts(storage, entries, NOW);
    const saved = Object.keys(data.get(FACTS_STORAGE_KEY) as object);
    expect(saved).toHaveLength(FACTS_MAX_ENTRIES);
    expect(saved).not.toContain('10000000'); // the oldest went first
    expect(saved).toContain(String(10_000_000 + FACTS_MAX_ENTRIES + 4));
  });

  it('can be cleared completely', async () => {
    const { storage, data } = memoryStorage({ [FACTS_STORAGE_KEY]: { anything: 1 } });
    await clearStoredFacts(storage);
    expect(data.has(FACTS_STORAGE_KEY)).toBe(false);
  });
});

describe('Walmart adapter with saved labels', () => {
  afterEach(() => vi.unstubAllGlobals());

  const pageFor = (id: string) => new Response(productPageHtml({ ...PAGES.skittles, id }), { status: 200 });

  it('starts a repeat visit with the saved labels, reads no product page for them, and keeps their original time', async () => {
    const savedAt = NOW - 3 * 60 * 60_000;
    const { storage, data } = memoryStorage({ [FACTS_STORAGE_KEY]: { '90000001': { at: savedAt, facts: factsFor('90000001') } } });
    const fetchMock = vi.fn(async (url: string) => pageFor(String(url).split('/').pop()!));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createWalmartAdapter({ factsStorage: storage, now: () => NOW });

    // Nothing is known before the saved labels are brought in.
    expect(adapter.knownProductFacts!(['90000001']).complete).toBe(false);
    await adapter.warmUp!();
    expect(adapter.knownProductFacts!(['90000001'])).toEqual({ facts: { '90000001': factsFor('90000001') }, complete: true });

    // A cart with one saved and one new item reads only the new one.
    const facts = await adapter.loadProductFacts!(['90000001', '90000002']);
    expect(Object.keys(facts).sort()).toEqual(['90000001', '90000002']);
    expect(fetchMock.mock.calls.map(([url]) => String(url).split('/').pop())).toEqual(['90000002']);

    await vi.waitFor(() => expect(Object.keys(data.get(FACTS_STORAGE_KEY) as object).sort()).toEqual(['90000001', '90000002']));
    const saved = data.get(FACTS_STORAGE_KEY) as Record<string, { at: number }>;
    expect(saved['90000001']!.at).toBe(savedAt); // reusing a label does not extend its day
    expect(saved['90000002']!.at).toBe(NOW);
  });

  it('does not save anything when nothing new was read, and never saves an unreadable page', async () => {
    const { storage, data } = memoryStorage();
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createWalmartAdapter({ factsStorage: storage, now: () => NOW });
    await adapter.loadProductFacts!(['90000009']);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(data.has(FACTS_STORAGE_KEY)).toBe(false);
  });

  it('works without storage, keeping labels only for the life of the page', async () => {
    const fetchMock = vi.fn(async (url: string) => pageFor(String(url).split('/').pop()!));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createWalmartAdapter();
    await adapter.warmUp!();
    await adapter.loadProductFacts!(['90000001']);
    await adapter.loadProductFacts!(['90000001']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
