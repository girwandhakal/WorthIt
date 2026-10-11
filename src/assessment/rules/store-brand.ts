import type { CartItem } from '../../domain/cart';
import type { ProductFacts } from '../../domain/product-facts';
import { CRITERIA_VERSION, type AlternativeInfo, type CriterionResult, type Evidence } from '../../domain/finding';
import { formatCents } from '../../shared/currency';
import { ALLERGEN_LABELS, type Allergen, type DietaryPreference } from '../../storage/preferences';
import { CATEGORIES, STORE_BRAND_MIN_SAVINGS_RATIO } from '../reference/categories';
import { PRICES_CHECKED_ON, referenceUrl, storeBrandAlternative, type ReferenceProduct } from '../reference/products';
import { CONCERN_INFO, evaluateFood } from './food-quality';
import { foodViewFor, hasNoAddedSugar } from './nutrition';

export interface ShopperPreferences {
  allergens: readonly Allergen[];
  dietaryPreferences: readonly DietaryPreference[];
}

/** Ingredient lists this similar (Jaccard) count as "similar ingredients". */
const SIMILAR_INGREDIENTS_THRESHOLD = 0.8;

/**
 * Store-brand value: prefer an available store brand, state the real unit and
 * basket price difference, and claim savings only when it is at least 5%
 * cheaper per unit. Never suggests a food or drink with added sugar (or an
 * unknown amount), and flags allergy or dietary conflicts instead of
 * suggesting the product.
 */
export function assessStoreBrand(
  item: CartItem,
  reference: ReferenceProduct | null,
  preferences: ShopperPreferences,
  facts: ProductFacts | null = null,
): CriterionResult {
  const base = { criterion: 'store_brand' as const, version: CRITERIA_VERSION };
  if (!reference) {
    return { ...base, status: 'unknown', summary: 'No reviewed product data, so no store-brand comparison.', evidence: [], confidence: 'low' };
  }
  if (reference.storeBrand) {
    return { ...base, status: 'not_applicable', summary: 'Already a Walmart store brand.', evidence: [], confidence: 'high' };
  }
  const alternative = storeBrandAlternative(reference);
  if (!alternative) {
    return { ...base, status: 'not_applicable', summary: 'No store-brand version in the reference list.', evidence: [], confidence: 'high' };
  }

  const isFood = CATEGORIES[reference.category].food;
  if (isFood && !hasNoAddedSugar(alternative)) {
    const reason =
      alternative.label?.addedSugarG == null
        ? `its added-sugar amount isn’t recorded`
        : `its label lists added sugar`;
    return {
      ...base,
      status: 'no_concern',
      summary: `No store-brand switch suggested: ${alternative.name} isn’t suggested because ${reason}.`,
      evidence: [{ label: 'Store brand', value: alternative.name, source: 'walmart_reference' }],
      confidence: 'high',
    };
  }

  // The same decision tree applies to the alternative: never suggest a food Worth It would flag itself.
  const flagged = isFood
    ? evaluateFood({ ingredients: alternative.label?.ingredients?.join(', ') ?? null, addedSugarG: null, sodiumMg: null, transFatG: null, context: alternative.name.toLowerCase() }).filter(
        (concern) => concern.id !== 'ultra_processed',
      )
    : [];
  // If the cart item itself has such a concern, an alternative whose ingredients aren't recorded can't be vouched for.
  const ownView = isFood ? foodViewFor(reference, facts) : null;
  const ownConcerns = ownView ? evaluateFood(ownView.inputs).filter((concern) => concern.id !== 'added_sugar' && concern.id !== 'ultra_processed') : [];
  if (flagged.length === 0 && ownConcerns.length > 0 && alternative.label?.ingredients == null) {
    return {
      ...base,
      status: 'no_concern',
      summary: `No store-brand switch suggested: this item’s label shows ${ownConcerns.map((concern) => CONCERN_INFO[concern.id].label.toLowerCase()).join(', ')}, and ${alternative.name}’s ingredients aren’t recorded, so it can’t be checked for the same thing.`,
      evidence: [{ label: 'Store brand', value: alternative.name, source: 'walmart_reference' }],
      confidence: 'medium',
    };
  }
  if (flagged.length > 0) {
    return {
      ...base,
      status: 'no_concern',
      summary: `No store-brand switch suggested: ${alternative.name} isn’t suggested because its ingredients include ${flagged.map((concern) => CONCERN_INFO[concern.id].label.toLowerCase()).join(', ')}.`,
      evidence: [{ label: 'Store brand', value: alternative.name, source: 'walmart_reference' }],
      confidence: 'high',
    };
  }

  const conflicts = dietConflicts(alternative, preferences);
  const linePrice = item.linePriceCents;
  const quantity = item.quantity;
  if (linePrice === null || quantity === null) {
    return {
      ...base,
      status: 'unknown',
      summary: `${alternative.name} is the store-brand version, but the cart price or quantity wasn’t readable, so prices weren’t compared.`,
      evidence: [{ label: 'Store brand', value: alternative.name, source: 'walmart_reference' }],
      confidence: 'low',
    };
  }
  if (reference.size.unit !== alternative.size.unit) {
    return {
      ...base,
      status: 'unknown',
      summary: 'Package sizes use different units, so unit prices weren’t compared.',
      evidence: [],
      confidence: 'low',
    };
  }

  const packagePrice = linePrice / quantity; // live price of one cart package
  const cartUnit = packagePrice / reference.size.amount;
  const altUnit = alternative.priceCents / alternative.size.amount;
  const ratio = altUnit / cartUnit;
  const comparison: AlternativeInfo['comparison'] =
    ratio > 1 ? 'costs_more' : 1 - ratio < STORE_BRAND_MIN_SAVINGS_RATIO ? 'about_same' : 'cheaper';
  // Same amount as the cart item, for the cart quantity; rounded once.
  const savingsCents =
    comparison === 'cheaper'
      ? Math.round(quantity * (packagePrice - (alternative.priceCents * reference.size.amount) / alternative.size.amount))
      : null;

  const differences = [...sizeDifference(reference, alternative), ...conflicts];
  if (reference.note) differences.push(reference.note);
  const similarity = ingredientSimilarity(reference, alternative, isFood, differences);

  const info: AlternativeInfo = {
    itemId: alternative.itemId,
    name: alternative.name,
    url: referenceUrl(alternative.itemId),
    referencePriceCents: alternative.priceCents,
    priceCheckedOn: PRICES_CHECKED_ON,
    comparison,
    savingsCents,
    unitPriceComparison: unitComparison(cartUnit, altUnit, reference.size.unit),
    similarity,
    differences,
  };

  const evidence: Evidence[] = [
    { label: 'Your cart price', value: `${formatCents(linePrice)} for ${quantity}`, source: 'cart_page' },
    {
      label: `Store-brand price (last checked ${PRICES_CHECKED_ON})`,
      value: `${formatCents(alternative.priceCents)} for ${alternative.size.amount} ${alternative.size.unit}`,
      source: 'walmart_reference',
    },
    { label: 'Unit prices (yours vs store brand)', value: info.unitPriceComparison, source: 'walmart_reference' },
  ];
  if (similarity === 'similar_ingredients') {
    evidence.push({ label: 'Ingredients', value: 'Similar ingredient lists', source: 'walmart_reference' });
  }

  if (conflicts.length > 0) {
    return {
      ...base,
      status: 'finding',
      summary: `${alternative.name} isn’t suggested: ${conflicts.join('; ')}.`,
      evidence,
      confidence: 'high',
      suggestion: { kind: 'store_brand_note', amountCents: null, alternative: info },
    };
  }

  if (comparison === 'cheaper' && savingsCents !== null && savingsCents > 0) {
    return {
      ...base,
      status: 'finding',
      summary: `${alternative.name} costs about ${formatCents(savingsCents)} less for the same amount (estimate from a last-checked price).`,
      evidence,
      confidence: 'medium',
      suggestion: { kind: 'cheaper_alternative', amountCents: savingsCents, alternative: info },
    };
  }

  return {
    ...base,
    status: 'finding',
    summary:
      comparison === 'costs_more'
        ? `${alternative.name} is the store-brand option, but it costs more per unit, so there’s no savings.`
        : `${alternative.name} is the store-brand option; the unit prices are about the same, so no savings are claimed.`,
    evidence,
    confidence: 'medium',
    suggestion: { kind: 'store_brand_note', amountCents: null, alternative: { ...info, savingsCents: null } },
  };
}

