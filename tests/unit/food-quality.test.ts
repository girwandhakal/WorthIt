import { describe, expect, it } from 'vitest';
import { CONCERN_INFO, byGlare, concernNotes, concernPoints, evaluateFood, foodWatchNotes, type FoodInputs } from '../../src/assessment/rules/food-quality';

const food = (overrides: Partial<FoodInputs>): FoodInputs => ({
  ingredients: null,
  addedSugarG: null,
  sodiumMg: null,
  transFatG: null,
  context: '',
  ...overrides,
});
const ids = (inputs: FoodInputs) => evaluateFood(inputs).map((concern) => concern.id);

describe('food decision tree: whole foods get no comment', () => {
  it.each([
    ['milk', 'GRADE A ORGANIC MILK, VITAMIN D3', 0],
    ['eggs', 'EGGS', 0],
    ['bananas', 'BANANAS, RAW', null],
    ['rice', 'LONG GRAIN ENRICHED RICE (RICE, NIACIN, REDUCED IRON, THIAMINE MONONITRATE, FOLIC ACID)', 0],
    ['plain oats', 'WHOLE GRAIN ROLLED OATS', 0],
  ])('%s', (_name, ingredients, addedSugarG) => {
    expect(evaluateFood(food({ ingredients, addedSugarG }))).toEqual([]);
  });

  it('is silent, not alarmed, when there is no label at all', () => {
    expect(evaluateFood(food({}))).toEqual([]);
  });
});

describe('food decision tree: what gets investigated', () => {
  it('flags any added sugar on the label, however little', () => {
    expect(ids(food({ addedSugarG: 1 }))).toEqual(['added_sugar']);
    expect(ids(food({ addedSugarG: 0.5 }))).toEqual(['added_sugar']);
    expect(ids(food({ addedSugarG: 0 }))).toEqual([]);
  });

  it('names the specific non-sugar sweetener', () => {
    const concerns = evaluateFood(food({ ingredients: 'CARBONATED WATER, ASPARTAME, SUCRALOSE, ACESULFAME POTASSIUM' }));
    expect(concerns.find((concern) => concern.id === 'sweetener')?.detail).toBe('aspartame, sucralose, acesulfame potassium');
  });

  it('does not treat sugar alcohols or plain sugar as a non-sugar sweetener', () => {
    expect(ids(food({ ingredients: 'SUGAR, ERYTHRITOL, XYLITOL, SORBITOL' }))).toEqual([]);
  });

  it('flags cured, processed meat only when it is meat', () => {
    expect(ids(food({ ingredients: 'PORK, WATER, SALT, SODIUM NITRITE' }))).toContain('processed_meat');
    expect(ids(food({ ingredients: 'WATER, SALT, SODIUM NITRITE', context: 'food > pantry > curing salt' }))).not.toContain('processed_meat');
    expect(ids(food({ ingredients: 'SODIUM NITRITE, SALT', context: 'food > meat & seafood > bacon' }))).toContain('processed_meat');
  });

  it('flags artificial trans fat from the ingredient list or the label', () => {
    expect(ids(food({ ingredients: 'ENRICHED FLOUR, PARTIALLY HYDROGENATED SOYBEAN OIL' }))).toContain('trans_fat');
    expect(ids(food({ transFatG: 1.5 }))).toEqual(['trans_fat']);
    expect(ids(food({ transFatG: 0 }))).toEqual([]);
  });

  it('treats fully hydrogenated oil as a processing marker, not as trans fat', () => {
    const concerns = ids(food({ ingredients: 'SUGAR, FULLY HYDROGENATED PALM KERNEL OIL' }));
    expect(concerns).toEqual(['ultra_processed']);
  });

  it('flags high sodium per serving, at and above the line only', () => {
    expect(ids(food({ sodiumMg: 459 }))).toEqual([]);
    expect(ids(food({ sodiumMg: 460 }))).toEqual(['high_sodium']);
    expect(evaluateFood(food({ sodiumMg: 800 }))[0]?.detail).toBe('800 mg');
  });

  it('flags synthetic dyes but not natural or caramel color', () => {
    expect(evaluateFood(food({ ingredients: 'SUGAR, RED 40, YELLOW 5 LAKE, BLUE 1' })).find((c) => c.id === 'dyes')?.detail).toBe('Red 40, Yellow 5, Blue 1');
    expect(ids(food({ ingredients: 'WATER, TURMERIC, ANNATTO, BEET JUICE COLOR' }))).toEqual([]);
    expect(ids(food({ ingredients: 'WATER, CARAMEL COLOR' }))).not.toContain('dyes');
  });

  it('flags ultra-processed ingredients from the list, not the title or category', () => {
    expect(ids(food({ ingredients: 'ENRICHED FLOUR, WATER, SOY LECITHIN, XANTHAN GUM' }))).toEqual(['ultra_processed']);
    expect(ids(food({ ingredients: 'WATER, HIGH FRUCTOSE CORN SYRUP, NATURAL FLAVOR' }))).toEqual(['ultra_processed']);
    expect(ids(food({ ingredients: 'TOMATOES, SALT', context: 'food > snacks > chips' }))).toEqual([]);
  });

  it('does not mistake vitamins or enrichment for processing', () => {
    expect(ids(food({ ingredients: 'MILK, VITAMIN D3, VITAMIN A PALMITATE' }))).toEqual([]);
    expect(ids(food({ ingredients: 'ENRICHED WHEAT FLOUR (NIACIN, IRON, THIAMINE MONONITRATE, RIBOFLAVIN, FOLIC ACID), WATER, YEAST, SALT' }))).toEqual([]);
  });
});

