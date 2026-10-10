/**
 * Documented, deterministic calculations. Money is integer cents.
 */

/** Assumptions for the single cart-level investment illustration (TECH_SPEC section 7). */
export const INVESTMENT_ASSUMPTIONS = {
  annualReturn: 0.1,
  years: 40,
  compounding: 'annually',
  basis: 'before inflation',
} as const;

/**
 * Future value with annual compounding: FV = P × (1 + r)^n.
 * The growth factor is computed in double precision and the result rounded
 * once to whole cents. Example: 1000¢ at 10% for 40 years → 45259¢ ($452.59).
 */
export function futureValueCents(
  principalCents: number,
  annualReturn: number = INVESTMENT_ASSUMPTIONS.annualReturn,
  years: number = INVESTMENT_ASSUMPTIONS.years,
): number {
  if (!Number.isFinite(principalCents) || principalCents <= 0) return 0;
  return Math.round(principalCents * Math.pow(1 + annualReturn, years));
}

/** Share of a total in basis points (1% = 100), rounded half up; null without a positive denominator. */
export function shareBps(partCents: number, totalCents: number | null): number | null {
  if (totalCents === null || totalCents <= 0) return null;
  return Math.round((partCents * 10_000) / totalCents);
}
