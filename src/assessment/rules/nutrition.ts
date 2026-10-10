import { CRITERIA_VERSION, type CriterionResult } from '../../domain/finding';
import { ADDED_SUGAR_NOTE } from '../evidence/sources';
import { CATEGORIES } from '../reference/categories';
import type { ReferenceProduct } from '../reference/products';

/**
 * The only MVP health rule: a food or drink whose recorded label lists more
 * than 0 g of added sugars per serving gets the approved note. The label
 * decides, never the title or category; an unknown value gives no note.
 */
export function assessAddedSugar(reference: ReferenceProduct | null, linePriceCents: number | null): CriterionResult {
  const base = { criterion: 'added_sugar' as const, version: CRITERIA_VERSION };
  if (!reference) {
    return { ...base, status: 'unknown', summary: 'No label data for this item; no health note is shown.', evidence: [], confidence: 'low' };
  }
  if (!CATEGORIES[reference.category].food) {
    return { ...base, status: 'not_applicable', summary: 'Not a food or drink.', evidence: [], confidence: 'high' };
  }
  const grams = reference.label?.addedSugarG ?? null;
  if (grams === null) {
    return {
      ...base,
      status: 'unknown',
      summary: 'The added-sugar amount isn’t recorded for this item; no health note is shown.',
      evidence: [],
      confidence: 'low',
    };
  }
  if (grams === 0) {
    return {
      ...base,
      status: 'no_concern',
      summary: 'The label lists no added sugar.',
      evidence: [{ label: 'Added sugars on label', value: 'None listed', source: 'walmart_reference' }],
      confidence: 'high',
    };
  }
  return {
    ...base,
    status: 'finding',
    summary: ADDED_SUGAR_NOTE,
    evidence: [
      { label: 'Added sugars on label', value: 'Listed on the label', source: 'walmart_reference' },
      { label: 'Guidance', value: 'Too much added sugar over time is linked to health problems', source: 'cdc_added_sugars' },
    ],
    confidence: 'high',
    suggestion: { kind: 'reduce_added_sugar', amountCents: linePriceCents },
  };
}

/** True only when the label is known to list no added sugar. */
export function hasNoAddedSugar(reference: ReferenceProduct): boolean {
  return reference.label?.addedSugarG === 0;
}
