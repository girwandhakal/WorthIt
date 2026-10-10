import type { CartSnapshot } from '../../domain/cart';
import { WORTH_IT_HOST_TAG } from './extract-cart';

/**
 * Stable fingerprint of what the review depends on, so cosmetic rerenders of
 * the retailer page do not trigger a new review.
 */
export function snapshotSignature(snapshot: CartSnapshot): string {
  return snapshot.items
    .map((item) =>
      [item.key, item.title ?? '', item.quantity ?? '?', item.linePriceCents ?? '?', item.issues.join('+')].join('|'),
    )
    .join('\n');
}

export interface CartObserverOptions {
  /** Reads the current snapshot from the page. */
  read: () => CartSnapshot;
  /** Called with a new snapshot whenever its signature changes. */
  onChange: (snapshot: CartSnapshot) => void;
  debounceMs?: number;
}

/**
 * Watches the page for cart changes (quantity edits, removals, SPA rerenders)
 * and reports fresh snapshots, debounced and deduplicated by signature. Reads
 * from the live DOM every time instead of caching page state.
 */
export function observeCart(root: Node, options: CartObserverOptions): { stop: () => void; refresh: () => void } {
  const debounceMs = options.debounceMs ?? 400;
  let lastSignature: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const emitIfChanged = () => {
    const snapshot = options.read();
    const signature = snapshotSignature(snapshot);
    if (signature === lastSignature) return;
    lastSignature = signature;
    options.onChange(snapshot);
  };

  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(emitIfChanged, debounceMs);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.every(isOwnUiMutation)) return;
    schedule();
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
  emitIfChanged();

  return {
    stop: () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    },
    refresh: () => {
      lastSignature = null;
      emitIfChanged();
    },
  };
}

function isOwnUiMutation(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
  if (target?.closest(WORTH_IT_HOST_TAG)) return true;
  const added = Array.from(mutation.addedNodes);
  const removed = Array.from(mutation.removedNodes);
  const changed = [...added, ...removed];
  return changed.length > 0 && changed.every((node) => node.nodeName.toLowerCase() === WORTH_IT_HOST_TAG);
}

/**
 * Walmart is a single-page app: the URL changes without a page load. This
 * watcher reports route changes from history navigation and from client-side
 * `pushState` (detected by polling, since content scripts cannot patch the
 * page's history functions).
 */
export function watchRoute(
  win: Window,
  onRoute: (url: URL) => void,
  pollMs = 300,
): () => void {
  let last = win.location.href;
  const check = () => {
    const href = win.location.href;
    if (href === last) return;
    last = href;
    onRoute(new URL(href));
  };
  const interval = win.setInterval(check, pollMs);
  win.addEventListener('popstate', check);
  win.addEventListener('hashchange', check);
  return () => {
    win.clearInterval(interval);
    win.removeEventListener('popstate', check);
    win.removeEventListener('hashchange', check);
  };
}
