import { assessCart } from '../assessment/assess-cart';
import { panelFindings } from '../assessment/describe';
import { summarizeCart } from '../assessment/summarize-cart';
import { MERCHANT_LABELS, isFullyReadable, type CartSnapshot } from '../domain/cart';
import type { ClarificationRecord, PurchaseRecord } from '../domain/history';
import type { CartReview, ReviewFinding } from '../domain/review';
import { SOURCES } from '../assessment/evidence/sources';
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
  const unread = unreadLinesFinding(snapshot);
  const findings = [...panelFindings(assessment, snapshot.items), ...(unread ? [unread] : [])].map((finding) =>
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

/**
 * Fails visibly when the page reports more items than Worth It could read
 * (for example after a Walmart layout change), instead of quietly reviewing
 * a partial cart. Quantities count as items, matching the page heading.
 */
export function unreadLinesFinding(snapshot: CartSnapshot): ReviewFinding | null {
  const displayed = snapshot.displayedItemCount ?? null;
  if (displayed === null || displayed === 0) return null;
  const store = MERCHANT_LABELS[snapshot.merchant];
  const read = snapshot.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  if (read >= displayed) return null;
  return {
    id: 'cart:unread-lines',
    itemKey: 'cart',
    position: Number.MAX_SAFE_INTEGER,
    kind: 'uncertain',
    itemName: 'Your cart',
    text:
      snapshot.items.length === 0
        ? `${store} shows ${displayed} ${displayed === 1 ? 'item' : 'items'} in your cart, but Worth It couldn't read any of them. ${store}'s page may have changed, so Worth It isn't guessing.`
        : `${store} shows ${displayed} items, but Worth It could read only ${read}. ${store}'s page may have changed, so this review may be incomplete.`,
    wording: null,
    amountCents: null,
    question: null,
    why: [],
    sources: [SOURCES.cart_page],
    confidence: 'low',
  };
}
