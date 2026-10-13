import { describe, expect, it } from 'vitest';
import { panelFindings } from '../../src/assessment/describe';
import { investmentIllustration } from '../../src/assessment/investment';
import { groupedLabel, summarizeCart } from '../../src/assessment/summarize-cart';
import type { ReviewFinding } from '../../src/domain/review';
import { futureValueCents, shareBps } from '../../src/shared/calculations';
import { answer, assess, line, snapshot, tumblerReceipt, walkthroughSnapshot } from '../helpers/assessment';

function summaryFor(cart = walkthroughSnapshot(), inputs: Parameters<typeof assess>[1] = { history: [tumblerReceipt()] }, illustration = true) {
  const assessment = assess(cart, inputs);
  return summarizeCart(assessment, panelFindings(assessment, cart.items), { investmentIllustration: illustration });
}

describe('futureValueCents (FV = P × 1.1^40, rounded once)', () => {
  it.each([
    [1000, 45259], // $10 → about $452.59
    [500, 22630], // $5 → about $226.30
    [3872, 175244], // $38.72 → about $1,752.44
    [2575, 116543], // $25.75 → about $1,165.43
    [1, 45],
    [0, 0],
    [-5, 0],
  ])('%i¢ → %i¢', (principal, expected) => {
    expect(futureValueCents(principal)).toBe(expected);
  });

  it('shares use basis points and need a positive denominator', () => {
    expect(shareBps(2497, 5379)).toBe(4642);
    expect(shareBps(1, null)).toBeNull();
    expect(shareBps(1, 0)).toBeNull();
  });
});

describe('investmentIllustration', () => {
  it('is one short sentence with code-calculated amounts', () => {
    expect(investmentIllustration(3872, true)?.sentence).toBe(
      'Invested at an assumed 10% a year, $38.72 could grow to about $1,752.44 in 40 years.',
    );
  });

  it('is omitted when turned off or when there is nothing to illustrate', () => {
    expect(investmentIllustration(3872, false)).toBeNull();
    expect(investmentIllustration(0, true)).toBeNull();
  });
});

describe('summarizeCart', () => {
  it('matches the walkthrough: three highlights, grouped swaps, $38.72 → about $1,752.44', () => {
    const summary = summaryFor();
    expect(summary.opening).toBe('Before you check out, 3 things are worth a second thought.');
    expect(summary.highlights.map((h) => h.itemName.split(' ')[0])).toEqual(['Stanley', 'Skittles', 'Squishmallows']);
    expect(summary.grouped).toMatchObject({ label: 'You also had 3 other items you could reconsider or swap for a different one, worth about $4.81 more.', itemCount: 3, amountCents: 481 });
    expect(summary.grouped?.findings.map((f) => f.kind)).toEqual(['cheaper_alternative', 'cheaper_alternative', 'cheaper_alternative']);
    expect(summary.totals).toEqual({ combinedCents: 3872, alternativeCents: 481, skipCents: 3391, uncountedItems: 0 });
    expect(summary.investment).toMatchObject({ principalCents: 3872, futureValueCents: 175244 });
    expect(summary.savingsSentence).toBeNull();
    expect(summary.handBack).toBe('It’s your call.');
  });

  it('after "Replacing a worn one": $25.75 → about $1,165.43', () => {
    const summary = summaryFor(walkthroughSnapshot(), { history: [tumblerReceipt()], clarifications: [answer('18256507800', 'replacement')] });
    expect(summary.totals.combinedCents).toBe(2575);
    expect(summary.investment?.sentence).toContain('could grow to about $1,165.43 in 40 years');
    expect(summary.highlights.map((h) => h.itemName.split(' ')[0])).toEqual(['Stanley', 'Skittles', 'Squishmallows']);
  });

  it('counts a recently bought item once, at its full price, with no cheaper-option amount alongside', () => {
    const summary = summaryFor(snapshot([line('18256507800')]));
    expect(summary.totals).toMatchObject({ combinedCents: 2497, alternativeCents: 0, skipCents: 2497 });
  });

  it('shows only the savings sentence when the illustration is off', () => {
    const summary = summaryFor(walkthroughSnapshot(), { history: [tumblerReceipt()] }, false);
    expect(summary.investment).toBeNull();
    expect(summary.savingsSentence).toBe('By following these suggestions, you would save $38.72.');
  });

  it('handles quantities and missing prices without guessing', () => {
    const cart = snapshot([line('10309701', { quantity: 2, linePriceCents: 1192 }), line('17741466139', { linePriceCents: null }, 1)]);
    const summary = summaryFor(cart, {});
    expect(summary.totals).toEqual({ combinedCents: 398, alternativeCents: 398, skipCents: 0, uncountedItems: 1 });
  });

  it('has no recap content for a cart with nothing to flag', () => {
    const summary = summaryFor(snapshot([line('10315798'), line('145051970', {}, 1)]), {});
    expect(summary).toMatchObject({ opening: '', highlights: [], grouped: null, investment: null, savingsSentence: null });
  });

  it('highlights uncertainty when nothing else needs attention', () => {
    const summary = summaryFor(snapshot([line('10315798', { linePriceCents: null })]), {});
    expect(summary.opening).toBe('Before you check out, a quick note: Worth It couldn’t read everything in your cart.');
    expect(summary.highlights.map((h) => h.kind)).toEqual(['uncertain']);
  });

  it('breaks ranking ties by cart order', () => {
    const cart = snapshot([line('656700117'), line('17569970321', { linePriceCents: 497 }, 1)]);
    expect(summaryFor(cart, {}).highlights.map((h) => h.position)).toEqual([0, 1]);
  });
});

describe('groupedLabel when only notes are left', () => {
  const note = (kind: ReviewFinding['kind']) => ({ kind }) as ReviewFinding;

  it('says what the notes are instead of counting them', () => {
    expect(groupedLabel([note('uncertain'), note('uncertain')])).toBe(
      'Also: Worth It couldn’t read 2 things in your cart reliably, so this review may be incomplete.',
    );
    expect(groupedLabel([note('uncertain')])).toBe('Also: Worth It couldn’t read one thing in your cart reliably, so this review may be incomplete.');
    expect(groupedLabel([note('store_brand_note')])).toBe('Also: 1 store-brand option with no savings.');
    expect(groupedLabel([note('uncertain'), note('store_brand_note'), note('store_brand_note')])).toBe(
      'Also: Worth It couldn’t read one thing in your cart reliably, so this review may be incomplete · 2 store-brand options with no savings.',
    );
  });
});

describe('groupedLabel counts items, not findings', () => {
  it('an item with two findings is one item', () => {
    const finding = (kind: ReviewFinding['kind'], amountCents: number | null) => ({ kind, itemKey: 'walmart:1', amountCents }) as ReviewFinding;
    expect(groupedLabel([finding('cheaper_alternative', 150), finding('store_brand_note', null)])).toBe(
      'You also had 1 other item you could reconsider or swap for a different one, worth about $1.50 more.',
    );
  });
});
