import { itemDisplayName, type CartItem, type CartSnapshot } from '../domain/cart';
import {
  CRITERIA_VERSION,
  type CartAssessment,
  type CriterionResult,
  type ItemAssessment,
  type Suggestion,
} from '../domain/finding';
import type { ClarificationRecord, PurchaseRecord } from '../domain/history';
import type { ProductFacts, ProductFactsMap } from '../domain/product-facts';
import { sumCents } from '../shared/currency';
import { REPEAT_PURPOSE_QUESTION_ID, itemMatchKey, storedAnswer } from './clarification';
import { REFERENCE_DATA_VERSION, referenceForItem, type ReferenceProduct } from './reference/products';
import { assessAddedSugar, assessFoodQuality } from './rules/nutrition';
import { assessPurpose } from './rules/purpose';
import { assessRepeatPurchase, findHistoryMatches } from './rules/repeat-purchase';
import { assessStoreBrand, type ShopperPreferences } from './rules/store-brand';

export interface AssessmentInputs {
  snapshot: CartSnapshot;
  history: readonly PurchaseRecord[];
  clarifications: readonly ClarificationRecord[];
  preferences: ShopperPreferences;
  /** Shopper's local date, YYYY-MM-DD. */
  today: string;
  /** Facts read from each product's own page, by retailer item ID. Absent items are 'unknown'. */
  facts?: ProductFactsMap;
  /** Resolves reviewed reference data for a cart item (retailer-specific IDs). */
  lookupReference?: (item: CartItem) => ReferenceProduct | null;
}

/**
 * Assesses every cart line against every criterion. Pure and deterministic:
 * the same inputs always produce the same output. Uses no bank, balance,
 * budget, or other personal-finance data.
 */
export function assessCart(inputs: AssessmentInputs): CartAssessment {
  const lookup = inputs.lookupReference ?? ((item: CartItem) => referenceForItem(item.merchant, item.retailerItemId));
  const readableTotalCents = sumCents(inputs.snapshot.items.map((item) => item.linePriceCents));
  return {
    criteriaVersion: CRITERIA_VERSION,
    referenceVersion: REFERENCE_DATA_VERSION,
    assessedOn: inputs.today,
    readableTotalCents,
    items: inputs.snapshot.items.map((item) =>
      assessItem(item, lookup(item), item.retailerItemId ? (inputs.facts?.[item.retailerItemId] ?? null) : null, inputs, readableTotalCents),
    ),
  };
}

function assessItem(
  item: CartItem,
  reference: ReferenceProduct | null,
  facts: ProductFacts | null,
  inputs: AssessmentInputs,
  readableTotalCents: number | null,
): ItemAssessment {
  const unitPriceCents =
    item.linePriceCents !== null && item.quantity !== null ? Math.round(item.linePriceCents / item.quantity) : item.unitPriceCents;
  const matchKey = itemMatchKey(item);
  const answer = storedAnswer(inputs.clarifications, REPEAT_PURPOSE_QUESTION_ID, matchKey);

  const readability = assessReadability(item);
  const purpose = assessPurpose(reference, unitPriceCents, item.linePriceCents, facts);
  const matches = findHistoryMatches(item, reference, inputs.history, inputs.today);
  const repeat = assessRepeatPurchase({
    reference,
    purposeClass: purpose.purposeClass,
    consumable: purpose.consumable,
    matches,
    answer,
    matchKey,
  });
  const sugar = assessAddedSugar(reference, item.linePriceCents, facts);
  const foodQuality = assessFoodQuality(reference, facts, item.linePriceCents);
  const storeBrand = assessStoreBrand(item, reference, inputs.preferences, facts);

  const criteria: CriterionResult[] = [readability, purpose.result, repeat.result, storeBrand, sugar, foodQuality];

  // One primary suggestion per item: skip (redundancy, then novelty) beats the
  // added-sugar skip-or-reduce, then any other label concern, which beat a cheaper alternative.
  const candidates: Suggestion[] = [];
  if (repeat.skipEligible) candidates.push({ kind: 'skip_redundant', amountCents: item.linePriceCents });
  if (purpose.result.suggestion) candidates.push(purpose.result.suggestion);
  if (sugar.suggestion) candidates.push(sugar.suggestion);
  if (foodQuality.suggestion) candidates.push(foodQuality.suggestion);
  if (storeBrand.suggestion) candidates.push(storeBrand.suggestion);
  const actionable = item.issues.includes('unavailable') ? [] : candidates;
  const primary = actionable.find((suggestion) => suggestion.kind !== 'store_brand_note') ?? null;

  return {
    itemKey: item.key,
    itemName: itemDisplayName(item),
    position: item.position,
    retailerItemId: item.retailerItemId,
    quantity: item.quantity,
    linePriceCents: item.linePriceCents,
    unitPriceCents,
    referenceId: reference?.itemId ?? null,
    purposeClass: purpose.purposeClass,
    criteria,
    primary,
    secondary: actionable.filter((suggestion) => suggestion !== primary),
    question: item.issues.includes('unavailable') ? null : repeat.question,
    answer,
    historyMatches: matches,
    shareOfCartBps:
      readableTotalCents && item.linePriceCents !== null ? Math.round((item.linePriceCents * 10_000) / readableTotalCents) : null,
  };
}

function assessReadability(item: CartItem): CriterionResult {
  const base = { criterion: 'readability' as const, version: CRITERIA_VERSION };
  if (item.issues.length === 0) {
    return { ...base, status: 'no_concern', summary: 'Name, quantity, and price were read from the cart page.', evidence: [], confidence: 'high' };
  }
  return { ...base, status: 'unknown', summary: uncertaintyText(item), evidence: [], confidence: 'low' };
}

export function uncertaintyText(item: CartItem): string {
  if (item.issues.includes('unavailable')) return "This item shows as unavailable, so it isn't part of the review.";
  const missing: string[] = [];
  if (item.issues.includes('missing_title')) missing.push('name');
  if (item.issues.includes('missing_price') || item.issues.includes('ambiguous_price')) missing.push('price');
  if (item.issues.includes('missing_quantity')) missing.push('quantity');
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} or ${missing.at(-1)}` : (missing[0] ?? 'details');
  return `Couldn't read this item's ${list} reliably, so Worth It couldn't fully check it.`;
}
