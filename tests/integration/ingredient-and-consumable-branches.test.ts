import { describe, expect, it } from 'vitest';
import { factsFor } from '../helpers/product-page';
import { reviewCart } from '../../src/background/review-cart';
import { assess, line, purchase, snapshot } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';

/**
 * Decision-tree branches not covered by assessment.test.ts, decision-tree.test.ts, or non-food-branches.test.ts:
 * an ingredient that is noted but never counted, and non-food consumables recognized from their product page.
 */

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

describe('non-food consumables whose page was read', () => {
  it.each([
    ['dog food', ['Pets', 'Dog Supplies', 'Dog Food']],
    ['dish soap', ['Household Essentials', 'Cleaning Supplies', 'Dish Soap']],
  ])('%s bought recently is restocking, not a warning', (_name, path) => {
    const item = line('999000333', { title: 'Great Value Everyday Item' });
    const facts = { '999000333': factsFor({ id: '999000333', name: 'Great Value Everyday Item', path }) };
    const history = [purchase('Great Value Everyday Item', '2026-09-20')];
    const result = assess(snapshot([item]), { history, facts }).items[0]!;
    expect(result.purposeClass).toBe('essential_consumable');
    expect(result.primary).toBeNull();
    expect(result.question).toBeNull();
  });

  it('a durable non-food item in the same situation is still warned about', () => {
    const item = line('999000444', { title: 'Instant Pot Duo 6 Qt Pressure Cooker' });
    const facts = { '999000444': factsFor({ id: '999000444', name: 'Instant Pot Duo 6 Qt Pressure Cooker', path: ['Home', 'Small Appliances', 'Pressure Cookers'] }) };
    const history = [purchase('Instant Pot Duo 6 Qt Pressure Cooker', '2026-09-20')];
    expect(assess(snapshot([item]), { history, facts }).items[0]!.primary?.kind).toBe('skip_redundant');
  });
});
