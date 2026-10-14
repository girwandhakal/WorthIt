import { CRITERIA_VERSION, type CriterionResult, type Evidence } from '../../domain/finding';
import { isFoodByCategory, type ProductFacts } from '../../domain/product-facts';
import { formatCents } from '../../shared/currency';
import { CATEGORIES } from '../reference/categories';
import type { ReferenceProduct } from '../reference/products';
import { CONCERN_INFO, evaluateFood, foodWatchNotes, type FoodConcern, type FoodInputs } from './food-quality';

/**
 * The food branch of the decision tree, from the product's own label.
 * A food's facts come from its Walmart product page when they were read
 * (preferred) or from the reviewed reference record. The label decides, never
 * the title or category; a value that isn't known gives no note.
 */

export interface FoodView {
  /** Whether the retailer files this as food or drink; null when neither facts nor reference say. */
  isFood: boolean | null;
  inputs: FoodInputs;
  /** True when the label values came from the product page. */
  fromFacts: boolean;
  /** True when there's an ingredient statement or any Nutrition Facts value to judge. */
  hasLabel: boolean;
}

export function foodViewFor(reference: ReferenceProduct | null, facts: ProductFacts | null): FoodView | null {
  if (!reference && !facts) return null;
  const isFood = (facts ? isFoodByCategory(facts) : null) ?? (reference ? CATEGORIES[reference.category].food : null);
  const referenceIngredients = reference?.label?.ingredients?.join(', ') ?? null;
  const nutrition = facts?.nutrition ?? null;
  const inputs: FoodInputs = {
    ingredients: facts?.ingredients ?? referenceIngredients,
    addedSugarG: nutrition?.addedSugarG ?? reference?.label?.addedSugarG ?? null,
    sodiumMg: nutrition?.sodiumMg ?? null,
    transFatG: nutrition?.transFatG ?? null,
    context: `${facts?.categoryPath.join(' ') ?? ''} ${facts?.name ?? reference?.name ?? ''}`.toLowerCase(),
  };
  const fromFacts = Boolean(facts && (facts.ingredients !== null || nutrition !== null));
  const hasLabel =
    inputs.ingredients !== null || inputs.addedSugarG !== null || inputs.sodiumMg !== null || inputs.transFatG !== null;
  return { isFood, inputs, fromFacts, hasLabel };
}

const labelSource = (view: FoodView) => (view.fromFacts ? ('walmart_product_page' as const) : ('walmart_reference' as const));

/**
 * Added sugar: any food or drink whose label lists more than 0 g of added
 * sugars per serving gets the approved note.
 */
export function assessAddedSugar(
  reference: ReferenceProduct | null,
  linePriceCents: number | null,
  facts: ProductFacts | null = null,
): CriterionResult {
  const base = { criterion: 'added_sugar' as const, version: CRITERIA_VERSION };
  const view = foodViewFor(reference, facts);
  if (!view) {
    return { ...base, status: 'unknown', summary: 'No label data for this item; no health note is shown.', evidence: [], confidence: 'low' };
  }
  if (view.isFood === false) {
    return { ...base, status: 'not_applicable', summary: 'Not a food or drink.', evidence: [], confidence: 'high' };
  }
  const grams = view.inputs.addedSugarG;
  if (view.isFood === null || grams === null) {
    return {
      ...base,
      status: 'unknown',
      summary: 'The added-sugar amount isn’t recorded for this item; no health note is shown.',
      evidence: [],
      confidence: 'low',
    };
  }
  const source = labelSource(view);
  if (grams === 0) {
    return {
      ...base,
      status: 'no_concern',
      summary: 'The label lists no added sugar.',
      evidence: [{ label: 'Added sugars on label', value: 'None listed', source }],
      confidence: 'high',
    };
  }
  return {
    ...base,
    status: 'finding',
    summary: CONCERN_INFO.added_sugar.note(''),
    points: CONCERN_INFO.added_sugar.points(''),
    concerns: [{ id: 'added_sugar', detail: '' }],
    evidence: [
      { label: 'Added sugars on label', value: 'Listed on the label', source },
      { label: 'Guidance', value: 'Too much added sugar over time is linked to health problems', source: 'cdc_added_sugars' },
    ],
    confidence: 'high',
    suggestion: { kind: 'reduce_added_sugar', amountCents: linePriceCents },
  };
}

