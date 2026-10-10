/**
 * Per-tab dismissal memory in `storage.session` (cleared when the browser
 * closes). A dismissed panel stays collapsed for the tab unless a finding that
 * was not dismissed appears.
 */

export interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

const keyFor = (tabId: number) => `dismissed:${tabId}`;

export async function getDismissed(area: SessionArea, tabId: number): Promise<Set<string>> {
  const stored = (await area.get(keyFor(tabId)))[keyFor(tabId)];
  return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
}

export async function addDismissed(area: SessionArea, tabId: number, ids: readonly string[]): Promise<void> {
  const current = await getDismissed(area, tabId);
  for (const id of ids) current.add(id);
  // Bound growth for very long sessions.
  const bounded = [...current].slice(-1000);
  await area.set({ [keyFor(tabId)]: bounded });
}

export async function clearDismissed(area: SessionArea, tabId: number): Promise<void> {
  await area.remove(keyFor(tabId));
}
