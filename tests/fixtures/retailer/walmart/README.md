# Walmart fixtures

Synthetic, hand-written pages that mimic the structure of Walmart US pages.
They contain no account data. Product names, item IDs, and prices come from
`docs/WALMART_REFERENCE_PRODUCTS.md`. Retailer buttons in these fixtures count
their own clicks (`window.__retailerClicks`) so tests can prove Worth It never
presses them.
