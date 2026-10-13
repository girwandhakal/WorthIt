import type { PurposeClass } from '../assessment/reference/categories';
import type { SourceId } from '../assessment/evidence/sources';
import type { ClarificationAnswer, HistorySource, PurchaseStatus } from './history';

/**
 * Structured, deterministic assessment output. Every cart item gets one result
 * per criterion; the UI and any wording assistant only ever present these.
 */

/** Bumped when the decision rules change: 2 is the single food / non-food decision tree. */
export const CRITERIA_VERSION = 2;

export type CriterionId = 'readability' | 'purpose' | 'store_brand' | 'repeat_purchase' | 'added_sugar' | 'food_quality';

export const CRITERION_LABELS: Record<CriterionId, string> = {
  readability: 'Item details readable',
  purpose: 'Purpose and need',
  store_brand: 'Store-brand value',
  repeat_purchase: 'Recent similar purchase',
  added_sugar: 'Added sugar (label)',
  food_quality: 'Ingredients and nutrition (label)',
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
  /** A toy: more of a want than a need. Counted like a novelty item. */
  | 'skip_toy'
  /** A decor item or gadget the shopper bought a similar one of recently. Soft: never counted in the savings. */
  | 'rethink'
  /** Decor: worth comparing with Walmart's own decor lines. A prompt only, with no amount. */
  | 'decor_brand_note'
  | 'reduce_added_sugar'
  /** Any other label-based food concern (sweetener, processed meat, trans fat, sodium, dyes, ultra-processed). */
  | 'reduce_food_concern'
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
  /** The finding's reviewed wording cut to 2 or 3 short points, when it has a health note. */
  points?: string[];
  /** The label concerns behind a finding: an id from the food decision tree and the specific thing found. */
  concerns?: Array<{ id: string; detail: string }>;
  /** Ingredients worth noting that are not a concern and are never counted (for example modified starch). */
  watch?: string[];
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
  /** The retailer's product thumbnail, when the cart line showed one. */
  imageUrl: string | null;
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
