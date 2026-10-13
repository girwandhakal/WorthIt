import type { ProductFacts } from '../../domain/product-facts';
import type { CategoryId } from '../reference/categories';

/**
 * The kinds of non-food item the decision tree treats differently (TECH_SPEC section 7):
 *  - toy:    flagged like a novelty item; skipping it counts toward the potential savings.
 *  - decor:  a soft prompt only; a cheaper Walmart-brand line is worth comparing. Never counted.
 *  - gadget: a soft prompt only, and only when a similar one was bought recently. Never counted,
 *            and no store-brand swap is suggested.
 * Recognized from the retailer's own category path (and, for gadgets, the product name); never from a title alone
 * for anything else.
 */
export type NonFoodKind = 'toy' | 'decor' | 'gadget';

export interface NonFoodType {
  kind: NonFoodKind;
  /** A phone, laptop, TV, or similar: a purchase this size is re-checked over two years, not three months. */
  highValue: boolean;
}

const TOY_CATEGORY = /\b(toys?|dolls?|action figures?|plush|stuffed animals?|playsets?|building sets?|pretend play|ride[- ]on toys?)\b/i;
const DECOR_CATEGORY =
  /\b(home d[eé]cor|d[eé]cor|wall (art|d[eé]cor)|picture frames?|photo frames?|candles?|candle holders?|vases?|artificial (plants?|flowers?|trees?)|throw pillows?|decorative)\b/i;
const GADGET_CATEGORY =
  /\b(cell phones?|smartphones?|laptops?|computers?|tablets?|smart ?watch(es)?|wearable technology|headphones?|earbuds|speakers?|video game consoles?|cameras?|drones?|televisions?|tvs?|e-?readers?|gadgets?)\b/i;
/** Parts and add-ons for a gadget: useful items, not the gadget itself. */
const ACCESSORY_PATH = /\b(accessor(y|ies)|cases?|covers?|chargers?|cables?|adapters?|screen protectors?|mounts?|stands?|holders?|batteries|bands?|straps?)\b/i;
const ACCESSORY_TITLE = /\b(case|cover|screen protector|band|strap|mount|stand)\b/i;

/** Gadgets worth a second look if a similar one was bought within two years. */
const HIGH_VALUE_CATEGORY =
  /\b(smartphones?|cell phones?|laptops?|computers?|tablets?|smart ?watch(es)?|televisions?|tvs?|video game consoles?|cameras?|drones?)\b/i;

/** Families of gadget, by product name, so a new phone matches an older phone of any brand. */
const GADGET_FAMILIES: ReadonlyArray<{ family: string; highValue: boolean; test: RegExp }> = [
  { family: 'phone', highValue: true, test: /\b(iphone|smartphones?|galaxy [sazf]\d+|pixel \d+|cell phone|unlocked phone)\b/i },
  { family: 'laptop', highValue: true, test: /\b(laptop|macbook|chromebook)\b/i },
  { family: 'tablet', highValue: true, test: /\b(ipad|tablet|galaxy tab)\b/i },
  { family: 'watch', highValue: true, test: /\b(smart ?watch|apple watch|galaxy watch|fitbit)\b/i },
  { family: 'tv', highValue: true, test: /\b(tv|television)\b/i },
  { family: 'console', highValue: true, test: /\b(playstation|ps[45]|xbox|nintendo switch|game console)\b/i },
  { family: 'camera', highValue: true, test: /\b(camera|gopro|drone)\b/i },
  { family: 'headphones', highValue: false, test: /\b(airpods|headphones?|earbuds)\b/i },
  { family: 'speaker', highValue: false, test: /\b(bluetooth speaker|smart speaker)\b/i },
];

/** The gadget family a product name belongs to, or null (also null for a case, band, or other accessory). */
export function gadgetFamily(title: string | null): string | null {
  if (!title || ACCESSORY_TITLE.test(title)) return null;
  return GADGET_FAMILIES.find((candidate) => candidate.test.test(title))?.family ?? null;
}

/** What kind of non-food item this is, from the reviewed category when there is one, else the page's category path. */
export function nonFoodType(facts: Pick<ProductFacts, 'categoryPath' | 'name'> | null, category: CategoryId | null = null): NonFoodType | null {
  if (category === 'toy') return { kind: 'toy', highValue: false };
  if (category === 'decor') return { kind: 'decor', highValue: false };
  if (category === 'electronics') return { kind: 'gadget', highValue: false };
  if (!facts) return null;

  const path = facts.categoryPath.join(' > ');
  if (TOY_CATEGORY.test(path)) return { kind: 'toy', highValue: false };
  if (DECOR_CATEGORY.test(path)) return { kind: 'decor', highValue: false };

  if (ACCESSORY_PATH.test(path) || (facts.name !== null && ACCESSORY_TITLE.test(facts.name))) return null;
  const family = GADGET_FAMILIES.find((candidate) => facts.name !== null && candidate.test.test(facts.name!));
  if (GADGET_CATEGORY.test(path) || family) {
    return { kind: 'gadget', highValue: HIGH_VALUE_CATEGORY.test(path) || (family?.highValue ?? false) };
  }
  return null;
}

/** Walmart's own decor lines: an item from one of them is already the cheaper generic. */
const WALMART_DECOR_BRANDS = /\b(mainstays|better homes (&|and) gardens)\b/i;

/** True when a decor item is not already from one of Walmart's own lines, so comparing with them is worth saying. */
export function worthComparingDecorBrands(title: string | null): boolean {
  return title !== null && !WALMART_DECOR_BRANDS.test(title);
}
