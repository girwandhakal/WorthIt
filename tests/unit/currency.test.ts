import { describe, expect, it } from 'vitest';
import { findAllPricesInCents, formatCents, parsePriceToCents, sumCents } from '../../src/shared/currency';

describe('parsePriceToCents', () => {
  it.each([
    ['$5.96', 596],
    ['Now $1,234.5', 123450],
    ['$12', 1200],
    ['current price $0.92', 92],
    ['$ 3.07/ea', 307],
  ])('parses %s', (text, cents) => {
    expect(parsePriceToCents(text)).toBe(cents);
  });

  it.each(['Price unavailable', '', null, undefined, '5.96'])('returns null for %s', (text) => {
    expect(parsePriceToCents(text)).toBeNull();
  });
});

describe('findAllPricesInCents', () => {
  it('finds every price in order', () => {
    expect(findAllPricesInCents('Was $8.50 now $7.74 ($3.87/ea)')).toEqual([850, 774, 387]);
  });
});

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [596, '$5.96'],
    [175244, '$1,752.44'],
    [-127, '-$1.27'],
  ])('formats %i', (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });
});

describe('sumCents', () => {
  it('sums integer cents exactly', () => {
    expect(sumCents([10, 20, 1])).toBe(31);
    // 0.1 + 0.2 style values stay exact in cents.
    expect(sumCents([199, 101, 181])).toBe(481);
  });

  it('returns null when any value is unknown', () => {
    expect(sumCents([100, null])).toBeNull();
  });
});
