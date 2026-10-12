import { describe, expect, it } from 'vitest';
import { PAGES, factsFor } from '../helpers/product-page';
import { reviewCart } from '../../src/background/review-cart';
import { assess, line, purchase, snapshot, tumblerReceipt } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';

/**
 * The simplified decision tree, one branch per test.
 *
 *   Food or not?
 *   ├─ Food ─ something on its label (what makes it processed)?
 *   │         ├─ yes → say what it is and cite the source (no store-brand switch)
 *   │         └─ no  → a cheaper store brand of the same quality? yes → recommend it; no → nothing
 *   ├─ Not food ─ useful?
 *   │         ├─ a novelty item with no use → skip it
 *   │         └─ useful ─ bought recently?
 *   │                   ├─ yes → warn (and ask)
 *   │                   └─ no  → a cheaper store brand that does the same job? yes → recommend it; no → nothing
 *   └─ Can't tell whether it is food → nothing
 */
const kindOf = (item: ReturnType<typeof assess>['items'][number]) => item.primary?.kind ?? null;

describe('food', () => {
  it('a whole food with a cheaper store brand gets that recommendation, and no health note', () => {
    const milk = assess(snapshot([line('10309701')]), { facts: { '10309701': factsFor(PAGES.milk) } }).items[0]!;
    expect(kindOf(milk)).toBe('cheaper_alternative');
  });

  it('a whole food with no cheaper store brand gets nothing', () => {
    const eggs = assess(snapshot([line('145051970')]), {
      facts: { '145051970': factsFor({ ...PAGES.milk, id: '145051970', name: 'Great Value Large White Eggs, 12 Count', path: ['Food', 'Dairy & Eggs', 'Eggs'], ingredients: 'EGGS' }) },
    }).items[0]!;
    expect(kindOf(eggs)).toBeNull();
  });

  it('a food with something flagged on its label says what it is, and suggests no store-brand switch', () => {
    const skittles = assess(snapshot([line('656700117')]), { facts: { '656700117': factsFor(PAGES.skittles) } }).items[0]!;
    expect(kindOf(skittles)).toBe('reduce_added_sugar');
    // Any other advice on it is another label concern, never a cheaper-brand switch.
    expect(skittles.secondary.every((suggestion) => suggestion.kind === 'reduce_food_concern')).toBe(true);
    expect(skittles.criteria.find((c) => c.criterion === 'added_sugar')?.points?.length).toBeGreaterThanOrEqual(2);
  });

  it('food is never questioned about a past purchase, however recent', () => {
    const history = [purchase('Great Value Large White Eggs, 12 Count', '2026-10-05', { retailerItemId: '145051970' })];
    const eggs = assess(snapshot([line('145051970')]), { history }).items[0]!;
    expect(eggs.question).toBeNull();
    expect(kindOf(eggs)).not.toBe('skip_redundant');
  });
});

describe('not food', () => {
  it('a novelty item with no use is flagged to skip', () => {
    expect(kindOf(assess(snapshot([line('17741466139')])).items[0]!)).toBe('skip_novelty');
  });

  it('a useful item bought recently is warned about, and the shopper is asked', () => {
    const tumbler = assess(snapshot([line('18256507800')]), { history: [tumblerReceipt()] }).items[0]!;
    expect(kindOf(tumbler)).toBe('skip_redundant');
    expect(tumbler.question).not.toBeNull();
    expect(tumbler.secondary).toEqual([]);
  });

  it('a useful item not bought recently gets the cheaper store brand', () => {
    const tumbler = assess(snapshot([line('18256507800')])).items[0]!;
    expect(tumbler.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 1200 });
  });

  it('a useful item bought long ago, with no cheaper store brand, gets nothing', () => {
    const lights = assess(snapshot([line('18110413708')]), { history: [purchase('Govee LED Strip Lights 32.8ft', '2026-06-01')] }).items[0]!;
    expect(kindOf(lights)).toBeNull();
  });

  it('a household consumable is restocking, not a warning', () => {
    const history = [purchase('Bounty Essentials Select-A-Size Paper Towels', '2026-10-05', { retailerItemId: '5308263928' })];
    const towels = assess(snapshot([line('5308263928')]), { history }).items[0]!;
    expect(kindOf(towels)).toBeNull();
    expect(towels.question).toBeNull();
  });
});

describe("when it can't tell whether an item is food", () => {
  it('says nothing, even with a similar past purchase (the eggs case)', () => {
    const eggs = line('987654321', { title: 'Great Value Large White Eggs, 60 Count' });
    const history = [purchase('Great Value Large White Eggs, 12 Count', '2026-08-15')];
    const item = assess(snapshot([eggs]), { history }).items[0]!;
    expect(kindOf(item)).toBeNull();
    expect(item.question).toBeNull();
  });
});

describe('an ingredient worth noting, but not counted', () => {
  it('shredded cheese with modified cornstarch keeps its store-brand swap, with the starch noted and not counted', () => {
    const cheese = assess(snapshot([line('43981978')])).items[0]!;
    // Still the cheaper store brand, at the same saving as before: the note changes nothing in the calculation.
    expect(cheese.primary).toMatchObject({ kind: 'cheaper_alternative', amountCents: 170 });
    const quality = cheese.criteria.find((c) => c.criterion === 'food_quality')!;
    expect(quality.status).toBe('no_concern');
    expect(quality.watch).toEqual(['modified starch']);
    expect(quality.summary).toMatch(/Also noted, but not counted: modified starch/);
    expect(quality.evidence[0]).toMatchObject({ label: 'Also noted (not counted)' });
  });

  it('is carried onto the item’s finding so it is shown, and adds nothing to the totals', () => {
    const result = reviewCart(snapshot([line('43981978')]), reviewContext());
    expect(result.findings.map((finding) => [finding.kind, finding.watch])).toEqual([['cheaper_alternative', ['modified starch']]]);
    expect(result.summary.totals).toEqual({ combinedCents: 170, alternativeCents: 170, skipCents: 0, uncountedItems: 0 });
  });
});
