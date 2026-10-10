import { CRITERION_LABELS } from '../domain/finding';
import type { CartSummary, ReviewFinding } from '../domain/review';
import { requestWording, type PostLike, type WordingRequest, type WordingResponse, type WordingTransport } from './openai-client';
import { INGREDIENT_CLAIM_TEMPLATES, PHRASABLE, TEMPLATES, fill } from './templates';
import { validateRephrasing } from './validate-phrasing';

export interface WordingCache {
  get(hash: string): Promise<WordingResponse | null>;
  set(hash: string, value: WordingResponse): Promise<void>;
}

export interface PhraseDeps {
  /** Null when there is no key and no proxy: templates are used. */
  getTransport: () => Promise<WordingTransport | null>;
  post: PostLike;
  cache: WordingCache;
}

const CHECK_FOR_KIND: Record<string, keyof typeof CRITERION_LABELS> = {
  skip_redundant: 'repeat_purchase',
  repeat_question: 'repeat_purchase',
  skip_novelty: 'purpose',
  cheaper_alternative: 'store_brand',
};

/**
 * The minimized payload: finding kinds, check names, and placeholder templates.
 * Highlights are identified by position (h1…), not item keys, so no product
 * IDs, names, prices, history, or settings are ever included.
 */
export function buildWordingRequest(summary: CartSummary): WordingRequest {
  const phrasable = summary.highlights.filter((finding) => finding.wording && PHRASABLE.includes(finding.wording.template));
  return {
    opening: summary.opening && summary.highlights.some((f) => f.kind !== 'uncertain') ? { template: TEMPLATES.opening } : null,
    highlights: phrasable.map((finding) => ({
      id: `h${summary.highlights.indexOf(finding) + 1}`,
      kind: finding.kind,
      check: CRITERION_LABELS[CHECK_FOR_KIND[finding.kind] ?? 'store_brand'],
      template: TEMPLATES[finding.wording!.template],
    })),
  };
}

/** FNV-1a hash of the request, for caching accepted wording across rerenders. */
export function hashRequest(request: WordingRequest): string {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(request)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

/**
 * Optionally rephrases the opening and highlight sentences. Every candidate is
 * validated against its template and filled with verified values in code;
 * anything missing or invalid keeps the reviewed template wording. Numbers,
 * the added-sugar note, notes, and the investment sentence are never sent.
 */
export async function phraseSummary(summary: CartSummary, deps: PhraseDeps): Promise<CartSummary> {
  const request = buildWordingRequest(summary);
  if (!request.opening && request.highlights.length === 0) return summary;
  const transport = await deps.getTransport().catch(() => null);
  if (!transport) return summary;

  const hash = hashRequest(request);
  let response = await deps.cache.get(hash).catch(() => null);
  if (!response) {
    response = await requestWording(deps.post, transport, request);
    if (!response) return summary;
    await deps.cache.set(hash, response).catch(() => undefined);
  }

  let applied = false;
  let opening = summary.opening;
  if (request.opening) {
    const valid = validateRephrasing(TEMPLATES.opening, response.opening, { allowIngredientClaims: false });
    const countPhrase = /^Before you check out, (.+) worth a second thought\.$/.exec(summary.opening)?.[1];
    if (valid && countPhrase) {
      opening = fill(valid, { count_phrase: countPhrase });
      applied = true;
    }
  }

  const highlights = summary.highlights.map((finding, index): ReviewFinding => {
    if (!finding.wording) return finding;
    const candidate = response.highlights.find((entry) => entry.id === `h${index + 1}`)?.text;
    const template = TEMPLATES[finding.wording.template];
    const valid = validateRephrasing(template, candidate, {
      allowIngredientClaims: INGREDIENT_CLAIM_TEMPLATES.includes(finding.wording.template),
    });
    if (!valid) return finding;
    applied = true;
    return { ...finding, text: fill(valid, finding.wording.slots) };
  });

  return applied ? { ...summary, opening, highlights, wordingSource: 'openai' } : summary;
}
