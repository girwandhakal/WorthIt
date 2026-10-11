import { matchesCheckoutControl, type RetailerAdapter } from '../retailer-adapter';
import { extractAmazonCart } from './extract-cart';
import { amazonOrderPageKind, extractAmazonOrders } from './extract-orders';
import { AMAZON_ORIGIN, CART_PATH, CHECKOUT_CONTROL_SELECTORS } from './selectors';

export const amazonAdapter: RetailerAdapter = {
  merchant: 'amazon',
  isCartRoute: (url) => url.origin === AMAZON_ORIGIN && CART_PATH.test(url.pathname),
  extractCart: extractAmazonCart,
  isCheckoutControl: (target) => matchesCheckoutControl(target, CHECKOUT_CONTROL_SELECTORS),
  orderPageKind: amazonOrderPageKind,
  extractOrders: extractAmazonOrders,
};
