import { clarificationId } from '../assessment/clarification';
import { observedToInput } from '../domain/orders';
import { buildImportReview } from '../ingestion/review-import';
import type { ContentRequest } from '../messaging/messages';
import { validateContentRequest } from '../messaging/validate-message';
import { localIsoDate } from '../shared/dates';
import { WORDING_PROXY_URL } from '../summary/config';
import { wordingTransport, type WordingResponse } from '../summary/openai-client';
import { phraseSummary, type PhraseDeps } from '../summary/phrase-summary';
import { getOpenAiKey, getPreferences, type LocalArea } from '../storage/preferences';
import type { Repositories } from '../storage/repositories';
import { addDismissed, addSkippedQuestion, getDismissed, getSkippedQuestions, resetDismissed, type SessionArea } from './dismissals';
import { reviewCart } from './review-cart';

export interface BackgroundDeps {
  extensionId: string;
  session: SessionArea;
  local: LocalArea;
  repositories: () => Promise<Repositories>;
  /** HTTP POST used only for the optional OpenAI wording request. */
  post?: PhraseDeps['post'];
  /** Overrides the build-time proxy URL (tests). */
  wordingProxyUrl?: string | null;
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
      if (request.fresh) await resetDismissed(deps.session, tabId);
      const { purchases, clarifications } = await deps.repositories();
      const [dismissedIds, skippedQuestions, preferences, history, answers] = await Promise.all([
        getDismissed(deps.session, tabId),
        getSkippedQuestions(deps.session, tabId),
        getPreferences(deps.local),
        purchases.list(),
        clarifications.list(),
      ]);
      const review = reviewCart(request.snapshot, {
        history,
        clarifications: answers,
        preferences,
        today: localIsoDate(now),
        dismissedIds,
        skippedQuestions,
        investmentIllustration: preferences.investmentIllustration,
        ...(request.facts ? { facts: request.facts } : {}),
      });
      const summary = deps.post
        ? await phraseSummary(review.summary, {
            getTransport: async () => wordingTransport(deps.wordingProxyUrl ?? WORDING_PROXY_URL, await getOpenAiKey(deps.local)),
            post: deps.post,
            cache: sessionWordingCache(deps.session),
          })
        : review.summary;
      return { ok: true, review: { ...review, summary, autoOpen: review.autoOpen && preferences.promptsEnabled } };
    }
    case 'panel/dismiss': {
      await addDismissed(deps.session, tabId, request.findingIds);
      return { ok: true };
    }
    case 'clarification/answer': {
      const { clarifications } = await deps.repositories();
      await clarifications.put({
        id: clarificationId(request.questionId, request.itemMatchKey),
        questionId: request.questionId,
        itemMatchKey: request.itemMatchKey,
        itemTitle: request.itemTitle,
        answer: request.answer,
        answeredAt: now.toISOString(),
      });
      return { ok: true };
    }
    case 'clarification/skip': {
      await addSkippedQuestion(deps.session, tabId, clarificationId(request.questionId, request.itemMatchKey));
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

/** Accepted wording, keyed by request hash, for this browser session only. */
function sessionWordingCache(session: SessionArea): PhraseDeps['cache'] {
  const key = (hash: string) => `wording:${hash}`;
  return {
    get: async (hash) => ((await session.get(key(hash)))[key(hash)] as WordingResponse | undefined) ?? null,
    set: (hash, value) => session.set({ [key(hash)]: value }),
  };
}
