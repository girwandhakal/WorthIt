import { z } from 'zod';

/** Primitives shared by the cart, order, and purchase-history schemas. */

/** Integer US cents, capped far above any real cart or receipt line. */
export const centsSchema = z.number().int().min(0).max(100_000_000);

/** A calendar date as `YYYY-MM-DD`. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** A retailer item ID. Digits only, so nothing else can end up in a product-page URL we request. */
export const ITEM_ID_PATTERN = /^\d{5,15}$/;
