import { describe, expect, it } from 'vitest';
import { CONCERN_INFO, evaluateFood, foodWatchNotes, type FoodInputs } from '../../src/assessment/rules/food-quality';

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
