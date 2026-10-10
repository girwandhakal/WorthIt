import { itemDisplayName, isFullyReadable, type CartItem, type CartSnapshot } from '../domain/cart';
import type { CartReview, ReviewFinding } from '../domain/review';

/**
 * Builds the panel review for a cart snapshot. Every line is considered; only
 * material uncertainty becomes a visible finding at this stage.
 */
export function reviewCart(snapshot: CartSnapshot, dismissedIds: ReadonlySet<string>): CartReview {
  const findings = snapshot.items.flatMap(uncertaintyFinding);
  return {
    version: 1,
    merchant: snapshot.merchant,
    itemCount: snapshot.items.length,
    readableCount: snapshot.items.filter(isFullyReadable).length,
    findings,
    autoOpen: findings.some((finding) => !dismissedIds.has(finding.id)),
  };
}

function uncertaintyFinding(item: CartItem): ReviewFinding[] {
  if (item.issues.length === 0) return [];
  return [
    {
      id: `${item.key}:uncertain`,
      itemKey: item.key,
      kind: 'uncertain',
      itemName: itemDisplayName(item),
      text: uncertaintyText(item),
    },
  ];
}

function uncertaintyText(item: CartItem): string {
  if (item.issues.includes('unavailable')) return "This item shows as unavailable, so it isn't part of the review.";
  const missing: string[] = [];
  if (item.issues.includes('missing_title')) missing.push('name');
  if (item.issues.includes('missing_price') || item.issues.includes('ambiguous_price')) missing.push('price');
  if (item.issues.includes('missing_quantity')) missing.push('quantity');
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} or ${missing.at(-1)}` : (missing[0] ?? 'details');
  return `Couldn't read this item's ${list} reliably, so Worth It didn't assess it.`;
}
