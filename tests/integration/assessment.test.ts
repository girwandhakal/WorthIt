import { describe, expect, it } from 'vitest';
import { ADDED_SUGAR_NOTE } from '../../src/assessment/evidence/sources';
import { allReferenceProducts, referenceProduct, storeBrandAlternative } from '../../src/assessment/reference/products';
import { panelFindings } from '../../src/assessment/describe';
import { CRITERIA_VERSION, type CriterionId } from '../../src/domain/finding';
import {
  answer,
  assess,
  byId,
  criterion,
  line,
  purchase,
  snapshot,
  tumblerReceipt,
  walkthroughSnapshot,
} from '../helpers/assessment';
import { factsFor } from '../helpers/product-page';

const ALL_CRITERIA: CriterionId[] = ['readability', 'purpose', 'repeat_purchase', 'store_brand', 'added_sugar', 'food_quality'];
const totalOfPrimaries = (items: ReturnType<typeof assess>['items']) =>
  items.reduce((sum, item) => sum + (item.primary?.amountCents ?? 0), 0);

describe('mixed walkthrough cart (TECH_SPEC section 2)', () => {
  const history = [tumblerReceipt()];
  const result = assess(walkthroughSnapshot(), { history });

  it('assesses every line against every criterion with a version', () => {
    expect(result.items).toHaveLength(7);
    for (const item of result.items) {
      expect(item.criteria.map((c) => c.criterion)).toEqual(ALL_CRITERIA);
      expect(item.criteria.every((c) => c.version === CRITERIA_VERSION)).toBe(true);
    }
  });

  it('distinguishes essential from discretionary items', () => {
    expect(Object.fromEntries(result.items.map((item) => [item.retailerItemId, item.purposeClass]))).toEqual({
      '10309701': 'essential_consumable',
      '47088920': 'essential_consumable',
      '5308263928': 'essential_consumable',
      '15610624': 'discretionary',
      '18256507800': 'discretionary_trend',
      '17741466139': 'discretionary_novelty',
      '656700117': 'discretionary',
    });
  });

  it('chooses one primary suggestion per item, matching the walkthrough', () => {
    const primaries = Object.fromEntries(result.items.map((item) => [item.retailerItemId, [item.primary?.kind ?? null, item.primary?.amountCents ?? null]]));
    expect(primaries).toEqual({
      '10309701': ['cheaper_alternative', 199],
      '47088920': ['cheaper_alternative', 101],
      '5308263928': [null, null],
      '15610624': ['cheaper_alternative', 181],
      '18256507800': ['skip_redundant', 2497],
      '17741466139': ['skip_novelty', 397],
      '656700117': ['reduce_added_sugar', 497],
    });
    expect(totalOfPrimaries(result.items)).toBe(3872);
  });

  it('asks one question about the tumbler, and a warning replaces the cheaper-option advice', () => {
    const tumbler = byId(result.items, '18256507800');
    expect(tumbler.question?.prompt).toBe('Is this one replacing it, an extra, or for something different?');
    expect(tumbler.secondary).toEqual([]);
    expect(result.items.filter((item) => item.question)).toHaveLength(1);
  });

  it('says nothing about a store brand that costs more (paper towels), though the analysis shows the comparison', () => {
    const towels = byId(result.items, '5308263928');
    const storeBrand = criterion(towels, 'store_brand');
    expect(storeBrand.status).toBe('no_concern');
    expect(storeBrand.suggestion).toBeUndefined();
    expect(storeBrand.summary).toMatch(/costs more per unit/);
    expect(storeBrand.evidence.map((e) => e.value)).toContain('$1.23 vs $1.50 per 100 sheets');
    expect(towels.primary).toBeNull();
  });

  it('labels reference prices with their check date and as an estimate', () => {
    const milk = criterion(byId(result.items, '10309701'), 'store_brand');
    expect(milk.evidence.map((e) => e.label)).toContain('Store-brand price (last checked 2026-10-09)');
    expect(milk.summary).toMatch(/estimate/);
    expect(milk.confidence).toBe('medium');
    expect(milk.suggestion?.alternative).toMatchObject({ similarity: 'similar_ingredients', unitPriceComparison: '9.3¢ vs 6.2¢ per fl oz' });
  });

  it('computes each line’s share of the readable cart total', () => {
    expect(result.readableTotalCents).toBe(5379);
    expect(byId(result.items, '18256507800').shareOfCartBps).toBe(4642);
  });

  it('is deterministic', () => {
    expect(assess(walkthroughSnapshot(), { history })).toEqual(result);
  });

  it('ranks panel findings by potential savings, biggest first, then notes', () => {
    const findings = panelFindings(result, walkthroughSnapshot().items);
    expect(findings.map((f) => [f.kind, f.itemName.split(' ')[0]])).toEqual([
      ['skip_redundant', 'Stanley'],
      ['reduce_added_sugar', 'Skittles'],
      ['skip_novelty', 'Squishmallows'],
      ['cheaper_alternative', 'Horizon'],
      ['cheaper_alternative', 'Diet'],
      ['cheaper_alternative', 'Kraft'],
    ]);
    expect(findings[0]!.question).not.toBeNull();
  });
});

