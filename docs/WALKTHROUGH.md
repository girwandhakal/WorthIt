# Hackathon walkthrough and verification record

How to install, configure, and demonstrate Worth It end to end, and what has been verified so far ([issue #9](https://github.com/girwandhakal/WorthIt/issues/9)). The steps follow the [acceptance walkthrough](TECH_SPEC.md#hackathon-acceptance-walkthrough).

## 1. Build and install

```sh
npm ci
npm run build
```

In Google Chrome: `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → select `dist/chrome-mv3`. (`npm run zip` also writes `dist/worth-it-<version>-chrome.zip`; CI uploads the same zip as the `worth-it-chrome` artifact.)

On first install Worth It opens onboarding. Read the disclosure, turn on **Offer to record purchases** for the walkthrough, and choose **Finish setup**.

## 2. Owner setup (optional extras)

| Feature | What to do | Without it |
|---|---|---|
| Stable extension ID + Gmail import | [GMAIL_SETUP.md](GMAIL_SETUP.md): key pair, OAuth client ID, test user, then rebuild | Gmail tab says it isn't set up; everything else works |
| Natural wording | Settings → **Wording assistant** → paste your OpenAI key (set a low spending limit first) | Reviewed template wording; identical findings and numbers |
| Synthetic receipts | `node scripts/synthetic-receipts.mjs`, send each to yourself, then Settings → **Import from Gmail** | Add the tumbler manually in Purchase history (20 days ago, $24.97) |

## 3. Walkthrough on Walmart.com

Recheck reference prices first; the amounts below use the 2026-10-09 prices in [WALMART_REFERENCE_PRODUCTS.md](WALMART_REFERENCE_PRODUCTS.md).

1. **History:** import the synthetic receipts (or add the tumbler manually). Purchase history shows them labeled **Synthetic test receipt (Gmail)**.
2. **Normal cart:** Great Value milk (`10315798`), eggs (`145051970`), long-grain rice (`10315395`). Open the cart: only "Worth It · Reviewed 3 items". No recap.
**Note on live numbers.** The amounts below are what the fixture pages produce, where each product page cannot be read and the reviewed reference data alone drives the result. On live walmart.com Worth It also reads each item's own product page, so label-based notes appear and some totals change: for example Diet Coke lists aspartame, so it gets the sweetener note (full price counted, no store-brand swap) instead of the $1.81 swap, and any reviewed item whose live label shows another approved concern is flagged. Recheck the totals against what the panel shows rather than the figures here.

3. **Mixed cart:** Horizon milk (`10309701`), Kraft cheddar (`47088920`), Bounty Essentials (`5308263928`), Diet Coke (`15610624`), Stanley tumbler (`18256507800`), Squishmallows 5" (`17741466139`), Skittles (`656700117`). The recap opens: "Before you check out, 3 things are worth a second thought." → the three biggest savings, in order: tumbler (bought 20 days ago, $24.97, with a question) → Skittles (added-sugar note, $4.97) → plush ($3.97) → "You also had 3 other items you could reconsider or swap for a different one, worth about $4.81 more." → "…you would save $38.72… about $1,752.44 in 40 years…".
4. **Clarification:** answer **Replacing a worn one**. The tumbler now suggests Ozark Trail ($12.00 less); the total becomes $25.75 → about $1,165.43.
5. **Control:** Pause, Replay, Skip recap, open **See full analysis** and **Back to highlights**, then **Continue**. The panel closes, the Walmart cart is unchanged, and checkout works normally.
6. **Purchase recording:** open Walmart's purchase history (`/orders`), choose **Record these purchases**, review, and save. They appear as **Recorded from order page**.

## 4. Verification record

| Check | How | Result |
|---|---|---|
| Lint, typecheck, unit/integration, build | `npm run lint`, `typecheck`, `test`, `build` (local and CI) | Pass |
| Full walkthrough on fixture pages | `npm run test:e2e` (`tests/e2e/assessment.spec.ts`): Walmart pages served from `tests/fixtures/`, history seeded as the importer stores it | Pass: recap order, $38.72 → $1,752.44, clarification → $25.75 → $1,165.43, full analysis, Continue with unchanged cart markup and zero retailer clicks |
| Gmail import path | e2e with stubbed Chrome Identity and Gmail API (`tests/e2e/history-gmail.spec.ts`) | Pass: query, pagination, review, synthetic labeling, no body/token stored |
| OpenAI wording path | e2e with a stubbed OpenAI endpoint; unit tests for timeout, errors, invalid output | Pass: values filled in code, invalid sentences fall back, request has no names/prices/IDs |
| Order-page recording | e2e on fixture purchase-history page | Pass: off by default; opt-in reads item rows only |
| Failure paths | Unit + e2e: declined Gmail consent, empty mailbox, unparsed email, unreadable cart lines, unrecognized cart layout ("Walmart shows 3 items… couldn't read any"), no OpenAI key, OpenAI timeout/error, no-concern cart | Pass |
| Live Walmart.com, read-only | Built-in browser, guest session, 2026-10-10 | `/ip/10315798` loads, price $3.97 (6.2¢/fl oz) matches the reference; `/cart` route confirmed and the empty cart heading reads "Cart (0 items)", the format Worth It uses to detect unread lines |
| Live Walmart cart with items | Requires adding items to a cart | **Not run.** Adding items is a real-world cart action, so it was left to the owner. Do step 3 above in your own Chrome; if the panel says it couldn't read items, Walmart's markup changed: update `src/adapters/walmart/selectors.ts` |
| Live Gmail import | Requires the owner's OAuth client and test user (#4) | **Not run** |
| Live OpenAI wording | Requires the owner's key (#4) | **Not run**; template wording verified |
| Live order-page recording | Requires a signed-in Walmart account | **Not run**; order-page routes and markup are best effort |

## 5. Data, deletion, and disconnecting

- Everything stays on this device: purchase history, answers, and feedback in the extension's IndexedDB; settings, allergies, and the OpenAI key in `chrome.storage.local`. Nothing is synced or sent to a Worth It server (there isn't one).
- **Purchase history** → edit or delete records, **Remove all Gmail-imported records**, **Remove synthetic test records**, or **Delete all purchase history**; **Export (JSON)** downloads records only.
- **Import from Gmail** → **Disconnect Gmail** clears the cached token (records are kept). Revoke fully at [Google Account → Third-party connections](https://myaccount.google.com/connections).
- **Wording assistant** → **Remove key**. **Privacy** → **Delete all Worth It data**. Removing the extension deletes all of its storage.

## 6. Known limitations

- Walmart selectors are verified only against synthetic fixtures; live markup may differ. Worth It reports unread lines instead of guessing.
- Product-page facts (ingredients, Nutrition Facts, category) are read from each cart item's own Walmart page. The parser was checked against live page data on 2026-10-10 (Skittles, Diet Coke, Horizon milk, bananas, hot dogs, bread, a collectible plush, a tumbler); the full decision tree has not yet been run against a large live sample because Walmart's bot check answered a rapid test with "Robot or human?". Worth It therefore reads pages slowly, caps them per review, and stops at the first bot check; those items are reported as unknown.
- Ultra-processed is identified from the ingredient list (NOVA-style markers such as flavorings, emulsifiers, modified starch). It is deliberately broad, so many packaged foods will get that note; it cites a study about whole diets and says so.
- Amazon has no product-page reader, so Amazon food items are not label-checked yet.
- Product pages are re-read each time the cart page loads (cached only while the page stays open).
- Reference prices and label facts must be rechecked before the walkthrough; store-brand savings are estimates from last-checked prices.
- Similar-item matching covers reviewed item types and a few keyword groups (tumblers, plush, LED strip lights, t-shirts).
- The OpenAI key lives in the browser for this single-user build; a public release needs a server-side proxy ([#11](https://github.com/girwandhakal/WorthIt/issues/11)).
- Amazon carts are reviewed through their own adapter, but no Amazon products are in the reviewed reference data yet, so Amazon reviews cover readability, history repeats, and unread rows only ([AMAZON.md](AMAZON.md)).
