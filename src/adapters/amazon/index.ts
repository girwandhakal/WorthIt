import type { RetailerAdapter } from '../retailer-adapter';
import { extractAmazonCart } from './extract-cart';
import { amazonOrderPageKind, extractAmazonOrders } from './extract-orders';
import { AMAZON_ORIGIN, CART_PATH } from './selectors';

export const amazonAdapter: RetailerAdapter = {
  merchant: 'amazon',
  isCartRoute: (url) => url.origin === AMAZON_ORIGIN && CART_PATH.test(url.pathname),
  extractCart: extractAmazonCart,
  orderPageKind: amazonOrderPageKind,
  extractOrders: extractAmazonOrders,
};
