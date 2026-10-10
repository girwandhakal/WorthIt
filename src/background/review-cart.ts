import { assessCart } from '../assessment/assess-cart';
import { panelFindings } from '../assessment/describe';
import { summarizeCart } from '../assessment/summarize-cart';
import { isFullyReadable, type CartSnapshot } from '../domain/cart';
import type { ClarificationRecord, PurchaseRecord } from '../domain/history';
import type { CartReview } from '../domain/review';
import type { ShopperPreferences } from '../assessment/rules/store-brand';

export interface ReviewContext {
  history: readonly PurchaseRecord[];
  clarifications: readonly ClarificationRecord[];
  preferences: ShopperPreferences;
  today: string;
  dismissedIds: ReadonlySet<string>;
  /** Questions the shopper skipped in this tab: `${questionId}:${itemMatchKey}`. */
  skippedQuestions: ReadonlySet<string>;
  /** The single cart-level investment illustration (default on). */
  investmentIllustration: boolean;
}

/**
 * Assesses every cart line, then keeps only meaningful findings and material
 * uncertainty for the panel.
 */
export function reviewCart(snapshot: CartSnapshot, context: ReviewContext): CartReview {
  const assessment = assessCart({
    snapshot,
    history: context.history,
    clarifications: context.clarifications,
    preferences: context.preferences,
    today: context.today,
  });
  const findings = panelFindings(assessment, snapshot.items).map((finding) =>
    finding.question && context.skippedQuestions.has(`${finding.question.questionId}:${finding.question.itemMatchKey}`)
      ? { ...finding, question: null }
      : finding,
  );
  return {
    version: 1,
    merchant: snapshot.merchant,
    itemCount: snapshot.items.length,
    readableCount: snapshot.items.filter(isFullyReadable).length,
    findings,
    summary: summarizeCart(assessment, findings, { investmentIllustration: context.investmentIllustration }),
    assessment,
    autoOpen: findings.some((finding) => !context.dismissedIds.has(finding.id)),
  };
}
