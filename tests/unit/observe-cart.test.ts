import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractWalmartCart } from '../../src/adapters/walmart/extract-cart';
import { observeCart, snapshotSignature, watchRoute } from '../../src/adapters/walmart/observe-cart';
import type { CartSnapshot } from '../../src/domain/cart';
import { readFixture } from '../helpers/fixtures';

const CART_URL = new URL('https://www.walmart.com/cart');

describe('observeCart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const parsed = new DOMParser().parseFromString(readFixture('retailer', 'walmart', 'cart-mixed.html'), 'text/html');
    document.body.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const start = () => {
    const snapshots: CartSnapshot[] = [];
    const observer = observeCart(document.body, {
      debounceMs: 50,
      read: () => extractWalmartCart(document, CART_URL, new Date()),
      onChange: (snapshot) => snapshots.push(snapshot),
    });
    return { snapshots, observer };
  };

  it('emits the initial snapshot immediately', () => {
    const { snapshots, observer } = start();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.items).toHaveLength(7);
    observer.stop();
  });

  it('emits once per real change after debouncing', async () => {
    const { snapshots, observer } = start();
    const line = document.querySelector('[data-testid="cart-line-item"]')!;
    line.querySelector('[data-testid="line-price"] span')!.textContent = '$11.92';
    line.querySelector('select')!.value = '2';
    line.querySelector('select')!.setAttribute('data-changed', 'yes');
    await vi.advanceTimersByTimeAsync(60);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]!.items[0]).toMatchObject({ quantity: 2, linePriceCents: 1192 });
    observer.stop();
  });

  it('ignores rerenders that do not change the cart', async () => {
    const { snapshots, observer } = start();
    const section = document.querySelector('[data-testid="cart-items"]')!;
    // Re-render the same content, as a single-page app would.
    section.replaceWith(section.cloneNode(true));
    await vi.advanceTimersByTimeAsync(60);
    expect(snapshots).toHaveLength(1);
    observer.stop();
  });

  it('reports a removed line', async () => {
    const { snapshots, observer } = start();
    document.querySelectorAll('[data-testid="cart-line-item"]')[1]!.remove();
    await vi.advanceTimersByTimeAsync(60);
    expect(snapshots.at(-1)!.items).toHaveLength(6);
    observer.stop();
  });

  it('ignores mutations inside the Worth It panel', async () => {
    const { snapshots, observer } = start();
    const host = document.createElement('worth-it-panel');
    document.body.append(host);
    host.append(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(60);
    expect(snapshots).toHaveLength(1);
    observer.stop();
  });
});

describe('snapshotSignature', () => {
  it('ignores observation time', () => {
    const doc = new DOMParser().parseFromString(readFixture('retailer', 'walmart', 'cart-normal.html'), 'text/html');
    const a = extractWalmartCart(doc, CART_URL, new Date('2026-01-01'));
    const b = extractWalmartCart(doc, CART_URL, new Date('2026-02-01'));
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });
});

describe('watchRoute', () => {
  afterEach(() => {
    vi.useRealTimers();
    history.replaceState({}, '', '/');
  });

  it('reports client-side navigation detected by polling and popstate', async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const stop = watchRoute(window, (url) => seen.push(url.pathname), 100);
    history.pushState({}, '', '/cart');
    await vi.advanceTimersByTimeAsync(120);
    history.pushState({}, '', '/checkout');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(seen).toEqual(['/cart', '/checkout']);
    stop();
  });
});
