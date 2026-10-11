import { parseProductPage } from '../../src/adapters/walmart/product-facts';
import type { ProductFacts } from '../../src/domain/product-facts';

/**
 * Builds a Walmart product page in the shape of the live page data: a
 * `__NEXT_DATA__` script holding product name, category path, the ingredient
 * statement, and the Nutrition Facts tree (Total Carbohydrate → Total Sugars →
 * Added Sugars). Label values in tests are synthetic unless a test says otherwise.
 */
export interface PageSpec {
  id: string;
  name: string;
  path: string[];
  ingredients?: string | null;
  /** Nutrition Facts rows by label name, e.g. { 'Added Sugars': '21g', Sodium: '5mg' }. */
  nutrition?: Record<string, string> | null;
  servingSize?: string;
}

const row = (name: string, amount: string, children: unknown[] | null = null) => ({
  name: null,
  mainNutrient: { name, amount, dvp: '', standardServingAmount: null, childNutrients: null },
  childNutrients: children,
});

function nutritionTree(rows: Record<string, string>, servingSize: string) {
  const nutrient = (name: string, amount: string, childNutrients: unknown[] | null = null) => ({
    name,
    amount,
    dvp: '',
    standardServingAmount: null,
    childNutrients,
  });
  const added = rows['Added Sugars'] ? [nutrient('Added Sugars', rows['Added Sugars'])] : null;
  const sugars = rows['Total Sugars'] || added ? [nutrient('Total Sugars', rows['Total Sugars'] ?? rows['Added Sugars'] ?? '0g', added)] : null;
  const values: unknown[] = [];
  if (rows['Total Fat']) values.push(row('Total Fat', rows['Total Fat'], rows['Trans Fat'] ? [nutrient('Trans Fat', rows['Trans Fat'])] : null));
  else if (rows['Trans Fat']) values.push(row('Trans Fat', rows['Trans Fat']));
  if (rows['Sodium']) values.push(row('Sodium', rows['Sodium']));
  if (sugars) values.push(row('Total Carbohydrate', rows['Total Carbohydrate'] ?? '0g', sugars));
  return {
    calorieInfo: { name: 'Calorie Information', mainNutrient: { name: 'Calories', amount: '100' }, childNutrients: null },
    keyNutrients: { name: 'Key Nutrients', values },
    vitaminMinerals: null,
    servingInfo: { name: 'Serving Information', values: [{ name: 'Serving Size', value: servingSize, attribute: null, values: null }] },
  };
}