describe('clarification and the skip rule', () => {
  const cart = () => snapshot([line('18256507800')]);

  it('a replacement answer withdraws the skip and suggests the Ozark Trail tumbler ($12.00 less)', () => {
    const result = assess(walkthroughSnapshot(), { history: [tumblerReceipt()], clarifications: [answer('18256507800', 'replacement')] });
    const tumbler = byId(result.items, '18256507800');
    expect(tumbler.question).toBeNull();
    expect(tumbler.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 1200 });
    expect(tumbler.primary?.alternative?.name).toBe('Ozark Trail Insulated Tumbler with Handle, 30 oz');
    expect(criterion(tumbler, 'repeat_purchase')).toMatchObject({ status: 'no_concern', summary: 'You said this is a replacement.' });
    expect(totalOfPrimaries(result.items)).toBe(2575);
  });

  it('a different-purpose answer also withdraws the skip', () => {
    const tumbler = assess(cart(), { history: [tumblerReceipt()], clarifications: [answer('18256507800', 'different_purpose')] }).items[0]!;
    expect(tumbler.primary?.kind).toBe('cheaper_alternative');
  });

  it('an "extra" answer keeps the skip suggestion and is not asked again', () => {
    const tumbler = assess(cart(), { history: [tumblerReceipt()], clarifications: [answer('18256507800', 'additional')] }).items[0]!;
    expect(tumbler.primary?.kind).toBe('skip_redundant');
    expect(tumbler.question).toBeNull();
    expect(tumbler.answer).toBe('additional');
  });

  it('with no recent purchase, a trend item gets the cheaper alternative, not a skip', () => {
    const tumbler = assess(cart()).items[0]!;
    expect(tumbler.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 1200 });
    expect(tumbler.question).toBeNull();
  });

  it('a novelty item is skip-eligible without any history', () => {
    expect(assess(snapshot([line('17741466139')])).items[0]!.primary).toEqual({ kind: 'skip_novelty', amountCents: 397 });
  });

  it('decor bought recently is skip-eligible; long ago it is not', () => {
    const lights = snapshot([line('18110413708')]);
    const recent = purchase('Govee LED Strip Lights 32.8ft', '2026-08-01');
    const old = purchase('Govee LED Strip Lights 32.8ft', '2026-06-01');
    expect(assess(lights, { history: [recent] }).items[0]!.primary?.kind).toBe('skip_redundant');
    expect(assess(lights, { history: [old] }).items[0]!.primary).toBeNull();
  });

  it('every non-food item uses the same 90-day window, clothing included', () => {
    const shirts = snapshot([line('697314670')]);
    const at = (date: string) => assess(shirts, { history: [purchase('Fruit of the Loom Crew T-Shirts 5 pk', date)] }).items[0]!;
    expect(at('2026-07-13').primary?.kind).toBe('skip_redundant'); // 89 days
    expect(at('2026-07-11').primary?.kind).toBe('cheaper_alternative'); // 91 days: not recent, so the cheaper store brand
    expect(at('2026-07-13').purposeClass).toBe('essential_non_consumable');
  });

  it('food is never checked against past purchases', () => {
    const eggs = snapshot([line('145051970'), line('10309701', {}, 1)]);
    const history = [
      purchase('Great Value Large White Eggs, 12 Count', '2026-10-05', { retailerItemId: '145051970' }),
      purchase('Horizon Organic Vitamin D Whole Milk, 64 fl oz', '2026-10-08', { retailerItemId: '10309701' }),
    ];
    const result = assess(eggs, { history });
    for (const item of result.items) {
      expect(item.primary?.kind).not.toBe('skip_redundant');
      expect(item.question).toBeNull();
      expect(criterion(item, 'repeat_purchase')).toMatchObject({ status: 'not_applicable' });
      expect(criterion(item, 'repeat_purchase').summary).toMatch(/bought again and again/);
    }
  });

  it('household consumables are restocking too: bought recently is routine, not a warning', () => {
    const history = [purchase('Bounty Essentials Select-A-Size Paper Towels', '2026-10-05', { retailerItemId: '5308263928' })];
    const towels = assess(snapshot([line('5308263928')]), { history }).items[0]!;
    expect(towels.primary).toBeNull();
    expect(towels.question).toBeNull();
    expect(criterion(towels, 'repeat_purchase').status).toBe('no_concern');
    expect(criterion(towels, 'repeat_purchase').summary).toMatch(/routine restocking/);
  });

  it('candy bought recently is mentioned only as history', () => {
    const skittles = assess(snapshot([line('656700117')]), { history: [purchase('Skittles Original', '2026-10-03', { retailerItemId: '656700117' })] }).items[0]!;
    expect(skittles.primary?.kind).toBe('reduce_added_sugar');
    expect(criterion(skittles, 'repeat_purchase').status).toBe('not_applicable');
    expect(skittles.historyMatches).toHaveLength(1);
  });
});

