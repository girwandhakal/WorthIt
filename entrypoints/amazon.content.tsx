import { defineContentScript } from 'wxt/utils/define-content-script';
import { amazonAdapter } from '../src/adapters/amazon';
import { startRetailerContent } from '../src/content/start-content';
import '../src/ui/checkout/panel.css';
import '../src/ui/shared/review-list.css';

/**
 * Amazon content script. The review activates only on cart routes; the
 * opt-in purchase recorder only on order pages. Checkout is never touched.
 */
export default defineContentScript({
  matches: ['https://www.amazon.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    startRetailerContent(ctx, amazonAdapter);
  },
});
