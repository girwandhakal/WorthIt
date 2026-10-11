/**
 * Amazon.com page knowledge, isolated so markup changes stay in one file.
 * Amazon cart rows carry stable data attributes (`data-asin`, `data-price`,
 * `data-quantity`), which extraction prefers over visible text. Anything that
 * cannot be read is reported as unknown.
 */

export const AMAZON_ORIGIN = 'https://www.amazon.com';

/** Amazon's checkout control on the cart page (plus a label check in matchesCheckoutControl). */
export const CHECKOUT_CONTROL_SELECTORS = ['input[name="proceedToRetailCheckout"]', '[data-feature-id="proceed-to-checkout-action"]'] as const;

/** Cart routes. Checkout (`/gp/buy/...`, `/checkout/...`) is never the cart. */
export const CART_PATH = /^\/(?:gp\/cart\/view\.html|cart|gp\/aw\/c)(?:\/ref=[^/]*)?\/?$/;

/** Opt-in purchase recording pages; only item rows are read there. */
export const ORDER_CONFIRMATION_PATH = /^\/gp\/buy\/thankyou\//;
export const ORDER_HISTORY_PATH = /^\/(?:gp\/(?:your-account|css)\/order-history|your-orders\/orders)(?:\/|$)/;
export const ORDER_DETAILS_PATH = /^\/(?:gp\/(?:your-account|css)\/order-details|your-orders\/order-details)(?:\/|$)/;

export const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
export const ASIN_FROM_URL = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/;

export const ACTIVE_CART_SELECTORS = ['#sc-active-cart', '[data-name="Active Items"]', '#activeCartViewForm'] as const;
export const LINE_ITEM_SELECTOR = '[data-asin].sc-list-item, [data-asin][data-itemtype="active"]';
export const EXCLUDED_CART_REGIONS = ['#sc-saved-cart', '[data-name="Saved items"]', '#sc-secondary-list', '[data-itemtype="saved"]'] as const;

export const TITLE_SELECTORS = ['.sc-product-title .a-truncate-full', '.sc-product-title', '.sc-item-product-title-cont'] as const;
export const PRODUCT_LINK_SELECTOR = 'a[href*="/dp/"], a[href*="/gp/product/"]';
export const PRICE_SELECTORS = ['.sc-product-price', '.sc-item-price-block .a-price .a-offscreen', '.a-price .a-offscreen'] as const;
export const WAS_PRICE_SELECTORS = ['.a-text-price .a-offscreen', '.sc-list-price'] as const;
export const QUANTITY_INPUT_SELECTORS = ['select[name="quantity"]', 'input[name="quantityBox"]'] as const;
export const QUANTITY_TEXT_SELECTORS = ['[data-a-selector="value"]', '.a-dropdown-prompt', '.sc-quantity-stepper .a-text-bold'] as const;

export const SUBTOTAL_LABEL_SELECTORS = ['#sc-subtotal-label-activecart', '#sc-subtotal-label-buybox'] as const;
export const SUBTOTAL_AMOUNT_SELECTORS = ['#sc-subtotal-amount-activecart', '#sc-subtotal-amount-buybox'] as const;
export const ITEM_COUNT_PATTERN = /\((\d{1,4})\s+items?\)/i;

export const UNAVAILABLE_PATTERN = /\b(currently unavailable|out of stock|no longer available)\b/i;

// Order pages
export const ORDER_CONTAINER_SELECTORS = ['.order-card', '.js-order-card', '#orderDetails', '.order'] as const;
export const ORDER_ITEM_SELECTORS = ['.yohtmlc-item', '.item-box'] as const;
export const ORDER_ID_SELECTORS = ['.yohtmlc-order-id', '[data-component="orderId"]'] as const;
export const ORDER_HEADER_CELL_SELECTORS = ['.order-header .a-column', '.order-header__header-list-item'] as const;
export const ORDER_ITEM_TITLE_SELECTORS = ['.yohtmlc-product-title'] as const;
export const ORDER_ITEM_PRICE_SELECTORS = ['.a-color-price', '.yohtmlc-item-price'] as const;
export const ORDER_ITEM_QUANTITY_SELECTORS = ['.item-view-qty', '.product-image__qty'] as const;
export const ORDER_STATUS_SELECTORS = ['.yohtmlc-shipment-status-primaryText', '.delivery-box__primary-text'] as const;
export const ORDER_ID_PATTERN = /\b(\d{3}-\d{7}-\d{7})\b/;

/** Never read: recipient/address, payment, account menu, and forms. */
export const ORDER_EXCLUDED_REGIONS = [
  '.yohtmlc-recipient',
  '[class*="recipient"]',
  '[id*="shipToInsert"]',
  '[class*="address"]',
  '[class*="payment"]',
  '#nav-belt',
  '#nav-tools',
  'form',
] as const;
