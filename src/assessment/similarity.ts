import { normalizeTitle } from '../domain/history';

/**
 * Cosine similarity of product titles, computed on this device. It lets an item
 * with no reviewed product data be compared with past purchases ("TAL Hudson
 * Tumbler" vs "Stanley Quencher Tumbler"). Deterministic and offline: no model
 * and no network, so purchase history never leaves the browser.
 */

/** At or above this cosine, two titles are treated as a similar kind of item. */
export const SIMILAR_TITLE_THRESHOLD = 0.3;

/** How much more a word from the item's own Walmart category counts than a title word. */
const CATEGORY_WEIGHT = 3;

/** Words that say nothing about what the product is: sizes, units, packaging, filler, colors, store labels. */
const IGNORED = new Set(
  (
    'a an and the of for with in on to by or from set pack pk ct count oz fl lb lbs ml l g kg gal gallon liter litre qt pt ' +
    'size sizes large small medium xl xs mini jumbo original classic new value great equate mainstays marketside ' +
    'black white blue red green pink purple yellow orange gray grey brown beige tan silver gold clear sage navy teal ' +
    'men women kids boys girls mens womens'
  ).split(' '),
);

/** Crude singularization ("tumblers" -> "tumbler", "batteries" -> "battery") so plural and singular titles match. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(s|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Meaningful, singularized words of a title. Quantities such as "40oz" or "12" are dropped. */
export function titleTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const word of normalizeTitle(text).split(' ')) {
    if (word.length < 2 || /^\d/.test(word) || IGNORED.has(word)) continue;
    const token = stem(word);
    if (!IGNORED.has(token)) tokens.push(token);
  }
  return tokens;
}

function vectorFor(text: string, categoryPath: readonly string[]): Map<string, number> {
  const vector = new Map<string, number>();
  for (const token of titleTokens(text)) vector.set(token, (vector.get(token) ?? 0) + 1);
  // The leaf of the retailer's category path names the kind of product ("40 oz Tumblers").
  const leaf = categoryPath.at(-1);
  if (leaf) for (const token of new Set(titleTokens(leaf))) vector.set(token, (vector.get(token) ?? 0) + CATEGORY_WEIGHT);
  return vector;
}

function cosine(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
  let dot = 0;
  for (const [token, weight] of a) dot += weight * (b.get(token) ?? 0);
  if (dot === 0) return 0;
  const norm = (vector: ReadonlyMap<string, number>) => Math.sqrt([...vector.values()].reduce((sum, weight) => sum + weight * weight, 0));
  return dot / (norm(a) * norm(b));
}

/**
 * Similarity from 0 to 1 between a cart item (its title and, when known, its
 * Walmart category path) and a past purchase's title.
 */
export function titleSimilarity(itemTitle: string, categoryPath: readonly string[], otherTitle: string): number {
  return cosine(vectorFor(itemTitle, categoryPath), vectorFor(otherTitle, []));
}
