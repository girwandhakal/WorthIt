/**
 * Every factual claim Worth It shows names one of these sources. Nothing here
 * is fetched at runtime; URLs are shown as links for the shopper.
 */

export type SourceId =
  | 'cdc_added_sugars'
  | 'who_nss'
  | 'hall_upf'
  | 'monteiro_nova'
  | 'fda_trans_fat'
  | 'iarc_processed_meat'
  | 'oehha_dyes'
  | 'cdc_sodium'
  | 'walmart_product_page'
  | 'walmart_reference'
  | 'cart_page'
  | 'purchase_history'
  | 'your_answer';

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
  who_nss: {
    id: 'who_nss',
    label: 'WHO: guideline on non-sugar sweeteners (2023)',
    url: 'https://www.who.int/news/item/15-05-2023-who-advises-not-to-use-non-sugar-sweeteners-for-weight-control-in-newly-released-guideline',
  },
  hall_upf: {
    id: 'hall_upf',
    label: 'Hall et al., Cell Metabolism (2019): randomized trial of ultra-processed vs. unprocessed diets',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31105044/',
  },
  monteiro_nova: {
    id: 'monteiro_nova',
    label: 'Monteiro et al., Public Health Nutrition (2019): how to identify ultra-processed foods',
    url: 'https://doi.org/10.1017/S1368980018003762',
  },
  fda_trans_fat: {
    id: 'fda_trans_fat',
    label: 'FDA: Trans fat',
    url: 'https://www.fda.gov/food/food-additives-petitions/trans-fat',
  },
  iarc_processed_meat: {
    id: 'iarc_processed_meat',
    label: 'WHO / IARC: cancer risk of red meat and processed meat',
    url: 'https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat',
  },
  oehha_dyes: {
    id: 'oehha_dyes',
    label: 'California OEHHA (2021): neurobehavioral effects of synthetic food dyes in children',
    url: 'https://oehha.ca.gov/risk-assessment/synthetic-food-dye-risk-assessment',
  },
  cdc_sodium: {
    id: 'cdc_sodium',
    label: 'CDC (MMWR): dietary sodium reduction',
    url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6105a2.htm',
  },
  walmart_product_page: {
    id: 'walmart_product_page',
    label: 'The product’s own Walmart.com page (ingredients, Nutrition Facts, category)',
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
