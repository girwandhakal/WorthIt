import { describe, expect, it } from 'vitest';
import { SIMILAR_TITLE_THRESHOLD, titleSimilarity, titleTokens } from '../../src/assessment/similarity';

const TAL = 'TAL 40oz Stainless Steel Hudson Tumbler with Straw, Sage';
const TAL_CATEGORY = ['Sports & Outdoors', 'Outdoor Tumblers', '40 oz Tumblers'];
const STANLEY = 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz';

describe('titleTokens', () => {
  it('keeps what the product is and drops sizes, units, colors, filler, and plurals', () => {
    expect(titleTokens(TAL)).toEqual(['tal', 'stainless', 'steel', 'hudson', 'tumbler', 'straw']);
    expect(titleTokens('Hanes Men’s Value Pack Crew T-Shirts, 6 pk')).toEqual(['hane', 'crew', 'shirt']);
  });
});

describe('titleSimilarity (cosine)', () => {
  it('is 1 for identical titles and 0 for titles with nothing in common', () => {
    expect(titleSimilarity(STANLEY, [], STANLEY)).toBeCloseTo(1, 5);
    expect(titleSimilarity(TAL, [], 'Skittles Original Fruity Candy, Sharing Size, 15.6 oz')).toBe(0);
  });

  it('uses the retailer category to see that two differently named tumblers are the same kind of item', () => {
    expect(titleSimilarity(TAL, TAL_CATEGORY, STANLEY)).toBeGreaterThanOrEqual(SIMILAR_TITLE_THRESHOLD);
    // Without the category, a single shared word is not enough on its own.
    expect(titleSimilarity(TAL, [], STANLEY)).toBeLessThan(SIMILAR_TITLE_THRESHOLD);
  });

  it('matches products that share most of their name', () => {
    expect(titleSimilarity('Instant Pot Duo 6 Qt Pressure Cooker', [], 'Ninja Foodi 8 Qt Pressure Cooker')).toBeGreaterThanOrEqual(
      SIMILAR_TITLE_THRESHOLD,
    );
  });

  it.each([
    ['Horizon Organic Vitamin D Whole Milk, 64 fl oz', 'Kraft Natural Mild Cheddar Finely Shredded Cheese, 8 oz'],
    ['Great Value Large White Eggs, 12 Count', 'Great Value Whole Milk, 1 Gallon'],
    [TAL, 'Hanes Men’s Value Pack Crew T-Shirts, 6 pk'],
    [TAL, 'Monster 16.4 ft LED Strip Lights'],
  ])('does not call unrelated products similar: %s / %s', (a, b) => {
    expect(titleSimilarity(a, [], b)).toBeLessThan(SIMILAR_TITLE_THRESHOLD);
  });

  it('is symmetric without a category', () => {
    expect(titleSimilarity(TAL, [], STANLEY)).toBeCloseTo(titleSimilarity(STANLEY, [], TAL), 10);
  });
});
