import { z } from 'zod';
import { centsSchema, isoDateSchema } from './schemas';

/**
 * Item-level purchase history. A record proves an order was placed (and,
 * when known, kept, canceled, or returned); it never proves the shopper still
 * owns or has used the item.
 */

export const historySourceSchema = z.enum(['gmail_import', 'synthetic_gmail', 'manual', 'observed_purchase']);
export type HistorySource = z.infer<typeof historySourceSchema>;

export const HISTORY_SOURCE_LABELS: Record<HistorySource, string> = {
  gmail_import: 'Gmail import',
  synthetic_gmail: 'Synthetic test receipt (Gmail)',
  manual: 'Added manually',
  observed_purchase: 'Recorded from order page',
};

export const purchaseStatusSchema = z.enum(['purchased', 'canceled', 'returned', 'refunded', 'unknown']);
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  purchased: 'Purchased',
  canceled: 'Canceled',
  returned: 'Returned',
  refunded: 'Refunded',
  unknown: 'Status unknown',
};

/** Fields a person or importer supplies. */
export const purchaseInputSchema = z.object({
  source: historySourceSchema,
  merchant: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(300),
  retailerItemId: z.string().trim().min(1).max(40).nullable(),
  orderId: z.string().trim().min(1).max(80).nullable(),
  purchasedOn: isoDateSchema,
  quantity: z.number().int().min(1).max(999).nullable(),
  /** Total paid for the line (all units). */
  linePriceCents: centsSchema.nullable(),
  status: purchaseStatusSchema,
  description: z.string().trim().max(500).nullable(),
  /** Gmail message ID only (never content), for provenance and dedupe. */
  gmailMessageId: z.string().max(64).nullable(),
});
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const purchaseRecordSchema = purchaseInputSchema.extend({
  id: z.string().min(1).max(64),
  /** True when the source lacked details (quantity, price) needed for some checks. */
  incomplete: z.boolean(),
  dedupeKey: z.string().max(500),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PurchaseRecord = z.infer<typeof purchaseRecordSchema>;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Same order + item, or same item on the same day, counts as a duplicate. */
export function dedupeKeyFor(input: Pick<PurchaseInput, 'merchant' | 'orderId' | 'retailerItemId' | 'title' | 'purchasedOn'>): string {
  const item = input.retailerItemId ?? normalizeTitle(input.title);
  const order = input.orderId ?? input.purchasedOn;
  return `${input.merchant.toLowerCase()}|${order}|${item}`;
}

/** Cancel, refund, or return wording in order text; null when it mentions none of them. */
export function reversalStatus(text: string): PurchaseStatus | null {
  if (/cancel/i.test(text)) return 'canceled';
  if (/refund/i.test(text)) return 'refunded';
  if (/return/i.test(text)) return 'returned';
  return null;
}

export function isIncomplete(input: Pick<PurchaseInput, 'quantity' | 'linePriceCents' | 'status'>): boolean {
  return input.quantity === null || input.linePriceCents === null || input.status === 'unknown';
}

/** Clarification answer from the checkout panel, remembered so the question isn't asked again. */
export const clarificationAnswerSchema = z.enum(['broke', 'replacement', 'gift', 'additional', 'different_purpose']);
export type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

export interface ClarificationRecord {
  /** `${questionId}:${itemMatchKey}` */
  id: string;
  questionId: string;
  itemMatchKey: string;
  itemTitle: string;
  answer: ClarificationAnswer;
  answeredAt: string;
}
