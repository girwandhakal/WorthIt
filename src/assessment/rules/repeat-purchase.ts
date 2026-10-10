import type { CartItem } from '../../domain/cart';
import { CRITERIA_VERSION, type ClarificationQuestion, type CriterionResult, type Evidence, type HistoryMatch } from '../../domain/finding';
import { normalizeTitle, PURCHASE_STATUS_LABELS, type ClarificationAnswer, type PurchaseRecord } from '../../domain/history';
import { daysBetween } from '../../shared/dates';
import { ANSWER_LABELS, answerWithdrawsSkip, repeatPurposeQuestion } from '../clarification';
import { LOOKBACK_DAYS, lookbackDaysFor, type PurposeClass } from '../reference/categories';
import { ITEM_TYPE_KEYWORDS, referenceProduct, type ReferenceProduct } from '../reference/products';

/** History older than this is not considered at all. */
const MAX_HISTORY_DAYS = 365;

/**
 * Finds past purchases of the same item (item ID or identical name) or a
 * similar one (same reviewed item type). Newest first.
 */
export function findHistoryMatches(
  item: Pick<CartItem, 'retailerItemId' | 'title'>,
  reference: ReferenceProduct | null,
  history: readonly PurchaseRecord[],
  today: string,
): HistoryMatch[] {
  const title = item.title ? normalizeTitle(item.title) : null;
  const keywords = reference ? (ITEM_TYPE_KEYWORDS[reference.itemType] ?? []) : [];
  const matches: HistoryMatch[] = [];
  for (const record of history) {
    const daysAgo = daysBetween(record.purchasedOn, today);
    if (daysAgo < 0 || daysAgo > MAX_HISTORY_DAYS) continue;
    const exact =
      (item.retailerItemId !== null && record.retailerItemId === item.retailerItemId) ||
      (title !== null && normalizeTitle(record.title) === title);
    let similar = false;
    if (!exact && reference) {
      const recordReference = referenceProduct(record.retailerItemId);
      const recordTitle = normalizeTitle(record.title);
      similar =
        recordReference?.itemType === reference.itemType ||
        keywords.some((keyword) => recordTitle.includes(normalizeTitle(keyword)));
    }
    if (!exact && !similar) continue;
    matches.push({
      recordId: record.id,
      title: record.title,
      purchasedOn: record.purchasedOn,
      daysAgo,
      kind: exact ? 'exact' : 'similar',
      status: record.status,
      source: record.source,
    });
  }
  return matches.sort((a, b) => a.daysAgo - b.daysAgo);
}

export interface RepeatAssessment {
  result: CriterionResult;
  /** A recent similar non-consumable with no replacement/different-purpose answer. */
  skipEligible: boolean;
  question: ClarificationQuestion | null;
}

/**
 * Recent similar purchases. A receipt shows a purchase, not current ownership
 * or use; consumables are routine restocking and never skip-eligible.
 */
export function assessRepeatPurchase(input: {
  reference: ReferenceProduct | null;
  purposeClass: PurposeClass;
  consumable: boolean | null;
  matches: readonly HistoryMatch[];
  answer: ClarificationAnswer | null;
  matchKey: string;
}): RepeatAssessment {
  const { reference, purposeClass, consumable, matches, answer, matchKey } = input;
  const base = { criterion: 'repeat_purchase' as const, version: CRITERIA_VERSION };
  const kept = matches.filter((match) => match.status === 'purchased' || match.status === 'unknown');
  const notKept = matches.filter((match) => !kept.includes(match));
  const evidence: Evidence[] = matches.slice(0, 3).map((match) => ({
    label: `${match.kind === 'exact' ? 'Same item' : 'Similar item'} (${match.daysAgo} days ago)`,
    value: `${match.title}: ${PURCHASE_STATUS_LABELS[match.status]}`,
    source: 'purchase_history',
  }));
  const none = (summary: string): RepeatAssessment => ({
    result: { ...base, status: 'no_concern', summary, evidence, confidence: 'high' },
    skipEligible: false,
    question: null,
  });

  if (kept.length === 0) {
    if (notKept.length > 0) {
      const latest = notKept[0]!;
      return none(`A similar item from ${latest.daysAgo} days ago was ${PURCHASE_STATUS_LABELS[latest.status].toLowerCase()}, so it isn’t counted.`);
    }
    return reference
      ? none('No recent similar purchase in your history.')
      : {
          result: {
            ...base,
            status: 'unknown',
            summary: 'No exact repeat found; without product data, similar items can’t be matched.',
            evidence,
            confidence: 'low',
          },
          skipEligible: false,
          question: null,
        };
  }

  const latest = kept[0]!;

  if (consumable) {
    return none(`Bought ${latest.daysAgo} days ago; treated as routine restocking, not a concern.`);
  }

  // Without product data, only an exact repeat is noted, and only to ask.
  if (!reference || purposeClass === 'unknown') {
    const exact = kept.find((match) => match.kind === 'exact' && match.daysAgo <= LOOKBACK_DAYS.unknownExact);
    if (!exact) return none('No recent exact repeat in your history.');
    if (answer) return answeredResult(base, evidence, answer, false);
    return {
      result: {
        ...base,
        status: 'finding',
        summary: `You bought this ${exact.daysAgo} days ago. A past receipt doesn’t show whether you still have it.`,
        evidence,
        confidence: 'low',
      },
      skipEligible: false,
      question: repeatPurposeQuestion(matchKey),
    };
  }

  const window = lookbackDaysFor(reference.category, purposeClass);
  const recent = kept.find((match) => match.daysAgo <= window);
  if (!recent) return none(`Last bought ${latest.daysAgo} days ago, outside the ${window}-day window.`);
  if (answer) return answeredResult(base, evidence, answer, !answerWithdrawsSkip(answer));

  return {
    result: {
      ...base,
      status: 'finding',
      summary: `You bought ${recent.kind === 'exact' ? 'this' : 'a similar item'} ${recent.daysAgo} days ago. A past receipt doesn’t prove you still have it.`,
      evidence,
      confidence: recent.kind === 'exact' ? 'high' : 'medium',
    },
    skipEligible: true,
    question: repeatPurposeQuestion(matchKey),
  };
}

function answeredResult(
  base: { criterion: 'repeat_purchase'; version: number },
  evidence: Evidence[],
  answer: ClarificationAnswer,
  stillSkipEligible: boolean,
): RepeatAssessment {
  const withAnswer: Evidence[] = [...evidence, { label: 'Your answer', value: ANSWER_LABELS[answer], source: 'your_answer' }];
  if (!stillSkipEligible) {
    return {
      result: {
        ...base,
        status: 'no_concern',
        summary: `You said this is ${answer === 'replacement' ? 'a replacement' : answer === 'different_purpose' ? 'for something different' : 'an extra'}.`,
        evidence: withAnswer,
        confidence: 'high',
      },
      skipEligible: false,
      question: null,
    };
  }
  return {
    result: {
      ...base,
      status: 'finding',
      summary: 'You said this is an extra, on top of a similar recent purchase.',
      evidence: withAnswer,
      confidence: 'high',
    },
    skipEligible: true,
    question: null,
  };
}
