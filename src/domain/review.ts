import type { Source } from '../assessment/evidence/sources';
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
  /** The full per-item, per-criterion assessment (for "See full analysis"). */
  assessment: CartAssessment;
  /** False when there is nothing to show, prompts are off, or the shopper dismissed these findings. */
  autoOpen: boolean;
}

export type ReviewFindingKind = SuggestionKind | 'repeat_question' | 'uncertain';

export interface ReviewFinding {
  /** Stable across rerenders: `${itemKey}:${kind}`. Used for dismissal. */
  id: string;
  itemKey: string;
  kind: ReviewFindingKind;
  itemName: string;
  /** Short advisor text built from verified fields. */
  text: string;
  /** Potential current-cart reduction, when this finding has one. */
  amountCents: number | null;
  question: ClarificationQuestion | null;
  /** Shown only behind "Why?". */
  why: Evidence[];
  sources: Source[];
  confidence: Confidence;
}
