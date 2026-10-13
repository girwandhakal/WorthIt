import type { CartItem } from '../../domain/cart';
import { CRITERIA_VERSION, type ClarificationQuestion, type CriterionResult, type Evidence, type HistoryMatch } from '../../domain/finding';
import { normalizeTitle, PURCHASE_STATUS_LABELS, type ClarificationAnswer, type PurchaseRecord } from '../../domain/history';
import { daysBetween } from '../../shared/dates';
import { ANSWER_LABELS, answerWithdrawsSkip, repeatPurposeQuestion } from '../clarification';
import { HIGH_VALUE_PURCHASE_DAYS, RECENT_PURCHASE_DAYS } from '../reference/categories';
import { ITEM_TYPE_KEYWORDS, referenceProduct, type ReferenceProduct } from '../reference/products';
import { SIMILAR_TITLE_THRESHOLD, titleSimilarity } from '../similarity';
import { gadgetFamily } from './non-food';

/** History older than this is not considered at all (the longest recent-purchase window). */
const MAX_HISTORY_DAYS = HIGH_VALUE_PURCHASE_DAYS;

/**
 * Finds past purchases of the same item (item ID or identical name) or a
 * similar one. Newest first. A reviewed item is similar to the same reviewed
 * item type; an item with no reviewed data is similar when both titles name the
 * same keyword type (tumbler, plush, ...) or their title/category cosine
 * similarity reaches SIMILAR_TITLE_THRESHOLD. The latter suggests a skip only
 * when the item's own page shows it is not food (see assessRepeatPurchase).
 */
export function findHistoryMatches(
  item: Pick<CartItem, 'retailerItemId' | 'title'>,
  reference: ReferenceProduct | null,
  history: readonly PurchaseRecord[],
  today: string,
  /** The item's category on its own Walmart page, when it was read. */
  categoryPath: readonly string[] = [],
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
    } else if (!exact && item.title) {
      const family = gadgetFamily(item.title);
      similar =
        (family !== null && family === gadgetFamily(record.title)) ||
        sameKeywordType(item.title, record.title) ||
        titleSimilarity(item.title, categoryPath, record.title) >= SIMILAR_TITLE_THRESHOLD;
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

/** Both titles name the same reviewed keyword type, such as "tumbler" or "plush". */
function sameKeywordType(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  return Object.values(ITEM_TYPE_KEYWORDS).some((words) => {
    const normalized = words.map(normalizeTitle);
    return normalized.some((word) => left.includes(word)) && normalized.some((word) => right.includes(word));
  });
}

export interface RepeatAssessment {
  result: CriterionResult;
  /** A recent similar purchase of a non-food item, with no "not redundant" answer. */
  skipEligible: boolean;
  question: ClarificationQuestion | null;
}

/**
 * Recent similar purchases. Only non-food items that are not routine
 * restocking are checked: a receipt shows a purchase, not current ownership or
 * use, so food and other consumables are never flagged as redundant. When
 * Worth It cannot tell whether an item is food, it says nothing.
 */
export function assessRepeatPurchase(input: {
  /** True/false when the item is known to be a food or drink (or not); null when that couldn't be told. */
  food: boolean | null;
  consumable: boolean | null;
  /** True when the item came from the reviewed product list, not only its own page. */
  reviewed: boolean;
  matches: readonly HistoryMatch[];
  answer: ClarificationAnswer | null;
  matchKey: string;
  /** How far back a similar purchase counts as recent for this kind of item. */
  windowDays?: number;
}): RepeatAssessment {
  const { food, consumable, reviewed, matches, answer, matchKey, windowDays = RECENT_PURCHASE_DAYS } = input;
  const base = { criterion: 'repeat_purchase' as const, version: CRITERIA_VERSION };
  const kept = matches.filter((match) => match.status === 'purchased' || match.status === 'unknown');
  const notKept = matches.filter((match) => !kept.includes(match));
  const evidence: Evidence[] = matches.slice(0, 3).map((match) => ({
    label: `${match.kind === 'exact' ? 'Same item' : 'Similar item'} (${match.daysAgo} days ago)`,
    value: `${match.title}: ${PURCHASE_STATUS_LABELS[match.status]}`,
    source: 'purchase_history',
  }));
  const none = (summary: string, status: CriterionResult['status'] = 'no_concern'): RepeatAssessment => ({
    result: { ...base, status, summary, evidence, confidence: status === 'unknown' ? 'low' : 'high' },
    skipEligible: false,
    question: null,
  });

  if (food === true) return none('Food is bought again and again, so a past purchase isn’t a concern.', 'not_applicable');
  if (food === null) return none('Worth It couldn’t tell whether this is food, so it isn’t checked against past purchases.', 'unknown');

  if (kept.length === 0) {
    if (notKept.length > 0) {
      const latest = notKept[0]!;
      return none(`A similar item from ${latest.daysAgo} days ago was ${PURCHASE_STATUS_LABELS[latest.status].toLowerCase()}, so it isn’t counted.`);
    }
    return none('No recent similar purchase in your history.');
  }

  const latest = kept[0]!;
  if (consumable) return none(`Bought ${latest.daysAgo} days ago; treated as routine restocking, not a concern.`);

  const recent = kept.find((match) => match.daysAgo <= windowDays);
  if (!recent) return none(`Last bought ${latest.daysAgo} days ago, outside the ${windowDays}-day window.`);
  if (answer) return answeredResult(base, evidence, answer, !answerWithdrawsSkip(answer));

  return {
    result: {
      ...base,
      status: 'finding',
      summary: `You bought ${recent.kind === 'exact' ? 'this' : 'a similar item'} ${recent.daysAgo} days ago. A past receipt doesn’t prove you still have it.`,
      evidence,
      confidence: recent.kind === 'exact' ? (reviewed ? 'high' : 'medium') : reviewed ? 'medium' : 'low',
    },
    skipEligible: true,
    question: repeatPurposeQuestion(matchKey),
  };
}

const ANSWER_SENTENCES: Record<ClarificationAnswer, string> = {
  broke: 'replacing one that broke or got lost',
  replacement: 'a replacement',
  gift: 'a gift',
  additional: 'an extra',
  different_purpose: 'for something different',
};

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
        summary: `You said this is ${ANSWER_SENTENCES[answer]}.`,
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
