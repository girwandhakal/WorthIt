import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createWalmartAdapter } from '../src/adapters/walmart';
import { startRetailerContent } from '../src/content/start-content';
import '../src/ui/checkout/panel.css';
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
    // Product labels are kept on this device for a day, so a repeat visit to the cart doesn't read every page again.
    startRetailerContent(ctx, createWalmartAdapter({ factsStorage: browser.storage.local }));
  },
});
