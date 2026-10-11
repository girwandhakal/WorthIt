import { CRITERIA_VERSION, type CriterionResult } from '../../domain/finding';
import { isFoodByCategory, type ProductFacts } from '../../domain/product-facts';
import { CATEGORIES, PURPOSE_CLASS_LABELS, purposeClassFor, type PurposeClass } from '../reference/categories';
import type { ReferenceProduct } from '../reference/products';

export interface PurposeAssessment {
  result: CriterionResult;
  purposeClass: PurposeClass;
  /** Null when the category is unknown. */
  consumable: boolean | null;
  food: boolean | null;
}

/**
 * The non-food branch of the decision tree: is this a novelty item with no
 * practical use? Recognized from the retailer's own category path or a
 * product line that exists only as a collectible. Ordinary toys, tools, and
 * household goods are never flagged just for being optional.
 */
const NOVELTY_CATEGORY = /\b(collectibles?|collectables?|novelty|gag gifts?|pranks?|fidgets?|bobbleheads?|figurines?)\b/i;
const NOVELTY_PRODUCT_LINE = /\b(squishmallows?|funko|bobblehead|gag gift|novelty|fidget (spinner|toy|pack)|pop it)\b/i;

/** Categories (by Walmart path) whose foods are treats, not staples. */
const TREAT_CATEGORY = /\b(candy|snacks?|cookies?|soda|soft drinks?|chips)\b/i;

export function noveltyEvidence(facts: ProductFacts): string | null {
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
  unitPriceCents: number | null,
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
  const purposeClass = purposeClassFor(reference.category, unitPriceCents);
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
        summary: 'A novelty or collectible item with no practical use.',
        evidence,
        confidence: 'high',
        suggestion: { kind: 'skip_novelty', amountCents: linePriceCents },
      },
    };
  }

  return {
    purposeClass,
    consumable: category.consumable,
    food: category.food,
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
        summary: 'A novelty or collectible item with no practical use.',
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
  return {
    purposeClass: 'unknown',
    consumable: null,
    food,
    result: {
      ...base,
      status: 'no_concern',
      summary: 'Nothing suggests this is a novelty item with no practical use.',
      evidence: facts.categoryPath.length > 0 ? [{ label: 'Walmart category', value: facts.categoryPath.slice(-2).join(' > '), source }] : [],
      confidence: 'medium',
    },
  };
}
