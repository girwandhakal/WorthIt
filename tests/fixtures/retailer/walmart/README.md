# Walmart fixtures

Synthetic, hand-written pages that mimic the structure of Walmart US pages.
They contain no account data. Product names, item IDs, and prices come from
`docs/WALMART_REFERENCE_PRODUCTS.md`. Retailer buttons in these fixtures count
their own clicks (`window.__retailerClicks`) so tests can prove Worth It never
presses them.

`cart-*-2026-10.html` pages are transcribed from the live walmart.com cart (class names, data-testids,
aria-labels; no account data). `cart-rollback-2026-10.html` has an item on Rollback, whose accessible price
text names the current price, the Was price, and the saving in one sentence.
