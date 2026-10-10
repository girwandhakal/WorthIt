import type { ReviewContext } from '../../src/background/review-cart';
import type { BackgroundDeps } from '../../src/background/handle-message';
import { openWorthItDb } from '../../src/storage/database';
import { createRepositories, type Repositories } from '../../src/storage/repositories';

export const EXTENSION_ID = 'worth-it-test-id';

/** In-memory stand-in for a chrome.storage area. */
export function memoryArea() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key: string) => (data.has(key) ? { [key]: structuredClone(data.get(key)) } : {}),
    set: async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
    },
    remove: async (key: string) => {
      data.delete(key);
    },
  };
}

let dbCounter = 0;

/** Fresh repositories on a uniquely named fake IndexedDB database. */
export async function testRepositories(now?: () => Date): Promise<Repositories> {
  const db = await openWorthItDb({ name: `worth-it-test-${Date.now()}-${dbCounter++}` });
  return createRepositories(db, now);
}

export async function testDeps(overrides: Partial<BackgroundDeps> = {}): Promise<BackgroundDeps & { repos: Repositories }> {
  const repos = await testRepositories();
  return {
    extensionId: EXTENSION_ID,
    session: memoryArea(),
    local: memoryArea(),
    repositories: async () => repos,
    repos,
    ...overrides,
  };
}

/** A review context with empty history and no preferences, dated 2026-10-10. */
export function reviewContext(overrides: Partial<ReviewContext> = {}): ReviewContext {
  return {
    history: [],
    clarifications: [],
    preferences: { allergens: [], dietaryPreferences: [] },
    today: '2026-10-10',
    dismissedIds: new Set(),
    skippedQuestions: new Set(),
    ...overrides,
  };
}