export function productPageHtml(spec: PageSpec): string {
  const data = {
    props: {
      pageProps: {
        initialData: {
          data: {
            product: {
              usItemId: spec.id,
              name: spec.name,
              brand: null,
              category: { path: spec.path.map((name) => ({ name, url: '/cp/x' })) },
            },
            idml: {
              ingredients: spec.ingredients === undefined || spec.ingredients === null ? {} : { ingredients: { name: 'Ingredients', value: spec.ingredients } },
              nutritionFacts: spec.nutrition ? nutritionTree(spec.nutrition, spec.servingSize ?? '1 serving') : null,
            },
          },
        },
      },
    },
  };
  return `<!doctype html><html><head><title>${spec.name} - Walmart.com</title></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

export function factsFor(spec: PageSpec): ProductFacts {
  const facts = parseProductPage(productPageHtml(spec), spec.id);
  if (!facts) throw new Error(`Fixture page for ${spec.id} did not parse`);
  return facts;
}

/**
 * Real label text (ingredients and category) read from public Walmart.com
 * product pages on 2026-10-10. Nutrition values marked "synthetic" in comments
 * are filled in only where the live page showed none.
 */
export const PAGES = {
  skittles: {
    id: '656700117',
    name: 'Skittles Original Chewy Candy Sharing Size, 15.6 oz Bag',
    path: ['Food', 'Candy', 'Fruit Flavored & Sour Candy', 'Fruit Flavored Candy'],
    ingredients:
      'SUGAR, CORN SYRUP, HYDROGENATED PALM KERNEL OIL; LESS THAN 2% OF: CITRIC ACID, TAPIOCA DEXTRIN, MODIFIED CORN STARCH, NATURAL AND ARTIFICIAL FLAVORS, COLORS (RED 40 LAKE, YELLOW 5 LAKE, BLUE 2 LAKE, YELLOW 6 LAKE, TITANIUM DIOXIDE, BLUE 1 LAKE, YELLOW 6, RED 40, YELLOW 5, BLUE 1), SODIUM CITRATE, CARNAUBA WAX.',
    nutrition: { 'Total Fat': '1g', Sodium: '5mg', 'Total Carbohydrate': '26g', 'Total Sugars': '21g', 'Added Sugars': '21g' },
  },
  dietCoke: {
    id: '15610624',
    name: 'Diet Coke Soda Pop Bottle, 2 Liters',
    path: ['Food', 'Beverages', 'Soda Pop', 'Coca-Cola', 'Diet Coke'],
    ingredients:
      'CARBONATED WATER, CARAMEL COLOR, ASPARTAME, PHOSPHORIC ACID, POTASSIUM BENZOATE (TO PROTECT TASTE), NATURAL FLAVORS, CITRIC ACID, CAFFEINE, PHENYLKETONURICS: CONTAINS PHENYLALANINE',
    // Synthetic: the live page's values weren't recorded.
    nutrition: { Sodium: '40mg', 'Total Carbohydrate': '0g', 'Total Sugars': '0g', 'Added Sugars': '0g' },
  },
  milk: {
    id: '10309701',
    name: 'Horizon Organic Vitamin D Whole Milk, Vitamin D Whole, 64 fl oz Carton',
    path: ['Food', 'Dairy & Eggs', 'Milk', 'Organic Milk'],
    ingredients: 'GRADE A ORGANIC MILK, VITAMIN D3',
    nutrition: { 'Total Fat': '8g', Sodium: '125mg', 'Total Carbohydrate': '12g', 'Total Sugars': '12g', 'Added Sugars': '0g' },
  },
  bananas: {
    id: '44390948',
    name: 'Fresh Banana, Each',
    path: ['Food', 'Fresh Produce', 'Fresh Fruits', 'Bananas'],
    ingredients: 'BANANAS, RAW',
    nutrition: null,
  },
  hotDog: {
    id: '1534770749',
    name: 'Kraft Frozen 5:1 Oscar Mayer Beef Frank, 6 inch',
    path: ['Food', 'Meat & Seafood', 'Bacon, Hot Dogs, & Sausages', 'Hot Dogs', 'Oscar Mayer'],
    ingredients:
      'BEEF, WATER, CONTAINS LESS THAN 2% OF SALT, CORN SYRUP, GROUND MUSTARD SEED, DEXTROSE, SODIUM PHOSPHATES, SODIUM DIACETATE, SODIUM BENZOATE, SODIUM ASCORBATE, FLAVOR, SODIUM NITRITE, EXTRACTIVES OF PAPRIKA, HYDROLYZED BEEF STOCK',
    nutrition: null,
  },
  plush: {
    id: '17741466139',
    name: "Squishmallows FuzzAMallow Official 5 inch Tzeitel the Lavender and White Tuxedo Cat - Child's Ultra Soft Plush Toy",
    path: ['Collectibles', 'Collectible Plush'],
    ingredients: null,
    nutrition: null,
  },
  tumbler: {
    id: '18256507800',
    name: 'Stanley Quencher Flowstate 30oz Hibiscus Stainless Steel Tumbler',
    path: ['Sports & Outdoors', 'Sports & Outdoors Shop by Brand', 'Stanley 1913', 'Stanley Tumblers', 'Stanley 30 oz Tumblers'],
    ingredients: null,
    nutrition: null,
  },
  paperTowels: {
    id: '5308263928',
    name: 'Bounty Essentials Paper Towels',
    path: ['Household Essentials', 'Paper Goods', 'Paper Towels'],
    ingredients: null,
    nutrition: null,
  },
} satisfies Record<string, PageSpec>;
