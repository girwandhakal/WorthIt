import type { RetailerAdapter } from '../retailer-adapter';
import { extractWalmartCart } from './extract-cart';
import { CART_PATH, WALMART_ORIGIN } from './selectors';

export const walmartAdapter: RetailerAdapter = {
  merchant: 'walmart',
  isCartRoute: (url) => url.origin === WALMART_ORIGIN && CART_PATH.test(url.pathname),
  extractCart: extractWalmartCart,
};
