import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import background from '../../entrypoints/background';
import { extractWalmartCart } from '../../src/adapters/walmart/extract-cart';
import * as database from '../../src/storage/database';
import { readFixture } from '../helpers/fixtures';

/** Exercise the registered entrypoint, with Chrome's callback response contract. */
function listener() {
  const registration = vi.spyOn(fakeBrowser.runtime.onMessage, 'addListener');
  background.main();
  return registration.mock.calls[0]![0];
}

const sender = async () => ({ id: fakeBrowser.runtime.id,
  tab: await fakeBrowser.tabs.create({ url: 'https://www.walmart.com/cart' }) });
function snapshot() {
  const doc = new DOMParser().parseFromString(readFixture('retailer', 'walmart', 'cart-normal.html'), 'text/html');
  return extractWalmartCart(doc, new URL('https://www.walmart.com/cart'), new Date('2026-10-10T00:00:00Z'));
}

describe('background callback messaging compatibility', () => {
  it('returns literal true immediately and delivers a cart review through sendResponse', async () => {
    const receive = listener();
    const respond = vi.fn();
    // Chrome versions without Promise-listener support only keep this channel
    // open if the listener returns literal true, not a Promise or truthy value.
    expect(receive({ type: 'cart/review', snapshot: snapshot() }, await sender(), respond)).toBe(true);
    expect(respond).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(respond).toHaveBeenCalledOnce());
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({ ok: true,
      review: expect.objectContaining({ itemCount: 3 }) }));
  });

  it('returns the safe failure response through the open channel when storage fails', async () => {
    vi.spyOn(database, 'openWorthItDb').mockRejectedValue(new Error('private-storage-detail'));
    const respond = vi.fn();
    expect(listener()({ type: 'cart/review', snapshot: snapshot() }, await sender(), respond)).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledOnce());
    expect(respond).toHaveBeenCalledWith({ ok: false, error: 'Worth It could not complete that request.' });
  });

  it('responds to invalid messages without leaking arbitrary request fields', async () => {
    const respond = vi.fn();
    expect(listener()({ type: 'unknown', secret: 'private-token' }, await sender(), respond)).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledOnce());
    expect(respond.mock.calls[0]![0]).toMatchObject({ ok: false });
    expect(JSON.stringify(respond.mock.calls)).not.toContain('private-token');
  });
});
