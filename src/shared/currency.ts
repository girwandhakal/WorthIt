/**
 * Money helpers. All money in Worth It is held as integer US cents so totals
 * never accumulate floating-point error.
 */

const PRICE_PATTERN = /\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?(?!\d)/;
const PRICE_PATTERN_GLOBAL = new RegExp(PRICE_PATTERN.source, 'g');

/** Parses the first dollar amount in `text` (for example "Now $1,234.5") into cents. */
export function parsePriceToCents(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = PRICE_PATTERN.exec(text);
  return match ? matchToCents(match) : null;
}

/** Returns every dollar amount found in `text`, in order, as cents. */
export function findAllPricesInCents(text: string): number[] {
  return Array.from(text.matchAll(PRICE_PATTERN_GLOBAL), matchToCents);
}

function matchToCents(match: RegExpMatchArray): number {
  const dollars = Number((match[1] ?? '0').replace(/,/g, ''));
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return dollars * 100 + Number(fraction);
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