describe('history matching', () => {
  const tumbler = line('18256507800');

  it.each([
    ['exact by item ID', purchase('Some other name', '2026-10-01', { retailerItemId: '18256507800' }), 'exact'],
    ['exact by name', purchase('Stanley Quencher FlowState Tumbler, 30 oz', '2026-10-01'), 'exact'],
    ['similar by item type', purchase('Owala FreeSip Insulated Tumbler 24 oz', '2026-10-01'), 'similar'],
    ['similar by reference item type', purchase('Store tumbler', '2026-10-01', { retailerItemId: '14622112422' }), 'similar'],
  ])('%s', (_label, record, kind) => {
    const item = assess(snapshot([tumbler]), { history: [record] }).items[0]!;
    expect(item.historyMatches[0]?.kind).toBe(kind);
    expect(item.primary?.kind).toBe('skip_redundant');
  });

  it('ignores unrelated purchases', () => {
    const item = assess(snapshot([tumbler]), { history: [purchase('Bounty paper towels', '2026-10-01'), purchase('Hanes T-shirts', '2026-10-01')] }).items[0]!;
    expect(item.historyMatches).toEqual([]);
    expect(criterion(item, 'repeat_purchase').summary).toBe('No recent similar purchase in your history.');
  });

  it.each(['returned', 'canceled', 'refunded'] as const)('does not count a %s purchase', (status) => {
    const item = assess(snapshot([tumbler]), { history: [purchase('Owala insulated tumbler', '2026-10-01', { status })] }).items[0]!;
    expect(item.primary?.kind).toBe('cheaper_alternative');
    expect(criterion(item, 'repeat_purchase').summary).toMatch(new RegExp(`was ${status}`, 'i'));
  });

  it('labels a similar match as less certain than an exact one', () => {
    const similar = assess(snapshot([tumbler]), { history: [purchase('Owala insulated tumbler', '2026-10-01')] }).items[0]!;
    expect(criterion(similar, 'repeat_purchase').confidence).toBe('medium');
    expect(criterion(similar, 'repeat_purchase').summary).toMatch(/doesn’t prove you still have it/);
  });

  it('when it cannot tell whether an item is food, it says nothing about past purchases', () => {
    const unknown = line('99999999', { title: 'Mystery Gadget' });
    const item = assess(snapshot([unknown]), { history: [purchase('Mystery Gadget', '2026-09-30')] }).items[0]!;
    expect(item.purposeClass).toBe('unknown');
    expect(item.primary).toBeNull();
    expect(item.question).toBeNull();
    expect(criterion(item, 'repeat_purchase').status).toBe('unknown');
    expect(criterion(item, 'repeat_purchase').summary).toMatch(/couldn’t tell whether this is food/);
  });

  it('does not question eggs whose page was not read, even with a similar past purchase', () => {
    const eggs = line('987654321', { title: 'Great Value Large White Eggs, 60 Count' });
    const item = assess(snapshot([eggs]), { history: [purchase('Great Value Large White Eggs, 12 Count', '2026-08-15')] }).items[0]!;
    expect(item.primary).toBeNull();
    expect(item.question).toBeNull();
  });

  describe('an item with no reference data that looks like a past purchase', () => {
    const talTitle = 'TAL 40oz Stainless Steel Hudson Tumbler with Straw, Sage';
    const tal = line('999000111', { title: talTitle });
    const talFacts = factsFor({
      id: '999000111',
      name: talTitle,
      path: ['Sports & Outdoors', 'Outdoor Tumblers', '40 oz Tumblers'],
    });
    const stanley = purchase('Stanley Quencher H2.0 FlowState Tumbler, 30 oz', '2026-09-20', { retailerItemId: '18256507800' });

    it('flags a similar tumbler as a skip once the page shows it is not food, and asks why', () => {
      const item = assess(snapshot([tal]), { history: [stanley], facts: { '999000111': talFacts } }).items[0]!;
      expect(item.historyMatches).toMatchObject([{ kind: 'similar', daysAgo: 20 }]);
      expect(item.primary).toEqual({ kind: 'skip_redundant', amountCents: 100 });
      expect(item.question).not.toBeNull();
      expect(criterion(item, 'repeat_purchase')).toMatchObject({
        status: 'finding',
        confidence: 'low',
        summary: expect.stringMatching(/^You bought a similar item 20 days ago/) as unknown as string,
      });
    });

    it('says nothing when the page could not be read, so it cannot tell it is not food', () => {
      const item = assess(snapshot([tal]), { history: [stanley] }).items[0]!;
      expect(item.historyMatches).toMatchObject([{ kind: 'similar', daysAgo: 20 }]);
      expect(item.primary).toBeNull();
      expect(item.question).toBeNull();
    });

    it('shows the skip with its amount, so it ranks among the highlights', () => {
      const result = assess(snapshot([tal]), { history: [stanley], facts: { '999000111': talFacts } });
      const finding = panelFindings(result, snapshot([tal]).items).find((candidate) => candidate.kind === 'skip_redundant');
      expect(finding?.text).toMatch(/a similar one/);
      expect(finding?.amountCents).toBe(100);
      expect(finding?.question).not.toBeNull();
    });

    it.each(['broke', 'gift', 'replacement', 'different_purpose'] as const)('a "%s" answer withdraws the skip', (value) => {
      const item = assess(snapshot([tal]), { history: [stanley], facts: { '999000111': talFacts }, clarifications: [answer('999000111', value)] }).items[0]!;
      expect(item.primary).toBeNull();
      expect(item.question).toBeNull();
    });

    it('an "extra" answer keeps the skip', () => {
      const item = assess(snapshot([tal]), { history: [stanley], facts: { '999000111': talFacts }, clarifications: [answer('999000111', 'additional')] }).items[0]!;
      expect(item.primary?.kind).toBe('skip_redundant');
    });

    it('matches by name similarity alone, beyond the keyword types', () => {
      const cooker = line('999000222', { title: 'Instant Pot Duo 6 Qt Pressure Cooker' });
      const cookerFacts = factsFor({ id: '999000222', name: 'Instant Pot Duo 6 Qt Pressure Cooker', path: ['Home', 'Small Appliances', 'Pressure Cookers'] });
      const history = [purchase('Ninja Foodi 8 Qt Pressure Cooker', '2026-09-01')];
      const item = assess(snapshot([cooker]), { history, facts: { '999000222': cookerFacts } }).items[0]!;
      expect(item.historyMatches[0]?.kind).toBe('similar');
      expect(item.primary?.kind).toBe('skip_redundant');
      expect(item.question).not.toBeNull();
    });

    it('ignores a returned similar purchase', () => {
      const item = assess(snapshot([tal]), { history: [{ ...stanley, status: 'returned' }], facts: { '999000111': talFacts } }).items[0]!;
      expect(item.question).toBeNull();
    });

    it('does not match unrelated purchases', () => {
      const history = [purchase('Hanes Men’s Value Pack Crew T-Shirts, 6 pk', '2026-09-20'), purchase('Skittles Original Fruity Candy', '2026-10-03')];
      const item = assess(snapshot([tal]), { history, facts: { '999000111': talFacts } }).items[0]!;
      expect(item.historyMatches).toEqual([]);
      expect(item.question).toBeNull();
    });
  });
});

