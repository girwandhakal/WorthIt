import type { RetailerAdapter } from '../adapters/retailer-adapter';
import { observeCart, watchRoute } from '../adapters/observe-page';
import { isFullyReadable, type CartSnapshot } from '../domain/cart';
import type { ClarificationQuestion } from '../domain/finding';
import type { ClarificationAnswer } from '../domain/history';
import type { CartReview } from '../domain/review';
import type { ContentRequest } from '../messaging/messages';
import { messagingErrorCode, type DiagnosticUpdate } from './diagnostics';

export interface PanelHandle {
  show(review: CartReview): void;
  /** Opens the panel (the shopper clicked the retailer's checkout control). */
  open(): void;
  /** True while the panel is showing, so a checkout click isn't held again. */
  isOpen(): boolean;
  remove(): void;
}

/** Everything the panel can do. All of it acts on Worth It only, never on the retailer page. */
export interface PanelHandlers {
  onDismiss: (findingIds: string[]) => void;
  onAnswer: (question: ClarificationQuestion, answer: ClarificationAnswer, itemName: string) => void;
  onSkipQuestion: (question: ClarificationQuestion) => void;
}

export interface ReviewControllerDeps {
  win: Window;
  adapter: RetailerAdapter;
  send: (request: ContentRequest) => Promise<unknown>;
  /** Mounts Worth It's isolated panel. Called only on the cart route. */
  mountPanel: (handlers: PanelHandlers) => Promise<PanelHandle>;
  debounceMs?: number;
  routePollMs?: number;
  diagnose?: (update: DiagnosticUpdate) => void;
  /** Hold only real user clicks, never scripted ones. Tests turn this off because jsdom events are never trusted. */
  trustedClicksOnly?: boolean;
}

/**
 * Activates the review only while the URL is the retailer's cart route and
 * stays inert everywhere else (including checkout and payment pages).
 */
