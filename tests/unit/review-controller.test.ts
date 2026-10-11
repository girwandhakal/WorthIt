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
      return { show: (review) => shown.push(review), open: () => undefined, isOpen: () => false, remove: () => mounted.push('remove') };
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
    resolvePanel({ show, open: vi.fn(), isOpen: () => false, remove });
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

    it('reviews at once from the cart page, then reads every product page and reviews again with the facts', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-normal.html');
      const loadProductFacts = vi.fn(async (ids: readonly string[]) => ({ [ids[0]!]: factsFor({ ...PAGES.milk, id: ids[0]! }) }));
      const { sent, shown, stop } = start({ adapter: cartAdapter(loadProductFacts) });
      await vi.advanceTimersByTimeAsync(50);
      expect(loadProductFacts).toHaveBeenCalledWith(['10315798', '145051970', '10315395']);
      expect(sent).toHaveLength(2);
      expect(sent[0]).not.toHaveProperty('facts');
      const second = sent[1]!;
      expect(second.type).toBe('cart/review');
      expect(second.type === 'cart/review' && Object.keys(second.facts ?? {})).toEqual(['10315798']);
      // Only the first pass opens a new visit; the second must not clear the shopper's dismissals.
      expect(sent[0]).toHaveProperty('fresh', true);
      expect(sent[1]).not.toHaveProperty('fresh');
      expect(shown).toHaveLength(2);
      stop();
    });

    it('skips the second review when facts are already known, so cart edits are instant', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-normal.html');
      const known = { '10315798': factsFor({ ...PAGES.milk, id: '10315798' }) };
      const loadProductFacts = vi.fn(async () => known);
      const adapter = { ...cartAdapter(loadProductFacts), knownProductFacts: () => ({ facts: known, complete: true }) };
      const { sent, stop } = start({ adapter });
      await vi.advanceTimersByTimeAsync(50);
      expect(loadProductFacts).not.toHaveBeenCalled();
      expect(sent).toHaveLength(1);
      expect(sent[0]!.type === 'cart/review' && Object.keys(sent[0]!.facts ?? {})).toEqual(['10315798']);
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
      expect(sent).toHaveLength(1); // the first pass doesn't wait for the product pages
      document.querySelector('[data-testid="line-price"]')!.textContent = '$9.00';
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(2); // the newer read's first pass
      release();
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(2); // the older read's second pass never sends
      expect(shown).toHaveLength(2);
      stop();
    });
  });

  describe('before the product pages have loaded', () => {
    const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const never = () => new Promise<never>(() => undefined);
    type Facts = Awaited<ReturnType<NonNullable<typeof walmartAdapter.loadProductFacts>>>;

    function startWithSlowPages(loadProductFacts: NonNullable<typeof walmartAdapter.loadProductFacts>) {
      let isOpen = false;
      let handlers!: Parameters<ReviewControllerDeps['mountPanel']>[0];
      const shown: CartReview[] = [];
      const mountPanel = vi.fn(async (given: typeof handlers): Promise<PanelHandle> => {
        handlers = given;
        return { show: (review) => shown.push(review), open: () => (isOpen = true), isOpen: () => isOpen, remove: () => undefined };
      });
      const adapter = { ...walmartAdapter, isCartRoute: (url: URL) => /^\/cart\/?$/.test(url.pathname), loadProductFacts };
      const started = start({ adapter, mountPanel, trustedClicksOnly: false });
      return { ...started, shown, handlers: () => handlers, isOpen: () => isOpen, setOpen: (value: boolean) => (isOpen = value) };
    }

    it('holds the first checkout click while product pages are still loading', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const pageClicks = vi.fn();
      document.addEventListener('click', pageClicks);
      const { isOpen, diagnose, stop } = startWithSlowPages(never);
      await vi.advanceTimersByTimeAsync(50);
      expect(diagnose).toHaveBeenCalledWith({ checkout: 'armed' });
      click(document.getElementById('checkout')!);
      expect(isOpen()).toBe(true);
      expect(pageClicks).not.toHaveBeenCalled();
      document.removeEventListener('click', pageClicks);
      stop();
    });

    it('applies what the product pages teach once they arrive, if the panel is closed', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      let release!: (facts: Facts) => void;
      const { shown, sent, stop } = startWithSlowPages(() => new Promise<Facts>((resolve) => { release = resolve; }));
      await vi.advanceTimersByTimeAsync(50);
      expect(shown).toHaveLength(1);
      release({ '10309701': factsFor({ ...PAGES.milk, id: '10309701' }) });
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(2);
      expect(shown).toHaveLength(2);
      stop();
    });

    it('does not swap the review while the shopper is reading it, and refreshes after they close it', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      let release!: (facts: Facts) => void;
      const { shown, sent, handlers, setOpen, stop } = startWithSlowPages(() => new Promise<Facts>((resolve) => { release = resolve; }));
      await vi.advanceTimersByTimeAsync(50);
      setOpen(true); // the shopper is looking at the first pass
      release({ '10309701': factsFor({ ...PAGES.milk, id: '10309701' }) });
      await vi.advanceTimersByTimeAsync(50);
      expect(sent).toHaveLength(1);
      expect(shown).toHaveLength(1);

      setOpen(false);
      handlers().onDismiss(['walmart:18256507800:cheaper_alternative']);
      await vi.advanceTimersByTimeAsync(50);
      // A fresh review is requested, which honors what they just dismissed.
      expect(sent.map((request) => request.type)).toEqual(['cart/review', 'panel/dismiss', 'cart/review']);
      stop();
    });
  });

  describe('holding the first checkout click', () => {
    /** Clicks like a shopper would; returns true when the page's own handlers would still run. */
    const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const checkout = () => document.getElementById('checkout')!;

    function startWithPanel(overrides: Partial<ReviewControllerDeps> = {}) {
      const open = vi.fn();
      let isOpen = false;
      let handlers!: Parameters<ReviewControllerDeps['mountPanel']>[0];
      const pageClicks = vi.fn();
      document.addEventListener('click', pageClicks); // stands in for the retailer's own handler
      const mountPanel = vi.fn(async (given: typeof handlers): Promise<PanelHandle> => {
        handlers = given;
        return { show: () => undefined, open: () => ((isOpen = true), open()), isOpen: () => isOpen, remove: () => undefined };
      });
      const started = start({ mountPanel, trustedClicksOnly: false, ...overrides });
      return { ...started, open, pageClicks, handlers: () => handlers, setOpen: (value: boolean) => (isOpen = value) };
    }

    it('holds the first click once, opens the panel, and lets the next click through', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { open, pageClicks, stop, diagnose } = startWithPanel();
      await vi.advanceTimersByTimeAsync(50);
      expect(diagnose).toHaveBeenCalledWith({ checkout: 'armed' });

      expect(click(checkout())).toBe(false); // held: default prevented
      expect(diagnose).toHaveBeenLastCalledWith({ checkout: 'held' });
      expect(open).toHaveBeenCalledTimes(1);
      expect(pageClicks).not.toHaveBeenCalled(); // the page never saw it

      expect(click(checkout())).toBe(true); // the shopper's second click goes through
      expect(diagnose).toHaveBeenLastCalledWith({ checkout: 'passed-through-not-armed' });
      expect(open).toHaveBeenCalledTimes(1);
      expect(pageClicks).toHaveBeenCalledTimes(1);
      stop();
    });

    it('never holds anything when there is nothing to show', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-normal.html');
      const { open, stop, diagnose } = startWithPanel();
      await vi.advanceTimersByTimeAsync(50);
      expect(diagnose).toHaveBeenCalledWith({ checkout: 'nothing-to-show' });
      const button = document.createElement('button');
      button.id = 'checkout';
      button.textContent = 'Continue to checkout';
      document.body.append(button);
      expect(click(button)).toBe(true);
      expect(open).not.toHaveBeenCalled();
      stop();
    });

    it('ignores other buttons on the page', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { open, stop } = startWithPanel();
      await vi.advanceTimersByTimeAsync(50);
      expect(click(document.querySelector('button.retailer-control:not(#checkout)')!)).toBe(true);
      expect(open).not.toHaveBeenCalled();
      stop();
    });

    it('does not hold a click after the shopper has already seen and closed the panel', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { open, handlers, stop } = startWithPanel();
      await vi.advanceTimersByTimeAsync(50);
      handlers().onDismiss(['a']);
      expect(click(checkout())).toBe(true);
      expect(open).not.toHaveBeenCalled();
      stop();
    });

    it('a review that was in flight when the shopper dismissed does not re-arm the hold', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      let release!: () => void;
      let calls = 0;
      const send = vi.fn(async (request: ContentRequest) => {
        if (request.type !== 'cart/review') return { ok: true };
        const review = reviewCart(request.snapshot, reviewContext());
        if (calls++ === 1) await new Promise<void>((resolve) => (release = resolve)); // the second review stays in flight
        return { ok: true, review };
      });
      const { handlers, open, stop } = startWithPanel({ send });
      await vi.advanceTimersByTimeAsync(50); // first review: armed
      document.querySelector('[data-testid="line-price"]')!.textContent = '$9.00';
      await vi.advanceTimersByTimeAsync(50); // second review now in flight
      handlers().onDismiss(['a']); // the shopper closes the panel meanwhile
      release();
      await vi.advanceTimersByTimeAsync(50);
      expect(click(checkout())).toBe(true); // not held again
      expect(open).not.toHaveBeenCalled();
      stop();
    });

    it('does not hold a click while the panel is already open', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { open, setOpen, stop } = startWithPanel();
      await vi.advanceTimersByTimeAsync(50);
      setOpen(true);
      expect(click(checkout())).toBe(true);
      expect(open).not.toHaveBeenCalled();
      stop();
    });

    it('never holds a click it cannot show a panel for', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { stop } = startWithPanel({ mountPanel: () => Promise.reject(new Error('no UI')) });
      await vi.advanceTimersByTimeAsync(50);
      expect(click(checkout())).toBe(true);
      stop();
    });

    it('ignores scripted clicks (only real user clicks are held)', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { open, stop, diagnose } = startWithPanel({ trustedClicksOnly: true });
      await vi.advanceTimersByTimeAsync(50);
      expect(click(checkout())).toBe(true); // jsdom events are never trusted
      expect(diagnose).toHaveBeenLastCalledWith({ checkout: 'passed-through-scripted-click' });
      expect(open).not.toHaveBeenCalled();
      stop();
    });

    it('stops listening once the shopper leaves the cart', async () => {
      vi.useFakeTimers();
      history.replaceState({}, '', '/cart');
      loadIntoDocument('cart-mixed.html');
      const { open, stop } = startWithPanel();
      await vi.advanceTimersByTimeAsync(50);
      history.pushState({}, '', '/checkout');
      await vi.advanceTimersByTimeAsync(100);
      expect(click(checkout())).toBe(true);
      expect(open).not.toHaveBeenCalled();
      stop();
    });
  });

  it('marks only the first review of each visit to the cart page as fresh', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    const { sent, stop } = start();
    await vi.advanceTimersByTimeAsync(50);
    expect(sent[0]).toMatchObject({ type: 'cart/review', fresh: true });

    document.querySelector('[data-testid="line-price"]')!.textContent = '$9.00';
    await vi.advanceTimersByTimeAsync(50);
    expect(sent).toHaveLength(2);
    expect(sent[1]).not.toHaveProperty('fresh');

    // Leaving the cart and coming back is a new visit.
    history.pushState({}, '', '/checkout');
    await vi.advanceTimersByTimeAsync(100);
    history.pushState({}, '', '/cart');
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.at(-1)).toMatchObject({ fresh: true });
    stop();
  });

  it('keeps asking for a fresh start until a review actually comes back', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/cart');
    loadIntoDocument('cart-normal.html');
    let attempts = 0;
    const sent: ContentRequest[] = [];
    const send = vi.fn(async (request: ContentRequest) => {
      sent.push(request);
      if (attempts++ === 0) throw new Error('background asleep');
      return request.type === 'cart/review' ? { ok: true, review: reviewCart(request.snapshot, reviewContext()) } : { ok: true };
    });
    const { stop } = start({ send });
    await vi.advanceTimersByTimeAsync(50);
    document.querySelector('[data-testid="line-price"]')!.textContent = '$9.00';
    await vi.advanceTimersByTimeAsync(50);
    expect(sent.map((request) => request.type === 'cart/review' && request.fresh === true)).toEqual([true, true]);
    stop();
  });
});
