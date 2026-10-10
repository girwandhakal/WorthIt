import { describe, expect, it } from 'vitest';
import { extractWalmartCart } from '../../src/adapters/walmart/extract-cart';
import { reviewCart, unreadLinesFinding } from '../../src/background/review-cart';
import { reviewContext } from '../helpers/background';
import { loadRetailerDocument } from '../helpers/fixtures';

const URL_CART = new URL('https://www.walmart.com/cart');
const read = (file: string) => extractWalmartCart(loadRetailerDocument('walmart', file), URL_CART, new Date('2026-10-10T12:00:00Z'));

describe('extraction failure is visible, never silent', () => {
  it('reads the item count Walmart shows in the heading', () => {
    expect(read('cart-mixed.html').displayedItemCount).toBe(7);
    expect(read('cart-normal.html').displayedItemCount).toBe(3);
    expect(read('cart-missing-data.html').displayedItemCount).toBeNull();
  });

  it('flags a page that shows items Worth It could not read', () => {
    const snapshot = read('cart-unrecognized.html');
    expect(snapshot.items).toEqual([]);
    const review = reviewCart(snapshot, reviewContext());
    expect(review.autoOpen).toBe(true);
    expect(review.summary.highlights.map((finding) => finding.text)).toEqual([
      "Walmart shows 3 items in your cart, but Worth It couldn't read any of them. Walmart's page may have changed, so Worth It isn't guessing.",
    ]);
    expect(review.summary.totals.combinedCents).toBe(0);
  });

  it('reports a partial read', () => {
    const snapshot = { ...read('cart-normal.html'), displayedItemCount: 5 };
    expect(unreadLinesFinding(snapshot)?.text).toBe(
      "Walmart shows 5 items, but Worth It could read only 3. Walmart's page may have changed, so this review may be incomplete.",
    );
  });

  it('counts quantities like the heading does, and stays quiet when everything was read', () => {
    expect(unreadLinesFinding(read('cart-mixed.html'))).toBeNull();
    const twoOfOne = { ...read('cart-normal.html'), displayedItemCount: 4 };
    twoOfOne.items[0] = { ...twoOfOne.items[0]!, quantity: 2 };
    expect(unreadLinesFinding(twoOfOne)).toBeNull();
    expect(unreadLinesFinding({ ...read('cart-normal.html'), displayedItemCount: 0 })).toBeNull();
  });
});
