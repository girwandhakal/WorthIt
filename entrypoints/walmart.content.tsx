import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { walmartAdapter } from '../src/adapters/walmart';
import { WORTH_IT_HOST_TAG } from '../src/adapters/walmart/extract-cart';
import { startReviewController } from '../src/content/review-controller';
import type { ContentRequest } from '../src/messaging/messages';
import { CheckoutPanel } from '../src/ui/checkout/CheckoutPanel';
import '../src/ui/checkout/panel.css';
import { createReviewStore } from '../src/ui/shared/review-store';

/**
 * Walmart content script. Matches the Walmart origin because the site is a
 * single-page app, but the controller activates only on the cart route.
 */
export default defineContentScript({
  matches: ['https://www.walmart.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    const stop = startReviewController({
      win: window,
      adapter: walmartAdapter,
      send: (request: ContentRequest) => browser.runtime.sendMessage(request),
      mountPanel: async (onDismiss) => {
        const store = createReviewStore();
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
            root.render(<CheckoutPanel store={store} onDismiss={onDismiss} />);
            return root;
          },
          onRemove: (root) => root?.unmount(),
        });
        ui.mount();
        return { show: (review) => store.set(review), remove: () => ui.remove() };
      },
    });
    ctx.onInvalidated(stop);
  },
});
