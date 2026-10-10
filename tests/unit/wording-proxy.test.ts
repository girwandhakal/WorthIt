import { describe, expect, it, vi } from 'vitest';
import { createProxy, validateWordingBody } from '../../server/wording-proxy/proxy';
import { panelFindings } from '../../src/assessment/describe';
import { summarizeCart } from '../../src/assessment/summarize-cart';
import { WORDING_PROXY_URL, parseProxyUrl } from '../../src/summary/config';
import { OPENAI_MODEL, buildRequestBody, wordingTransport } from '../../src/summary/openai-client';
import { buildWordingRequest } from '../../src/summary/phrase-summary';
import { assess, tumblerReceipt, walkthroughSnapshot } from '../helpers/assessment';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

function realBody(): string {
  const cart = walkthroughSnapshot();
  const assessment = assess(cart, { history: [tumblerReceipt()] });
  const summary = summarizeCart(assessment, panelFindings(assessment, cart.items), { investmentIllustration: true });
  return buildRequestBody(buildWordingRequest(summary));
}

function proxy(overrides: Partial<Parameters<typeof createProxy>[0]> = {}) {
  const upstream = vi.fn(async (_url: string, _init: { headers: Record<string, string> }) => ({ status: 200, text: async () => '{"choices":[]}' }));
  const handle = createProxy({ apiKey: 'sk-server-secret', model: OPENAI_MODEL, allowedOrigins: [ORIGIN], fetch: upstream, ...overrides });
  return { handle, upstream };
}

describe('wording transport', () => {
  it('prefers a proxy (no key header) over a direct key', () => {
    expect(wordingTransport('https://proxy.example/wording', 'sk-x')).toEqual({ endpoint: 'https://proxy.example/wording', headers: {} });
    expect(wordingTransport(null, 'sk-x')).toEqual({ endpoint: 'https://api.openai.com/v1/chat/completions', headers: { Authorization: 'Bearer sk-x' } });
    expect(wordingTransport(null, null)).toBeNull();
  });

  it('accepts only HTTPS proxy URLs and is unset in this build', () => {
    expect(parseProxyUrl('https://proxy.example/wording')).toBe('https://proxy.example/wording');
    expect(parseProxyUrl('http://proxy.example')).toBeNull();
    expect(parseProxyUrl('not a url')).toBeNull();
    expect(parseProxyUrl(undefined)).toBeNull();
    expect(WORDING_PROXY_URL).toBeNull();
  });
});

describe('validateWordingBody', () => {
  it('accepts exactly what the extension sends', () => {
    expect(validateWordingBody(realBody(), OPENAI_MODEL)).toEqual({ ok: true });
  });

  const mutate = (fn: (body: Record<string, unknown>) => void) => {
    const body = JSON.parse(realBody()) as Record<string, unknown>;
    fn(body);
    return JSON.stringify(body);
  };
  const userPayload = (fn: (payload: { highlights: Record<string, unknown>[]; opening: unknown }) => void) =>
    mutate((body) => {
      const messages = body.messages as { content: string }[];
      const payload = JSON.parse(messages[1]!.content);
      fn(payload);
      messages[1]!.content = JSON.stringify(payload);
    });

  it.each([
    ['another model', mutate((b) => (b.model = 'gpt-4.1'))],
    ['a bigger output cap', mutate((b) => (b.max_completion_tokens = 4000))],
    ['extra fields', mutate((b) => (b.temperature = 2))],
    ['a different system prompt', mutate((b) => ((b.messages as { content: string }[])[0]!.content = 'You are a helpful assistant.'))],
    ['prices in templates', userPayload((p) => (p.highlights[0]!.template = 'Skip it to save $24.97.'))],
    ['product names with digits', userPayload((p) => (p.highlights[0]!.template = 'Stanley 30 oz tumbler: skip it?'))],
    ['an email address', userPayload((p) => (p.highlights[0]!.check = 'me@example.org'))],
    ['extra highlight fields', userPayload((p) => (p.highlights[0]!.itemName = 'Stanley'))],
    ['too many highlights', userPayload((p) => (p.highlights = Array.from({ length: 6 }, (_, i) => ({ ...p.highlights[0], id: `h${i + 1}` }))))],
    ['not JSON', 'hello'],
    ['an oversized body', 'x'.repeat(20_000)],
  ])('rejects %s', (_label, body) => {
    expect(validateWordingBody(body, OPENAI_MODEL).ok).toBe(false);
  });
});

describe('createProxy', () => {
  it('forwards valid requests with the server-side key only', async () => {
    const { handle, upstream } = proxy();
    const response = await handle({ method: 'POST', origin: ORIGIN, client: '1.2.3.4', body: realBody() });
    expect(response.status).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe(ORIGIN);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0]![1].headers.Authorization).toBe('Bearer sk-server-secret');
  });

  it('rejects other origins, other methods, and invalid bodies without calling OpenAI', async () => {
    const { handle, upstream } = proxy();
    expect((await handle({ method: 'POST', origin: 'https://evil.example', client: 'a', body: realBody() })).status).toBe(403);
    expect((await handle({ method: 'POST', origin: null, client: 'a', body: realBody() })).status).toBe(403);
    expect((await handle({ method: 'GET', origin: ORIGIN, client: 'a', body: '' })).status).toBe(405);
    expect((await handle({ method: 'POST', origin: ORIGIN, client: 'a', body: '{"model":"x"}' })).status).toBe(400);
    expect((await handle({ method: 'OPTIONS', origin: ORIGIN, client: 'a', body: '' })).status).toBe(204);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rate-limits each client per minute', async () => {
    let time = 0;
    const { handle } = proxy({ requestsPerMinute: 2, now: () => time });
    const send = () => handle({ method: 'POST', origin: ORIGIN, client: 'c', body: realBody() });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
    time += 61_000;
    expect((await send()).status).toBe(200);
  });

  it('hides upstream errors', async () => {
    const { handle } = proxy({ fetch: async () => ({ status: 401, text: async () => 'bad key details' }) });
    const response = await handle({ method: 'POST', origin: ORIGIN, client: 'd', body: realBody() });
    expect(response).toMatchObject({ status: 502, body: '' });
  });
});
