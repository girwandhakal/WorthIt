import type { ContentRequest } from '../messaging/messages';
import { validateContentRequest } from '../messaging/validate-message';
import { addDismissed, getDismissed, type SessionArea } from './dismissals';
import { reviewCart } from './review-cart';

export interface BackgroundDeps {
  extensionId: string;
  session: SessionArea;
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
  return dispatch(validated.value, tabId, deps);
}

async function dispatch(request: ContentRequest, tabId: number, deps: BackgroundDeps): Promise<unknown> {
  switch (request.type) {
    case 'cart/review': {
      const dismissed = await getDismissed(deps.session, tabId);
      return { ok: true, review: reviewCart(request.snapshot, dismissed) };
    }
    case 'panel/dismiss': {
      await addDismissed(deps.session, tabId, request.findingIds);
      return { ok: true };
    }
  }
}
