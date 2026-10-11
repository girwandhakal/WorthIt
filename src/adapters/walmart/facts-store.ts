import { productFactsSchema, type ProductFacts } from '../../domain/product-facts';

/**
 * Product labels read from Walmart pages, kept on this device between page loads so a repeat visit to the
 * cart doesn't read every product page again. Only readable labels are kept (public product data, never
 * anything about the shopper), each for a day; anything older, unreadable, or malformed is dropped.
 */

export const FACTS_STORAGE_KEY = 'walmartProductFacts';

/** A label is trusted for this long before it is read again. */
export const FACTS_TTL_MS = 24 * 60 * 60_000;

/** The most labels kept; the oldest go first. */
export const FACTS_MAX_ENTRIES = 200;

/** The part of `chrome.storage.local` this needs. */
export interface FactsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Labels with the time each was read (epoch ms), keyed by item ID. */
export type StoredFacts = Map<string, { at: number; facts: ProductFacts }>;

/** Reads the saved labels that are still fresh and well-formed. Never throws. */
export async function loadStoredFacts(storage: FactsStorage, now: number): Promise<StoredFacts> {
  const stored: StoredFacts = new Map();
  try {
    const raw = (await storage.get(FACTS_STORAGE_KEY))[FACTS_STORAGE_KEY];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return stored;
    for (const [id, entry] of Object.entries(raw)) {
      const at = (entry as { at?: unknown } | null)?.at;
      if (typeof at !== 'number' || !Number.isFinite(at) || at > now || now - at >= FACTS_TTL_MS) continue;
      const facts = productFactsSchema.safeParse((entry as { facts?: unknown }).facts);
      if (facts.success && facts.data.itemId === id) stored.set(id, { at, facts: facts.data });
    }
  } catch {
    // Unreadable storage just means reading the product pages again.
  }
  return stored;
}

/** Saves the labels, newest first up to the cap. Never throws. */
export async function saveStoredFacts(storage: FactsStorage, entries: StoredFacts, now: number): Promise<void> {
  try {
    const kept = [...entries]
      .filter(([, entry]) => now - entry.at < FACTS_TTL_MS)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, FACTS_MAX_ENTRIES);
    await storage.set({ [FACTS_STORAGE_KEY]: Object.fromEntries(kept) });
  } catch {
    // Failing to save only costs a re-read next time.
  }
}

/** Forgets every saved label ("Delete everything" in settings). */
export async function clearStoredFacts(storage: Pick<FactsStorage, 'remove'>): Promise<void> {
  await storage.remove(FACTS_STORAGE_KEY);
}
