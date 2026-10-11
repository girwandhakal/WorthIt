import { afterEach, describe, expect, it, vi } from 'vitest';
import { panelFindings } from '../../src/assessment/describe';
import { summarizeCart } from '../../src/assessment/summarize-cart';
import type { CartSummary } from '../../src/domain/review';
import { OPENAI_ENDPOINT, OPENAI_MODEL, wordingTransport, type PostLike, type WordingResponse } from '../../src/summary/openai-client';
import { buildWordingRequest, phraseSummary, type WordingCache } from '../../src/summary/phrase-summary';
import { TEMPLATES } from '../../src/summary/templates';
import { validateRephrasing } from '../../src/summary/validate-phrasing';
import { assess, tumblerReceipt, walkthroughSnapshot } from '../helpers/assessment';

const KEY = 'sk-test-abcdefghijklmnopqrstuvwxyz';

function walkthroughSummary(): CartSummary {
  const cart = walkthroughSnapshot();
  const assessment = assess(cart, { history: [tumblerReceipt()] });
  return summarizeCart(assessment, panelFindings(assessment, cart.items), { investmentIllustration: true });
}

function memoryCache(): WordingCache & { data: Map<string, WordingResponse> } {
  const data = new Map<string, WordingResponse>();
  return { data, get: async (hash) => data.get(hash) ?? null, set: async (hash, value) => void data.set(hash, value) };
}

/** A fake OpenAI endpoint returning `content` as the assistant message. */
function fakeOpenAi(content: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const post: PostLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    return {
      ok: status < 400,
      status,
      text: async () => JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }),
    };
  };
  return { post, calls };
}

const goodWording = {
  opening: 'Before you head to checkout, {count_phrase} worth a quick second look.',
  highlights: [
    { id: 'h1', text: 'You picked up {what} {when}. Is another one really needed? Leaving it out would save {amount}.' },
    { id: 'h2', text: 'This collectible doesn’t serve a practical purpose. Maybe skip it and keep {amount}?' },
  ],
};

describe('validateRephrasing', () => {
  const template = TEMPLATES.skip_redundant;
  const ok = (text: string, allowIngredientClaims = false) => validateRephrasing(template, text, { allowIngredientClaims });

  it('accepts a rephrasing that keeps every slot', () => {
    expect(ok('You got {what} {when}. Need another? Skipping saves {amount}.')).toBe('You got {what} {when}. Need another? Skipping saves {amount}.');
  });

  it.each([
    ['a dropped slot', 'You got {what} {when}. Need another?'],
    ['an added slot', 'You got {what} {when} for {item}. Skipping saves {amount}.'],
    ['a duplicated slot', 'You got {what} {when} {when}. Skipping saves {amount}.'],
    ['digits', 'You got {what} {when}. Skipping saves {amount}, about 2 dollars.'],
    ['money symbols', 'You got {what} {when}. Skipping saves $ {amount}.'],
    ['a link', 'You got {what} {when}. See walmart.com. Skipping saves {amount}.'],
    ['judgment', 'You got {what} {when}. Buying more is wasteful; skipping saves {amount}.'],
    ['a health claim', 'You got {what} {when}. Skipping is healthier and saves {amount}.'],
    ['an investment claim', 'You got {what} {when}. Invest the {amount} instead.'],
    ['an unsupported ingredient claim', 'You got {what} {when}. Same ingredients anyway; skipping saves {amount}.'],
    ['markup', 'You got <b>{what}</b> {when}. Skipping saves {amount}.'],
    ['a stray brace', 'You got {what} {when}. Skipping saves {amount} }.'],
    ['no ending punctuation', 'You got {what} {when} so skipping saves {amount}'],
    ['too long', `You got {what} {when}. ${'Really '.repeat(40)}skip it for {amount}.`],
    ['a non-string', 42],
  ])('rejects %s', (_label, text) => {
    expect(validateRephrasing(template, text, { allowIngredientClaims: false })).toBeNull();
  });

  it('allows ingredient wording only where the template states it', () => {
    const text = '{alternative} has similar ingredients and is about {amount} cheaper. Give the store brand a try?';
    expect(validateRephrasing(TEMPLATES.cheaper_similar, text, { allowIngredientClaims: true })).toBe(text);
    expect(validateRephrasing(TEMPLATES.cheaper_food, '{alternative} has similar ingredients for {amount} less. Try it?', { allowIngredientClaims: false })).toBeNull();
  });
});

