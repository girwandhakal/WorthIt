import { afterEach, describe, expect, it, vi } from 'vitest';
import { walmartAdapter } from '../../src/adapters/walmart';
import { reviewCart } from '../../src/background/review-cart';
import { startReviewController, type PanelHandle } from '../../src/content/review-controller';
import type { CartReview } from '../../src/domain/review';
import type { ContentRequest } from '../../src/messaging/messages';
import { readFixture } from '../helpers/fixtures';

function loadIntoDocument(file: string) {
  const parsed = new DOMParser().parseFromString(readFixture('retailer', 'walmart', file), 'text/html');
  document.body.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
}

describe('startReviewController', () => {
  afterEach(() => {
    vi.useRealTimers();
    history.replaceState({}, '', '/');
    document.body.replaceChildren();
  });

  function start() {
    // jsdom's origin is localhost, so route checks use the path only.
    const adapter = { ...walmartAdapter, isCartRoute: (url: URL) => /^\/cart\/?$/.test(url.pathname) };
    const shown: CartReview[] = [];
    const mounted: string[] = [];
    const sent: ContentRequest[] = [];
    const send = vi.fn(async (request: ContentRequest) => {
      sent.push(request);
      return request.type === 'cart/review' ? { ok: true, review: reviewCart(request.snapshot, new Set()) } : { ok: true };
    });
    const mountPanel = vi.fn(async (): Promise<PanelHandle> => {
      mounted.push('mount');
      return { show: (review) => shown.push(review), remove: () => mounted.push('remove') };
    });
    const stop = startReviewController({ win: window, adapter, send, mountPanel, debounceMs: 10, routePollMs: 50 });
    return { shown, mounted, sent, stop };
  }

  it('stays inert off the cart route and activates after client-side navigation', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/checkout');
    loadIntoDocument('cart-normal.html');
    const { shown, mounted, stop } = start();
    await vi.advanceTimersByTimeAsync(100);
    expect(mounted).toEqual([]);

    history.pushState({}, '', '/cart');
    await vi.advanceTimersByTimeAsync(100);
    expect(mounted).toEqual(['mount']);
    expect(shown.at(-1)?.itemCount).toBe(3);

    history.pushState({}, '', '/checkout');
    await vi.advanceTimersByTimeAsync(100);
    expect(mounted).toEqual(['mount', 'remove']);
    stop();
  });

  it('only sends review and dismiss messages (never cart actions)', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-mixed.html');
    const { sent, stop } = start();
    await vi.advanceTimersByTimeAsync(50);
    expect(sent.map((request) => request.type)).toEqual(['cart/review']);
    stop();
  });
});
