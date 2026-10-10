import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractWalmartOrders } from '../../src/adapters/walmart/extract-orders';
import { startOrdersController, type OrdersPanelApi } from '../../src/content/orders-controller';
import type { PurchaseInput } from '../../src/domain/history';
import type { ContentRequest } from '../../src/messaging/messages';
import { OrdersPanel } from '../../src/ui/orders/OrdersPanel';
import { ImportReviewList } from '../../src/ui/shared/ImportReviewList';
import type { ImportProposal } from '../../src/ingestion/review-import';

const input: PurchaseInput = {
  source: 'synthetic_gmail',
  merchant: 'Walmart',
  title: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
  retailerItemId: '18256507800',
  orderId: 'WI-TEST-0001',
  purchasedOn: '2026-09-20',
  quantity: 1,
  linePriceCents: 2497,
  status: 'purchased',
  description: null,
  gmailMessageId: 'a',
};

const proposals: ImportProposal[] = [
  { id: 'p1', input, duplicate: false, incomplete: false },
  { id: 'p2', input: { ...input, title: 'Already saved thing' }, duplicate: true, incomplete: false },
  { id: 'p3', input: { ...input, title: '<b>Eggs</b>', quantity: null }, duplicate: false, incomplete: true },
];

describe('ImportReviewList', () => {
  it('preselects new items, leaves duplicates unchecked, and saves only the selection', async () => {
    const onSave = vi.fn();
    render(<ImportReviewList proposals={proposals} onSave={onSave} onCancel={() => undefined} />);
    expect(screen.getAllByText('Synthetic test receipt (Gmail)')).toHaveLength(3);
    expect(screen.getByText('Already in history')).toBeTruthy();
    expect(screen.getByText('Missing quantity or price')).toBeTruthy();
    // Untrusted titles render as text.
    expect(screen.getByText('<b>Eggs</b>')).toBeTruthy();

    await userEvent.click(screen.getByRole('checkbox', { name: /<b>Eggs<\/b>/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 1 purchase' }));
    expect(onSave).toHaveBeenCalledWith([input]);
  });
});

describe('OrdersPanel', () => {
  it('reads the page only when asked, then saves approved items', async () => {
    const loadReview = vi.fn(async () => ({ proposals: [proposals[0]!], unparsed: [] }));
    const save = vi.fn(async (inputs: PurchaseInput[]) => inputs.length);
    render(<OrdersPanel pageKind="history" loadReview={loadReview} save={save} />);
    expect(loadReview).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Record these purchases' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save 1 purchase' }));
    expect(save).toHaveBeenCalledWith([input]);
    expect(await screen.findByText('Saved 1 purchase to your Worth It history.')).toBeTruthy();
  });

  it('can be dismissed without reading anything', async () => {
    const loadReview = vi.fn();
    render(<OrdersPanel pageKind="confirmation" loadReview={loadReview} save={vi.fn()} />);
    expect(screen.getByText('Record this order in Worth It?')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(loadReview).not.toHaveBeenCalled();
  });
});

describe('startOrdersController', () => {
  afterEach(() => history.replaceState({}, '', '/'));

  async function run(recordPurchases: boolean) {
    history.replaceState({}, '', '/orders');
    const mounted: OrdersPanelApi[] = [];
    const sent: ContentRequest['type'][] = [];
    const stop = startOrdersController({
      win: window,
      merchant: 'walmart',
      pageKind: (url) => (url.pathname === '/orders' ? 'history' : null),
      extractOrders: extractWalmartOrders,
      send: async (request) => {
        sent.push(request.type);
        return { ok: true, recordPurchases };
      },
      mountPanel: async (api) => {
        mounted.push(api);
        return { remove: () => undefined };
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    stop();
    return { mounted, sent };
  }

  it('stays inert when recording is off', async () => {
    const { mounted, sent } = await run(false);
    expect(mounted).toEqual([]);
    expect(sent).toEqual(['orders/settings']);
  });

  it('offers recording when opted in, without reading rows yet', async () => {
    const { mounted, sent } = await run(true);
    expect(mounted.map((api) => api.pageKind)).toEqual(['history']);
    expect(sent).toEqual(['orders/settings']);
  });
});