describe('food decision tree: real labels read from Walmart.com', () => {
  it('Skittles: added sugar leads, with dyes and processing behind it', () => {
    const concerns = evaluateFood(
      food({
        addedSugarG: 21,
        sodiumMg: 5,
        ingredients:
          'SUGAR, CORN SYRUP, HYDROGENATED PALM KERNEL OIL; LESS THAN 2% OF: CITRIC ACID, TAPIOCA DEXTRIN, MODIFIED CORN STARCH, NATURAL AND ARTIFICIAL FLAVORS, COLORS (RED 40 LAKE, YELLOW 5 LAKE, BLUE 2 LAKE, YELLOW 6 LAKE, TITANIUM DIOXIDE, BLUE 1 LAKE, YELLOW 6, RED 40, YELLOW 5, BLUE 1), SODIUM CITRATE, CARNAUBA WAX.',
      }),
    );
    expect(concerns.map((concern) => concern.id)).toEqual(['added_sugar', 'dyes', 'ultra_processed']);
  });

  it('Diet Coke: names aspartame even with 0 g of added sugar', () => {
    const concerns = evaluateFood(
      food({
        addedSugarG: 0,
        ingredients: 'CARBONATED WATER, CARAMEL COLOR, ASPARTAME, PHOSPHORIC ACID, POTASSIUM BENZOATE (TO PROTECT TASTE), NATURAL FLAVORS, CITRIC ACID, CAFFEINE',
      }),
    );
    expect(concerns.map((concern) => concern.id)).toEqual(['sweetener', 'ultra_processed']);
    expect(concerns[0]?.detail).toBe('aspartame');
  });

  it('Oscar Mayer beef frank: cured meat leads', () => {
    const concerns = evaluateFood(
      food({
        ingredients:
          'BEEF, WATER, CONTAINS LESS THAN 2% OF SALT, CORN SYRUP, GROUND MUSTARD SEED, DEXTROSE, SODIUM PHOSPHATES, SODIUM DIACETATE, SODIUM BENZOATE, SODIUM ASCORBATE, FLAVOR, SODIUM NITRITE, EXTRACTIVES OF PAPRIKA, HYDROLYZED BEEF STOCK',
        context: 'food > meat & seafood > bacon, hot dogs, & sausages > hot dogs',
      }),
    );
    expect(concerns.map((concern) => concern.id)).toEqual(['processed_meat', 'ultra_processed']);
  });
});

describe('food concerns as short points', () => {
  it('cuts every reviewed note to 2 or 3 short points that keep the label value', () => {
    for (const info of Object.values(CONCERN_INFO)) {
      const points = info.points('sodium nitrite');
      expect(points.length).toBeGreaterThanOrEqual(2);
      expect(points.length).toBeLessThanOrEqual(3);
      for (const point of points) expect(point.length).toBeLessThanOrEqual(70);
    }
    expect(CONCERN_INFO.high_sodium.points('980 mg')[0]).toBe('980 mg of sodium per serving');
    expect(CONCERN_INFO.added_sugar.points('')).toEqual(['Has added sugar', 'Too much over time is linked to type 2 diabetes and heart disease', 'Skip it, buy less, or have it less often']);
  });
});

