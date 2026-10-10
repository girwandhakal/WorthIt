import { afterEach, describe, expect, it, vi } from 'vitest';
import { walmartAdapter } from '../../src/adapters/walmart';
import { reviewCart } from '../../src/background/review-cart';
import { startReviewController, type PanelHandle, type ReviewControllerDeps } from '../../src/content/review-controller';
import type { CartReview } from '../../src/domain/review';
import type { ContentRequest } from '../../src/messaging/messages';
import { reviewContext } from '../helpers/background';
import { readFixture } from '../helpers/fixtures';
import { PAGES, factsFor } from '../helpers/product-page';

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

  function start(overrides: Partial<ReviewControllerDeps> = {}) {
    // jsdom's origin is localhost, so route checks use the path only.
    const adapter = {
      ...walmartAdapter,
      isCartRoute: (url: URL) => /^\/cart\/?$/.test(url.pathname),
      // No live product-page reads in unit tests.
      loadProductFacts: async () => ({}),
    };
    const shown: CartReview[] = [];
    const mounted: string[] = [];
    const sent: ContentRequest[] = [];
    const send = vi.fn(async (request: ContentRequest) => {
      sent.push(request);
      return request.type === 'cart/review' ? { ok: true, review: reviewCart(request.snapshot, reviewContext()) } : { ok: true };
    });
    const mountPanel = vi.fn(async (): Promise<PanelHandle> => {
      mounted.push('mount');
      return { show: (review) => shown.push(review), remove: () => mounted.push('remove') };
    });
    const diagnose = vi.fn();
    const stop = startReviewController({ win: window, adapter, send, mountPanel, debounceMs: 10, routePollMs: 50, diagnose, ...overrides });
    return { shown, mounted, sent, stop, diagnose };
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

  it('reports extraction counts, background success and delivery without item data', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    const { diagnose, stop } = start();
    await vi.advanceTimersByTimeAsync(50);
    expect(diagnose).toHaveBeenCalledWith({ route: 'cart' });
    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining({ extractedItems: 3, readableItems: 3 }));
    expect(diagnose).toHaveBeenCalledWith({ panel: 'mounted' });
    expect(diagnose).toHaveBeenCalledWith({ background: 'ok' });
    expect(diagnose).toHaveBeenCalledWith({ review: 'delivered', error: 'none' });
    expect(JSON.stringify(diagnose.mock.calls)).not.toContain('Great Value');
    stop();
  });

  it('classifies invalidated context, rejected and malformed background responses', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    for (const response of [new Error('Extension context invalidated.'), new Error('secret'), { ok: false }, undefined]) {
      const send = vi.fn(async () => { if (response instanceof Error) throw response; return response; });
      const { diagnose, shown, stop } = start({ send });
      await vi.advanceTimersByTimeAsync(50);
      expect(shown).toEqual([]);
      expect(diagnose).toHaveBeenCalledWith(response instanceof Error
        ? { background: 'unavailable', error: response.message.includes('invalidated') ? 'context-invalidated' : 'background-unavailable' }
        : { background: 'invalid-response' });
      expect(JSON.stringify(diagnose.mock.calls)).not.toContain('secret');
      stop();
    }
  });

  it('handles a panel mount rejection even while the background request is pending', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    const { diagnose, shown, stop } = start({ send: () => new Promise(() => undefined),
      mountPanel: async () => { throw new Error('Extension context invalidated.'); } });
    await vi.advanceTimersByTimeAsync(50);
    expect(diagnose).toHaveBeenCalledWith({ panel: 'failed', error: 'panel-mount-failed' });
    expect(shown).toEqual([]);
    stop();
    await vi.advanceTimersByTimeAsync(50);
  });

  it('clears a prior messaging error when a later cart update succeeds', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    let unavailable = true;
    const send = async (request: ContentRequest) => {
      if (unavailable) throw new Error('Background unavailable');
      return request.type === 'cart/review' ? { ok: true, review: reviewCart(request.snapshot, reviewContext()) } : { ok: true };
    };
    const { diagnose, shown, stop } = start({ send });
    await vi.advanceTimersByTimeAsync(50);
    expect(diagnose).toHaveBeenCalledWith({ background: 'unavailable', error: 'background-unavailable' });
    unavailable = false;
    document.querySelector('[data-testid="line-price"]')!.textContent = '$8.00';
    await vi.advanceTimersByTimeAsync(50);
    expect(shown).toHaveLength(1);
    expect(diagnose).toHaveBeenLastCalledWith({ review: 'delivered', error: 'none' });
    stop();
  });

  it('does not show or report a review after navigation away while mounting', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    let resolvePanel!: (handle: PanelHandle) => void;
    const show = vi.fn();
    const remove = vi.fn();
    const { diagnose, stop } = start({ mountPanel: () => new Promise((resolve) => { resolvePanel = resolve; }) });
    await vi.advanceTimersByTimeAsync(50);
    history.pushState({}, '', '/checkout');
    await vi.advanceTimersByTimeAsync(100);
    resolvePanel({ show, remove });
    await vi.advanceTimersByTimeAsync(50);
    expect(show).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
    expect(diagnose).not.toHaveBeenCalledWith({ review: 'delivered', error: 'none' });
    stop();
  });

  describe('product pages', () => {
    const cartAdapter = (loadProductFacts: NonNullable<typeof walmartAdapter.loadProductFacts>) => ({
      ...walmartAdapter,
      isCartRoute: (url: URL) => /^\/cart\/?$/.test(url.pathname),
      loadProductFacts,
    });

    it('reads the product page of every cart item and sends the facts with the review', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-normal.html');
      const loadProductFacts = vi.fn(async (ids: readonly string[]) => ({ [ids[0]!]: factsFor({ ...PAGES.milk, id: ids[0]! }) }));
      const { sent, stop } = start({ adapter: cartAdapter(loadProductFacts) });
      await vi.advanceTimersByTimeAsync(50);
      expect(loadProductFacts).toHaveBeenCalledWith(['10315798', '145051970', '10315395']);
      const request = sent[0]!;
      expect(request.type).toBe('cart/review');
      expect(request.type === 'cart/review' && Object.keys(request.facts ?? {})).toEqual(['10315798']);
      stop();
    });

    it('still reviews the cart, without facts, when product pages cannot be read', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-normal.html');
      const { sent, shown, stop } = start({ adapter: cartAdapter(async () => Promise.reject(new Error('blocked'))) });
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(1);
      expect(sent[0]).not.toHaveProperty('facts');
      expect(shown).toHaveLength(1);
      stop();
    });

    it('drops a slow, older review when a newer cart read has replaced it', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-normal.html');
      let release!: () => void;
      let calls = 0;
      const loadProductFacts = vi.fn(async () => {
        if (calls++ === 0) await new Promise<void>((resolve) => { release = resolve; });
        return {};
      });
      const { sent, shown, stop } = start({ adapter: cartAdapter(loadProductFacts) });
      await vi.advanceTimersByTimeAsync(50);
      document.querySelector('[data-testid="line-price"]')!.textContent = '$9.00';
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(1); // the newer read finished first
      release();
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(1); // the older one never sends
      expect(shown).toHaveLength(1);
      stop();
    });
  });
});
