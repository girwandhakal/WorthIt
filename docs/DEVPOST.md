## Inspiration

Checkout is the last moment when a purchase is still a choice. Most money tools only show what you spent after the fact. We wanted to help at the moment of decision, with no bank account and no judging of anyone's finances.

Many small purchases aren't bad, just not worth it: a cheaper store brand, a tumbler you bought three weeks ago, a novelty plush, a candy bar full of added sugar. Those dollars add up, and money saved today can grow for decades. So we built **Worth It**, a Chrome extension that gives you one moment to think twice before you pay.

## What it does

Worth It reviews your Walmart or Amazon cart at checkout. Nothing appears on the cart page while you shop. When you click Checkout and there is something worth a second look, that first click is held once and a short full-screen presentation plays:

- **Up to three highlighted items**, each with the store's thumbnail, a short verdict, and one tip or question.
- **A savings meter** showing what you would keep.
- **One animated chart** of what that saving could grow to in 40 years if invested (hypothetical, 10% assumed return).

What it looks for:

- **Cheaper store brands**, only when product data supports the match.
- **Recent similar purchases.** It asks one question: replacement, extra, or gift?
- **Novelty items** with no practical use.
- **Food labels**, read from the product page: added sugar, processed meat, trans fat, sweeteners, high sodium, dyes, and ultra-processed ingredients. Each note has fixed wording and a source.

Worth It only informs. **It never edits your cart, clicks for you, or starts checkout.** After the presentation you click Continue, then Checkout, and that click goes straight through. "See full analysis" shows every check and source. Gmail receipt import is optional: you review each record and only approved ones are saved.

## How we built it

- **Chrome Manifest V3 extension** using WXT (Vite), strict TypeScript, and React 19. The animation is inline SVG and CSS.
- **Retailer adapters.** One interface reads cart rows. Walmart came first, then Amazon. Content scripts never read payment, address, or sign-in fields.
- **Deterministic engine.** Scores, savings, and totals are computed in code from reviewed reference data plus each cart item's own product page. An optional LLM can only rephrase the verified summary. If its output fails validation, we use fixed templates.
- **All data stays on the device.** IndexedDB holds purchase history and `chrome.storage.local` holds settings. There is no backend. Gmail uses Chrome's identity API, and receipts are parsed locally.
- **On-device similarity matching** (cosine similarity on product-name words) finds repeat purchases that keyword lists miss.
- **Tests.** Vitest unit and integration tests, plus Playwright tests that run the real extension on fixture pages copied from the live Walmart cart. A script sends labeled synthetic receipts through the Gmail import path.
- **Process.** PRD, tech spec, and issue-linked plan first, then one reviewed PR per issue.

## Challenges we ran into

- **Reading Walmart's live cart.** Our first reader counted the "Don't forget your usuals" carousel as cart items. Later we found one tile can hold several items (a cheese and a milk). We now read each row on its own, test against fixtures from the live page, and report unreadable lines instead of guessing.
- **Sale prices.** A Rollback item reads "Current price $3.97, Was $4.43, You save $0.46." We dropped anything with "Was", saw two leftover amounts, and lost the price and the cart total. Price reading now uses the words and markup around each amount.
- **Silent failure on older Chrome.** The panel opened but never got its review. The cause was a Promise-based message listener, which WXT stopped polyfilling in v0.20. We switched to `sendResponse` with `return true` and added diagnostics that log no product data.
- **The checkout hold.** It must catch only the first real click: never a scripted one, never twice, never when there is nothing to show. Waiting for product pages took about 4 seconds, so early clicks slipped through. We now review the cart first and update once the pages load.
- **Being polite to Walmart.** We read product pages only for items in the cart, a few at a time, cached for a day, and stop at the first bot check.
- **Health claims.** We limited them to a short approved list with fixed wording and one source each: no diagnoses and no Daily Value percentages. "Ultra-processed" was the hardest call, so its note states what its source study does and does not show.
- **Doing less.** Early versions showed scores and tables. We rebuilt Worth It as an advisor: three highlights, plain words, one chart. The full analysis is behind a button.
- **Gmail OAuth.** Chrome reports client ID errors in a confusing way, so Worth It shows the extension ID and Chrome's own message.

## Accomplishments that we're proud of

- **A real extension, not a demo.** Install it, open a Walmart cart, click Checkout.
- **Numbers you can trust.** All numbers come from code and all health notes from reviewed text. The AI cannot change a finding.
- **Privacy.** No bank access, no backend, read-only Gmail with your review, no stored email bodies, and a minimal permission list.
- **The shopper stays in control.** Worth It never touches the cart.
- **Strong tests.** 300+ unit and integration tests and Playwright tests on the real extension, including failure cases such as declined consent, unreadable lines, bot checks, and bad LLM output.
- **An accessible presentation.** It has captions, pause and replay, and a static version for reduced motion.
- **Two retailers, one engine.**

## What we learned

- **Less is more at checkout.** An interruption only works if it is rare, short, and believable.
- **Keep the LLM out of the math.** Code does scoring and evidence, and the model only rephrases. That made the product easier to test and trust.
- **Real pages break assumptions.** Sale prices, grouped tiles, and bot checks only showed up on the live site.
- **Extension quirks cost time.** Message listeners, stale scripts after a rebuild, and OAuth setup each took hours. All are now documented.
- **Write the spec first.** It let us decide once and build fast.

## What's next for WorthIt

- **Test the live paths.** Gmail import, OpenAI wording, and order-page recording work against stubs but need real-account runs.
- **Deeper Amazon support.** Add a product-page reader and reference data for label checks and store-brand matches.
- **More products and better matching** of equivalent items, plus smarter replacement detection.
- **Public release.** This needs a server proxy for the OpenAI key, Chrome Web Store assets, and Google OAuth verification.
- **More retailers and save-for-later**, with price-drop alerts.
