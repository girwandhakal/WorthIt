import { HISTORY_SOURCE_LABELS, PURCHASE_STATUS_LABELS, type PurchaseInput } from '../../domain/history';
import { formatCents } from '../../shared/currency';

/** "Sep 20, 2026" from a YYYY-MM-DD string, without timezone drift. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function describePurchase(input: PurchaseInput): string {
  return [
    input.merchant,
    formatDate(input.purchasedOn),
    input.quantity === null ? 'Qty unknown' : `Qty ${input.quantity}`,
    input.linePriceCents === null ? 'Price unknown' : formatCents(input.linePriceCents),
    PURCHASE_STATUS_LABELS[input.status],
  ].join(' · ');
}

export const sourceLabel = (input: Pick<PurchaseInput, 'source'>) => HISTORY_SOURCE_LABELS[input.source];
