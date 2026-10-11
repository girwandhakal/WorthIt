import { cleanText } from '../retailer-adapter';
import { productFactsSchema, type ProductFacts, type ProductFactsMap } from '../../domain/product-facts';

/**
 * Reads the facts the decision tree needs (category path, ingredient statement,
 * Nutrition Facts) from a Walmart product page's embedded page data. Pure and
 * defensive: any field it can't find is `null`, and a page it doesn't
 * recognize (a bot-check page, a layout change) yields `null` overall.
 */

const NEXT_DATA = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

type Json = Record<string, unknown> | null | undefined;

const asRecord = (value: unknown): Json => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const asString = (value: unknown): string | null => (typeof value === 'string' ? cleanText(value) : null);

export function parseProductPage(html: string, itemId: string): ProductFacts | null {
  const match = NEXT_DATA.exec(html);
  if (!match?.[1]) return null;
  let data: Json;
  try {
    const root = asRecord(JSON.parse(match[1]));
    data = asRecord(asRecord(asRecord(asRecord(root?.props)?.pageProps)?.initialData)?.data);
  } catch {
    return null;
  }
  const product = asRecord(data?.product);
  if (!product) return null;
  // The page must be for the item we asked about; a redirect to another product is not evidence.
  const pageItemId = asString(product.usItemId) ?? asString(product.id);
  if (pageItemId !== null && pageItemId !== itemId) return null;

  const idml = asRecord(data?.idml);
  const path = (Array.isArray(asRecord(product.category)?.path) ? (asRecord(product.category)!.path as unknown[]) : [])
    .map((segment) => asString(asRecord(segment)?.name))
    .filter((name): name is string => name !== null)
    .slice(0, 10);

  const ingredients = asString(asRecord(asRecord(idml?.ingredients)?.ingredients)?.value);
  const facts: ProductFacts = {
    itemId,
    name: asString(product.name),
    categoryPath: path,
    ingredients: ingredients === null ? null : ingredients.slice(0, 3000),
    nutrition: parseNutrition(asRecord(idml?.nutritionFacts)),
  };
  const checked = productFactsSchema.safeParse(facts);
  return checked.success ? checked.data : null;
}

function parseNutrition(label: Json): ProductFacts['nutrition'] {
  if (!label) return null;
  const rows = new Map<string, string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    const record = asRecord(node);
    if (!record) return;
    const name = asString(record.name);
    const amount = asString(record.amount);
    if (name && amount !== null && !rows.has(name.toLowerCase())) rows.set(name.toLowerCase(), amount);
    for (const key of ['mainNutrient', 'childNutrients', 'values', 'keyNutrients', 'vitaminMinerals']) walk(record[key]);
  };
  walk(label);
  if (rows.size === 0) return null;

  const serving = asRecord(label.servingInfo);
  const servingSize = (Array.isArray(serving?.values) ? (serving!.values as unknown[]) : [])
    .map(asRecord)
    .find((row) => asString(row?.name)?.toLowerCase() === 'serving size');
  return {
    servingSize: asString(servingSize?.value),
    addedSugarG: parseAmount(rows.get('added sugars') ?? rows.get('includes added sugars'), 'g'),
    sodiumMg: parseAmount(rows.get('sodium'), 'mg'),
    transFatG: parseAmount(rows.get('trans fat'), 'g'),
  };
}

/** "21g" → 21, "170 mg" → 170, "<1g" / "less than 1g" → 0.5 (listed, so more than zero), anything else → null. */
export function parseAmount(raw: string | undefined, unit: 'g' | 'mg'): number | null {
  if (!raw) return null;
  const match = /^\s*(<|less than\s*)?\s*(\d+(?:\.\d+)?)\s*(mg|g|mcg)?\s*$/i.exec(raw);
  if (!match) return null;
  const found = (match[3] ?? unit).toLowerCase();
  if (found !== unit) return null;
  const value = Number(match[2]);
  if (match[1]) return value > 0 ? value / 2 : null;
  return value;
}

/** Only these characters can appear in an item ID we are willing to request. */
const ITEM_ID = /^\d{5,15}$/;

/** What Walmart's bot check looks like. Seeing it once means stop asking. */
const BOT_CHECK = /robot or human|px-captcha|are you a robot|access denied/i;

/** Thrown by a fetcher when the site answers with a block (HTTP 403/412/429 or a bot check). */
export class BlockedError extends Error {}

/** A Walmart cart is rarely this big; past it, the rest are left unread rather than hammering the site. */
export const MAX_PAGES_PER_REVIEW = 25;

/** After a bot check, no product pages are requested for this long. */
export const BLOCKED_COOLDOWN_MS = 15 * 60_000;

