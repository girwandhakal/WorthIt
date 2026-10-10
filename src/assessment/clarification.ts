import type { CartItem } from '../domain/cart';
import type { ClarificationQuestion } from '../domain/finding';
import { normalizeTitle, type ClarificationAnswer, type ClarificationRecord } from '../domain/history';

/**
 * The fixed question set. At most one question per item per checkout; answers
 * are remembered locally (keyed by item) so the same question isn't repeated.
 */

export const REPEAT_PURPOSE_QUESTION_ID = 'repeat_purpose';

export const ANSWER_LABELS: Record<ClarificationAnswer, string> = {
  replacement: 'Replacing a worn one',
  additional: 'It’s an extra',
  different_purpose: 'For something different',
};

export function itemMatchKey(item: Pick<CartItem, 'merchant' | 'retailerItemId' | 'title'>): string {
  return item.retailerItemId ? `${item.merchant}:${item.retailerItemId}` : `${item.merchant}:title:${normalizeTitle(item.title ?? '')}`;
}

export function clarificationId(questionId: string, matchKey: string): string {
  return `${questionId}:${matchKey}`;
}

/** The advice text above the question already says when; the prompt stays short. */
export function repeatPurposeQuestion(matchKey: string): ClarificationQuestion {
  return {
    questionId: REPEAT_PURPOSE_QUESTION_ID,
    itemMatchKey: matchKey,
    prompt: 'Is this one replacing it, an extra, or for something different?',
    options: (Object.keys(ANSWER_LABELS) as ClarificationAnswer[]).map((value) => ({ value, label: ANSWER_LABELS[value] })),
  };
}

/** Looks up a stored answer for an item, so the question is not asked again. */
export function storedAnswer(
  records: readonly ClarificationRecord[],
  questionId: string,
  matchKey: string,
): ClarificationAnswer | null {
  return records.find((record) => record.id === clarificationId(questionId, matchKey))?.answer ?? null;
}

/** A replacement or different-purpose answer means "not redundant". */
export function answerWithdrawsSkip(answer: ClarificationAnswer | null): boolean {
  return answer === 'replacement' || answer === 'different_purpose';
}
