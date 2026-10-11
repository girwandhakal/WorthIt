/**
 * Category-to-purpose map (TECH_SPEC section 7). Price limits and lookback
 * windows are named constants so they can be tuned in one place.
 */

export const CATEGORY_IDS = [
  // Essential consumables
  'grocery_staple',
  'household_consumable',
  'personal_hygiene',
  'otc_medicine_first_aid',
  'baby_care',
  'pet_food',
  // Essential non-consumables (under a price limit)
  'basic_clothing',
  'basic_household',
  // Useful / context-dependent
  'school_office',
  'small_appliance',
  'tools',
  'electronics_accessory',
  // Discretionary
  'snack',
  'candy',
  'soda',
  'toy',
  'decor',
  'entertainment',
  'electronics',
  'beauty_extra',
  // Discretionary, special classes
  'trend_drinkware',
  'novelty_collectible',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export type PurposeClass =
  | 'essential_consumable'
  | 'essential_non_consumable'
  | 'useful'
  | 'discretionary'
  | 'discretionary_trend'
  | 'discretionary_novelty'
  | 'unknown';

export const PURPOSE_CLASS_LABELS: Record<PurposeClass, string> = {
  essential_consumable: 'Essential (consumable)',
  essential_non_consumable: 'Essential (non-consumable)',
  useful: 'Useful / depends on context',
  discretionary: 'Discretionary',
  discretionary_trend: 'Discretionary (trend item at a premium)',
  discretionary_novelty: 'Discretionary (novelty, no practical use)',
  unknown: 'Unknown',
};

/** Basic clothing is essential at or under this price per unit. */
export const BASIC_CLOTHING_MAX_UNIT_CENTS = 25_00;
/** Basic household items are essential at or under this price per unit. */
export const BASIC_HOUSEHOLD_MAX_UNIT_CENTS = 40_00;

/** How far back a similar purchase counts as recent, by kind of item. */
export const LOOKBACK_DAYS = {
  clothing: 60,
  household: 90,
  useful: 90,
  discretionary: 90,
  /** Unknown category: only exact or similar-looking repeats, and only to ask, never to suggest skipping. */
  unknownExact: 90,
} as const;

/** Store-brand savings are claimed only when its unit price is at least this much lower. */
export const STORE_BRAND_MIN_SAVINGS_RATIO = 0.05;

interface CategoryInfo {
  label: string;
  consumable: boolean;
  food: boolean;
}

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  grocery_staple: { label: 'Grocery staple', consumable: true, food: true },
  household_consumable: { label: 'Household consumable', consumable: true, food: false },
  personal_hygiene: { label: 'Personal hygiene', consumable: true, food: false },
  otc_medicine_first_aid: { label: 'Medicine / first aid', consumable: true, food: false },
  baby_care: { label: 'Baby care', consumable: true, food: false },
  pet_food: { label: 'Pet food', consumable: true, food: false },
  basic_clothing: { label: 'Basic clothing', consumable: false, food: false },
  basic_household: { label: 'Basic household item', consumable: false, food: false },
  school_office: { label: 'School / office supplies', consumable: false, food: false },
  small_appliance: { label: 'Small appliance', consumable: false, food: false },
  tools: { label: 'Tools', consumable: false, food: false },
  electronics_accessory: { label: 'Electronics accessory', consumable: false, food: false },
  snack: { label: 'Snack', consumable: true, food: true },
  candy: { label: 'Candy', consumable: true, food: true },
  soda: { label: 'Soda / sweetened drink', consumable: true, food: true },
  toy: { label: 'Toy', consumable: false, food: false },
  decor: { label: 'Decor', consumable: false, food: false },
  entertainment: { label: 'Entertainment', consumable: false, food: false },
  electronics: { label: 'Electronics', consumable: false, food: false },
  beauty_extra: { label: 'Beauty extra', consumable: false, food: false },
  trend_drinkware: { label: 'Drinkware (trend item)', consumable: false, food: false },
  novelty_collectible: { label: 'Novelty / collectible', consumable: false, food: false },
};

/**
 * Purpose class from category and the live unit price. Never guessed from a
 * title: a missing category is `unknown`.
 */
export function purposeClassFor(category: CategoryId | null, unitPriceCents: number | null): PurposeClass {
  if (!category) return 'unknown';
  switch (category) {
    case 'grocery_staple':
    case 'household_consumable':
    case 'personal_hygiene':
    case 'otc_medicine_first_aid':
    case 'baby_care':
    case 'pet_food':
      return 'essential_consumable';
    case 'basic_clothing':
      return unitPriceCents !== null && unitPriceCents <= BASIC_CLOTHING_MAX_UNIT_CENTS ? 'essential_non_consumable' : 'useful';
    case 'basic_household':
      return unitPriceCents !== null && unitPriceCents <= BASIC_HOUSEHOLD_MAX_UNIT_CENTS ? 'essential_non_consumable' : 'useful';
    case 'school_office':
    case 'small_appliance':
    case 'tools':
    case 'electronics_accessory':
      return 'useful';
    case 'trend_drinkware':
      return 'discretionary_trend';
    case 'novelty_collectible':
      return 'discretionary_novelty';
    default:
      return 'discretionary';
  }
}

/** Lookback window for a recent similar purchase of a non-consumable. */
export function lookbackDaysFor(category: CategoryId, purpose: PurposeClass): number {
  if (category === 'basic_clothing' && purpose === 'essential_non_consumable') return LOOKBACK_DAYS.clothing;
  if (category === 'basic_household' && purpose === 'essential_non_consumable') return LOOKBACK_DAYS.household;
  if (purpose === 'useful') return LOOKBACK_DAYS.useful;
  return LOOKBACK_DAYS.discretionary;
}