export function startReviewController(deps: ReviewControllerDeps): () => void {
  let active: { stop: () => void; refresh: () => void; panel: Promise<PanelHandle | null> } | null = null;
  let generation = 0;
  /** Only the newest request may update the panel; slower, older ones are dropped. */
  let latestRequest = 0;
  /** True until a review for this visit to the cart page has come back, so earlier dismissals are dropped. */
  let freshVisit = true;
  /**
   * True while there is something un-dismissed to show and the shopper has not yet been
   * shown it. The first real click on the retailer's checkout control is held once, then
   * this goes false so the next click goes straight through.
   */
  let armed = false;
  /** Counts dismissals, so a review that was already in flight when one happened can't re-arm the hold. */
  let dismissals = 0;
  /** The mounted panel, once it exists. A click is held only when this can open. */
  let mounted: PanelHandle | null = null;

  const ignore = () => undefined;
  const handlers: PanelHandlers = {
    onDismiss: (ids) => {
      armed = false; // the shopper has seen it and closed it
      dismissals += 1;
      deps.diagnose?.({ checkout: 'closed-by-shopper' });
      void deps.send({ type: 'panel/dismiss', findingIds: ids }).catch(ignore);
    },
    onAnswer: (question, answer, itemName) =>
      void deps
        .send({
          type: 'clarification/answer',
          questionId: question.questionId,
          itemMatchKey: question.itemMatchKey,
          itemTitle: itemName.slice(0, 500),
          answer,
        })
        .catch(ignore)
        .then(() => active?.refresh()),
    onSkipQuestion: (question) =>
      void deps
        .send({ type: 'clarification/skip', questionId: question.questionId, itemMatchKey: question.itemMatchKey })
        .catch(ignore)
        .then(() => active?.refresh()),
  };

  /**
   * Holds the first checkout click, once, when there's something to show. It never clicks
   * anything: the shopper's next click on the retailer's own control goes through untouched.
   * Only real user clicks are held (not scripted ones), and only if the panel can open.
   */
  const holdCheckoutClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !deps.adapter.isCheckoutControl?.(target)) return;
    // From here on it is a click on the retailer's checkout control; say why it was or wasn't held.
    if (!armed) return void deps.diagnose?.({ checkout: 'passed-through-not-armed' });
    if (!mounted) return void deps.diagnose?.({ checkout: 'passed-through-panel-unavailable' });
    if (mounted.isOpen()) return void deps.diagnose?.({ checkout: 'passed-through-panel-open' });
    if ((deps.trustedClicksOnly ?? true) && !event.isTrusted) return void deps.diagnose?.({ checkout: 'passed-through-scripted-click' });
    armed = false;
    deps.diagnose?.({ checkout: 'held' });
    event.preventDefault();
    event.stopImmediatePropagation();
    mounted.open();
  };

  const activate = () => {
    const myGeneration = ++generation;
    armed = false;
    mounted = null;
    freshVisit = true;
    deps.diagnose?.({ checkout: 'waiting-for-review' });
    deps.win.addEventListener('click', holdCheckoutClick, true);
    deps.diagnose?.({ panel: 'mounting', review: 'pending', error: 'none' });
    // Attach a rejection handler immediately, even if the background never answers.
    const panel = Promise.resolve()
      .then(() => deps.mountPanel(handlers))
      .then((handle) => {
        if (myGeneration === generation) {
          mounted = handle;
          deps.diagnose?.({ panel: 'mounted' });
        }
        return handle;
      })
      .catch(() => {
        if (myGeneration === generation) deps.diagnose?.({ panel: 'failed', error: 'panel-mount-failed' });
        return null;
      });
    const observer = observeCart(deps.win.document.body, {
      debounceMs: deps.debounceMs,
      read: () => deps.adapter.extractCart(deps.win.document, new URL(deps.win.location.href), new Date()),
      onChange: (snapshot) => void requestReview(snapshot, myGeneration, panel),
    });
    active = { stop: observer.stop, refresh: observer.refresh, panel };
  };

  const deactivate = () => {
    generation++;
    deps.win.removeEventListener('click', holdCheckoutClick, true);
    armed = false;
    mounted = null;
    if (!active) return;
    active.stop();
    void active.panel.then((handle) => handle?.remove());
    active = null;
    deps.diagnose?.({
      panel: 'removed', review: 'not-requested', background: 'not-requested', checkout: 'idle',
      extractedItems: null, readableItems: null, displayedItems: null,
    });
  };

  const requestReview = async (snapshot: CartSnapshot, myGeneration: number, panel: Promise<PanelHandle | null>) => {
    deps.diagnose?.({
      background: 'pending', review: 'pending', extractedItems: snapshot.items.length,
      readableItems: snapshot.items.filter(isFullyReadable).length, displayedItems: snapshot.displayedItemCount ?? null,
    });
    const requestId = ++latestRequest;
    const dismissalsAtStart = dismissals;
    // Read each item's own product page (ingredients, Nutrition Facts, category). Never fatal.
    const itemIds = snapshot.items.flatMap((item) => (item.retailerItemId ? [item.retailerItemId] : []));
    const facts = deps.adapter.loadProductFacts && itemIds.length > 0 ? await deps.adapter.loadProductFacts(itemIds).catch(() => ({})) : {};
    if (myGeneration !== generation || requestId !== latestRequest) return;
    let response: unknown;
    try {
      response = await deps.send({
        type: 'cart/review',
        snapshot,
        ...(Object.keys(facts).length > 0 ? { facts } : {}),
        ...(freshVisit ? { fresh: true } : {}),
      });
    } catch (error) {
      if (myGeneration === generation) deps.diagnose?.({ background: 'unavailable', error: messagingErrorCode(error) });
      return;
    }
    if (myGeneration !== generation || requestId !== latestRequest) return; // Route changed or a newer cart read replaced this one.
    deps.diagnose?.({ background: isReviewResponse(response) ? 'ok' : 'invalid-response' });
    if (!isReviewResponse(response)) return;
    freshVisit = false;
    const handle = await panel;
    if (myGeneration !== generation || !handle) return;
    handle.show(response.review);
    // Something un-dismissed to show: hold the first checkout click (unless they dismissed while this was in flight).
    armed = response.review.autoOpen && dismissals === dismissalsAtStart;
    deps.diagnose?.({ checkout: armed ? 'armed' : 'nothing-to-show' });
    deps.diagnose?.({ review: 'delivered', error: 'none' });
  };

  const onRoute = (url: URL) => {
    const shouldBeActive = deps.adapter.isCartRoute(url);
    deps.diagnose?.({ route: shouldBeActive ? 'cart' : 'other' });
    if (shouldBeActive && !active) activate();
    if (!shouldBeActive && active) deactivate();
  };

  onRoute(new URL(deps.win.location.href));
  const stopWatching = watchRoute(deps.win, onRoute, deps.routePollMs);
  return () => {
    stopWatching();
    deactivate();
  };
}

function isReviewResponse(value: unknown): value is { ok: true; review: CartReview } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === true &&
    typeof (value as { review?: unknown }).review === 'object'
  );
}
