import type { ReviewFinding, ReviewFindingKind } from '../../domain/review';

/** The two- or three-word headline for each kind of finding; the reviewed sentence sits under it. */
export const VERDICTS: Record<ReviewFindingKind, string> = {
  skip_redundant: 'Already have one?',
  skip_novelty: 'Probably not worth it',
  skip_toy: 'Want or need?',
  rethink: 'Do you need it?',
  decor_brand_note: 'Compare brands',
  reduce_added_sugar: 'Added sugar',
  reduce_food_concern: 'Check the label',
  cheaper_alternative: 'Cheaper swap',
  store_brand_note: 'Store brand',
  uncertain: 'Couldn’t read',
};

export type Tone = 'warm' | 'mint' | 'muted';

/** Warm for "think twice", mint for a swap that saves, muted for notes. */
export function toneOf(kind: ReviewFindingKind): Tone {
  if (kind === 'cheaper_alternative' || kind === 'store_brand_note') return 'mint';
  if (kind === 'uncertain' || kind === 'decor_brand_note') return 'muted';
  return 'warm';
}

/** What the amount means, in a few words. */
export function amountLabel(finding: ReviewFinding): string {
  return finding.kind === 'cheaper_alternative' ? 'saved with the swap' : 'off your cart if you skip it';
}

/** The store-brand item a swap suggests, when the wording names one. */
export function swapTarget(finding: ReviewFinding): string | null {
  return finding.kind === 'cheaper_alternative' ? (finding.wording?.slots.alternative ?? null) : null;
}

/**
 * Walmart's image CDN resizes on request; ask for a crisp square on white. Other URLs pass through.
 * With no size, the URL is used as the cart page loaded it, so the browser already has it.
 */
export function sizedImage(url: string | null, px: number | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (px === null || !/(^|\.)walmartimages\.com$/i.test(parsed.hostname)) return url;
    parsed.searchParams.set('odnHeight', String(px));
    parsed.searchParams.set('odnWidth', String(px));
    parsed.searchParams.set('odnBg', 'FFFFFF');
    return parsed.href;
  } catch {
    return null;
  }
}
