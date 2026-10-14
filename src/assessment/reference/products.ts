import type { Allergen } from '../../storage/preferences';
import type { CategoryId } from './categories';

/**
 * Bundled, reviewed product reference data, transcribed from
 * docs/WALMART_REFERENCE_PRODUCTS.md and keyed by Walmart item ID.
 *
 * Prices here are last-checked reference prices (never used for items in the
 * cart, whose prices come from the live page). Label facts are what each
 * product's Nutrition Facts / ingredient label lists; `null` means not recorded,
 * and checks depending on it return `unknown`.
 */

export const REFERENCE_DATA_VERSION = '2026-10-10';
export const PRICES_CHECKED_ON = '2026-10-09';

export interface LabelFacts {
  /** Grams of added sugars per serving as listed on the label. */
  addedSugarG: number | null;
  /** Ingredient list in label order, lowercase; `null` when not recorded. */
  ingredients: readonly string[] | null;
  /** Major allergens the label declares; `null` when not recorded. */
  allergens: readonly Allergen[] | null;
  vegetarian: boolean | null;
  vegan: boolean | null;
}

export interface ReferenceProduct {
  itemId: string;
  name: string;
  brand: string;
  storeBrand: boolean;
  category: CategoryId;
  /** Functional type used to match similar purchases, e.g. `tumbler`. */
  itemType: string;
  size: { amount: number; unit: string };
  priceCents: number;
  /** Item ID of the Walmart store-brand counterpart, if any. */
  storeBrandAlternativeId?: string;
  /** Food and drink only. */
  label?: LabelFacts;
  /** Material, non-label differences worth stating (features, style). */
  note?: string;
  /**
   * Amazon ASINs reviewed as the same product (same brand, size, and label).
   * Empty until reviewed; unmatched Amazon items stay 'unknown'.
   */
  amazonAsins?: readonly string[];
}

const NO_SUGAR = 0;

const food = (
  addedSugarG: number | null,
  ingredients: readonly string[] | null,
  allergens: readonly Allergen[] | null,
  diet: { vegetarian: boolean | null; vegan: boolean | null },
): LabelFacts => ({ addedSugarG, ingredients, allergens, ...diet });

const PLANT = { vegetarian: true, vegan: true };
const DAIRY_OR_EGG = { vegetarian: true, vegan: false };
const UNKNOWN_DIET = { vegetarian: null, vegan: null };
/** Cheese is not vegan; whether it is vegetarian depends on the enzymes, which the label doesn't specify. */
const CHEESE = { vegetarian: null, vegan: false };

