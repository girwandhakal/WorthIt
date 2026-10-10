import { describe, expect, it } from 'vitest';
import { extractWalmartCart } from '../../src/adapters/walmart/extract-cart';
import { extractWalmartOrders } from '../../src/adapters/walmart/extract-orders';
import { handleContentMessage } from '../../src/background/handle-message';
import type { CartReview } from '../../src/domain/review';
import type { ImportReview } from '../../src/ingestion/review-import';
import { updatePreferences } from '../../src/storage/preferences';
import { EXTENSION_ID, testDeps } from '../helpers/background';
import { loadRetailerDocument } from '../helpers/fixtures';

const sender = { id: EXTENSION_ID, tab: { id: 3 } };
const items = () => extractWalmartOrders(loadRetailerDocument('walmart', 'orders-history.html'), new Date(2026, 9, 10));

describe('observed purchase messages', () => {
  it('are refused while purchase recording is off (the default)', async () => {
    const deps = await testDeps();
    expect(await handleContentMessage({ type: 'orders/settings' }, sender, deps)).toEqual({ ok: true, recordPurchases: false });
    expect(await handleContentMessage({ type: 'orders/review', merchant: 'walmart', items: items() }, sender, deps)).toEqual({
      ok: false,
      error: 'Purchase recording is off.',
    });
  });

  it('build a review and save approved rows as observed_purchase', async () => {
    const deps = await testDeps();
    await updatePreferences(deps.local, { recordPurchases: true });
    const reviewResponse = (await handleContentMessage({ type: 'orders/review', merchant: 'walmart', items: items() }, sender, deps)) as {
      review: ImportReview;
    };
    const proposals = reviewResponse.review.proposals;
    expect(proposals).toHaveLength(3);
    expect(proposals.every((proposal) => proposal.input.source === 'observed_purchase' && !proposal.duplicate)).toBe(true);
    expect(proposals[2]!.input.status).toBe('canceled');

    const inputs = proposals.slice(0, 2).map((proposal) => proposal.input);
    expect(await handleContentMessage({ type: 'orders/save', inputs }, sender, deps)).toEqual({ ok: true, saved: 2, duplicates: 0 });
    const saved = await deps.repos.purchases.list();
    expect(saved.map((record) => record.source)).toEqual(['observed_purchase', 'observed_purchase']);

    // Re-recording the same page marks those rows as duplicates.
    const again = (await handleContentMessage({ type: 'orders/review', merchant: 'walmart', items: items() }, sender, deps)) as {
      review: ImportReview;
    };
    expect(again.review.proposals.map((proposal) => proposal.duplicate)).toEqual([true, true, false]);
  });

  it('rejects pages trying to save records under another source', async () => {
    const deps = await testDeps();
    await updatePreferences(deps.local, { recordPurchases: true });
    const forged = {
      source: 'synthetic_gmail',
      merchant: 'Walmart',
      title: 'Forged',
      retailerItemId: null,
      orderId: null,
      purchasedOn: '2026-10-01',
      quantity: 1,
      linePriceCents: 100,
      status: 'purchased',
      description: null,
      gmailMessageId: null,
    };
    expect(await handleContentMessage({ type: 'orders/save', inputs: [forged] }, sender, deps)).toEqual({
      ok: false,
      error: 'Message failed validation.',
    });
    expect(await deps.repos.purchases.list()).toEqual([]);
  });
});

describe('checkout prompts preference', () => {
  it('keeps the panel collapsed when prompts are off', async () => {
    const deps = await testDeps();
    await updatePreferences(deps.local, { promptsEnabled: false });
    const snapshot = extractWalmartCart(
      loadRetailerDocument('walmart', 'cart-missing-data.html'),
      new URL('https://www.walmart.com/cart'),
      new Date(),
    );
    const response = (await handleContentMessage({ type: 'cart/review', snapshot }, sender, deps)) as { review: CartReview };
    expect(response.review.findings.length).toBeGreaterThan(0);
    expect(response.review.autoOpen).toBe(false);
  });
});
