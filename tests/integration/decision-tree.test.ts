import { describe, expect, it } from 'vitest';
import { reviewCart } from '../../src/background/review-cart';
import type { ProductFactsMap } from '../../src/domain/product-facts';
import { reviewContext } from '../helpers/background';
import { PAGES, factsFor, type PageSpec } from '../helpers/product-page';
import { criterion, line, snapshot } from '../helpers/assessment';
import { assess } from '../helpers/assessment';

/**
 * The decision tree end to end, from product-page facts only (none of these
 * IDs is in the reviewed reference list):
 *
 *   whole food → no comment
 *   processed food / added sugar / sweetener / ... → what's of concern, with a source
 *   non-food → novelty with no practical use → "probably not worth it"; anything else → no comment
 */
const asItem = (spec: PageSpec, id: string, extra: Partial<PageSpec> = {}): PageSpec => ({ ...spec, id, ...extra });

const SPECS = {
  milk: asItem(PAGES.milk, '90000001'),
  bananas: asItem(PAGES.bananas, '90000002'),
  skittles: asItem(PAGES.skittles, '90000003'),
  dietCoke: asItem(PAGES.dietCoke, '90000004'),
  hotDog: asItem(PAGES.hotDog, '90000005'),
  plush: asItem(PAGES.plush, '90000006'),
  paperTowels: asItem(PAGES.paperTowels, '90000007'),
  tumbler: asItem(PAGES.tumbler, '90000008'),
};

const price = { milk: 596, bananas: 59, skittles: 497, dietCoke: 181 + 199, hotDog: 899, plush: 397, paperTowels: 1297, tumbler: 2497 };

function cart(names: (keyof typeof SPECS)[]) {
  const items = names.map((name, position) =>
    line(SPECS[name].id, { title: SPECS[name].name, linePriceCents: price[name], quantity: 1 }, position),
  );
  const facts: ProductFactsMap = Object.fromEntries(names.map((name) => [SPECS[name].id, factsFor(SPECS[name])]));
  return { snapshot: snapshot(items), facts };
}

const review = (names: (keyof typeof SPECS)[]) => {
  const { snapshot: snap, facts } = cart(names);
  return reviewCart(snap, reviewContext({ facts }));
};

describe('whole foods and plain household goods get no comment', () => {
  it('milk, bananas, paper towels, and an ordinary tumbler produce no findings', () => {
    const result = review(['milk', 'bananas', 'paperTowels', 'tumbler']);
    expect(result.findings).toEqual([]);
    expect(result.summary.highlights).toEqual([]);
    expect(result.autoOpen).toBe(false);
    for (const item of result.assessment.items) expect(item.primary).toBeNull();
  });

  it('records why: the label showed nothing to flag (food) or the item is not food', () => {
    const { snapshot: snap, facts } = cart(['milk', 'paperTowels']);
    const [milk, towels] = assess(snap, { facts }).items;
    expect(criterion(milk!, 'food_quality').status).toBe('no_concern');
    expect(criterion(milk!, 'added_sugar').status).toBe('no_concern');
    expect(criterion(towels!, 'food_quality').status).toBe('not_applicable');
    expect(criterion(towels!, 'purpose').status).toBe('no_concern');
  });
});

