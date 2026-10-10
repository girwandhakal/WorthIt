import { watchRoute } from '../adapters/observe-page';
import type { Merchant } from '../domain/cart';
import type { PurchaseInput } from '../domain/history';
import type { ObservedOrderItem, OrderPageKind } from '../domain/orders';
import type { ImportReview } from '../ingestion/review-import';
import type { ContentRequest } from '../messaging/messages';

export interface OrdersPanelApi {
  pageKind: OrderPageKind;
  loadReview: () => Promise<ImportReview>;
  save: (inputs: PurchaseInput[]) => Promise<number>;
}

export interface OrdersControllerDeps {
  win: Window;
  merchant: Merchant;
  pageKind: (url: URL) => OrderPageKind | null;
  extractOrders: (doc: Document, now: Date) => ObservedOrderItem[];
  send: (request: ContentRequest) => Promise<unknown>;
  mountPanel: (api: OrdersPanelApi) => Promise<{ remove: () => void }>;
  routePollMs?: number;
}

/**
 * Opt-in purchase recorder. Inert unless the shopper turned recording on and
 * the URL is an order confirmation or purchase-history page. Reads item rows
 * only when the shopper asks.
 */
export function startOrdersController(deps: OrdersControllerDeps): () => void {
  let active: { kind: OrderPageKind; panel: Promise<{ remove: () => void }> } | null = null;
  let generation = 0;

  const deactivate = () => {
    generation++;
    if (!active) return;
    void active.panel.then((panel) => panel.remove());
    active = null;
  };

  const api = (kind: OrderPageKind): OrdersPanelApi => ({
    pageKind: kind,
    loadReview: async () => {
      const items = deps.extractOrders(deps.win.document, new Date());
      const response = (await deps.send({ type: 'orders/review', merchant: deps.merchant, items })) as {
        ok?: boolean;
        review?: ImportReview;
      };
      if (!response?.ok || !response.review) throw new Error('Review failed');
      return response.review;
    },
    save: async (inputs) => {
      const observed = inputs.map((input) => ({ ...input, source: 'observed_purchase' as const }));
      const response = (await deps.send({ type: 'orders/save', inputs: observed })) as { ok?: boolean; saved?: number };
      if (!response?.ok || typeof response.saved !== 'number') throw new Error('Save failed');
      return response.saved;
    },
  });

  const onRoute = async (url: URL) => {
    const kind = deps.pageKind(url);
    if (active && active.kind === kind) return;
    deactivate();
    if (!kind) return;
    const myGeneration = generation;
    const settings = (await deps.send({ type: 'orders/settings' }).catch(() => null)) as { recordPurchases?: boolean } | null;
    if (myGeneration !== generation || !settings?.recordPurchases) return;
    active = { kind, panel: deps.mountPanel(api(kind)) };
  };

  void onRoute(new URL(deps.win.location.href));
  const stopWatching = watchRoute(deps.win, (url) => void onRoute(url), deps.routePollMs);
  return () => {
    stopWatching();
    deactivate();
  };
}
