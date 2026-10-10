/** Calendar-date helpers. Dates are plain `YYYY-MM-DD` strings in the shopper's local time. */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Accepts `YYYY-MM-DD` or `Sep 20, 2026` / `September 20, 2026`. */
export function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})\b/.exec(value.trim());
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const long = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(value.trim());
  if (long) {
    const month = MONTHS.indexOf(long[1]!.slice(0, 3).toLowerCase()) + 1;
    if (month > 0) return validDate(Number(long[3]), month, Number(long[2]));
  }
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
}