const PRODUCTS: ReferenceProduct[] = [
  // Dairy
  {
    itemId: '10309701',
    name: 'Horizon Organic Vitamin D Whole Milk, 64 fl oz',
    brand: 'Horizon Organic',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'milk',
    size: { amount: 64, unit: 'fl oz' },
    priceCents: 596,
    storeBrandAlternativeId: '10315798',
    label: food(NO_SUGAR, ['grade a organic milk', 'vitamin d3'], ['milk'], DAIRY_OR_EGG),
  },
  {
    itemId: '10315798',
    name: 'Great Value Organic Whole Vitamin D Milk, 64 fl oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'milk',
    size: { amount: 64, unit: 'fl oz' },
    priceCents: 397,
    label: food(NO_SUGAR, ['grade a organic milk', 'vitamin d3'], ['milk'], DAIRY_OR_EGG),
  },
  {
    itemId: '10324125',
    name: "Eggland's Best Large White Eggs, 12 ct",
    brand: "Eggland's Best",
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'eggs',
    size: { amount: 12, unit: 'ct' },
    priceCents: 387,
    storeBrandAlternativeId: '145051970',
    label: food(NO_SUGAR, ['eggs'], ['eggs'], DAIRY_OR_EGG),
    note: "Eggland's Best hens get a specialty feed; the eggs themselves are the same size and grade.",
  },
  {
    itemId: '145051970',
    name: 'Great Value Large White Eggs, 12 ct',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'eggs',
    size: { amount: 12, unit: 'ct' },
    priceCents: 167,
    label: food(NO_SUGAR, ['eggs'], ['eggs'], DAIRY_OR_EGG),
  },
  {
    itemId: '47088920',
    name: 'Kraft Natural Mild Cheddar Finely Shredded Cheese, 8 oz',
    brand: 'Kraft',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'shredded cheese',
    size: { amount: 8, unit: 'oz' },
    priceCents: 298,
    storeBrandAlternativeId: '10452370',
    label: food(
      NO_SUGAR,
      ['mild cheddar cheese', 'potato starch', 'powdered cellulose', 'natamycin'],
      ['milk'],
      CHEESE,
    ),
  },
  {
    itemId: '43981978',
    name: 'Kraft Natural Mild Cheddar Shredded Cheese, 16 oz Bag',
    brand: 'Kraft',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'shredded cheese',
    size: { amount: 16, unit: 'oz' },
    priceCents: 564,
    storeBrandAlternativeId: '10452370',
    label: food(
      NO_SUGAR,
      ['cheddar cheese', 'modified cornstarch', 'natamycin'],
      ['milk'],
      CHEESE,
    ),
    note: 'The store brand is finely shredded; this Kraft cheese is regular shredded.',
  },
  {
    itemId: '10452370',
    name: 'Great Value Mild Cheddar Finely Shredded Cheese, 8 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'shredded cheese',
    size: { amount: 8, unit: 'oz' },
    priceCents: 197,
    label: food(
      NO_SUGAR,
      ['mild cheddar cheese', 'potato starch', 'powdered cellulose', 'natamycin'],
      ['milk'],
      CHEESE,
    ),
  },
  {
    itemId: '10291058',
    name: 'Land O Lakes Salted Butter Sticks, 4 ct',
    brand: 'Land O Lakes',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'butter',
    size: { amount: 16, unit: 'oz' },
    priceCents: 446,
    storeBrandAlternativeId: '132893363',
    label: food(NO_SUGAR, ['sweet cream', 'salt'], ['milk'], DAIRY_OR_EGG),
  },
  {
    itemId: '132893363',
    name: 'Great Value Sweet Cream Salted Butter, 4 sticks',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'butter',
    size: { amount: 16, unit: 'oz' },
    priceCents: 306,
    label: food(NO_SUGAR, ['sweet cream', 'salt'], ['milk'], DAIRY_OR_EGG),
  },
  // Bakery
  {
    itemId: '37858875',
    name: 'Wonder Classic White Sandwich Bread, 20 oz',
    brand: 'Wonder',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'white bread',
    size: { amount: 20, unit: 'oz' },
    priceCents: 247,
    storeBrandAlternativeId: '10315752',
    label: food(2, null, ['wheat'], UNKNOWN_DIET),
  },
  {
    itemId: '10315752',
    name: 'Great Value White Sandwich Bread, 20 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'white bread',
    size: { amount: 20, unit: 'oz' },
    priceCents: 152,
    label: food(2, null, ['wheat'], UNKNOWN_DIET),
  },
  // Cereal
  {
    itemId: '10311408',
    name: 'Cheerios, 8.9 oz',
    brand: 'General Mills',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'oat cereal',
    size: { amount: 8.9, unit: 'oz' },
    priceCents: 297,
    storeBrandAlternativeId: '17238466448',
    label: food(2, null, null, UNKNOWN_DIET),
  },
  {
    itemId: '17238466448',
    name: "Great Value Toasted O's, 18 oz",
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'oat cereal',
    size: { amount: 18, unit: 'oz' },
    priceCents: 247,
    label: food(2, null, null, UNKNOWN_DIET),
  },
  {
    itemId: '5014113090',
    name: "Kellogg's Frosted Flakes Original, 12 oz",
    brand: "Kellogg's",
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'frosted corn cereal',
    size: { amount: 12, unit: 'oz' },
    priceCents: 398,
    storeBrandAlternativeId: '264614057',
    label: food(12, null, null, UNKNOWN_DIET),
  },
  {
    itemId: '264614057',
    name: 'Great Value Frosted Flakes, 13.5 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'frosted corn cereal',
    size: { amount: 13.5, unit: 'oz' },
    priceCents: 196,
    label: food(12, null, null, UNKNOWN_DIET),
  },
  // Pantry
  {
    itemId: '25847552',
    name: 'Jif Natural Creamy Peanut Butter Spread, 16 oz',
    brand: 'Jif',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'peanut butter',
    size: { amount: 16, unit: 'oz' },
    priceCents: 298,
    storeBrandAlternativeId: '36267321',
    label: food(2, null, ['peanuts'], PLANT),
  },
  {
    itemId: '36267321',
    name: 'Great Value Natural No Stir Creamy Peanut Butter, 16 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'peanut butter',
    size: { amount: 16, unit: 'oz' },
    priceCents: 152,
    label: food(2, null, ['peanuts'], PLANT),
  },
  {
    itemId: '10309153',
    name: 'Barilla Classic Spaghetti, 16 oz',
    brand: 'Barilla',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'spaghetti',
    size: { amount: 16, unit: 'oz' },
    priceCents: 188,
    storeBrandAlternativeId: '10534115',
    label: food(NO_SUGAR, null, ['wheat'], PLANT),
  },
  {
    itemId: '10534115',
    name: 'Great Value Spaghetti, 16 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'spaghetti',
    size: { amount: 16, unit: 'oz' },
    priceCents: 124,
    label: food(NO_SUGAR, null, ['wheat'], PLANT),
  },
  {
    itemId: '10306800',
    name: "Bush's Black Beans, 15 oz",
    brand: "Bush's",
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'black beans',
    size: { amount: 15, unit: 'oz' },
    priceCents: 153,
    storeBrandAlternativeId: '10534038',
    label: food(NO_SUGAR, null, [], PLANT),
  },
  {
    itemId: '10534038',
    name: 'Great Value Black Beans, 15 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'black beans',
    size: { amount: 15, unit: 'oz' },
    priceCents: 92,
    label: food(NO_SUGAR, null, [], PLANT),
  },
  {
    itemId: '15754607',
    name: 'Mahatma Enriched Extra Long Grain White Rice, 80 oz',
    brand: 'Mahatma',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'white rice',
    size: { amount: 80, unit: 'oz' },
    priceCents: 557,
    storeBrandAlternativeId: '10315395',
    label: food(NO_SUGAR, null, [], PLANT),
  },
  {
    itemId: '10315395',
    name: 'Great Value Long Grain Enriched Rice, 80 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'white rice',
    size: { amount: 80, unit: 'oz' },
    priceCents: 352,
    label: food(NO_SUGAR, null, [], PLANT),
  },
  {
    itemId: '15529427',
    name: 'Heinz Tomato Ketchup, 32 oz',
    brand: 'Heinz',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'ketchup',
    size: { amount: 32, unit: 'oz' },
    priceCents: 478,
    storeBrandAlternativeId: '172196409',
    label: food(4, null, [], PLANT),
  },
  {
    itemId: '172196409',
    name: 'Great Value Tomato Ketchup, 32 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'ketchup',
    size: { amount: 32, unit: 'oz' },
    priceCents: 217,
    label: food(4, null, [], PLANT),
  },
  {
    itemId: '578550306',
    name: 'Folgers Classic Roast Ground Coffee, 25.9 oz',
    brand: 'Folgers',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'ground coffee',
    size: { amount: 25.9, unit: 'oz' },
    priceCents: 1296,
    storeBrandAlternativeId: '3400314469',
    label: food(NO_SUGAR, ['coffee'], [], PLANT),
  },
  {
    itemId: '3400314469',
    name: 'Great Value Classic Medium Roast Ground Coffee, 40.3 oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'ground coffee',
    size: { amount: 40.3, unit: 'oz' },
    priceCents: 1977,
    label: food(NO_SUGAR, ['coffee'], [], PLANT),
  },
  // Beverages
  {
    itemId: '5512318310',
    name: 'Tropicana Pure Premium Orange Juice, No Pulp, 46 fl oz',
    brand: 'Tropicana',
    storeBrand: false,
    category: 'grocery_staple',
    itemType: 'orange juice',
    size: { amount: 46, unit: 'fl oz' },
    priceCents: 388,
    storeBrandAlternativeId: '403284742',
    label: food(NO_SUGAR, ['orange juice'], [], PLANT),
    note: 'Tropicana is not-from-concentrate; check the store-brand label if that matters to you.',
  },
  {
    itemId: '403284742',
    name: 'Great Value 100% Orange Juice, No Pulp, 52 fl oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'grocery_staple',
    itemType: 'orange juice',
    size: { amount: 52, unit: 'fl oz' },
    priceCents: 396,
    label: food(NO_SUGAR, null, [], PLANT),
  },
  {
    itemId: '16618684',
    name: 'Coca-Cola, 2 L',
    brand: 'Coca-Cola',
    storeBrand: false,
    category: 'soda',
    itemType: 'cola',
    size: { amount: 67.6, unit: 'fl oz' },
    priceCents: 297,
    storeBrandAlternativeId: '16785073',
    label: food(39, null, [], PLANT),
  },
  {
    itemId: '16785073',
    name: "Sam's Cola, 2 L",
    brand: "Sam's Choice",
    storeBrand: true,
    category: 'soda',
    itemType: 'cola',
    size: { amount: 67.6, unit: 'fl oz' },
    priceCents: 110,
    label: food(38, null, [], PLANT),
  },
  {
    itemId: '15610624',
    name: 'Diet Coke, 2 L',
    brand: 'Coca-Cola',
    storeBrand: false,
    category: 'soda',
    itemType: 'diet cola',
    size: { amount: 67.6, unit: 'fl oz' },
    priceCents: 297,
    storeBrandAlternativeId: '16504559',
    label: food(NO_SUGAR, null, [], PLANT),
  },
  {
    itemId: '16504559',
    name: "Sam's Cola Diet, 2 L",
    brand: "Sam's Choice",
    storeBrand: true,
    category: 'soda',
    itemType: 'diet cola',
    size: { amount: 67.6, unit: 'fl oz' },
    priceCents: 116,
    label: food(NO_SUGAR, null, [], PLANT),
  },
  // Household consumables. Paper-towel sizes are sheet counts derived from
  // Walmart's listed unit prices ($1.23 and $1.50 per 100 sheets).
  {
    itemId: '5308263928',
    name: 'Bounty Essentials Select-A-Size Paper Towels, 6 double rolls',
    brand: 'Bounty',
    storeBrand: false,
    category: 'household_consumable',
    itemType: 'paper towels',
    size: { amount: 648, unit: 'sheets' },
    priceCents: 797,
    storeBrandAlternativeId: '3799647206',
  },
  {
    itemId: '3799647206',
    name: 'Great Value Ultra Strong Paper Towels, 6 double rolls',
    brand: 'Great Value',
    storeBrand: true,
    category: 'household_consumable',
    itemType: 'paper towels',
    size: { amount: 661, unit: 'sheets' },
    priceCents: 992,
  },
  {
    itemId: '1095568875',
    name: 'Dawn Ultra Dish Soap, Original, 18 fl oz',
    brand: 'Dawn',
    storeBrand: false,
    category: 'household_consumable',
    itemType: 'dish soap',
    size: { amount: 18, unit: 'fl oz' },
    priceCents: 294,
    storeBrandAlternativeId: '18610204851',
  },
  {
    itemId: '18610204851',
    name: 'Great Value Ultra Original Dish Liquid, 18 fl oz',
    brand: 'Great Value',
    storeBrand: true,
    category: 'household_consumable',
    itemType: 'dish soap',
    size: { amount: 18, unit: 'fl oz' },
    priceCents: 196,
  },
  {
    itemId: '123015473',
    name: 'Glad ForceFlex Tall Kitchen Drawstring Bags, 13 gal, 40 ct',
    brand: 'Glad',
    storeBrand: false,
    category: 'household_consumable',
    itemType: 'trash bags',
    size: { amount: 40, unit: 'ct' },
    priceCents: 1098,
    storeBrandAlternativeId: '344638043',
    note: 'Glad ForceFlex bags stretch; the store-brand bags are standard drawstring bags.',
  },
  {
    itemId: '344638043',
    name: 'Great Value Tall Kitchen Drawstring Bags, 13 gal, 40 ct',
    brand: 'Great Value',
    storeBrand: true,
    category: 'household_consumable',
    itemType: 'trash bags',
    size: { amount: 40, unit: 'ct' },
    priceCents: 648,
  },
  // Clothing basics
  {
    itemId: '697314670',
    name: "Hanes Men's Value Pack Crew T-Shirts, 6 pk",
    brand: 'Hanes',
    storeBrand: false,
    category: 'basic_clothing',
    itemType: 't-shirts',
    size: { amount: 6, unit: 'ea' },
    priceCents: 2398,
    storeBrandAlternativeId: '251574590',
  },
  {
    itemId: '251574590',
    name: "George Men's Crew T-Shirts, 6 pk",
    brand: 'George',
    storeBrand: true,
    category: 'basic_clothing',
    itemType: 't-shirts',
    size: { amount: 6, unit: 'ea' },
    priceCents: 1698,
  },
  // Drinkware
  {
    itemId: '18256507800',
    name: 'Stanley Quencher FlowState Tumbler, 30 oz',
    brand: 'Stanley',
    storeBrand: false,
    category: 'trend_drinkware',
    itemType: 'tumbler',
    size: { amount: 1, unit: 'ea' },
    priceCents: 2497,
    storeBrandAlternativeId: '14622112422',
    note: 'Both are 30 oz insulated tumblers with a handle.',
  },
  {
    itemId: '14622112422',
    name: 'Ozark Trail Insulated Tumbler with Handle, 30 oz',
    brand: 'Ozark Trail',
    storeBrand: true,
    category: 'trend_drinkware',
    itemType: 'tumbler',
    size: { amount: 1, unit: 'ea' },
    priceCents: 1297,
  },
  // Unpaired walkthrough items
  {
    itemId: '16275314128',
    name: 'Hostess Donettes Frightfully Frosted Mini Donuts, 10 oz Bag',
    brand: 'Hostess',
    storeBrand: false,
    category: 'snack',
    itemType: 'mini donuts',
    size: { amount: 10, unit: 'oz' },
    priceCents: 268,
    label: food(17, null, null, UNKNOWN_DIET),
  },
  {
    itemId: '17741466139',
    name: 'Squishmallows FuzzAMallow 5 in plush',
    brand: 'Squishmallows',
    storeBrand: false,
    category: 'novelty_collectible',
    itemType: 'plush',
    size: { amount: 1, unit: 'ea' },
    priceCents: 397,
  },
  {
    itemId: '18110413708',
    name: 'Monster 16.4 ft LED Strip Lights',
    brand: 'Monster',
    storeBrand: false,
    category: 'decor',
    itemType: 'led strip lights',
    size: { amount: 1, unit: 'ea' },
    priceCents: 1488,
  },
  {
    itemId: '656700117',
    name: 'Skittles Original, Sharing Size, 15.6 oz',
    brand: 'Skittles',
    storeBrand: false,
    category: 'candy',
    itemType: 'candy',
    size: { amount: 15.6, unit: 'oz' },
    priceCents: 497,
    label: food(34, null, [], UNKNOWN_DIET),
  },
  {
    itemId: '17569970321',
    name: "Reese's Miniatures, Share Pack, 9.6 oz",
    brand: "Reese's",
    storeBrand: false,
    category: 'candy',
    itemType: 'candy',
    size: { amount: 9.6, unit: 'oz' },
    priceCents: 597,
    label: food(19, null, ['milk', 'peanuts', 'soy'], { vegetarian: true, vegan: false }),
  },
];

