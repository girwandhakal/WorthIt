import type { CartAssessment } from '../domain/finding';
import type { CartSummary, ReviewFinding } from '../domain/review';
import { formatCents } from '../shared/currency';
import { countPhrase, renderTemplate, TEMPLATES } from '../summary/templates';
import { isHighlightable } from './describe';
import { investmentIllustration, savingsOnlySentence } from './investment';

export const MAX_HIGHLIGHTS = 3;

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
    grouped: rest.length > 0 ? { label: groupedLabel(rest), findings: rest } : null,
    totals: { combinedCents, alternativeCents, skipCents, uncountedItems },
    savingsSentence: investment ? null : savingsOnlySentence(combinedCents),
    investment,
    handBack: 'It’s your call.',
    wordingSource: 'templates',
  };
}

/** e.g. "Also: 3 store-brand swaps could save $4.81" */
export function groupedLabel(rest: readonly ReviewFinding[]): string {
  const swaps = rest.filter((finding) => finding.kind === 'cheaper_alternative');
  const swapCents = swaps.reduce((sum, finding) => sum + (finding.amountCents ?? 0), 0);
  const others = rest.filter((finding) => isHighlightable(finding) && finding.kind !== 'cheaper_alternative');
  const notes = rest.filter((finding) => !isHighlightable(finding));
  const parts: string[] = [];
  if (swaps.length > 0) {
    parts.push(`${swaps.length} store-brand ${swaps.length === 1 ? 'swap' : 'swaps'} could save ${formatCents(swapCents)}`);
  }
  if (others.length > 0) parts.push(`${others.length} more ${others.length === 1 ? 'item' : 'items'} to think about`);
  if (parts.length === 0) parts.push(`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`);
  return `Also: ${parts.join(' · ')}`;
}
