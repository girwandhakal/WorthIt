import type { RetailerAdapter } from '../adapters/retailer-adapter';
import { observeCart, watchRoute } from '../adapters/walmart/observe-cart';
import type { CartSnapshot } from '../domain/cart';
import type { CartReview } from '../domain/review';
import type { ContentRequest } from '../messaging/messages';

export interface PanelHandle {
  show(review: CartReview): void;
  remove(): void;
}

export interface ReviewControllerDeps {
  win: Window;
  adapter: RetailerAdapter;
  send: (request: ContentRequest) => Promise<unknown>;
  /** Mounts Worth It's isolated panel. Called only on the cart route. */
  mountPanel: (onDismiss: (ids: string[]) => void) => Promise<PanelHandle>;
  debounceMs?: number;
  routePollMs?: number;
}

/**
 * Activates the review only while the URL is the retailer's cart route and
 * stays inert everywhere else (including checkout and payment pages).
 */
export function startReviewController(deps: ReviewControllerDeps): () => void {
  let active: { stop: () => void; panel: Promise<PanelHandle> } | null = null;
  let generation = 0;

  const onDismiss = (ids: string[]) => {
    void deps.send({ type: 'panel/dismiss', findingIds: ids }).catch(() => undefined);
  };

  const activate = () => {
    const myGeneration = ++generation;
    const panel = deps.mountPanel(onDismiss);
    const observer = observeCart(deps.win.document.body, {
      debounceMs: deps.debounceMs,
      read: () => deps.adapter.extractCart(deps.win.document, new URL(deps.win.location.href), new Date()),
      onChange: (snapshot) => void requestReview(snapshot, myGeneration, panel),
    });
    active = { stop: observer.stop, panel };
  };

  const deactivate = () => {
    generation++;
    if (!active) return;
    active.stop();
    void active.panel.then((handle) => handle.remove());
    active = null;
  };

  const requestReview = async (snapshot: CartSnapshot, myGeneration: number, panel: Promise<PanelHandle>) => {
    const response = await deps.send({ type: 'cart/review', snapshot }).catch(() => null);
    if (myGeneration !== generation) return; // Route changed while waiting.
    if (isReviewResponse(response)) (await panel).show(response.review);
  };

  const onRoute = (url: URL) => {
    const shouldBeActive = deps.adapter.isCartRoute(url);
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
