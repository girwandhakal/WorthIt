/**
 * Money helpers. All money in Worth It is held as integer US cents so totals
 * never accumulate floating-point error.
 */

/** A "$" followed by digits, commas, and an optional ".digits": cut loosely here, then judged in `readMentions`. */
const AMOUNT = /\$\s*([\d,]*)(?:\.(\d+))?/g;
/** Longest whole-dollar amount read; anything longer is not a price in a cart. */
const MAX_DOLLAR_DIGITS = 9;

export interface PriceMention {
  cents: number;
  start: number;
  end: number;
  /** The dollars and cents digits, commas removed ("$1,234.50" -> "123450"; a squashed "$073" -> "073"). */
  digits: string;
  /** Written with a decimal point. */
  decimal: boolean;
}

interface RawMention extends PriceMention {
  /** A well-formed amount (grouped commas, at most two decimals). */
  valid: boolean;
}

/** Parses the first dollar amount in `text` (for example "Now $1,234.5") into cents. */
export function parsePriceToCents(text: string | null | undefined): number | null {
  return findPriceMentions(text ?? '')[0]?.cents ?? null;
}

/** Every dollar amount in `text` with where it sits, so the words around each one can say what it is. */
export function findPriceMentions(text: string): PriceMention[] {
  return withoutSquashedCopies(readMentions(text).filter((mention) => mention.valid)).map(({ cents, start, end, digits, decimal }) => ({
    cents,
    start,
    end,
    digits,
    decimal,
  }));
}

/**
 * Walmart repeats a price with its decimal point squashed out ("$0.73 $073", "$4.78 $478"). The copy is not a
 * second price: drop an amount with no decimal point when another amount shows the same digits with one. Works
 * across amounts found in different pieces of text, such as one cart row's separate elements.
 */
export function withoutSquashedCopies<T extends { decimal: boolean; digits: string }>(mentions: readonly T[]): T[] {
  const withDecimal = new Set(mentions.filter((mention) => mention.decimal).map((mention) => mention.digits));
  return mentions.filter((mention) => mention.decimal || !withDecimal.has(mention.digits));
}

/** Returns every dollar amount found in `text`, in order, as cents. */
export function findAllPricesInCents(text: string): number[] {
  return findPriceMentions(text).map((mention) => mention.cents);
}

function readMentions(text: string): RawMention[] {
  const mentions: RawMention[] = [];
  for (const match of text.matchAll(AMOUNT)) {
    const loose = match[1] ?? '';
    const fraction = match[2];
    // A comma right after the digits is punctuation ("$5, was $6"), not part of the amount.
    const whole = fraction === undefined ? loose.replace(/,+$/, '') : loose;
    if (whole === '' && fraction === undefined) continue; // a lone "$"
    const start = match.index ?? 0;
    const dollarDigits = whole.replace(/,/g, '');
    const centDigits = (fraction ?? '').padEnd(2, '0').slice(0, 2);
    mentions.push({
      cents: (dollarDigits === '' ? 0 : Number(dollarDigits)) * 100 + Number(centDigits),
      start,
      end: start + match[0].length - (loose.length - whole.length),
      // "$0.73" -> "073"; a squashed copy "$073" -> "073", so the two compare equal.
      digits: fraction === undefined ? dollarDigits : `${dollarDigits}${centDigits}`,
      decimal: fraction !== undefined,
      valid:
        dollarDigits.length <= MAX_DOLLAR_DIGITS &&
        (fraction === undefined || fraction.length <= 2) &&
        // Grouped commas must be real thousands groups.
        (!whole.includes(',') || /^\d{1,3}(?:,\d{3})+$/.test(whole)),
    });
  }
  return mentions;
}

/** Formats cents as a US dollar string, e.g. 175244 -> "$1,752.44". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}$${dollars.toLocaleString('en-US')}.${remainder}`;
}

/** Sums cents values, returning null when any value is unknown. */
export function sumCents(values: ReadonlyArray<number | null>): number | null {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}

export function isValidCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
