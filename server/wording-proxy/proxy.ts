/**
 * Reference wording proxy for a public Worth It release (issue #11). It holds
 * the OpenAI key server-side and forwards only well-formed Worth It wording
 * requests, so the key never ships in the extension and the endpoint can't be
 * used as a general-purpose OpenAI relay.
 *
 * Request bodies are never logged or stored.
 */

export interface ProxyConfig {
  apiKey: string;
  /** The only model the proxy will call. */
  model: string;
  /** e.g. ["chrome-extension://abcdefghijklmnopabcdefghijklmnop"] */
  allowedOrigins: readonly string[];
  fetch: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ status: number; text(): Promise<string> }>;
  requestsPerMinute?: number;
  now?: () => number;
}

export interface ProxyRequest {
  method: string;
  origin: string | null;
  /** Client identifier for rate limiting (e.g. remote address). */
  client: string;
  body: string;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
export const MAX_BODY_CHARS = 10_000;
const MAX_OUTPUT_TOKENS = 400;
const SYSTEM_PREFIX = 'You rephrase short shopping-advice sentences for a browser extension called Worth It.';

type Validation = { ok: true } | { ok: false; error: string };

/**
 * Accepts exactly the body the extension builds (src/wording/openai-client.ts):
 * the allowed model, a small output cap, the Worth It JSON schema, a Worth It
 * system prompt, and a user message holding only placeholder templates — no
 * digits, money, links, or emails, so no prices or personal data pass through.
 */
export function validateWordingBody(raw: string, model: string): Validation {
  if (raw.length > MAX_BODY_CHARS) return { ok: false, error: 'too large' };
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'not json' };
  }
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'not an object' };
  const keys = Object.keys(body).sort().join(',');
  if (keys !== 'max_completion_tokens,messages,model,response_format') return { ok: false, error: 'unexpected fields' };
  if (body.model !== model) return { ok: false, error: 'model not allowed' };
  if (!Number.isInteger(body.max_completion_tokens) || (body.max_completion_tokens as number) > MAX_OUTPUT_TOKENS) {
    return { ok: false, error: 'output cap' };
  }
  const format = body.response_format as { type?: unknown; json_schema?: { name?: unknown } } | undefined;
  if (format?.type !== 'json_schema' || format.json_schema?.name !== 'worth_it_wording') return { ok: false, error: 'schema' };

  const messages = body.messages as { role?: unknown; content?: unknown }[] | undefined;
  if (!Array.isArray(messages) || messages.length !== 2) return { ok: false, error: 'messages' };
  const [system, user] = messages;
  if (system?.role !== 'system' || typeof system.content !== 'string' || !system.content.startsWith(SYSTEM_PREFIX) || system.content.length > 2000) {
    return { ok: false, error: 'system prompt' };
  }
  if (user?.role !== 'user' || typeof user.content !== 'string') return { ok: false, error: 'user message' };

  let request: { opening?: unknown; highlights?: unknown };
  try {
    request = JSON.parse(user.content) as typeof request;
  } catch {
    return { ok: false, error: 'user payload' };
  }
  const strings: unknown[] = [];
  if (request.opening !== null) {
    const opening = request.opening as { template?: unknown } | undefined;
    if (!opening || Object.keys(opening).join() !== 'template') return { ok: false, error: 'opening' };
    strings.push(opening.template);
  }
  if (!Array.isArray(request.highlights) || request.highlights.length > 5) return { ok: false, error: 'highlights' };
  for (const highlight of request.highlights as Record<string, unknown>[]) {
    if (Object.keys(highlight).sort().join(',') !== 'check,id,kind,template') return { ok: false, error: 'highlight fields' };
    if (!/^h[1-5]$/.test(String(highlight.id))) return { ok: false, error: 'highlight id' };
    strings.push(highlight.kind, highlight.check, highlight.template);
  }
  for (const value of strings) {
    if (typeof value !== 'string' || value.length > 300) return { ok: false, error: 'field' };
    // Templates carry placeholders only; values never pass through the proxy.
    if (/\d|[$%@]|https?:|www\./i.test(value)) return { ok: false, error: 'values not allowed' };
  }
  return { ok: true };
}

export function createProxy(config: ProxyConfig): (request: ProxyRequest) => Promise<ProxyResponse> {
  const now = config.now ?? (() => Date.now());
  const limit = config.requestsPerMinute ?? 30;
  const recent = new Map<string, number[]>();

  const cors = (origin: string | null): Record<string, string> =>
    origin && config.allowedOrigins.includes(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
          Vary: 'Origin',
        }
      : {};
  const reply = (status: number, origin: string | null, body = ''): ProxyResponse => ({
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) },
    body,
  });

  return async (request) => {
    const allowed = request.origin !== null && config.allowedOrigins.includes(request.origin);
    if (request.method === 'OPTIONS') return reply(allowed ? 204 : 403, request.origin);
    if (request.method !== 'POST') return reply(405, request.origin);
    if (!allowed) return reply(403, request.origin);

    const windowStart = now() - 60_000;
    const hits = (recent.get(request.client) ?? []).filter((time) => time > windowStart);
    if (hits.length >= limit) return reply(429, request.origin);
    hits.push(now());
    recent.set(request.client, hits);

    const validation = validateWordingBody(request.body, config.model);
    if (!validation.ok) return reply(400, request.origin, JSON.stringify({ error: 'invalid request' }));

    try {
      const upstream = await config.fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: request.body,
      });
      const text = await upstream.text();
      return upstream.status === 200 ? reply(200, request.origin, text) : reply(502, request.origin);
    } catch {
      return reply(502, request.origin);
    }
  };
}