describe('processed food is investigated, with a citation', () => {
  it('Skittles: every concern is named, the most glaring first and added sugar (the mildest) last, each with its source', () => {
    const finding = review(['skittles']).findings[0]!;
    expect(finding.kind).toBe('reduce_added_sugar');
    const text = finding.text;
    expect(text).toMatch(/^This has synthetic food dye/);
    expect(text.indexOf('synthetic food dye')).toBeLessThan(text.indexOf('ultra-processed'));
    expect(text.indexOf('ultra-processed')).toBeLessThan(text.indexOf('This has added sugar. Too much added sugar over time can contribute to health problems'));
    expect(text).toMatch(/Removing it would lower your cart by \$4\.97\.$/);
    // The slide's points name them too, not just "added sugar".
    expect(finding.points[0]).toMatch(/^Synthetic food dye \(/);
    expect(finding.points.some((point) => point.startsWith('Ultra-processed: '))).toBe(true);
    expect(finding.points).toContain('Has added sugar');
    const sourceIds = finding.sources.map((source) => source.id);
    expect(sourceIds).toEqual(expect.arrayContaining(['cdc_added_sugars', 'oehha_dyes', 'hall_upf', 'monteiro_nova', 'walmart_product_page']));
    expect(finding.why.map((row) => row.label)).toEqual(expect.arrayContaining(['Added sugars on label', 'Synthetic food dyes', 'Ultra-processed ingredients']));
  });

  it('Diet Coke: names aspartame and cites WHO, even with no added sugar', () => {
    const finding = review(['dietCoke']).findings[0]!;
    expect(finding.kind).toBe('reduce_food_concern');
    expect(finding.text).toMatch(/^This has aspartame, a non-sugar sweetener\. The WHO advises against using these to control weight/);
    expect(finding.text).toContain('Consider a version without it or having it less often.');
    expect(finding.sources.map((source) => source.id)).toEqual(expect.arrayContaining(['who_nss', 'walmart_product_page']));
    expect(finding.sources.find((source) => source.id === 'who_nss')?.url).toMatch(/^https:\/\/www\.who\.int\//);
  });

  it('hot dogs: cured, processed meat cites the WHO cancer agency without overstating', () => {
    const finding = review(['hotDog']).findings[0]!;
    expect(finding.kind).toBe('reduce_food_concern');
    expect(finding.text).toMatch(/cured, processed meat \(it lists sodium nitrite\)/);
    expect(finding.text).toMatch(/risk rises with how much is eaten/);
    expect(finding.text).not.toMatch(/\bcauses?\b|diagnos/i);
    expect(finding.sources.map((source) => source.id)).toContain('iarc_processed_meat');
  });

  it('never quotes a Daily Value percentage or a score in the default text', () => {
    for (const finding of review(['skittles', 'dietCoke', 'hotDog']).findings) {
      expect(finding.text).not.toMatch(/%|score|\bDV\b/i);
    }
  });

  it('uses only fixed wording for health notes, so nothing can be rephrased', () => {
    for (const finding of review(['skittles', 'dietCoke', 'hotDog']).findings) expect(finding.wording).toBeNull();
  });
});

describe('non-food: only a novelty item with no practical use is "probably not worth it"', () => {
  it('flags a collectible plush from its Walmart category', () => {
    const finding = review(['plush']).findings[0]!;
    expect(finding.kind).toBe('skip_novelty');
    expect(finding.text).toBe('This looks like a novelty item with no practical use, so it’s probably not worth it. Consider skipping it to take $3.97 off your cart.');
    expect(finding.why).toContainEqual({ label: 'Walmart category', value: 'Collectibles > Collectible Plush', source: 'walmart_product_page' });
  });

  it('leaves everyday non-food items alone, even when optional', () => {
    expect(review(['tumbler', 'paperTowels']).findings).toEqual([]);
  });
});

describe('the cart summary', () => {
  const result = review(['milk', 'bananas', 'skittles', 'dietCoke', 'hotDog', 'plush', 'paperTowels']);

  it('highlights at most three items and groups the rest', () => {
    expect(result.summary.opening).toBe('Before you check out, 3 things are worth a second thought.');
    expect(result.summary.highlights).toHaveLength(3);
    expect(result.summary.highlights.map((finding) => finding.kind)).toEqual(['reduce_food_concern', 'reduce_added_sugar', 'skip_novelty']);
    expect(result.summary.grouped).toMatchObject({
      label: 'You also had 1 other item you could reconsider or swap for a different one, worth about $3.80 more.',
      itemCount: 1,
      amountCents: 380,
    });
    expect(result.findings).toHaveLength(4);
  });

  it('counts each flagged item once, at its full price, and never counts quiet items', () => {
    const flagged = price.plush + price.skittles + price.dietCoke + price.hotDog;
    expect(result.summary.totals.combinedCents).toBe(flagged);
    expect(result.summary.totals.alternativeCents).toBe(0);
    expect(result.summary.investment?.principalCents).toBe(flagged);
  });

  it('assesses every item, including the quiet ones', () => {
    expect(result.assessment.items).toHaveLength(7);
  });
});

describe('missing or unreadable product pages', () => {
  it('reports unknown, flags nothing, and never guesses from the title', () => {
    const items = [line('90000003', { title: 'Skittles Original Chewy Candy', linePriceCents: 497 })];
    const result = reviewCart(snapshot(items), reviewContext({ facts: {} }));
    expect(result.findings).toEqual([]);
    const [item] = assess(snapshot(items)).items;
    expect(criterion(item!, 'added_sugar').status).toBe('unknown');
    expect(criterion(item!, 'food_quality').status).toBe('unknown');
  });

  it('a food with no ingredient list or Nutrition Facts is unknown, not a concern', () => {
    const spec: PageSpec = { id: '90000010', name: 'Mystery snack', path: ['Food', 'Snacks'], ingredients: null, nutrition: null };
    const items = [line(spec.id, { title: spec.name, linePriceCents: 300 })];
    const [item] = assess(snapshot(items), { facts: { [spec.id]: factsFor(spec) } }).items;
    expect(criterion(item!, 'food_quality').status).toBe('unknown');
    expect(item!.primary).toBeNull();
  });

  it('a page for a different product is ignored', () => {
    const { snapshot: snap } = cart(['skittles']);
    const wrong = { [SPECS.skittles.id]: { ...factsFor(SPECS.milk), itemId: '90000099' } };
    // Facts are keyed by the cart item's own ID; a mismatched record can't attach to it.
    expect(assess(snap, { facts: wrong }).items[0]!.primary).toBeNull();
  });
});

describe('reviewed reference data still works without product pages', () => {
  it('keeps the approved walkthrough findings when pages could not be read', () => {
    const items = [line('656700117'), line('15610624', {}, 1)];
    const result = reviewCart(snapshot(items), reviewContext());
    expect(result.findings.map((finding) => finding.kind)).toEqual(['reduce_added_sugar', 'cheaper_alternative']);
  });
});

describe('reviewed items whose product page is also read', () => {
  it('Diet Coke: the sweetener note leads, and no store-brand swap is vouched for without its ingredients', () => {
    const items = [line('15610624')];
    const facts = { '15610624': factsFor(PAGES.dietCoke) };
    const result = reviewCart(snapshot(items), reviewContext({ facts }));
    expect(result.findings.map((finding) => finding.kind)).toEqual(['reduce_food_concern']);
    expect(result.findings[0]!.text).toMatch(/^This has aspartame/);
    const [item] = result.assessment.items;
    expect(criterion(item!, 'store_brand').suggestion).toBeUndefined();
    expect(criterion(item!, 'store_brand').summary).toMatch(/ingredients aren’t recorded/);
    expect(result.summary.totals.combinedCents).toBe(item!.linePriceCents);
  });

  it('a flagged food gets its concern only: no store-brand switch is suggested, even when one exists', () => {
    const facts = factsFor({ ...PAGES.skittles, id: '10324125', name: "Eggland's Best Large White Eggs, 12 ct", path: ['Food', 'Dairy & Eggs'], ingredients: 'EGGS, NATURAL FLAVOR', nutrition: null });
    const items = [line('10324125')];
    const result = reviewCart(snapshot(items), reviewContext({ facts: { '10324125': facts } }));
    const finding = result.findings[0]!;
    expect(finding.kind).toBe('reduce_food_concern');
    expect(result.findings.map((candidate) => candidate.kind)).toEqual(['reduce_food_concern']);
    expect(result.summary.totals.alternativeCents).toBe(0);
  });

  it('a whole-food reviewed item keeps its approved store-brand suggestion', () => {
    const items = [line('10309701')];
    const result = reviewCart(snapshot(items), reviewContext({ facts: { '10309701': factsFor(PAGES.milk) } }));
    expect(result.findings.map((finding) => finding.kind)).toEqual(['cheaper_alternative']);
  });
});

describe('what is worth interrupting checkout for', () => {
  it('a store brand that costs more says nothing, so it never arms the checkout hold', () => {
    const result = reviewCart(snapshot([line('5308263928')]), reviewContext());
    expect(result.findings).toEqual([]);
    expect(result.summary.highlights).toEqual([]);
    expect(result.autoOpen).toBe(false);
  });

  it('something the shopper could act on does arm it', () => {
    expect(reviewCart(snapshot([line('656700117')]), reviewContext()).autoOpen).toBe(true);
  });
});