/**
 * Every other label-based food concern: processed meat, trans fat, non-sugar
 * sweeteners, high sodium, synthetic dyes, and ultra-processed ingredients.
 * Nothing flagged (a whole or minimally processed food) is "no concern".
 */
export function assessFoodQuality(
  reference: ReferenceProduct | null,
  facts: ProductFacts | null,
  linePriceCents: number | null,
): CriterionResult {
  const base = { criterion: 'food_quality' as const, version: CRITERIA_VERSION };
  const view = foodViewFor(reference, facts);
  if (!view) {
    return { ...base, status: 'unknown', summary: 'No ingredient or label data for this item, so nothing is flagged.', evidence: [], confidence: 'low' };
  }
  if (view.isFood === false) {
    return { ...base, status: 'not_applicable', summary: 'Not a food or drink.', evidence: [], confidence: 'high' };
  }
  if (view.isFood === null || !view.hasLabel) {
    return {
      ...base,
      status: 'unknown',
      summary: 'The ingredients or Nutrition Facts weren’t available for this item, so nothing is flagged.',
      evidence: [],
      confidence: 'low',
    };
  }
  const concerns = evaluateFood(view.inputs).filter((concern) => concern.id !== 'added_sugar');
  const source = labelSource(view);
  const watch = foodWatchNotes(view.inputs.ingredients);
  const watchEvidence: Evidence[] = watch.map((name) => ({
    label: 'Also noted (not counted)',
    value: `${name[0]!.toUpperCase()}${name.slice(1)} is an industrial ingredient that is one marker of ultra-processed food, but it is also an everyday anti-caking or thickening agent, so it is not treated as a concern`,
    source: 'monteiro_nova' as const,
  }));
  if (concerns.length === 0) {
    return {
      ...base,
      status: 'no_concern',
      summary: watch.length > 0 ? `Nothing to flag in the ingredient list or Nutrition Facts. Also noted, but not counted: ${watch.join(', ')}.` : 'Nothing to flag in the ingredient list or Nutrition Facts.',
      watch,
      evidence: watchEvidence,
      confidence: view.fromFacts ? 'high' : 'medium',
    };
  }
  const lead = concerns[0]!;
  return {
    ...base,
    status: 'finding',
    summary: CONCERN_INFO[lead.id].note(lead.detail),
    points: CONCERN_INFO[lead.id].points(lead.detail),
    concerns: concerns.map(({ id, detail }) => ({ id, detail })),
    watch,
    evidence: [...concernEvidence(concerns, source), ...watchEvidence],
    confidence: view.fromFacts ? 'high' : 'medium',
    suggestion: { kind: 'reduce_food_concern', amountCents: linePriceCents },
  };
}

/** One "what was found" row and one "guidance" row per concern, each naming its source. */
function concernEvidence(concerns: readonly FoodConcern[], labelSourceId: Evidence['source']): Evidence[] {
  return concerns.flatMap((concern) => {
    const info = CONCERN_INFO[concern.id];
    const rows: Evidence[] = [
      { label: info.label, value: concern.detail === 'listed on the label' ? 'Listed on the label' : concern.detail, source: labelSourceId },
      { label: 'Guidance', value: info.guidance, source: info.source },
    ];
    if (info.alsoSource) rows.push({ label: 'How it is identified', value: 'By its ingredient list (NOVA classification)', source: info.alsoSource });
    return rows;
  });
}

/** True only when the label is known to list no added sugar. */
export function hasNoAddedSugar(reference: ReferenceProduct): boolean {
  return reference.label?.addedSugarG === 0;
}

/** Money line used in "removing it would lower your cart by". */
export function removalSentence(amountCents: number | null): string {
  return amountCents !== null ? ` Removing it would lower your cart by ${formatCents(amountCents)}.` : '';
}