const BY_ID = new Map(PRODUCTS.map((product) => [product.itemId, product]));

export function referenceProduct(itemId: string | null | undefined): ReferenceProduct | null {
  return itemId ? (BY_ID.get(itemId) ?? null) : null;
}

/** Reviewed reference data for a cart item, by retailer-specific ID. */
export function referenceForItem(merchant: 'walmart' | 'amazon', itemId: string | null): ReferenceProduct | null {
  if (!itemId) return null;
  if (merchant === 'walmart') return referenceProduct(itemId);
  return PRODUCTS.find((product) => product.amazonAsins?.includes(itemId)) ?? null;
}

export function storeBrandAlternative(product: ReferenceProduct): ReferenceProduct | null {
  return referenceProduct(product.storeBrandAlternativeId);
}

export function allReferenceProducts(): readonly ReferenceProduct[] {
  return PRODUCTS;
}

export function referenceUrl(itemId: string): string {
  return `https://www.walmart.com/ip/${itemId}`;
}

/** Title keywords that identify an item type in purchase history (lowercase). */
export const ITEM_TYPE_KEYWORDS: Record<string, readonly string[]> = {
  tumbler: ['tumbler', 'quencher', 'insulated cup', 'travel mug'],
  plush: ['plush', 'squishmallow', 'stuffed animal'],
  'led strip lights': ['led strip', 'strip light', 'led light strip'],
  't-shirts': ['t-shirt', 't shirt', 'tee shirt', 'crew tee', 'crew t'],
};
