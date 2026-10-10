import { observedToInput } from '../domain/orders';
import { buildImportReview } from '../ingestion/review-import';
import type { ContentRequest } from '../messaging/messages';
import { validateContentRequest } from '../messaging/validate-message';
import { localIsoDate } from '../shared/dates';
import { getPreferences, type LocalArea } from '../storage/preferences';
import type { Repositories } from '../storage/repositories';
import { addDismissed, getDismissed, type SessionArea } from './dismissals';
import { reviewCart } from './review-cart';

export interface BackgroundDeps {
  extensionId: string;
  session: SessionArea;
  local: LocalArea;
  repositories: () => Promise<Repositories>;
  now?: () => Date;
}

export interface MessageSender {
  id?: string | undefined;
  tab?: { id?: number | undefined } | undefined;
}

/**
 * Service-worker entry for content-script messages. Validates first, then
 * dispatches. Never touches retailer pages.
 */
export async function handleContentMessage(
  message: unknown,
  sender: MessageSender,
  deps: BackgroundDeps,
): Promise<unknown> {
  const validated = validateContentRequest(message, sender, deps.extensionId);
  if (!validated.ok) return { ok: false, error: validated.error };
  const tabId = sender.tab?.id;
  if (tabId === undefined) return { ok: false, error: 'Message must come from a tab.' };
  try {
    return await dispatch(validated.value, tabId, deps);
  } catch {
    return { ok: false, error: 'Worth It could not complete that request.' };
  }
}

async function dispatch(request: ContentRequest, tabId: number, deps: BackgroundDeps): Promise<unknown> {
  const now = deps.now?.() ?? new Date();
  switch (request.type) {
    case 'cart/review': {
      const [dismissed, preferences] = await Promise.all([getDismissed(deps.session, tabId), getPreferences(deps.local)]);
      const review = reviewCart(request.snapshot, dismissed);
      return { ok: true, review: { ...review, autoOpen: review.autoOpen && preferences.promptsEnabled } };
    }
    case 'panel/dismiss': {
      await addDismissed(deps.session, tabId, request.findingIds);
      return { ok: true };
    }
    case 'orders/settings': {
      const preferences = await getPreferences(deps.local);
      return { ok: true, recordPurchases: preferences.recordPurchases };
    }
    case 'orders/review': {
      if (!(await getPreferences(deps.local)).recordPurchases) return { ok: false, error: 'Purchase recording is off.' };
      const { purchases } = await deps.repositories();
      const today = localIsoDate(now);
      const inputs = request.items.map((item) => observedToInput(item, request.merchant, today));
      const review = await buildImportReview(inputs, (key) => purchases.hasDedupeKey(key));
      return { ok: true, review };
    }
    case 'orders/save': {
      if (!(await getPreferences(deps.local)).recordPurchases) return { ok: false, error: 'Purchase recording is off.' };
      const { purchases } = await deps.repositories();
      const result = await purchases.addMany(request.inputs);
      return { ok: true, saved: result.saved.length, duplicates: result.duplicates };
    }
  }
}
