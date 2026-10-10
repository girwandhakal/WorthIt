/**
 * Every factual claim Worth It shows names one of these sources. Nothing here
 * is fetched at runtime; URLs are shown as links for the shopper.
 */

export type SourceId = 'cdc_added_sugars' | 'walmart_reference' | 'cart_page' | 'purchase_history' | 'your_answer';

export interface Source {
  id: SourceId;
  label: string;
  url?: string;
}

export const SOURCES: Record<SourceId, Source> = {
  cdc_added_sugars: {
    id: 'cdc_added_sugars',
    label: 'CDC: Get the Facts: Added Sugars',
    url: 'https://www.cdc.gov/nutrition/php/data-research/added-sugars.html',
  },
  walmart_reference: {
    id: 'walmart_reference',
    label: 'Worth It product reference (Walmart.com prices and labels)',
  },
  cart_page: { id: 'cart_page', label: 'Your Walmart cart page' },
  purchase_history: { id: 'purchase_history', label: 'Your Worth It purchase history (on this device)' },
  your_answer: { id: 'your_answer', label: 'Your answer to Worth It' },
};

/** The approved added-sugar note (PRD PR-16). Never reworded or rephrased. */
export const ADDED_SUGAR_NOTE =
  'This has added sugar. Too much added sugar over time can contribute to health problems, including type 2 diabetes and heart disease. Consider skipping it, choosing a smaller amount, or having it less often.';
