import type { PurposeClass } from '../assessment/reference/categories';
import type { SourceId } from '../assessment/evidence/sources';
import type { ClarificationAnswer, HistorySource, PurchaseStatus } from './history';

/**
 * Structured, deterministic assessment output. Every cart item gets one result
 * per criterion; the UI and any wording assistant only ever present these.
 */

export const CRITERIA_VERSION = 1;

export type CriterionId = 'readability' | 'purpose' | 'store_brand' | 'repeat_purchase' | 'added_sugar';

export const CRITERION_LABELS: Record<CriterionId, string> = {
  readability: 'Item details readable',
  purpose: 'Purpose and need',
  store_brand: 'Store-brand value',
  repeat_purchase: 'Recent similar purchase',
  added_sugar: 'Added sugar (label)',
};

/** `no_concern` and `not_applicable` are distinct from `unknown` (missing evidence). */
export type CriterionStatus = 'finding' | 'no_concern' | 'not_applicable' | 'unknown';

export type Confidence = 'high' | 'medium' | 'low';

export interface Evidence {
  label: string;
  value: string;
  source: SourceId;
}

export type SuggestionKind =
  | 'skip_redundant'
  | 'skip_novelty'
  | 'reduce_added_sugar'
  | 'cheaper_alternative'
  /** Store brand named but no savings claimed (about the same price, or costs more). */
  | 'store_brand_note';

export interface AlternativeInfo {
  itemId: string;
  name: string;
  url: string;
  referencePriceCents: number;
  priceCheckedOn: string;
  /** Compared by unit price. */
  comparison: 'cheaper' | 'about_same' | 'costs_more';
  /** For the cart quantity, same amount as the cart item. Null when not cheaper. */
  savingsCents: number | null;
  /** e.g. "9.3¢ vs 6.2¢ per fl oz". */
  unitPriceComparison: string;
  similarity: 'similar_ingredients' | 'different_ingredients' | 'unknown' | 'not_food';
  differences: string[];
}

export interface Suggestion {
  kind: SuggestionKind;
  /** Potential current-cart reduction for this suggestion, when calculable. */
  amountCents: number | null;
  alternative?: AlternativeInfo;
}

export interface CriterionResult {
  criterion: CriterionId;
  version: number;
  status: CriterionStatus;
  /** One plain sentence for the full analysis. */
  summary: string;
  evidence: Evidence[];
  confidence: Confidence;
  suggestion?: Suggestion;
}

export interface HistoryMatch {
  recordId: string;
  title: string;
  purchasedOn: string;
  daysAgo: number;
  kind: 'exact' | 'similar';
  status: PurchaseStatus;
  source: HistorySource;
}

export interface ClarificationOption {
  value: ClarificationAnswer;
  label: string;
}

export interface ClarificationQuestion {
  questionId: string;
  itemMatchKey: string;
  prompt: string;
  options: ClarificationOption[];
}

export interface ItemAssessment {
  itemKey: string;
  itemName: string;
  position: number;
  retailerItemId: string | null;
  quantity: number | null;
  linePriceCents: number | null;
  unitPriceCents: number | null;
  referenceId: string | null;
  purposeClass: PurposeClass;
  criteria: CriterionResult[];
  /** The one suggestion that counts toward the cart total (skip > added sugar > cheaper alternative). */
  primary: Suggestion | null;
  /** Other suggestions shown for context but never added to the total. */
  secondary: Suggestion[];
  question: ClarificationQuestion | null;
  answer: ClarificationAnswer | null;
  historyMatches: HistoryMatch[];
  /** Line price / sum of readable line prices, in basis points; null when any line price is unknown. */
  shareOfCartBps: number | null;
}

export interface CartAssessment {
  criteriaVersion: number;
  referenceVersion: string;
  assessedOn: string;
  items: ItemAssessment[];
  /** Sum of readable line prices; null when any line price is unknown. */
  readableTotalCents: number | null;
}
