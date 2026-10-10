import type { Source } from '../assessment/evidence/sources';
import type { InvestmentIllustration } from '../assessment/investment';
import type { TemplateKey } from '../summary/templates';
import type { Merchant } from './cart';
import type { CartAssessment, ClarificationQuestion, Confidence, Evidence, SuggestionKind } from './finding';

/**
 * What the checkout panel renders. Built by the service worker from the
 * deterministic assessment; the content script never computes findings.
 */
export interface CartReview {
  version: 1;
  merchant: Merchant;
  itemCount: number;
  /** Items whose name, quantity, and price were all read. */
  readableCount: number;
  /** Meaningful findings and material uncertainty only, in presentation order. */
  findings: ReviewFinding[];
  /** The advisor recap: opening, up to three highlights, grouped rest, closing. */
  summary: CartSummary;
  /** The full per-item, per-criterion assessment (for "See full analysis"). */
  assessment: CartAssessment;
  /** False when there is nothing to show, prompts are off, or the shopper dismissed these findings. */
  autoOpen: boolean;
}

export type ReviewFindingKind = SuggestionKind | 'repeat_question' | 'uncertain';

export interface FindingWording {
  template: TemplateKey;
  /** Verified values for the template's `{slots}`. */
  slots: Record<string, string>;
}

export interface ReviewFinding {
  /** Stable across rerenders: `${itemKey}:${kind}`. Used for dismissal. */
  id: string;
  itemKey: string;
  /** Cart order, used to break ranking ties. */
  position: number;
  kind: ReviewFindingKind;
  itemName: string;
  /** Short advisor text built from verified fields. */
  text: string;
  /** How `text` was built, when it may be rephrased; null for fixed wording. */
  wording: FindingWording | null;
  /** Potential current-cart reduction, when this finding has one. */
  amountCents: number | null;
  question: ClarificationQuestion | null;
  /** Shown only behind "Why?". */
  why: Evidence[];
  sources: Source[];
  confidence: Confidence;
}

export interface CartSummary {
  opening: string;
  /** At most three, in deterministic ranking order. */
  highlights: ReviewFinding[];
  /** Everything else, collapsed into one expandable line. */
  grouped: { label: string; findings: ReviewFinding[] } | null;
  totals: {
    /** Each item counted once, by its primary suggestion. */
    combinedCents: number;
    /** Part of the combined total from cheaper alternatives (price differences). */
    alternativeCents: number;
    /** Part of the combined total from skip / skip-or-reduce suggestions (full line prices). */
    skipCents: number;
    /** Items with a suggestion whose amount couldn't be calculated. */
    uncountedItems: number;
  };
  /** "By following these suggestions, you would save $X." when the illustration is off. */
  savingsSentence: string | null;
  investment: InvestmentIllustration | null;
  handBack: string;
  /** Who wrote the sentences: reviewed templates, or OpenAI phrasing of them. */
  wordingSource: 'templates' | 'openai';
}
