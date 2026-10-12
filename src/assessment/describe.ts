import type { CartItem } from '../domain/cart';
import type { AlternativeInfo, CartAssessment, CriterionResult, ItemAssessment, Suggestion } from '../domain/finding';
import type { FindingWording, ReviewFinding } from '../domain/review';
import { formatCents } from '../shared/currency';
import { renderTemplate, type TemplateKey } from '../summary/templates';
import { uncertaintyText } from './assess-cart';
import { ADDED_SUGAR_NOTE, SOURCES, type Source, type SourceId } from './evidence/sources';
import { removalSentence } from './rules/nutrition';

/**
 * Turns the deterministic assessment into concise, non-shaming findings.
 * Wording comes from reviewed templates; names and numbers come from verified
 * fields. Sorted in the presentation ranking (see compareFindings).
 */
export function panelFindings(assessment: CartAssessment, items: readonly CartItem[]): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  for (const item of assessment.items) {
    const cartItem = items.find((candidate) => candidate.key === item.itemKey);
    if (item.primary) findings.push(findingFor(item, item.primary));
    // Store-brand notes without savings are listed, never highlighted.
    const note = item.secondary.find((suggestion) => suggestion.kind === 'store_brand_note');
    if (note) findings.push(findingFor(item, note));
    if (cartItem && cartItem.issues.length > 0) {
      findings.push({
        id: `${item.itemKey}:uncertain`,
        itemKey: item.itemKey,
        position: item.position,
        kind: 'uncertain',
        itemName: item.itemName,
    imageUrl: item.imageUrl,
        text: uncertaintyText(cartItem),
        points: [],
        watch: [],
        wording: null,
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
  reduce_food_concern: 3,
  cheaper_alternative: 4,
  store_brand_note: 5,
  uncertain: 6,
};

/** 0: a suggestion with a known amount; 1: a question or other suggestion without one; 2: notes and uncertainty. */
function tier(finding: ReviewFinding): number {
  if (!isHighlightable(finding)) return 2;
  return finding.amountCents !== null ? 0 : 1;
}

/**
 * Biggest potential savings first, so the highlights are the items that matter
 * most to the cart. Ties fall back to the kind of suggestion (skips before
 * cheaper options), then cart order.
 */
export function compareFindings(a: ReviewFinding, b: ReviewFinding): number {
  return (
    tier(a) - tier(b) ||
    (b.amountCents ?? -1) - (a.amountCents ?? -1) ||
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    a.position - b.position
  );
}

/** Kinds that may be highlighted (one of the top three). */
export function isHighlightable(finding: ReviewFinding): boolean {
  return finding.kind !== 'store_brand_note' && finding.kind !== 'uncertain';
}

function findingFor(item: ItemAssessment, suggestion: Suggestion): ReviewFinding {
  const criterionId =
    suggestion.kind === 'skip_redundant'
      ? 'repeat_purchase'
      : suggestion.kind === 'skip_novelty'
        ? 'purpose'
        : suggestion.kind === 'reduce_added_sugar'
          ? 'added_sugar'
          : suggestion.kind === 'reduce_food_concern'
            ? 'food_quality'
            : 'store_brand';
  const criterion = item.criteria.find((candidate) => candidate.criterion === criterionId)!;
  const why = [...criterion.evidence];
  // Everything else the label shows is listed behind "Why?" too, each with its source.
  if (suggestion.kind === 'reduce_added_sugar') {
    why.push(...(item.criteria.find((candidate) => candidate.criterion === 'food_quality')?.evidence ?? []));
  }
  if (suggestion.alternative) {
    for (const difference of suggestion.alternative.differences) why.push({ label: 'Difference', value: difference, source: 'walmart_reference' });
  }
  // An ingredient noted but not counted keeps its explanation and source on the finding it is shown with.
  const watched = item.criteria.find((candidate) => candidate.criterion === 'food_quality');
  if (watched?.watch?.length) why.push(...watched.evidence.filter((evidence) => evidence.label === 'Also noted (not counted)' && !why.includes(evidence)));
  if (item.shareOfCartBps !== null) {
    why.push({ label: 'Share of your cart', value: `${(item.shareOfCartBps / 100).toFixed(1)}%`, source: 'cart_page' });
  }
  const wording = wordingFor(item, suggestion);
  return {
    id: `${item.itemKey}:${suggestion.kind}`,
    itemKey: item.itemKey,
    position: item.position,
    kind: suggestion.kind,
    itemName: item.itemName,
    imageUrl: item.imageUrl,
    text: wording ? renderTemplate(wording.template, wording.slots) : fixedText(suggestion, criterion.summary),
    points: pointsFor(item, suggestion, criterion),
    watch: item.criteria.find((candidate) => candidate.criterion === 'food_quality')?.watch ?? [],
    wording,
    amountCents: suggestion.amountCents,
    question: suggestion.kind === 'skip_redundant' ? item.question : null,
    why,
    sources: sourcesFor(why.map((evidence) => evidence.source), suggestion.alternative),
    confidence: criterion.confidence,
  };
}

function wordingFor(item: ItemAssessment, suggestion: Suggestion): FindingWording | null {
  const amount = suggestion.amountCents !== null ? formatCents(suggestion.amountCents) : null;
  switch (suggestion.kind) {
    case 'skip_redundant': {
      const slots = whatWhen(latestKept(item));
      const template: TemplateKey =
        amount === null ? 'skip_redundant_no_amount' : item.answer === 'additional' ? 'skip_redundant_extra' : 'skip_redundant';
      return { template, slots: amount === null ? slots : { ...slots, amount } };
    }
    case 'skip_novelty':
      return amount === null ? { template: 'skip_novelty_no_amount', slots: {} } : { template: 'skip_novelty', slots: { amount } };
    case 'cheaper_alternative': {
      const alternative = suggestion.alternative!;
      const template: TemplateKey =
        alternative.similarity === 'similar_ingredients'
          ? 'cheaper_similar'
          : alternative.similarity === 'different_ingredients'
            ? 'cheaper_different'
            : alternative.similarity === 'not_food'
              ? 'cheaper_other'
              : 'cheaper_food';
      return { template, slots: { alternative: alternative.name, amount: amount ?? '' } };
    }
    default:
      return null;
  }
}

/**
 * The finding as 2 or 3 short points, readable in a highlight's few seconds.
 * Same verified values and claims as its full text; the amount is shown beside
 * them, so the points give the reason rather than repeat it.
 */
function pointsFor(item: ItemAssessment, suggestion: Suggestion, criterion: CriterionResult): string[] {
  switch (suggestion.kind) {
    case 'skip_redundant': {
      const { what, when } = whatWhen(latestKept(item));
      return [`You bought ${what} ${when}`, item.answer === 'additional' ? 'You said this one is an extra' : 'Do you need another one?'];
    }
    case 'skip_novelty':
      return ['A novelty item with no practical use', 'Probably not worth it'];
    case 'cheaper_alternative':
      switch (suggestion.alternative!.similarity) {
        case 'similar_ingredients':
          return ['Similar ingredients', 'Same amount for less', 'Try the store brand?'];
        case 'different_ingredients':
          return ['Some ingredient differences', 'Same amount for less', 'Try the store brand?'];
        case 'not_food':
          return ['A lower-priced option', 'Want to consider it?'];
        default:
          return ['Same amount for less', 'Try the store brand?'];
      }
    case 'reduce_added_sugar':
    case 'reduce_food_concern':
      return criterion.points ?? [];
    default:
      return [];
  }
}

function fixedText(suggestion: Suggestion, criterionSummary: string): string {
  if (suggestion.kind === 'reduce_added_sugar') return `${ADDED_SUGAR_NOTE}${removalSentence(suggestion.amountCents)}`;
  if (suggestion.kind === 'reduce_food_concern') return `${criterionSummary}${removalSentence(suggestion.amountCents)}`;
  return storeBrandNoteText(suggestion.alternative!);
}

function latestKept(item: ItemAssessment) {
  return item.historyMatches.find((match) => match.status === 'purchased' || match.status === 'unknown') ?? null;
}

function whatWhen(match: { kind: 'exact' | 'similar'; daysAgo: number } | null): Record<string, string> {
  const when = !match ? 'recently' : match.daysAgo === 0 ? 'today' : match.daysAgo === 1 ? 'yesterday' : `${match.daysAgo} days ago`;
  return { what: match?.kind === 'exact' ? 'this' : 'a similar one', when };
}

function storeBrandNoteText(alternative: AlternativeInfo): string {
  const conflicts = alternative.differences.filter((difference) => /allerg|vegan|vegetarian/i.test(difference));
  if (conflicts.length > 0) return `${alternative.name} isn’t suggested: ${conflicts.join('; ')}.`;
  return alternative.comparison === 'costs_more'
    ? `${alternative.name} is the store-brand option, but it costs more per unit (${alternative.unitPriceComparison}), so there’s no savings.`
    : `${alternative.name} is about the same price per unit (${alternative.unitPriceComparison}), so no savings are claimed.`;
}

function sourcesFor(ids: readonly SourceId[], alternative?: AlternativeInfo): Source[] {
  return [...new Set(ids)].map((id) =>
    id === 'walmart_reference' && alternative ? { ...SOURCES.walmart_reference, url: alternative.url } : SOURCES[id],
  );
}
