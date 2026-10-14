import type { CartAssessment } from '../domain/finding';
import type { CartSummary, ReviewFinding } from '../domain/review';
import { formatCents } from '../shared/currency';
import { countPhrase, renderTemplate, TEMPLATES } from '../wording/templates';
import { isHighlightable } from './describe';
import { investmentIllustration, savingsOnlySentence } from './investment';

const MAX_HIGHLIGHTS = 3;

/**
 * Deterministic cart summary: the sole authority for counts and totals.
 * Each item contributes exactly one amount (its primary suggestion), so
 * mutually exclusive options are never double counted. Historical savings are
 * never part of it.
 */
export function summarizeCart(
  assessment: CartAssessment,
  rankedFindings: readonly ReviewFinding[],
  options: { investmentIllustration: boolean },
): CartSummary {
  let alternativeCents = 0;
  let skipCents = 0;
  let uncountedItems = 0;
  for (const item of assessment.items) {
    const primary = item.primary;
    if (!primary) continue;
    if (primary.amountCents === null) {
      uncountedItems++;
    } else if (primary.kind === 'cheaper_alternative') {
      alternativeCents += primary.amountCents;
    } else {
      skipCents += primary.amountCents;
    }
  }
  const combinedCents = alternativeCents + skipCents;

  const highlightable = rankedFindings.filter(isHighlightable);
  const highlights =
    highlightable.length > 0 ? highlightable.slice(0, MAX_HIGHLIGHTS) : rankedFindings.filter((f) => f.kind === 'uncertain').slice(0, MAX_HIGHLIGHTS);
  const rest = rankedFindings.filter((finding) => !highlights.includes(finding));

  const opening =
    highlightable.length > 0
      ? renderTemplate('opening', { count_phrase: countPhrase(highlights.length) })
      : highlights.length > 0
        ? TEMPLATES.opening_uncertain
        : '';

  const investment = investmentIllustration(combinedCents, options.investmentIllustration);
  return {
    opening,
    highlights,
    grouped: rest.length > 0 ? { label: groupedLabel(rest), findings: rest, ...restTotals(rest) } : null,
    totals: { combinedCents, alternativeCents, skipCents, uncountedItems },
    savingsSentence: investment ? null : savingsOnlySentence(combinedCents),
    investment,
    handBack: 'It’s your call.',
    wordingSource: 'templates',
  };
}

/** The other items worth reconsidering, and what they add to the cart's potential reduction. */
function restTotals(rest: readonly ReviewFinding[]): { itemCount: number; amountCents: number } {
  const items = rest.filter(isHighlightable);
  return { itemCount: new Set(items.map((finding) => finding.itemKey)).size, amountCents: items.reduce((sum, finding) => sum + (finding.amountCents ?? 0), 0) };
}

/**
 * The line that rolls up everything not highlighted, e.g.
 * "You also had 3 other items you could reconsider or swap for a different one, worth about $4.81 more."
 * When nothing else is left, it says what the notes are (something Worth It couldn't read, or a store-brand option with no savings); the details stay in the expanded list.
 */
export function groupedLabel(rest: readonly ReviewFinding[]): string {
  const { itemCount, amountCents } = restTotals(rest);
  if (itemCount === 0) return `Also: ${noteSummary(rest)}`;
  const items = `You also had ${itemCount} other ${itemCount === 1 ? 'item' : 'items'} you could reconsider or swap for a different one`;
  const worth = amountCents > 0 ? `, worth about ${formatCents(amountCents)} more` : '';
  return `${items}${worth}.`;
}

/** Says what the notes are, not just how many: unread items and store-brand options with no savings. */
function noteSummary(rest: readonly ReviewFinding[]): string {
  const unread = rest.filter((finding) => finding.kind === 'uncertain').length;
  const storeBrand = rest.filter((finding) => finding.kind === 'store_brand_note').length;
  const parts: string[] = [];
  if (unread > 0) {
    parts.push(`Worth It couldn’t read ${unread === 1 ? 'one thing' : `${unread} things`} in your cart reliably, so this review may be incomplete`);
  }
  if (storeBrand > 0) parts.push(`${storeBrand} store-brand ${storeBrand === 1 ? 'option' : 'options'} with no savings`);
  return `${parts.join(' · ')}.`;
}