describe('store-brand value', () => {
  it('recognizes the reviewed 16 oz cheese separately from the 8 oz variant', () => {
    const cheese = assess(snapshot([line('43981978')])).items[0]!;
    expect(cheese.purposeClass).toBe('essential_consumable');
    expect(criterion(cheese, 'added_sugar').status).toBe('no_concern');
    expect(cheese.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 170 });
    expect(cheese.primary?.alternative).toMatchObject({ itemId: '10452370', similarity: 'different_ingredients' });
    expect(cheese.primary?.alternative?.differences).toContain('The store brand is finely shredded; this Kraft cheese is regular shredded.');
    expect(cheese.primary?.alternative?.differences.join(' ')).toMatch(/8 oz vs 16 oz/);
    expect(criterion(cheese, 'store_brand').evidence.map(e => e.label)).toContain('Store-brand price (last checked 2026-10-09)');
  });

  it('keeps the 16 oz cheese cart price unknown when it cannot be extracted', () => {
    const cheese = assess(snapshot([line('43981978', { linePriceCents: null })])).items[0]!;
    expect(cheese.purposeClass).toBe('essential_consumable');
    expect(criterion(cheese, 'readability').status).toBe('unknown');
    expect(criterion(cheese, 'store_brand').status).toBe('unknown');
    expect(cheese.primary).toBeNull();
  });

  it('uses the live 16 oz cheese price rather than its published reference price', () => {
    const cheese = assess(snapshot([line('43981978', { linePriceCents: 450 })])).items[0]!;
    expect(cheese.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 56 });
  });

  it('coffee: unit prices within 5% are "about the same", so nothing is recommended', () => {
    const item = assess(snapshot([line('578550306')])).items[0]!;
    const coffee = criterion(item, 'store_brand');
    expect(coffee.status).toBe('no_concern');
    expect(coffee.suggestion).toBeUndefined();
    expect(coffee.summary).toMatch(/about the same/);
    expect(item.primary).toBeNull();
  });

  it('orange juice: the store package costs more but its unit price is lower, saving about $0.38', () => {
    const oj = assess(snapshot([line('5512318310')])).items[0]!;
    expect(oj.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 38 });
    expect(oj.primary?.alternative?.differences[0]).toMatch(/52 fl oz vs 46 fl oz/);
  });

  it('Cheerios: savings for the same 8.9 oz would be $1.75, but the store brand lists added sugar, so no switch', () => {
    const cheerios = assess(snapshot([line('10311408')])).items[0]!;
    expect(criterion(cheerios, 'store_brand')).toMatchObject({ status: 'no_concern' });
    expect(criterion(cheerios, 'store_brand').summary).toMatch(/isn’t suggested because its label lists added sugar/);
    expect(cheerios.primary?.kind).toBe('reduce_added_sugar');
  });

  it('scales savings by quantity using the live cart price', () => {
    const milk = assess(snapshot([line('10309701', { quantity: 3, linePriceCents: 1788 })])).items[0]!;
    expect(milk.primary?.amountCents).toBe(597);
  });

  it('uses the live (discounted) price, not the reference price', () => {
    const milk = assess(snapshot([line('10309701', { linePriceCents: 450 })])).items[0]!;
    expect(milk.primary).toEqual(expect.objectContaining({ kind: 'cheaper_alternative', amountCents: 53 }));
    const cheaperThanStore = assess(snapshot([line('10309701', { linePriceCents: 400 })])).items[0]!;
    expect(cheaperThanStore.primary).toBeNull(); // within 5%: no savings claimed
  });

  it('returns unknown when the cart price is unreadable', () => {
    const milk = assess(snapshot([line('10309701', { linePriceCents: null })])).items[0]!;
    expect(criterion(milk, 'store_brand').status).toBe('unknown');
    expect(milk.primary).toBeNull();
  });

  it('is not applicable to a store-brand item', () => {
    expect(criterion(assess(snapshot([line('10315798')])).items[0]!, 'store_brand').status).toBe('not_applicable');
  });

  it('flags an allergy conflict instead of suggesting the store brand', () => {
    const milk = assess(snapshot([line('10309701')]), { preferences: { allergens: ['milk'], dietaryPreferences: [] } }).items[0]!;
    expect(milk.primary).toBeNull();
    expect(criterion(milk, 'store_brand').summary).toBe(
      'Great Value Organic Whole Vitamin D Milk, 64 fl oz isn’t suggested: its label lists milk, which you marked as an allergy.',
    );
  });

  it('flags a dietary conflict', () => {
    const cheddar = assess(snapshot([line('47088920')]), { preferences: { allergens: [], dietaryPreferences: ['vegan'] } }).items[0]!;
    expect(criterion(cheddar, 'store_brand').summary).toMatch(/isn’t vegan/);
    expect(cheddar.primary).toBeNull();
  });

  it('notes material non-label differences (Glad ForceFlex stretch)', () => {
    const bags = assess(snapshot([line('123015473')])).items[0]!;
    expect(bags.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 450 });
    expect(bags.primary?.alternative).toMatchObject({ similarity: 'not_food' });
    expect(bags.primary?.alternative?.differences).toContain('Glad ForceFlex bags stretch; the store-brand bags are standard drawstring bags.');
  });

  it('claims similar ingredients only when both labels are recorded', () => {
    const dietCoke = assess(snapshot([line('15610624')])).items[0]!;
    expect(dietCoke.primary?.alternative?.similarity).toBe('unknown');
    expect(panelFindings(assess(snapshot([line('15610624')])), [line('15610624')])[0]!.text).not.toMatch(/similar ingredients/);
  });
});

