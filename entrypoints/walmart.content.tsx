import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { walmartAdapter } from '../src/adapters/walmart';
import { WORTH_IT_HOST_TAG } from '../src/adapters/walmart/extract-cart';
import { extractWalmartOrders, walmartOrderPageKind } from '../src/adapters/walmart/extract-orders';
import { startOrdersController } from '../src/content/orders-controller';
import { startReviewController } from '../src/content/review-controller';
import type { ContentRequest } from '../src/messaging/messages';
import { CheckoutPanel } from '../src/ui/checkout/CheckoutPanel';
import '../src/ui/checkout/panel.css';
import { OrdersPanel } from '../src/ui/orders/OrdersPanel';
import { createReviewStore } from '../src/ui/shared/review-store';
import '../src/ui/shared/review-list.css';

/**
 * Walmart content script. Matches the Walmart origin because the site is a
 * single-page app; the cart review activates only on the cart route, and the
 * opt-in purchase recorder only on order pages when the shopper turned it on.
 */
export default defineContentScript({
  matches: ['https://www.walmart.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    const send = (request: ContentRequest) => browser.runtime.sendMessage(request);

    const stopReview = startReviewController({
      win: window,
      adapter: walmartAdapter,
      send,
      mountPanel: async (handlers) => {
        const store = createReviewStore();
        const remove = await mountShadow(ctx, <CheckoutPanel store={store} {...handlers} />);
        return { show: (review) => store.set(review), remove };
      },
    });

    const stopOrders = startOrdersController({
      win: window,
      merchant: 'walmart',
      pageKind: walmartOrderPageKind,
      extractOrders: extractWalmartOrders,
      send,
      mountPanel: async (api) => ({ remove: await mountShadow(ctx, <OrdersPanel {...api} />) }),
    });

    ctx.onInvalidated(() => {
      stopReview();
      stopOrders();
    });
  },
});

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
