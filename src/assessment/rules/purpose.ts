import { CRITERIA_VERSION, type CriterionResult } from '../../domain/finding';
import { isFoodByCategory, type ProductFacts } from '../../domain/product-facts';
import { CATEGORIES, PURPOSE_CLASS_LABELS, purposeClassFor, type PurposeClass } from '../reference/categories';
import type { ReferenceProduct } from '../reference/products';
import { nonFoodType, type NonFoodType } from './non-food';

export interface PurposeAssessment {
  result: CriterionResult;
  purposeClass: PurposeClass;
  /** Null when the category is unknown. */
  consumable: boolean | null;
  food: boolean | null;
  /** Toy, decor, or gadget, when it is one (see non-food.ts). */
  nonFood?: NonFoodType | null;
}

const NOVELTY_SUMMARY = 'A novelty or collectible item with no practical use.';
const TOY_SUMMARY = 'A toy: more of a want than a need.';

/**
 * Novelty detection for the non-food branch of the decision tree: a category path or a
 * product line that exists only as a collectible. Ordinary toys, tools, and
 * household goods are never flagged just for being optional.
 */
const NOVELTY_CATEGORY = /\b(collectibles?|collectables?|novelty|gag gifts?|pranks?|fidgets?|bobbleheads?|figurines?)\b/i;
const NOVELTY_PRODUCT_LINE = /\b(squishmallows?|funko|bobblehead|gag gift|novelty|fidget (spinner|toy|pack)|pop it)\b/i;

/** Categories (by Walmart path) of non-food items bought again and again: household and personal consumables, pet food. */
const CONSUMABLE_CATEGORY =
  /\b(paper (goods|towels?)|toilet paper|laundry|detergents?|dish(washing)? (soap|detergent)|cleaning supplies|trash bags?|diapers?|wipes|feminine care|shampoo|conditioner|soap|toothpaste|deodorant|vitamins?|pain relievers?|first aid|pet food|dog food|cat food|cat litter)\b/i;

/** Categories (by Walmart path) whose foods are treats, not staples. */
const TREAT_CATEGORY = /\b(candy|snacks?|cookies?|soda|soft drinks?|chips)\b/i;

function noveltyEvidence(facts: ProductFacts): string | null {
  if (isFoodByCategory(facts) === true) return null;
  const path = facts.categoryPath.join(' > ');
  if (NOVELTY_CATEGORY.test(path) || (facts.name !== null && NOVELTY_PRODUCT_LINE.test(facts.name))) {
    return facts.categoryPath.slice(-2).join(' > ') || facts.name;
  }
  return null;
}

/**
 * Purpose/necessity from the reviewed reference category, or from the
 * product's own page when it has no reference record. Never from a title
 * alone for food; it informs skip decisions and questions, and on its own
 * prompts only for a novelty item with no practical use.
 */
export function assessPurpose(
  reference: ReferenceProduct | null,
  linePriceCents: number | null,
  facts: ProductFacts | null = null,
): PurposeAssessment {
  if (!reference && facts) return assessFromPage(facts, linePriceCents);
  if (!reference) {
    return {
      purposeClass: 'unknown',
      consumable: null,
      food: null,
      result: {
        criterion: 'purpose',
        version: CRITERIA_VERSION,
        status: 'unknown',
        summary: 'No reviewed product data for this item, so its purpose isn’t classified.',
        evidence: [],
        confidence: 'low',
      },
    };
  }
  const category = CATEGORIES[reference.category];
  const purposeClass = purposeClassFor(reference.category);
  // The purpose class itself is shown only in the full analysis, not as evidence.
  const evidence = [{ label: 'Product type', value: category.label, source: 'walmart_reference' as const }];

  if (purposeClass === 'discretionary_novelty') {
    return {
      purposeClass,
      consumable: category.consumable,
      food: category.food,
      result: {
        criterion: 'purpose',
        version: CRITERIA_VERSION,
        status: 'finding',
        summary: NOVELTY_SUMMARY,
        evidence,
        confidence: 'high',
        suggestion: { kind: 'skip_novelty', amountCents: linePriceCents },
      },
    };
  }

  const nonFood = nonFoodType(facts, reference.category);
  if (nonFood?.kind === 'toy') {
    return {
      purposeClass,
      consumable: category.consumable,
      food: category.food,
      nonFood,
      result: {
        criterion: 'purpose',
        version: CRITERIA_VERSION,
        status: 'finding',
        summary: TOY_SUMMARY,
        evidence,
        confidence: 'high',
        suggestion: { kind: 'skip_toy', amountCents: linePriceCents },
      },
    };
  }

  return {
    purposeClass,
    consumable: category.consumable,
    food: category.food,
    nonFood,
    result: {
      criterion: 'purpose',
      version: CRITERIA_VERSION,
      status: 'no_concern',
      summary: `${PURPOSE_CLASS_LABELS[purposeClass]}.`,
      evidence,
      confidence: 'high',
    },
  };
}