describe('added-sugar rule (the only health rule)', () => {
  it('assesses all three reported cart products using their exact reviewed IDs', () => {
    const result = assess(snapshot([line('16275314128'), line('43981978'), line('10309701')]));
    expect(result.items.map((item) => [item.purposeClass, item.primary?.kind, item.primary?.amountCents])).toEqual([
      ['discretionary', 'reduce_added_sugar', 268],
      ['essential_consumable', 'cheaper_alternative', 170],
      ['essential_consumable', 'cheaper_alternative', 199],
    ]);
    expect(result.readableTotalCents).toBe(1428);
    expect(totalOfPrimaries(result.items)).toBe(637);
    expect(criterion(result.items[0]!, 'added_sugar').summary).toBe(ADDED_SUGAR_NOTE);
    expect(criterion(result.items[0]!, 'store_brand').status).toBe('not_applicable');
  });

  it('does not copy seasonal donut label facts to an unreviewed ID with the same title', () => {
    const donut = assess(snapshot([line('99999999', { title: referenceProduct('16275314128')!.name })])).items[0]!;
    expect(donut.purposeClass).toBe('unknown');
    expect(criterion(donut, 'added_sugar').status).toBe('unknown');
    expect(donut.primary).toBeNull();
  });

  it('0 g: no note', () => {
    const dietCoke = assess(snapshot([line('15610624')])).items[0]!;
    expect(criterion(dietCoke, 'added_sugar').status).toBe('no_concern');
  });

  it('more than 0 g: the fixed note, CDC source, and a skip-or-reduce suggestion for the line price', () => {
    const skittles = assess(snapshot([line('656700117')])).items[0]!;
    const sugar = criterion(skittles, 'added_sugar');
    expect(sugar.status).toBe('finding');
    expect(sugar.summary).toBe(ADDED_SUGAR_NOTE);
    expect(sugar.evidence.map((e) => e.source)).toContain('cdc_added_sugars');
    expect(skittles.primary).toEqual({ kind: 'reduce_added_sugar', amountCents: 497 });
    const finding = panelFindings(assess(snapshot([line('656700117')])), [line('656700117')])[0]!;
    expect(finding.sources.map((s) => s.url)).toContain('https://www.cdc.gov/nutrition/php/data-research/added-sugars.html');
  });

  it('never quotes Daily Value percentages or gram amounts', () => {
    const findings = panelFindings(assess(snapshot([line('656700117')])), [line('656700117')]);
    expect(ADDED_SUGAR_NOTE).not.toMatch(/%|daily value|\d+ ?g\b/i);
    expect(JSON.stringify(findings[0]!.why.filter((e) => e.label !== 'Share of your cart'))).not.toMatch(/%|\d+ ?g\b/);
  });

  it('unknown added sugar: no note, and never suggested as an alternative', () => {
    const product = { ...referenceProduct('10309701')!, label: { ...referenceProduct('10309701')!.label!, addedSugarG: null } };
    const result = assess(snapshot([line('10309701')]), { lookupReference: () => product });
    expect(criterion(result.items[0]!, 'added_sugar').status).toBe('unknown');

    const altWithUnknownSugar = { ...referenceProduct('10315798')!, label: { ...referenceProduct('10315798')!.label!, addedSugarG: null } };
    expect(altWithUnknownSugar.label.addedSugarG).toBeNull();
  });

  it('a store brand with added sugar is never suggested; the name brand gets the note instead (cola)', () => {
    const cola = assess(snapshot([line('16618684')])).items[0]!;
    expect(cola.primary?.kind).toBe('reduce_added_sugar');
    expect([cola.primary, ...cola.secondary].some((s) => s?.kind === 'cheaper_alternative')).toBe(false);
  });

  it('non-food items are not applicable', () => {
    expect(criterion(assess(snapshot([line('5308263928')])).items[0]!, 'added_sugar').status).toBe('not_applicable');
  });
});