export interface Breaker {
  /** Epoch ms when a bot check was last seen; null when never. */
  trippedAt: number | null;
}

export interface LoadFactsOptions {
  /** Fetches a product page's HTML (same-origin from the content script). */
  fetchHtml: (itemId: string, signal: AbortSignal) => Promise<string | null>;
  /** Product pages are big and Walmart watches request rates: keep this low. */
  concurrency?: number;
  /** Pause between one worker's requests, in milliseconds. */
  spacingMs?: number;
  /** Per-page and whole-load time limits in milliseconds. */
  pageTimeoutMs?: number;
  totalTimeoutMs?: number;
  /** Results (including "couldn't read") live for the life of the page. */
  cache?: Map<string, ProductFacts | null>;
  /** Shared across loads so one bot check pauses every later request too. */
  breaker?: Breaker;
  now?: () => number;
}

/**
 * What is already known for these items, without any request: the facts read so far, and whether
 * every item has been looked at (read or found unreadable). Lets a review start before the network does.
 */
export function knownProductFacts(itemIds: readonly string[], cache: Map<string, ProductFacts | null>): { facts: ProductFactsMap; complete: boolean } {
  const wanted = [...new Set(itemIds)].filter((id) => ITEM_ID.test(id));
  const facts: ProductFactsMap = {};
  for (const id of wanted) {
    const known = cache.get(id);
    if (known) facts[id] = known;
  }
  return { facts, complete: wanted.every((id) => cache.has(id)) };
}

/** Fetches in progress, per cache, so an overlapping review waits for them instead of asking Walmart again. */
const inFlight = new WeakMap<Map<string, ProductFacts | null>, Map<string, Promise<void>>>();

/**
 * Loads facts for the given item IDs. Never throws and never blocks the review
 * for long: an item that is slow, blocked, or unreadable is simply absent from
 * the result, and its checks report "unknown". The first sign of a bot check
 * stops all further requests, so a big cart can't get the shopper challenged.
 */
export async function loadProductFacts(itemIds: readonly string[], options: LoadFactsOptions): Promise<ProductFactsMap> {
  const cache = options.cache ?? new Map<string, ProductFacts | null>();
  const breaker = options.breaker ?? { trippedAt: null };
  const now = options.now ?? Date.now;
  const wanted = [...new Set(itemIds)].filter((id) => ITEM_ID.test(id));
  const cooling = breaker.trippedAt !== null && now() - breaker.trippedAt < BLOCKED_COOLDOWN_MS;
  if (!cooling) breaker.trippedAt = null; // cooldown over (or never tripped): ask again
  const pending = cooling ? [] : wanted.filter((id) => !cache.has(id)).slice(0, MAX_PAGES_PER_REVIEW);
  const flights = inFlight.get(cache) ?? new Map<string, Promise<void>>();
  inFlight.set(cache, flights);
  const overall = new AbortController();
  const deadline = setTimeout(() => overall.abort(), options.totalTimeoutMs ?? 15_000);

  const fetchOne = async (id: string): Promise<void> => {
    const controller = new AbortController();
    const stop = () => controller.abort();
    overall.signal.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(stop, options.pageTimeoutMs ?? 8_000);
    try {
      const html = await options.fetchHtml(id, controller.signal);
      const facts = html === null ? null : parseProductPage(html, id);
      if (html !== null && facts === null && BOT_CHECK.test(html.slice(0, 4000))) {
        breaker.trippedAt = now();
      } else {
        cache.set(id, facts);
      }
    } catch (error) {
      // Blocked: stop everywhere. Timed out or offline: leave it uncached so a later review can retry.
      if (error instanceof BlockedError) breaker.trippedAt = now();
    } finally {
      clearTimeout(timer);
      overall.signal.removeEventListener('abort', stop);
    }
  };

  let next = 0;
  const worker = async () => {
    let first = true;
    while (next < pending.length && !overall.signal.aborted && breaker.trippedAt === null) {
      if (!first && (options.spacingMs ?? 150) > 0) await new Promise((resolve) => setTimeout(resolve, options.spacingMs ?? 150));
      first = false;
      if (overall.signal.aborted || breaker.trippedAt !== null) break;
      const id = pending[next++]!;
      const running = flights.get(id);
      if (running) {
        await running; // another review is already fetching this item
        continue;
      }
      const flight = fetchOne(id);
      flights.set(id, flight);
      await flight.finally(() => flights.delete(id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 2, pending.length) }, worker));
  clearTimeout(deadline);

  const result: ProductFactsMap = {};
  for (const id of wanted) {
    const facts = cache.get(id);
    if (facts) result[id] = facts;
  }
  return result;
}