function assessFromPage(facts: ProductFacts, linePriceCents: number | null): PurposeAssessment {
  const base = { criterion: 'purpose' as const, version: CRITERIA_VERSION };
  const food = isFoodByCategory(facts);
  const novelty = noveltyEvidence(facts);
  const source = 'walmart_product_page' as const;

  if (novelty !== null) {
    return {
      purposeClass: 'discretionary_novelty',
      consumable: false,
      food: false,
      result: {
        ...base,
        status: 'finding',
        summary: NOVELTY_SUMMARY,
        evidence: [{ label: 'Walmart category', value: novelty, source }],
        confidence: 'medium',
        suggestion: { kind: 'skip_novelty', amountCents: linePriceCents },
      },
    };
  }
  if (food === true) {
    const treat = facts.categoryPath.some((segment) => TREAT_CATEGORY.test(segment));
    return {
      purposeClass: treat ? 'discretionary' : 'essential_consumable',
      consumable: true,
      food: true,
      result: {
        ...base,
        status: 'no_concern',
        summary: treat ? 'A treat or snack.' : 'Food or drink.',
        evidence: [{ label: 'Walmart category', value: facts.categoryPath.slice(0, 3).join(' > '), source }],
        confidence: 'medium',
      },
    };
  }
  if (food === false && facts.categoryPath.some((segment) => CONSUMABLE_CATEGORY.test(segment))) {
    return {
      purposeClass: 'essential_consumable',
      consumable: true,
      food: false,
      result: {
        ...base,
        status: 'no_concern',
        summary: 'A household or personal item that is bought again and again.',
        evidence: [{ label: 'Walmart category', value: facts.categoryPath.slice(-2).join(' > '), source }],
        confidence: 'medium',
      },
    };
  }
  const nonFood = nonFoodType(facts);
  const categoryEvidence = facts.categoryPath.length > 0 ? [{ label: 'Walmart category', value: facts.categoryPath.slice(-2).join(' > '), source }] : [];
  if (nonFood?.kind === 'toy') {
    return {
      purposeClass: 'discretionary',
      consumable: false,
      food: false,
      nonFood,
      result: {
        ...base,
        status: 'finding',
        summary: TOY_SUMMARY,
        evidence: categoryEvidence,
        confidence: 'medium',
        suggestion: { kind: 'skip_toy', amountCents: linePriceCents },
      },
    };
  }
  if (nonFood) {
    return {
      purposeClass: nonFood.kind === 'decor' ? 'discretionary' : 'useful',
      consumable: false,
      food: false,
      nonFood,
      result: { ...base, status: 'no_concern', summary: nonFood.kind === 'decor' ? 'Home decor.' : 'An electronic gadget.', evidence: categoryEvidence, confidence: 'medium' },
    };
  }
  // No category on the page: Worth It can't tell what this is, and says so rather than calling it fine.
  if (food === null) {
    return {
      purposeClass: 'unknown',
      consumable: null,
      food: null,
      nonFood: null,
      result: { ...base, status: 'unknown', summary: 'Worth It couldn’t tell what kind of product this is.', evidence: [], confidence: 'low' },
    };
  }
  return {
    purposeClass: 'unknown',
    consumable: null,
    food,
    nonFood: null,
    result: { ...base, status: 'no_concern', summary: 'Nothing to flag.', evidence: categoryEvidence, confidence: 'medium' },
  };
}
