# Amazon support

Amazon is Worth It's second retailer ([issue #10](https://github.com/girwandhakal/WorthIt/issues/10)). It reuses the shared cart model, assessment rules, history, summary, and recap; everything Amazon-specific lives in `src/adapters/amazon/`.

## Permission

`https://www.amazon.com/*` is requested so the content script can read cart rows and, if purchase recording is on, order-page item rows. Like Walmart, the script is present on the site but inert everywhere except the routes below. It never reads checkout, payment, address, sign-in, or account content and never clicks Amazon controls.

## Supported routes

| Page | Routes | What is read |
|---|---|---|
| Cart (review) | `/gp/cart/view.html`, `/cart`, `/gp/aw/c` (with optional `/ref=…`) | Active-cart rows only (`data-asin`, `data-price`, `data-quantity`, title, link); the "Subtotal (N items)" label to detect unread rows. Saved-for-later is ignored. |
| Order confirmation (opt-in) | `/gp/buy/thankyou/…` | Item rows, order number, "Order placed" date, status — only after **Record these purchases** |
| Order history / details (opt-in) | `/gp/css/order-history`, `/gp/your-account/order-history`, `/your-orders/orders`, `…/order-details` | Same as above |
| Checkout and everything else | e.g. `/gp/buy/spc/…`, `/checkout/…` | Nothing |

## What the review does on Amazon

- **Price**: Amazon rows show a per-unit price, so the line price is unit × quantity (`priceSource: unit_price_times_quantity`).
- **Product facts**: the bundled reference data is Walmart-specific. An Amazon item gets category, label, and store-brand checks only if its ASIN is listed in `amazonAsins` on a reviewed reference record in `src/assessment/reference/products.ts`. **None are listed yet**, so on Amazon those checks are `unknown` and nothing is guessed from titles.
- **History**: exact repeats (same ASIN or identical name) from any source still prompt "You bought this N days ago" with the replacement / extra / different-purpose question; there is no skip suggestion without product facts.
- **Unread rows**: if Amazon's "Subtotal (N items)" is higher than what Worth It read, the panel says so.

To add an ASIN: open the Amazon product page, confirm it is the same brand, size, and label as a reference record, and add the ASIN to that record's `amazonAsins`. Store-brand alternatives remain Walmart products, so Amazon store-brand savings are not shown.

## Known gaps

- Selectors are verified against synthetic fixtures (`tests/fixtures/retailer/amazon/`) modeled on Amazon's cart and order markup, not against the live site. Amazon A/B-tests layouts; unread rows are reported rather than guessed.
- Order-history markup varies by account and region; only the classic `.order-card` / `.yohtmlc-*` structure is covered.
- amazon.com only (no other Amazon domains).

## Manual smoke check (read-only)

1. Build and load the extension (`npm run build`, load `.output/chrome-mv3`).
2. Add two or three items to your own Amazon cart and open the cart. Expect "Worth It · Reviewed N items" with N equal to your cart lines; open it and choose **See full analysis** to confirm names, quantities, and prices match the page.
3. Change a quantity; the indicator and analysis update.
4. Proceed toward checkout: Worth It must not appear on any checkout page.
5. With purchase recording on, open Your Orders, choose **Record these purchases**, and check the review list shows only item rows (no address or payment details).
