/**
 * Per-tab panel memory in `storage.session` (cleared when the browser closes):
 * dismissed findings and skipped questions. A dismissed panel stays collapsed
 * for the tab unless a finding that was not dismissed appears.
 */

export interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

type SetName = 'dismissed' | 'skipped';

const keyFor = (name: SetName, tabId: number) => `${name}:${tabId}`;

async function getSet(area: SessionArea, name: SetName, tabId: number): Promise<Set<string>> {
  const key = keyFor(name, tabId);
  const stored = (await area.get(key))[key];
  return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
}

async function addToSet(area: SessionArea, name: SetName, tabId: number, ids: readonly string[]): Promise<void> {
  const current = await getSet(area, name, tabId);
  for (const id of ids) current.add(id);
  // Bound growth for very long sessions.
  await area.set({ [keyFor(name, tabId)]: [...current].slice(-1000) });
}

export const getDismissed = (area: SessionArea, tabId: number) => getSet(area, 'dismissed', tabId);
export const addDismissed = (area: SessionArea, tabId: number, ids: readonly string[]) => addToSet(area, 'dismissed', tabId, ids);
export const getSkippedQuestions = (area: SessionArea, tabId: number) => getSet(area, 'skipped', tabId);
export const addSkippedQuestion = (area: SessionArea, tabId: number, id: string) => addToSet(area, 'skipped', tabId, [id]);

/** A new visit to the cart page starts over: the panel may be offered again at checkout. Skipped questions are kept. */
export async function resetDismissed(area: SessionArea, tabId: number): Promise<void> {
  await area.remove(keyFor('dismissed', tabId));
}

export async function clearDismissed(area: SessionArea, tabId: number): Promise<void> {
  await area.remove(keyFor('dismissed', tabId));
  await area.remove(keyFor('skipped', tabId));
}