function dietConflicts(alternative: ReferenceProduct, preferences: ShopperPreferences): string[] {
  const conflicts: string[] = [];
  const label = alternative.label;
  if (preferences.allergens.length > 0) {
    if (!label || label.allergens === null) {
      conflicts.push('its allergens aren’t recorded, so it can’t be checked against your allergies');
    } else {
      for (const allergen of preferences.allergens) {
        if (label.allergens.includes(allergen)) conflicts.push(`its label lists ${ALLERGEN_LABELS[allergen].toLowerCase()}, which you marked as an allergy`);
      }
    }
  }
  if (label) {
    if (preferences.dietaryPreferences.includes('vegan') && label.vegan === false) conflicts.push('it isn’t vegan');
    if (preferences.dietaryPreferences.includes('vegetarian') && label.vegetarian === false) conflicts.push('it isn’t vegetarian');
  }
  return conflicts;
}

function sizeDifference(reference: ReferenceProduct, alternative: ReferenceProduct): string[] {
  if (reference.size.amount === alternative.size.amount) return [];
  return [
    `The store-brand package is ${alternative.size.amount} ${alternative.size.unit} vs ${reference.size.amount} ${reference.size.unit}; prices are compared for the same amount.`,
  ];
}

function ingredientSimilarity(
  reference: ReferenceProduct,
  alternative: ReferenceProduct,
  isFood: boolean,
  differences: string[],
): AlternativeInfo['similarity'] {
  if (!isFood) return 'not_food';
  const a = reference.label?.ingredients;
  const b = alternative.label?.ingredients;
  if (!a || !b) return 'unknown';
  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((ingredient) => setB.has(ingredient)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union > 0 && shared / union >= SIMILAR_INGREDIENTS_THRESHOLD) return 'similar_ingredients';
  const onlyStore = [...setB].filter((ingredient) => !setA.has(ingredient)).slice(0, 3);
  const onlyYours = [...setA].filter((ingredient) => !setB.has(ingredient)).slice(0, 3);
  if (onlyStore.length) differences.push(`Store brand also lists: ${onlyStore.join(', ')}.`);
  if (onlyYours.length) differences.push(`Yours also lists: ${onlyYours.join(', ')}.`);
  return 'different_ingredients';
}

function unitComparison(cartUnit: number, altUnit: number, unit: string): string {
  // Paper goods are compared per 100 sheets, as Walmart lists them.
  const scale = unit === 'sheets' ? 100 : 1;
  const label = unit === 'sheets' ? '100 sheets' : unit;
  const format = (cents: number) => (cents * scale < 100 ? `${(cents * scale).toFixed(1)}¢` : formatCents(Math.round(cents * scale)));
  return `${format(cartUnit)} vs ${format(altUnit)} per ${label}`;
}
