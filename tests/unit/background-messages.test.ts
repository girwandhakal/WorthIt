import { describe, expect, it } from 'vitest';
import { extractWalmartCart } from '../../src/adapters/walmart/extract-cart';
import { getDismissed } from '../../src/background/dismissals';
import { handleContentMessage } from '../../src/background/handle-message';
import { reviewCart } from '../../src/background/review-cart';
import type { CartReview } from '../../src/domain/review';
import { validateContentRequest } from '../../src/messaging/validate-message';
import { EXTENSION_ID, reviewContext, testDeps } from '../helpers/background';
import { loadRetailerDocument } from '../helpers/fixtures';

const URL_CART = new URL('https://www.walmart.com/cart');

const snapshotOf = (file: string) =>
  extractWalmartCart(loadRetailerDocument('walmart', file), URL_CART, new Date('2026-10-10T00:00:00Z'));

describe('validateContentRequest', () => {
  const sender = { id: EXTENSION_ID };

  it('accepts a valid review request', () => {
    const result = validateContentRequest({ type: 'cart/review', snapshot: snapshotOf('cart-normal.html') }, sender, EXTENSION_ID);
    expect(result.ok).toBe(true);
  });

  it('rejects other senders', () => {
    const result = validateContentRequest({ type: 'panel/dismiss', findingIds: [] }, { id: 'other' }, EXTENSION_ID);
    expect(result).toEqual({ ok: false, error: 'Message from an unknown sender.' });
  });

  it.each([
    [{ type: 'cart/add-item', itemId: '1' }],
    [{ type: 'cart/review', snapshot: { version: 1 } }],
    [{ type: 'panel/dismiss', findingIds: [42] }],
    ['cart/review'],
    [null],
  ])('rejects malformed message %#', (message) => {
    expect(validateContentRequest(message, sender, EXTENSION_ID).ok).toBe(false);
  });

  it('rejects oversized messages', () => {
    const findingIds = Array.from({ length: 500 }, () => 'x'.repeat(400));
    const huge = { type: 'panel/dismiss', findingIds, padding: 'y'.repeat(600_000) };
    expect(validateContentRequest(huge, sender, EXTENSION_ID)).toEqual({ ok: false, error: 'Message is too large.' });
  });
});

describe('reviewCart', () => {
  it('reviews every line and reports no findings for a fully readable cart', () => {
    const review = reviewCart(snapshotOf('cart-normal.html'), reviewContext());
    expect(review).toMatchObject({ itemCount: 3, readableCount: 3, findings: [], autoOpen: false });
  });

  it('turns unreadable lines into uncertainty findings', () => {
    const review = reviewCart(snapshotOf('cart-missing-data.html'), reviewContext());
    expect(review.itemCount).toBe(5);
    expect(review.readableCount).toBe(1);
    expect(review.autoOpen).toBe(true);
    const uncertain = review.findings.filter((finding) => finding.kind === 'uncertain');
    expect(uncertain.map((finding) => [finding.itemName, finding.text])).toEqual([
      ['Heinz Tomato Ketchup, 32 oz', "Couldn't read this item's price reliably, so Worth It couldn't fully check it."],
      ['Cart item 3', "Couldn't read this item's name reliably, so Worth It couldn't fully check it."],
      ['Folgers Classic Roast Ground Coffee, 25.9 oz', "Couldn't read this item's price reliably, so Worth It couldn't fully check it."],
      ['Wonder Classic White Sandwich Bread, 20 oz', "This item shows as unavailable, so it isn't part of the review."],
    ]);
    // An unavailable item gets no suggestions.
    expect(review.findings.filter((finding) => finding.itemName.startsWith('Wonder')).map((f) => f.kind)).toEqual(['uncertain']);
  });

  it('stays collapsed when every finding was dismissed and reopens for a new one', () => {
    const snapshot = snapshotOf('cart-missing-data.html');
    const all = reviewCart(snapshot, reviewContext()).findings.map((finding) => finding.id);
    expect(reviewCart(snapshot, reviewContext({ dismissedIds: new Set(all) })).autoOpen).toBe(false);
    expect(reviewCart(snapshot, reviewContext({ dismissedIds: new Set(all.slice(1)) })).autoOpen).toBe(true);
  });
});

describe('handleContentMessage', () => {
  it('returns a review and remembers dismissals per tab', async () => {
    const deps = await testDeps();
    const session = deps.session;
    const sender = { id: EXTENSION_ID, tab: { id: 7 } };
    const snapshot = snapshotOf('cart-missing-data.html');

    const first = (await handleContentMessage({ type: 'cart/review', snapshot }, sender, deps)) as {
      ok: true;
      review: CartReview;
    };
    expect(first.review.autoOpen).toBe(true);

    const ids = first.review.findings.map((finding) => finding.id);
    expect(await handleContentMessage({ type: 'panel/dismiss', findingIds: ids }, sender, deps)).toEqual({ ok: true });
    expect([...(await getDismissed(session, 7))]).toEqual(ids);

    const again = (await handleContentMessage({ type: 'cart/review', snapshot }, sender, deps)) as {
      review: CartReview;
    };
    expect(again.review.autoOpen).toBe(false);

    // Another tab is unaffected.
    const otherTab = (await handleContentMessage({ type: 'cart/review', snapshot }, { ...sender, tab: { id: 8 } }, deps)) as {
      review: CartReview;
    };
    expect(otherTab.review.autoOpen).toBe(true);
  });

  it('rejects invalid messages without throwing', async () => {
    const deps = await testDeps();
    await expect(handleContentMessage({ type: 'nope' }, { id: EXTENSION_ID, tab: { id: 1 } }, deps)).resolves.toEqual({
      ok: false,
      error: 'Message failed validation.',
    });
    await expect(handleContentMessage({ type: 'panel/dismiss', findingIds: [] }, { id: EXTENSION_ID }, deps)).resolves.toEqual({
      ok: false,
      error: 'Message must come from a tab.',
    });
  });
});
