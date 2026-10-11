/**
 * Walmart US page knowledge, isolated so markup changes stay in one file.
 *
 * Walmart's cart markup changes often, so extraction prefers stable,
 * accessibility-oriented hooks (data-testid, aria-label, product links to
 * `/ip/<id>`) and falls back to structural heuristics. Anything that cannot be
 * read is reported as unknown rather than guessed.
 */

export const WALMART_ORIGIN = 'https://www.walmart.com';

/** The only route where the cart review runs. Checkout and payment are excluded. */
export const CART_PATH = /^\/cart\/?$/;

/**
 * Opt-in purchase recording pages. Only item rows are read here; payment,
 * address, and account sections are excluded (see ORDER_EXCLUDED_REGIONS).
 */
export const ORDER_CONFIRMATION_PATH = /^\/checkout\/thankyou\/?$/;
export const PURCHASE_HISTORY_PATH = /^\/orders\/?$/;
export const ORDER_DETAILS_PATH = /^\/orders\/[A-Za-z0-9-]{4,40}\/?$/;

export const ORDER_CONTAINER_SELECTORS = ['[data-testid="order-card"]', '[data-testid="order-details"]'] as const;
export const ORDER_ITEM_SELECTORS = ['[data-testid="order-item"]', '[data-testid="item-row"]'] as const;
export const ORDER_NUMBER_SELECTORS = ['[data-testid="order-number"]'] as const;
export const ORDER_DATE_SELECTORS = ['[data-testid="order-date"]'] as const;
export const ORDER_STATUS_SELECTORS = ['[data-testid="order-status"]'] as const;
export const ORDER_ITEM_QUANTITY_SELECTORS = ['[data-testid="item-quantity"]'] as const;
export const ORDER_ITEM_PRICE_SELECTORS = ['[data-testid="item-price"]'] as const;
export const ORDER_EXCLUDED_REGIONS = [
  '[data-testid*="payment" i]',
  '[data-testid*="address" i]',
  '[data-testid*="billing" i]',
  '[data-testid*="account" i]',
  '[aria-label*="payment" i]',
  '[aria-label*="address" i]',
  'form',
] as const;

/** Product links look like `/ip/<slug>/<itemId>` or `/ip/<itemId>`. */
/** Walmart's checkout control on the cart page (plus a label check in matchesCheckoutControl). */
export const CHECKOUT_CONTROL_SELECTORS = ['[data-automation-id="checkout"]', '[data-testid="checkout-button"]'] as const;

export const ITEM_ID_FROM_URL = /\/ip\/(?:[^/?#]+\/)?(\d{5,15})(?:[/?#]|$)/;

/** Known cart containers, most specific first; list groups are split into individual rows. */
export const LINE_ITEM_SELECTORS = [
  // Live walmart.com cart (checked 2026-10-10): the tile hook can wrap several list rows.
  '[data-testid="product-tile-container"]',
  '[data-testid="cart-line-item"]',
  '[data-testid="cartPage-lineItem"]',
  '[data-automation-id="cart-item"]',
  '[data-testid*="line-item" i]',
] as const;

export const PRODUCT_LINK_SELECTOR = 'a[href*="/ip/"]';

/** A product-tile-container can wrap a fulfillment group's list of cart rows. */
export const GROUPED_LINE_ROW_SELECTOR = 'li';

export const TITLE_SELECTORS = [
  '[data-testid="productName"]',
  '[data-testid="product-title"]',
  '[data-automation-id="product-title"]',
] as const;

export const BRAND_SELECTORS = ['[data-testid="product-brand"]', '[data-automation-id="product-brand"]'] as const;

export const LINE_PRICE_SELECTORS = [
  '[data-testid="line-price"]',
  '[data-automation-id="line-price"]',
  '[itemprop="price"]',
] as const;

export const UNIT_PRICE_SELECTORS = ['[data-testid="unit-price"]', '[data-automation-id="unit-price"]'] as const;

export const WAS_PRICE_SELECTORS = [
  '[data-testid="was-price"]',
  '[data-automation-id="strikethrough-price"]',
  's',
  'del',
] as const;

export const QUANTITY_INPUT_SELECTORS = [
  'select[aria-label*="quantity" i]',
  'input[aria-label*="quantity" i]',
] as const;

export const QUANTITY_TEXT_SELECTORS = [
  '[data-testid="quantity-label"]',
  '[data-testid="quantity-value"]',
  '[data-testid="quantity-stepper-value"]',
  '[data-automation-id="quantity-value"]',
  '[aria-label^="Quantity" i]',
] as const;

export const PACKAGE_SIZE_SELECTORS = ['[data-testid="product-size"]', '[data-automation-id="product-variant"]'] as const;

/** Lines inside these regions are not part of the active cart. */
export const EXCLUDED_REGION_SELECTORS = [
  '[data-testid*="saved-for-later" i]',
  '[data-testid*="save-for-later" i]',
  '[data-testid*="recommend" i]',
  '[aria-label*="saved for later" i]',
  // Recommendation carousels ("Don't forget your usuals") hold product tiles that aren't in the cart.
  '[data-testid="carousel-container"]',
  '[data-testid^="horizontal-scroller"]',
] as const;

/** Stepper buttons say e.g. "Decrease quantity <name>, Current Quantity 2". */
export const CURRENT_QUANTITY_PATTERN = /current quantity\s*(\d{1,3})/i;

/** Stock status only; "Price unavailable" is a missing price, not a missing item. */
export const UNAVAILABLE_PATTERN = /\b(out of stock|no longer available|(?:currently|item|temporarily) unavailable)\b/i;

/** The page heading shows the item count, e.g. "Cart (7 items)". */
export const CART_HEADING_SELECTORS = ['main h1', 'h1'] as const;
export const CART_COUNT_PATTERN = /\((\d{1,4})\s+items?\)/i;

export const SUBTOTAL_SELECTORS = ['[data-testid="subtotal-value"]', '[data-automation-id="subtotal-value"]'] as const;

/** Text that marks a price as a per-unit or reference price, not the line price. */
export const UNIT_PRICE_TEXT = /\/\s*(ea|each|oz|fl oz|ct|lb|count|100)\b|¢\s*\//i;
export const WAS_PRICE_TEXT = /\b(was|list price|reg(ular)?\.?)\b/i;