describe('insufficient evidence', () => {
  it('an item with no reference data is unknown everywhere it depends on product facts', () => {
    const item = assess(snapshot([line('99999999', { title: 'Mystery Item' })])).items[0]!;
    expect(Object.fromEntries(item.criteria.map((c) => [c.criterion, c.status]))).toEqual({
      readability: 'no_concern',
      purpose: 'unknown',
      repeat_purchase: 'unknown',
      store_brand: 'unknown',
      added_sugar: 'unknown',
      food_quality: 'unknown',
    });
    expect(item.primary).toBeNull();
    expect(panelFindings(assess(snapshot([line('99999999')])), [line('99999999')])).toEqual([]);
  });

  it('a normal store-brand cart has nothing to show', () => {
    const cart = snapshot([line('10315798'), line('145051970', {}, 1), line('10315395', {}, 2)]);
    const result = assess(cart);
    expect(result.items.every((item) => item.primary === null && item.question === null)).toBe(true);
    expect(panelFindings(result, cart.items)).toEqual([]);
  });
});

describe('reference data integrity', () => {
  it('every pair points at a store brand of the same item type and unit', () => {
    for (const product of allReferenceProducts().filter((p) => p.storeBrandAlternativeId)) {
      const alternative = storeBrandAlternative(product)!;
      expect(alternative.storeBrand).toBe(true);
      expect(alternative.itemType).toBe(product.itemType);
      expect(alternative.size.unit).toBe(product.size.unit);
    }
  });

  it('every food or drink records its added-sugar amount', () => {
    const foods = allReferenceProducts().filter((p) => ['grocery_staple', 'soda', 'candy', 'snack'].includes(p.category));
    expect(foods.every((p) => p.label && p.label.addedSugarG !== null)).toBe(true);
  });
});
