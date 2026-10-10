import type { CartItem } from '../domain/cart';
import type { AlternativeInfo, CartAssessment, ItemAssessment, Suggestion } from '../domain/finding';
import type { ReviewFinding } from '../domain/review';
import { formatCents } from '../shared/currency';
import { uncertaintyText } from './assess-cart';
import { ADDED_SUGAR_NOTE, SOURCES, type Source, type SourceId } from './evidence/sources';

/**
 * Turns the deterministic assessment into concise, non-shaming panel findings
 * (reviewed template wording; names and numbers come from verified fields).
 * Order: skip suggestions (redundancy, then novelty), added sugar, cheaper
 * alternatives by amount, then store-brand notes, questions, and uncertainty.
 */
export function panelFindings(assessment: CartAssessment, items: readonly CartItem[]): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  for (const item of assessment.items) {
    const cartItem = items.find((candidate) => candidate.key === item.itemKey);
    const suggestions = [item.primary, ...item.secondary].filter((s): s is Suggestion => s !== null);
    const shown = new Set<string>();
    if (item.primary) {
      findings.push(findingFor(item, item.primary));
      shown.add(item.primary.kind);
    }
    // Store-brand notes without savings are listed (never highlighted).
    for (const suggestion of suggestions) {
      if (suggestion.kind === 'store_brand_note' && !shown.has('store_brand_note')) findings.push(findingFor(item, suggestion));
    }
    // A question with no skip suggestion (e.g. an exact repeat of an unclassified item).
    if (item.question && !findings.some((finding) => finding.itemKey === item.itemKey && finding.question)) {
      const repeat = item.criteria.find((criterion) => criterion.criterion === 'repeat_purchase')!;
      findings.push({
        id: `${item.itemKey}:repeat_question`,
        itemKey: item.itemKey,
        kind: 'repeat_question',
        itemName: item.itemName,
        text: repeat.summary,
        amountCents: null,
        question: item.question,
        why: repeat.evidence,
        sources: sourcesFor(repeat.evidence.map((evidence) => evidence.source)),
        confidence: repeat.confidence,
      });
    }
    if (cartItem && cartItem.issues.length > 0) {
      findings.push({
        id: `${item.itemKey}:uncertain`,
        itemKey: item.itemKey,
        kind: 'uncertain',
        itemName: item.itemName,
        text: uncertaintyText(cartItem),
        amountCents: null,
        question: null,
        why: [],
        sources: [SOURCES.cart_page],
        confidence: 'low',
      });
    }
  }
  return findings.sort(compareFindings);
}

const KIND_RANK: Record<ReviewFinding['kind'], number> = {
  skip_redundant: 0,
  skip_novelty: 1,
  reduce_added_sugar: 2,
  cheaper_alternative: 3,
  repeat_question: 4,
  store_brand_note: 5,
  uncertain: 6,
};

export function compareFindings(a: ReviewFinding, b: ReviewFinding): number {
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] || (b.amountCents ?? -1) - (a.amountCents ?? -1);
}

function findingFor(item: ItemAssessment, suggestion: Suggestion): ReviewFinding {
  const criterionId =
    suggestion.kind === 'skip_redundant'
      ? 'repeat_purchase'
      : suggestion.kind === 'skip_novelty'
        ? 'purpose'
        : suggestion.kind === 'reduce_added_sugar'
          ? 'added_sugar'
          : 'store_brand';
  const criterion = item.criteria.find((candidate) => candidate.criterion === criterionId)!;
  const why = [...criterion.evidence];
  // Context for a skip: the cheaper option is still worth knowing about.
  const alternative = item.secondary.find((other) => other.kind === 'cheaper_alternative')?.alternative;
  if (suggestion.kind === 'skip_redundant' && alternative) {
    why.push({ label: 'If you do need one', value: `${alternative.name} costs about ${formatCents(alternative.savingsCents ?? 0)} less`, source: 'walmart_reference' });
  }
  if (item.shareOfCartBps !== null) {
    why.push({ label: 'Share of your cart', value: `${(item.shareOfCartBps / 100).toFixed(1)}%`, source: 'cart_page' });
  }
  return {
    id: `${item.itemKey}:${suggestion.kind}`,
    itemKey: item.itemKey,
    kind: suggestion.kind,
    itemName: item.itemName,
    text: adviceText(item, suggestion),
    amountCents: suggestion.amountCents,
    question: suggestion.kind === 'skip_redundant' ? item.question : null,
    why,
    sources: sourcesFor(why.map((evidence) => evidence.source), suggestion.alternative),
    confidence: criterion.confidence,
  };
}

function adviceText(item: ItemAssessment, suggestion: Suggestion): string {
  const amount = suggestion.amountCents !== null ? formatCents(suggestion.amountCents) : null;
  switch (suggestion.kind) {
    case 'skip_redundant': {
      const match = item.historyMatches.find((candidate) => candidate.status === 'purchased' || candidate.status === 'unknown');
      const when = match ? `${match.daysAgo} days ago` : 'recently';
      const extra = item.answer === 'additional' ? ' You said this one is an extra.' : '';
      return `You bought ${match?.kind === 'exact' ? 'this' : 'a similar one'} ${when}.${extra} Do you need another?${amount ? ` Skipping it would take ${amount} off your cart.` : ''}`;
    }
    case 'skip_novelty':
      return `This is a collectible without a practical use. Consider skipping it${amount ? ` (${amount})` : ''}.`;
    case 'reduce_added_sugar':
      return `${ADDED_SUGAR_NOTE}${amount ? ` Removing it would lower your cart by ${amount}.` : ''}`;
    case 'cheaper_alternative':
      return cheaperText(suggestion.alternative!, amount);
    case 'store_brand_note':
      return storeBrandNoteText(suggestion.alternative!);
  }
}

function cheaperText(alternative: AlternativeInfo, amount: string | null): string {
  const likeness =
    alternative.similarity === 'similar_ingredients'
      ? ' has similar ingredients and'
      : alternative.similarity === 'different_ingredients'
        ? ' has some ingredient differences but'
        : '';
  return `${alternative.name}${likeness} costs about ${amount ?? 'less'} less for the same amount. Try the store brand?`;
}

function storeBrandNoteText(alternative: AlternativeInfo): string {
  if (alternative.differences.some((difference) => /allerg|vegan|vegetarian/i.test(difference))) {
    return `${alternative.name} isn’t suggested: ${alternative.differences.filter((d) => /allerg|vegan|vegetarian/i.test(d)).join('; ')}.`;
  }
  return alternative.comparison === 'costs_more'
    ? `${alternative.name} is the store-brand option, but it costs more per unit (${alternative.unitPriceComparison}), so no savings.`
    : `${alternative.name} is about the same price per unit (${alternative.unitPriceComparison}), so no savings are claimed.`;
}

function sourcesFor(ids: readonly SourceId[], alternative?: AlternativeInfo): Source[] {
  const unique = [...new Set(ids)];
  return unique.map((id) =>
    id === 'walmart_reference' && alternative ? { ...SOURCES.walmart_reference, url: alternative.url } : SOURCES[id],
  );
}