describe('ingredient wording on real labels', () => {
  it.each([
    ['mono- and diglycerides', 'emulsifiers'],
    ['monoglycerides and diglycerides', 'emulsifiers'],
  ])('reads "%s" as a marker of ultra-processed food', (ingredient, marker) => {
    const [concern] = evaluateFood(food({ ingredients: `flour, water, ${ingredient}, salt` }));
    expect(concern).toMatchObject({ id: 'ultra_processed' });
    expect(concern!.detail).toContain(marker);
  });

  it('does not read "non-hydrogenated" oil as trans fat or a marker', () => {
    expect(ids(food({ ingredients: 'non-hydrogenated palm oil, salt' }))).toEqual([]);
    expect(ids(food({ ingredients: 'partially hydrogenated soybean oil' }))).toContain('trans_fat');
  });

  it.each(['Red #40', 'FD&C Yellow #5', 'Blue No. 1 lake'])('reads the dye "%s"', (ingredient) => {
    expect(ids(food({ ingredients: `sugar, ${ingredient}` }))).toContain('dyes');
  });

  it('does not read a percentage such as "blue 2%" as a dye', () => {
    expect(ids(food({ ingredients: 'water, blue 2% milk fat' }))).not.toContain('dyes');
  });

  it('says "artificial" only for partially hydrogenated oil, not for trans fat that may be natural', () => {
    expect(CONCERN_INFO.trans_fat.note('partially hydrogenated oil')).toContain('artificial trans fat');
    const natural = CONCERN_INFO.trans_fat.note('0.5 g of trans fat per serving');
    expect(natural).not.toContain('artificial');
    expect(natural).toContain('This has 0.5 g of trans fat per serving.');
    expect(CONCERN_INFO.trans_fat.points('0.5 g of trans fat per serving')[0]).toBe('Trans fat (0.5 g of trans fat per serving)');
  });
});

describe('ingredients worth noting but never counted', () => {
  it.each(['modified cornstarch', 'modified food starch', 'modified corn starch', 'modified starch'])('notes "%s" without making it a concern', (ingredient) => {
    expect(foodWatchNotes(`cheddar cheese, ${ingredient}, natamycin`)).toEqual(['modified starch']);
    expect(ids(food({ ingredients: `cheddar cheese, ${ingredient}, natamycin` }))).toEqual([]);
  });

  it('notes nothing for plain starch or no ingredients', () => {
    expect(foodWatchNotes('corn, water, corn starch')).toEqual([]);
    expect(foodWatchNotes(null)).toEqual([]);
  });
});

describe('every concern on a food, most glaring first', () => {
  const syrupy = food({
    ingredients: 'water, high fructose corn syrup, corn syrup, natural flavors, xanthan gum, salt',
    addedSugarG: 12,
  });

  it('ranks added sugar, the mildest, after anything more glaring', () => {
    const order = byGlare(evaluateFood(syrupy)).map((concern) => concern.id);
    expect(order).toEqual(['ultra_processed', 'added_sugar']);
    expect(byGlare([{ id: 'added_sugar' }, { id: 'high_sodium' }, { id: 'dyes' }, { id: 'trans_fat' }, { id: 'sweetener' }].map((c) => c as { id: never })).map((c) => c.id)).toEqual(['trans_fat', 'sweetener', 'dyes', 'high_sodium', 'added_sugar']);
  });

  it('names the ultra-processed ingredients, not just "added sugar"', () => {
    const points = concernPoints(evaluateFood(syrupy));
    expect(points[0]).toBe('Ultra-processed: high-fructose corn syrup, corn syrup, flavorings, gums and thickeners');
    expect(points[1]).toBe('Has added sugar');
    expect(points).toHaveLength(3);
  });

  it('keeps all three points for a single concern, and says nothing for none', () => {
    expect(concernPoints(evaluateFood(food({ addedSugarG: 5, ingredients: 'sugar, water' })))).toEqual(CONCERN_INFO.added_sugar.points(''));
    expect(concernPoints([])).toEqual([]);
  });

  it('shows at most three concerns, then the action for the most glaring one', () => {
    const many = evaluateFood(food({ ingredients: 'pork, sodium nitrite, partially hydrogenated oil, aspartame, red 40, high fructose corn syrup', addedSugarG: 3, sodiumMg: 900, context: 'bacon' }));
    const points = concernPoints(many);
    expect(points).toHaveLength(4);
    expect(points[0]).toMatch(/^Artificial trans fat/);
    expect(points.at(-1)).toBe(CONCERN_INFO.trans_fat.points('x').at(-1));
  });

  it('reads out the reviewed note for every concern, most glaring first', () => {
    const text = concernNotes(evaluateFood(syrupy));
    expect(text.indexOf('ultra-processed')).toBeLessThan(text.indexOf('This has added sugar.'));
  });
});

