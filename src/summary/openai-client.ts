/**
 * OpenAI call for the wording assistant: directly with the owner's key in the
 * single-user hackathon build, or through a key-holding proxy in a public
 * build (src/summary/config.ts). Requests carry only finding types, check names, and
 * placeholder templates — never names, prices, history, or settings.
 */

/** Small, fast, low-cost chat model. Change here if it is retired. */
export const OPENAI_MODEL = 'gpt-4.1-mini';
export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_TIMEOUT_MS = 3000;
export const MAX_REQUEST_CHARS = 8000;
export const MAX_RESPONSE_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 400;

export interface WordingRequest {
  opening: { template: string } | null;
  highlights: { id: string; kind: string; check: string; template: string }[];
}

export interface WordingResponse {
  opening: string;
  highlights: { id: string; text: string }[];
}

/** Where wording requests go and how they authenticate. */
export interface WordingTransport {
  endpoint: string;
  headers: Record<string, string>;
}

/**
 * A configured proxy wins (it holds the key server-side; no key leaves the
 * browser). Otherwise the owner's key goes directly to OpenAI. Neither: null.
 */
export function wordingTransport(proxyUrl: string | null, apiKey: string | null): WordingTransport | null {
  if (proxyUrl) return { endpoint: proxyUrl, headers: {} };
  if (apiKey) return { endpoint: OPENAI_ENDPOINT, headers: { Authorization: `Bearer ${apiKey}` } };
  return null;
}

export type PostLike = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const SYSTEM_PROMPT = [
  'You rephrase short shopping-advice sentences for a browser extension called Worth It.',
  'Voice: a thoughtful friend. Second person, plain words, warm, never judgmental, never pushy.',
  'Each sentence must end with either a question or one gentle suggested action.',
  'Rules you must follow exactly:',
  '- Keep every {placeholder} from the template exactly once and add no new placeholders.',
  '- Do not write any numbers, prices, percentages, dates, links, or product names; placeholders supply them.',
  '- Do not add facts, health claims, quality or ingredient claims, or financial advice that the template does not state.',
  '- Keep each sentence under 200 characters.',
  'Return JSON only, matching the schema. Use the same ids you were given.',
].join('\n');

const RESPONSE_SCHEMA = {
  name: 'worth_it_wording',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['opening', 'highlights'],
    properties: {
      opening: { type: 'string' },
      highlights: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'text'],
          properties: { id: { type: 'string' }, text: { type: 'string' } },
        },
      },
    },
  },
} as const;

/** Builds the exact HTTP body sent to OpenAI (exported for tests and disclosure). */
export function buildRequestBody(request: WordingRequest): string {
  return JSON.stringify({
    model: OPENAI_MODEL,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(request) },
    ],
  });
}

/**
 * Returns the parsed wording, or null on a missing key, timeout, HTTP error,
 * oversize payload, or malformed output (callers then use the templates).
 */
export async function requestWording(
  post: PostLike,
  transport: WordingTransport,
  request: WordingRequest,
  timeoutMs = OPENAI_TIMEOUT_MS,
): Promise<WordingResponse | null> {
  const body = buildRequestBody(request);
  if (body.length > MAX_REQUEST_CHARS) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await post(transport.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...transport.headers },
      body,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_CHARS * 4) return null;
    const content = (JSON.parse(raw) as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length > MAX_RESPONSE_CHARS) return null;
    const parsed = JSON.parse(content) as Partial<WordingResponse>;
    if (typeof parsed.opening !== 'string' || !Array.isArray(parsed.highlights)) return null;
    return {
      opening: parsed.opening,
      highlights: parsed.highlights
        .filter((entry): entry is { id: string; text: string } => typeof entry?.id === 'string' && typeof entry?.text === 'string')
        .slice(0, 10),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
