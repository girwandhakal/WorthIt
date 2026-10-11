import { z } from 'zod';

/**
 * Facts read from a product's own retailer page (ingredients, Nutrition Facts,
 * category path). They are untrusted page data: validated on receipt, bounded
 * in size, and used only by deterministic rules. A value that could not be
 * read is `null`; nothing here is ever guessed.
 */

export const PRODUCT_FACTS_VERSION = 1;

export const productFactsSchema = z.object({
  itemId: z.string().regex(/^\d{5,15}$/),
  name: z.string().max(500).nullable(),
  /** Retailer category breadcrumb, e.g. `Food > Candy > Fruit Flavored Candy`. */
  categoryPath: z.array(z.string().max(120)).max(10),
  /** Ingredient statement exactly as listed, whitespace-normalized. */
  ingredients: z.string().max(3000).nullable(),
  /** Per-serving label values; `null` when the label (or the value) isn't shown. */
  nutrition: z
    .object({
      servingSize: z.string().max(200).nullable(),
      /** More than 0 when the label lists added sugars (a "<1g" label is stored as 0.5). */
      addedSugarG: z.number().min(0).max(1000).nullable(),
      sodiumMg: z.number().min(0).max(100_000).nullable(),
      transFatG: z.number().min(0).max(1000).nullable(),
    })
    .nullable(),
});
export type ProductFacts = z.infer<typeof productFactsSchema>;

/** Facts keyed by retailer item ID. */
export const productFactsMapSchema = z.record(z.string().regex(/^\d{5,15}$/), productFactsSchema);
export type ProductFactsMap = z.infer<typeof productFactsMapSchema>;

/** True for products the retailer files under food or drink (not pet food or household goods). */
export function isFoodByCategory(facts: Pick<ProductFacts, 'categoryPath'>): boolean | null {
  const root = facts.categoryPath[0]?.toLowerCase();
  if (!root) return null;
  if (root === 'food' || root === 'grocery') return true;
  return facts.categoryPath.some((segment) => /^baby (food|formula)/i.test(segment));
}
