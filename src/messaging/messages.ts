import { z } from 'zod';
import { cartSnapshotSchema } from '../domain/cart';
import type { CartReview } from '../domain/review';

/**
 * Typed messages from content scripts to the service worker. Every payload is
 * validated on receipt (see validate-message.ts); retailer pages are untrusted.
 */

const findingIdSchema = z.string().min(1).max(400);

export const contentRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cart/review'), snapshot: cartSnapshotSchema }),
  z.object({ type: z.literal('panel/dismiss'), findingIds: z.array(findingIdSchema).max(500) }),
]);
export type ContentRequest = z.infer<typeof contentRequestSchema>;

export type ContentResponse<T extends ContentRequest['type']> = T extends 'cart/review'
  ? { ok: true; review: CartReview } | { ok: false; error: string }
  : { ok: true } | { ok: false; error: string };
