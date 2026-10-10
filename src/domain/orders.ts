import { z } from 'zod';
import { purchaseStatusSchema, type PurchaseInput } from './history';
import { MERCHANT_LABELS, type Merchant } from './cart';

/** Order-page kinds a retailer adapter can record purchases from (opt-in). */
export type OrderPageKind = 'confirmation' | 'history' | 'details';

/** One purchased item row read from a retailer order page. */
export const observedOrderItemSchema = z.object({
  title: z.string().min(1).max(300),
  retailerItemId: z.string().min(1).max(40).nullable(),
  quantity: z.number().int().min(1).max(999).nullable(),
  linePriceCents: z.number().int().min(0).max(100_000_000).nullable(),
  orderId: z.string().min(1).max(80).nullable(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: purchaseStatusSchema,
});
export type ObservedOrderItem = z.infer<typeof observedOrderItemSchema>;

/** Converts an observed row into a history input. Rows without a date use `today`. */
export function observedToInput(item: ObservedOrderItem, merchant: Merchant, today: string): PurchaseInput {
  return {
    source: 'observed_purchase',
    merchant: MERCHANT_LABELS[merchant],
    title: item.title,
    retailerItemId: item.retailerItemId,
    orderId: item.orderId,
    purchasedOn: item.orderDate ?? today,
    quantity: item.quantity,
    linePriceCents: item.linePriceCents,
    status: item.status,
    description: null,
    gmailMessageId: null,
  };
}

