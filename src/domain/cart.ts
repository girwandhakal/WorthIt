import { z } from 'zod';
import { centsSchema } from './schemas';

/**
 * Normalized cart model shared by every retailer adapter. Values that could not
 * be read reliably are `null` and listed in `issues`; adapters never guess.
 */

export const CART_SNAPSHOT_VERSION = 1;

export const merchantSchema = z.enum(['walmart', 'amazon']);
export type Merchant = z.infer<typeof merchantSchema>;

export const MERCHANT_LABELS: Record<Merchant, string> = {
  walmart: 'Walmart',
  amazon: 'Amazon',
};

const extractionIssueSchema = z.enum([
  'missing_title',
  'missing_price',
  'ambiguous_price',
  'missing_quantity',
  'unavailable',
]);
export type ExtractionIssue = z.infer<typeof extractionIssueSchema>;

const cartItemSchema = z.object({
  /** Stable local key, e.g. `walmart:10309701`. */
  key: z.string().min(1).max(300),
  merchant: merchantSchema,
  /** Zero-based order of the line on the page. */
  position: z.number().int().min(0).max(1000),
  retailerItemId: z.string().min(1).max(40).nullable(),
  productUrl: z.string().max(2000).nullable(),
  title: z.string().min(1).max(500).nullable(),
  brand: z.string().max(200).nullable(),
  quantity: z.number().int().min(1).max(999).nullable(),
  unitPriceCents: centsSchema.nullable(),
  linePriceCents: centsSchema.nullable(),
  /** Pre-discount line price when the page shows one ("Was $x"). */
  wasLinePriceCents: centsSchema.nullable(),
  currency: z.literal('USD'),
  /** How `linePriceCents` was obtained. */
  priceSource: z.enum(['line_price', 'unit_price_times_quantity', 'unknown']),
  packageSize: z.string().max(100).nullable(),
  /** The retailer's own product thumbnail (its image CDN, https only), when the line shows one. */
  imageUrl: z.string().max(2000).nullable().optional(),
  issues: z.array(extractionIssueSchema).max(10),
  /** `high`: every core field read; `partial`: something missing; `low`: unusable. */
  confidence: z.enum(['high', 'partial', 'low']),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSnapshotSchema = z.object({
  version: z.literal(CART_SNAPSHOT_VERSION),
  merchant: merchantSchema,
  pageUrl: z.string().max(2000),
  observedAt: z.string().max(40),
  items: z.array(cartItemSchema).max(200),
  /** Retailer-displayed subtotal, when shown. Informational only. */
  subtotalCents: centsSchema.nullable(),
  /** The item count the page itself shows ("Cart (7 items)"), to detect lines Worth It failed to read. */
  displayedItemCount: z.number().int().min(0).max(10_000).nullable().optional(),
});
export type CartSnapshot = z.infer<typeof cartSnapshotSchema>;

/** Human-friendly item label with a safe fallback for unreadable titles. */
export function itemDisplayName(item: Pick<CartItem, 'title' | 'position'>): string {
  return item.title ?? `Cart item ${item.position + 1}`;
}

/** True when name, quantity, and line price were all read. */
export function isFullyReadable(item: CartItem): boolean {
  return item.title !== null && item.quantity !== null && item.linePriceCents !== null;
}
