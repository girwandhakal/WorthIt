import { formatCents } from '../shared/currency';
import { INVESTMENT_ASSUMPTIONS, futureValueCents } from '../shared/calculations';

export interface InvestmentIllustration {
  principalCents: number;
  futureValueCents: number;
  annualReturn: number;
  years: number;
  /** The approved sentence, with both amounts calculated in code. */
  sentence: string;
}

/**
 * The single, cart-level illustration. Shown only when enabled (default on)
 * and only for an aggregate current-cart potential reduction above $0. Never
 * per item, never from personal financial data.
 */
export function investmentIllustration(aggregateCents: number, enabled: boolean): InvestmentIllustration | null {
  if (!enabled || aggregateCents <= 0) return null;
  const future = futureValueCents(aggregateCents);
  const x = formatCents(aggregateCents);
  return {
    principalCents: aggregateCents,
    futureValueCents: future,
    annualReturn: INVESTMENT_ASSUMPTIONS.annualReturn,
    years: INVESTMENT_ASSUMPTIONS.years,
    sentence: `Invested at an assumed 10% a year, ${x} could grow to about ${formatCents(future)} in 40 years.`,
  };
}

/** Shown instead when the illustration is off. */
export function savingsOnlySentence(aggregateCents: number): string | null {
  return aggregateCents > 0 ? `By following these suggestions, you would save ${formatCents(aggregateCents)}.` : null;
}
