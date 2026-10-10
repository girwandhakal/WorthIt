import { z } from 'zod';

/**
 * Small settings live in `chrome.storage.local` (this device only, never
 * `storage.sync`). History lives in IndexedDB.
 */

export const ALLERGENS = [
  'milk',
  'eggs',
  'fish',
  'shellfish',
  'tree_nuts',
  'peanuts',
  'wheat',
  'soy',
  'sesame',
] as const;
export const allergenSchema = z.enum(ALLERGENS);
export type Allergen = z.infer<typeof allergenSchema>;

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: 'Milk',
  eggs: 'Eggs',
  fish: 'Fish',
  shellfish: 'Shellfish',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat',
  soy: 'Soy',
  sesame: 'Sesame',
};

export const DIETARY_PREFERENCES = ['vegetarian', 'vegan'] as const;
export const dietaryPreferenceSchema = z.enum(DIETARY_PREFERENCES);
export type DietaryPreference = z.infer<typeof dietaryPreferenceSchema>;

export const DIETARY_LABELS: Record<DietaryPreference, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
};

export const preferencesSchema = z.object({
  onboardingComplete: z.boolean(),
  /** Checkout prompts on/off. Off: only the collapsed indicator, never auto-open. */
  promptsEnabled: z.boolean(),
  /** Opt-in: read item rows on order confirmation / purchase-history pages. */
  recordPurchases: z.boolean(),
  /** The single cart-level investment illustration. On by default. */
  investmentIllustration: z.boolean(),
  allergens: z.array(allergenSchema).max(ALLERGENS.length),
  dietaryPreferences: z.array(dietaryPreferenceSchema).max(DIETARY_PREFERENCES.length),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  onboardingComplete: false,
  promptsEnabled: true,
  recordPurchases: false,
  investmentIllustration: true,
  allergens: [],
  dietaryPreferences: [],
};

const PREFERENCES_KEY = 'preferences';
const OPENAI_KEY = 'openaiApiKey';

/** The subset of `chrome.storage.StorageArea` Worth It uses. */
export interface LocalArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export async function getPreferences(area: LocalArea): Promise<Preferences> {
  const stored = (await area.get(PREFERENCES_KEY))[PREFERENCES_KEY];
  // Merge field by field so a new setting gets its default without losing old ones.
  const merged = { ...DEFAULT_PREFERENCES, ...(typeof stored === 'object' && stored !== null ? stored : {}) };
  const parsed = preferencesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

export async function updatePreferences(area: LocalArea, changes: Partial<Preferences>): Promise<Preferences> {
  const next = preferencesSchema.parse({ ...(await getPreferences(area)), ...changes });
  await area.set({ [PREFERENCES_KEY]: next });
  return next;
}

/**
 * The owner's OpenAI API key. Stored only in `chrome.storage.local` on this
 * device; never exported, logged, synced, or bundled.
 */
export async function getOpenAiKey(area: LocalArea): Promise<string | null> {
  const value = (await area.get(OPENAI_KEY))[OPENAI_KEY];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function validateOpenAiKey(key: string): string | null {
  const trimmed = key.trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return 'That doesn’t look like an OpenAI API key (it should start with "sk-").';
  }
  return null;
}

export async function setOpenAiKey(area: LocalArea, key: string): Promise<void> {
  const error = validateOpenAiKey(key);
  if (error) throw new Error(error);
  await area.set({ [OPENAI_KEY]: key.trim() });
}

export async function clearOpenAiKey(area: LocalArea): Promise<void> {
  await area.remove(OPENAI_KEY);
}

/** "sk-…AbCd" — never show the full key once saved. */
export function maskKey(key: string): string {
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}