describe('the OpenAI request', () => {
  it('contains only finding kinds, check names, and placeholder templates', async () => {
    const summary = walkthroughSummary();
    const { post, calls } = fakeOpenAi(goodWording);
    await phraseSummary(summary, { getTransport: async () => wordingTransport(null, KEY), post, cache: memoryCache() });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(OPENAI_ENDPOINT);
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = calls[0]!.body;
    expect(JSON.parse(body).model).toBe(OPENAI_MODEL);
    // No product names, prices, item IDs, history dates, or settings.
    for (const forbidden of ['Stanley', 'Squishmallows', 'Skittles', 'Horizon', 'Great Value', '24.97', '$', '18256507800', 'walmart:', '2026-', 'days ago', 'peanut', 'allerg']) {
      expect(body).not.toContain(forbidden);
    }
    // The added-sugar note is never sent for rephrasing.
    expect(body).not.toContain('This has added sugar');
    expect(buildWordingRequest(summary).highlights.map((h) => [h.id, h.kind])).toEqual([
      ['h1', 'skip_redundant'],
      ['h3', 'skip_novelty'],
    ]);
  });
});

describe('phraseSummary', () => {
  afterEach(() => vi.useRealTimers());

  it('applies validated wording and fills real values in code', async () => {
    const summary = walkthroughSummary();
    const { post } = fakeOpenAi(goodWording);
    const phrased = await phraseSummary(summary, { getTransport: async () => wordingTransport(null, KEY), post, cache: memoryCache() });
    expect(phrased.wordingSource).toBe('openai');
    expect(phrased.opening).toBe('Before you head to checkout, 3 things are worth a quick second look.');
    expect(phrased.highlights[0]!.text).toBe('You picked up this 20 days ago. Is another one really needed? Leaving it out would save $24.97.');
    // The added-sugar highlight keeps the approved fixed wording.
    expect(phrased.highlights[2]!.text).toBe(summary.highlights[2]!.text);
    // Numbers, totals, and sources are untouched.
    expect(phrased.totals).toEqual(summary.totals);
    expect(phrased.investment).toEqual(summary.investment);
    expect(phrased.highlights.map((h) => [h.id, h.amountCents, h.sources])).toEqual(summary.highlights.map((h) => [h.id, h.amountCents, h.sources]));
  });

  it('cannot add findings or change numbers: extra entries and altered values are ignored', async () => {
    const summary = walkthroughSummary();
    const { post } = fakeOpenAi({
      opening: 'Before you check out, 5 things are worth a second thought.',
      highlights: [
        { id: 'h1', text: 'You bought {what} {when}. Skipping saves $99.99.' },
        { id: 'h9', text: 'Also skip the milk entirely, it is bad.' },
      ],
    });
    const phrased = await phraseSummary(summary, { getTransport: async () => wordingTransport(null, KEY), post, cache: memoryCache() });
    expect(phrased).toEqual(summary);
  });

  it('uses templates when there is no key, without calling OpenAI', async () => {
    const { post, calls } = fakeOpenAi(goodWording);
    const summary = walkthroughSummary();
    expect(await phraseSummary(summary, { getTransport: async () => wordingTransport(null, null), post, cache: memoryCache() })).toBe(summary);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['an HTTP error', fakeOpenAi(goodWording, 500).post],
    ['malformed JSON', fakeOpenAi('not json').post],
    ['the wrong shape', fakeOpenAi({ text: 'hello' }).post],
    [
      'a network failure',
      (async () => {
        throw new TypeError('Failed to fetch');
      }) as PostLike,
    ],
  ])('falls back to templates on %s', async (_label, post) => {
    const summary = walkthroughSummary();
    expect(await phraseSummary(summary, { getTransport: async () => wordingTransport(null, KEY), post, cache: memoryCache() })).toBe(summary);
  });

  it('falls back to templates after about 3 seconds', async () => {
    vi.useFakeTimers();
    const summary = walkthroughSummary();
    const post: PostLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const pending = phraseSummary(summary, { getTransport: async () => wordingTransport(null, KEY), post, cache: memoryCache() });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe(summary);
  });

  it('caches accepted wording so rerenders do not call again', async () => {
    const cache = memoryCache();
    const { post, calls } = fakeOpenAi(goodWording);
    await phraseSummary(walkthroughSummary(), { getTransport: async () => wordingTransport(null, KEY), post, cache });
    const second = await phraseSummary(walkthroughSummary(), { getTransport: async () => wordingTransport(null, KEY), post, cache });
    expect(calls).toHaveLength(1);
    expect(second.wordingSource).toBe('openai');
  });
});
