import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { WORTH_IT_HOST_TAG, type RetailerAdapter } from '../adapters/retailer-adapter';
import type { ContentRequest } from '../messaging/messages';
import { CheckoutPanel } from '../ui/checkout/CheckoutPanel';
import { OrdersPanel } from '../ui/orders/OrdersPanel';
import { createReviewStore } from '../ui/shared/review-store';
import { startOrdersController } from './orders-controller';
import { startReviewController } from './review-controller';
import { createContentDiagnostics } from './diagnostics';

/**
 * Shared content-script setup for every retailer: the cart review (cart route
 * only) and the opt-in purchase recorder (order pages only). Retailer
 * specifics come entirely from the adapter.
 */
export function startRetailerContent(ctx: ContentScriptContext, adapter: RetailerAdapter): void {
  const diagnostics = createContentDiagnostics(document, adapter.merchant);
  const send = (request: ContentRequest) => browser.runtime.sendMessage(request);

  const stopReview = startReviewController({
    win: window,
    adapter,
    send,
    diagnose: diagnostics.update,
    mountPanel: async (handlers) => {
      const store = createReviewStore();
      const remove = await mountShadow(ctx, <CheckoutPanel store={store} {...handlers} />);
      return { show: (review) => store.set(review), remove };
    },
  });

  const stopOrders = startOrdersController({
    win: window,
    merchant: adapter.merchant,
    pageKind: adapter.orderPageKind,
    extractOrders: adapter.extractOrders,
    send,
    mountPanel: async (api) => ({ remove: await mountShadow(ctx, <OrdersPanel {...api} />) }),
  });

  ctx.onInvalidated(() => {
    diagnostics.update({ context: 'invalidated', error: 'context-invalidated' });
    stopReview();
    stopOrders();
  });
}

/** Mounts React UI in an isolated Shadow DOM root at the end of <body>. */
async function mountShadow(ctx: ContentScriptContext, element: ReactNode): Promise<() => void> {
  const ui = await createShadowRootUi(ctx, {
    name: WORTH_IT_HOST_TAG,
    position: 'inline',
    anchor: 'body',
    append: 'last',
    isolateEvents: true,
    onMount: (container) => {
      const host = document.createElement('div');
      host.className = 'wi-root';
      container.append(host);
      const root = createRoot(host);
      root.render(element);
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  ui.mount();
  return () => ui.remove();
}
