import { z } from 'zod';
import { cartSnapshotSchema, merchantSchema } from '../domain/cart';
import { clarificationAnswerSchema, purchaseInputSchema } from '../domain/history';
import { observedOrderItemSchema } from '../domain/orders';

/**
 * Typed messages from content scripts to the service worker. Every payload is
 * validated on receipt (see validate-message.ts); retailer pages are untrusted.
 */

const findingIdSchema = z.string().min(1).max(400);

export const contentRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cart/review'), snapshot: cartSnapshotSchema }),
  z.object({ type: z.literal('panel/dismiss'), findingIds: z.array(findingIdSchema).max(500) }),
  /** The shopper answered a clarification question (stored locally, reused next time). */
  z.object({
    type: z.literal('clarification/answer'),
    questionId: z.string().min(1).max(60),
    itemMatchKey: z.string().min(1).max(400),
    itemTitle: z.string().max(500),
    answer: clarificationAnswerSchema,
  }),
  /** The shopper skipped a question; not asked again in this tab. */
  z.object({
    type: z.literal('clarification/skip'),
    questionId: z.string().min(1).max(60),
    itemMatchKey: z.string().min(1).max(400),
  }),
  /** Is opt-in purchase recording on? */
  z.object({ type: z.literal('orders/settings') }),
  /** Build the review proposals for item rows read from an order page. */
  z.object({
    type: z.literal('orders/review'),
    merchant: merchantSchema,
    items: z.array(observedOrderItemSchema).max(200),
  }),
  /** Save the rows the shopper approved. Only `observed_purchase` records are accepted from pages. */
  z.object({
    type: z.literal('orders/save'),
    inputs: z.array(purchaseInputSchema.extend({ source: z.literal('observed_purchase') })).max(200),
  }),
]);
export type ContentRequest = z.infer<typeof contentRequestSchema>;
