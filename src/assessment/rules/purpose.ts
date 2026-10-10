import { CRITERIA_VERSION, type CriterionResult } from '../../domain/finding';
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
 * Purpose/necessity from the reference category only (never from the title).
 * It informs skip decisions and questions; on its own it prompts only for a
 * novelty item with no practical use.
 */
export function assessPurpose(reference: ReferenceProduct | null, unitPriceCents: number | null, linePriceCents: number | null): PurposeAssessment {
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
