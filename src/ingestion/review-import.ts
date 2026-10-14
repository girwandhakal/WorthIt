import { dedupeKeyFor, purchaseInputSchema, type HistorySource, type PurchaseInput } from '../domain/history';
import type { ParseOutcome, ParsedReceipt } from './gmail/parse-message';

/**
 * The review step every import goes through (Gmail receipts and order-page
 * observations alike): nothing is saved until the shopper confirms.
 */

export interface ImportProposal {
  /** Stable within one review session. */
  id: string;
  input: PurchaseInput;
  /** Already in history (same order and item), or repeated in this batch. */
  duplicate: boolean;
  /** Missing quantity or price; still importable, flagged in the UI. */
  incomplete: boolean;
}

export interface UnparsedMessage {
  messageId: string;
  subject: string;
  reason: string;
}

export interface ImportReview {
  proposals: ImportProposal[];
  unparsed: UnparsedMessage[];
}

function receiptToInputs(receipt: ParsedReceipt): PurchaseInput[] {
  const source: HistorySource = receipt.synthetic ? 'synthetic_gmail' : 'gmail_import';
  return receipt.items.map((item) => ({
    source,
    merchant: receipt.merchant,
    title: item.title,
    retailerItemId: item.retailerItemId,
    orderId: receipt.orderId,
    purchasedOn: receipt.orderDate,
    quantity: item.quantity,
    linePriceCents: item.linePriceCents,
    status: item.status,
    description: receipt.synthetic ? 'Synthetic test receipt' : null,
    gmailMessageId: receipt.messageId,
  }));
}

/**
 * Builds review proposals. `exists` checks local history for a dedupe key, so
 * re-running an import never duplicates records.
 */
export async function buildImportReview(
  inputs: readonly PurchaseInput[],
  exists: (dedupeKey: string) => Promise<boolean>,
  unparsed: readonly UnparsedMessage[] = [],
): Promise<ImportReview> {
  const seen = new Set<string>();
  const proposals: ImportProposal[] = [];
  for (const [index, raw] of inputs.entries()) {
    const parsed = purchaseInputSchema.safeParse(raw);
    if (!parsed.success) continue;
    const input = parsed.data;
    const key = dedupeKeyFor(input);
    const duplicate = seen.has(key) || (await exists(key));
    seen.add(key);
    proposals.push({
      id: `proposal-${index}`,
      input,
      duplicate,
      incomplete: input.quantity === null || input.linePriceCents === null,
    });
  }
  return { proposals, unparsed: [...unparsed] };
}

export async function reviewGmailOutcomes(
  outcomes: readonly ParseOutcome[],
  exists: (dedupeKey: string) => Promise<boolean>,
): Promise<ImportReview> {
  const inputs: PurchaseInput[] = [];
  const unparsed: UnparsedMessage[] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === 'parsed') inputs.push(...receiptToInputs(outcome.receipt));
    else unparsed.push({ messageId: outcome.messageId, subject: outcome.subject, reason: outcome.reason });
  }
  return buildImportReview(inputs, exists, unparsed);
}