describe('wider ingredient coverage, each tied to its source', () => {
  const detail = (ingredients: string, id: string, extra: Partial<FoodInputs> = {}) =>
    evaluateFood(food({ ingredients, ...extra })).find((concern) => concern.id === id)?.detail;

  it('names non-sugar sweeteners given by E-number', () => {
    expect(detail('WATER, E951, E950', 'sweetener')).toBe('aspartame, acesulfame potassium');
  });

  it('stays quiet on monk fruit, allulose, sugar alcohols, and plain sugar (no source names them)', () => {
    expect(ids(food({ ingredients: 'WATER, MONK FRUIT EXTRACT, LUO HAN GUO, MOGROSIDES' }))).toEqual([]);
    expect(ids(food({ ingredients: 'SUGAR, ALLULOSE, ERYTHRITOL, MALTITOL, MANNITOL' }))).toEqual([]);
  });

  it('reads dyes by E-number and chemical name', () => {
    expect(detail('SUGAR, E129, E102, TARTRAZINE, INDIGO CARMINE', 'dyes')).toBe('Red 40, Yellow 5, Blue 2');
  });

  it.each([
    ['fructose', 'WATER, CRYSTALLINE FRUCTOSE', 'fructose'],
    ['juice concentrate used as a sweetener', 'OATS, FRUIT JUICE CONCENTRATE', 'fruit juice concentrate'],
    ['invert sugar', 'SUGAR, INVERT SUGAR', 'invert sugar'],
    ['casein', 'WATER, SODIUM CASEINATE, CORN OIL', 'casein or whey protein'],
    ['whey protein', 'OATS, WHEY PROTEIN CONCENTRATE', 'casein or whey protein, protein concentrate'],
    ['pea protein', 'PEA PROTEIN CONCENTRATE, WATER', 'protein concentrate'],
    ['added gluten', 'FLOUR, WATER, VITAL WHEAT GLUTEN', 'added gluten'],
    ['mechanically separated chicken', 'MECHANICALLY SEPARATED CHICKEN, WATER', 'mechanically separated meat'],
    ['added fiber', 'WATER, SOLUBLE CORN FIBER, INULIN', 'added fiber'],
    ['MSG', 'CHICKEN, SALT, MONOSODIUM GLUTAMATE', 'flavor enhancers'],
    ['phosphates', 'MILK, DISODIUM PHOSPHATE, SODIUM HEXAMETAPHOSPHATE', 'phosphate salts'],
    ['emulsifiers', 'FLOUR, SUCROSE ESTERS OF FATTY ACIDS, SORBITAN MONOSTEARATE', 'emulsifiers'],
    ['gums', 'WATER, GUM ARABIC, SODIUM ALGINATE, MICROCRYSTALLINE CELLULOSE', 'gums and thickeners'],
    ['glaze', 'SUGAR, CONFECTIONER’S GLAZE, CARNAUBA WAX', 'glazes and anti-foaming agents'],
    ['white and orange colors', 'SUGAR, TITANIUM DIOXIDE, ORANGE B', 'color additives'],
  ])('flags %s as an ultra-processed marker', (_name, ingredients, expected) => {
    expect(detail(ingredients, 'ultra_processed')).toBe(expected);
  });

  it('does not add "fructose" on top of high-fructose corn syrup, or flag lactose-free milk', () => {
    expect(detail('WATER, HIGH FRUCTOSE CORN SYRUP', 'ultra_processed')).toBe('high-fructose corn syrup, corn syrup');
    expect(ids(food({ ingredients: 'LACTOSE-FREE MILK, LACTASE ENZYME, VITAMIN D3' }))).toEqual([]);
  });

  it('keeps everyday kitchen ingredients quiet', () => {
    expect(ids(food({ ingredients: 'WHOLE MILK, CREAM, SALT, VANILLA EXTRACT, PECTIN, GELATIN, BAKING SODA, ORANGE JUICE FROM CONCENTRATE' }))).toEqual([]);
    expect(ids(food({ ingredients: 'PASTEURIZED MILK, CHEESE CULTURES, ENZYMES, POWDERED CELLULOSE' }))).toEqual([]);
  });

  it('reads "uncured" celery-powder meats as cured, but only for cured-meat products', () => {
    expect(detail('PORK, WATER, SEA SALT, CULTURED CELERY POWDER', 'processed_meat', { context: 'food > meat > bacon' })).toBe('cultured celery powder, a natural nitrite source');
    expect(ids(food({ ingredients: 'CHICKEN BROTH, CARROTS, CELERY POWDER', context: 'food > soup' }))).toEqual([]);
    expect(detail('TURKEY, WATER, CELERY JUICE POWDER', 'processed_meat', { context: 'deli turkey' })).toBe('celery juice powder, a natural nitrite source');
  });

  it('reads more cured meats and curing salts', () => {
    expect(ids(food({ ingredients: 'PORK, SALT, CURING SALT', context: 'prosciutto' }))).toContain('processed_meat');
    expect(ids(food({ ingredients: 'PORK, WATER, SODIUM NITRITE', context: 'food > chorizo' }))).toContain('processed_meat');
  });
});
