import { describe, expect, it } from 'vitest';
import { findAllPricesInCents, findPriceMentions, formatCents, parsePriceToCents, sumCents } from '../../src/shared/currency';

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

describe('prices as Walmart really writes them', () => {
  it.each([
    // The price repeated with its decimal point squashed out: one price, not two.
    ['Fresh Hass Avocados, Each Bought 5+ times Rollback $0.73 $073 Subscribe SNAP EBT eligible', [73]],
    ['$073 $0.73', [73]],
    ['$4.78 $478 Now $4.78 Was $5.32', [478, 478, 532]],
    ['Price $0.20 each (est.) $020 50.0 ¢/lb Final cost by weight', [20]],
    ['Now$1347 Now $13.47 Was $15.94 13.6 ¢/fl oz', [1347, 1594]],
    ['$1,499.00 $1,49900 $2,299.99', [149900, 229999]],
    ['Price $8.03 avg price $803 $4.64/lb Final cost by weight', [803, 464]],
  ])('%s', (text, cents) => {
    expect(findAllPricesInCents(text)).toEqual(cents);
  });

  it('keeps a whole-dollar price that has no decimal twin', () => {
    expect(findAllPricesInCents('Only $5 today')).toEqual([500]);
    expect(findAllPricesInCents('$1,234 total')).toEqual([123400]);
    expect(findAllPricesInCents('$073')).toEqual([7300]);
  });

  it('keeps both prices when they really differ', () => {
    expect(findAllPricesInCents('$0.73 and $73')).toEqual([73, 7300]);
  });

  it.each([
    ['$.99', 99],
    ['Now $5, was $6', 500],
    ['Total: $5.96.', 596],
    ['$5.5', 550],
    ['($1.20/ea)', 120],
  ])('reads %s', (text, cents) => {
    expect(parsePriceToCents(text)).toBe(cents);
  });

  it.each(['$2.499', '$1,23.45', '$1,2345', '$', '$ ', 'US$', '$,', '$.', '$1234567890123.00', 'ten dollars'])('does not invent a price from %s', (text) => {
    expect(findAllPricesInCents(text)).toEqual([]);
  });

  it('reports where each price sits, excluding trailing punctuation', () => {
    const text = 'Now $5, was $6.50.';
    expect(findPriceMentions(text).map((m) => text.slice(m.start, m.end))).toEqual(['$5', '$6.50']);
  });
});

describe('the parser on arbitrary text', () => {
  // A small deterministic generator, so a failure reproduces.
  const random = (seed: number) => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  it('round-trips every formatted amount, alone or beside its squashed copy', () => {
    const next = random(42);
    for (let i = 0; i < 2000; i++) {
      const cents = Math.floor(next() ** 3 * 5_000_000);
      const text = formatCents(cents);
      expect(findAllPricesInCents(text)).toEqual([cents]);
      expect(findAllPricesInCents(`${text} ${text.replace(/[,.]/g, '')}`)).toEqual([cents]);
      expect(findAllPricesInCents(`Now ${text}, Was ${formatCents(cents + 100)}`)).toEqual([cents, cents + 100]);
    }
  });

  it('never throws and only returns safe whole cents, however odd the text', () => {
    const next = random(7);
    const alphabet = ['$', '$', '.', ',', '0', '1', '5', '7', '9', ' ', '¢', '/', 'a', 'Now', '-'];
    for (let i = 0; i < 3000; i++) {
      const text = Array.from({ length: Math.floor(next() * 24) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');
      for (const mention of findPriceMentions(text)) {
        expect(Number.isSafeInteger(mention.cents)).toBe(true);
        expect(mention.cents).toBeGreaterThanOrEqual(0);
        expect(mention.end).toBeGreaterThan(mention.start);
        expect(text.slice(mention.start, mention.end).startsWith('$')).toBe(true);
      }
      expect(findAllPricesInCents(text)).toEqual(findPriceMentions(text).map((m) => m.cents));
    }
  });
});
