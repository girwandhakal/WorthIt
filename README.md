# Worth It

Worth It is a Chrome extension for more intentional online shopping. Before checkout, it gives shoppers a concise, animated summary of items that may deserve a second look, such as a lower-priced store-brand option, a recent similar purchase, or a supported health concern.

The extension offers information and suggestions only. Shoppers decide whether to change their cart or continue with the purchase. It does not connect to personal financial accounts or control checkout. Purchase history can be imported from Gmail with read-only consent; the hackathon walkthrough uses synthetic receipt emails sent to the owner's Gmail account and imported through the same API flow.

- [Product requirements](docs/PRD.md): goals, user journey, evidence standards, and hackathon MVP scope.
- [Technical specification](docs/TECH_SPEC.md): architecture, data handling, security, and project structure.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): the ordered GitHub issues and their status.
- [Walkthrough and verification record](docs/WALKTHROUGH.md): install, demo steps, what has been verified, data deletion, and known limitations.

## Development

Requires Node.js 22 or newer and npm.

```sh
npm ci                 # install exactly what package-lock.json pins
npm run dev            # WXT dev server with extension reload
npm run build          # production build in dist/chrome-mv3
npm run lint
npm run typecheck
npm run test           # Vitest unit and integration tests
npm run test:e2e       # builds, then runs Playwright against local fixture pages
```

`test:e2e` needs Playwright's Chromium once: `npx playwright install chromium`. It builds a separate copy in `dist/chrome-mv3-e2e` (with a placeholder OAuth client), loads it, and serves synthetic Walmart pages and stubbed Gmail responses from `tests/fixtures/`; it never contacts Walmart, Google, or OpenAI. Load `dist/chrome-mv3` from `npm run build` in Chrome, not the e2e copy.

### Install the unpacked extension

1. Run `npm run build`.
2. Open `chrome://extensions` in Google Chrome and turn on **Developer mode**.
3. Choose **Load unpacked** and select the `dist/chrome-mv3` folder.
4. Open `https://www.walmart.com/cart` (or your Amazon cart). Worth It reviews the cart and shows a small "Reviewed N items" indicator, or opens its panel when something merits a second look.

On first install Worth It opens a short onboarding page that explains what it reads and lets you choose settings. Everything else (purchase history, Gmail import, the OpenAI key, privacy and deletion) is in the extension's settings page.

### Debug a missing cart indicator

After rebuilding, reload Worth It on `chrome://extensions` **and refresh the Walmart/Amazon tab**. Old tabs can retain scripts from the previous build and report `Extension context invalidated`. Check the original Chrome profile, not just a separate test window, and load the production `dist/chrome-mv3` folder from the checkout you rebuilt.

Open the cart page's DevTools (**F12 → Console**) and filter for `[Worth It]` (enable Info messages). The extension prints local status reports with a build timestamp, cart-route detection, extraction counts, panel mounting, background response and review delivery. No product names, prices, URLs, account information, history, tokens or raw error messages are printed or transmitted. To print just the latest report, run:

```js
console.log(JSON.parse(document.documentElement.getAttribute('data-worth-it-debug') || 'null'));
```

- `null`: this diagnostic build has not started on the page. Check the loaded folder, extension enablement/site access, and refresh.
- Different `build` timestamps between windows: they are running different builds (or an old tab still needs refreshing).
- `route: "other"`: this page is not the supported cart route.
- `panel: "failed"`: Worth It could not mount its isolated UI.
- `background: "pending"`: the background has not answered yet; repeat the report after a few seconds.
- `background: "unavailable"`: messaging failed; `error: "context-invalidated"` specifically means reload the retailer tab.
- `background: "invalid-response"`: the background returned a rejected or unrecognized response.
- `extractedItems` smaller than `displayedItems`: the cart markup may have changed or some lines could not be read.
- `panel: "mounted"`, `background: "ok"`, `review: "delivered"`: the controller handed a review to the UI. If the indicator is still missing, inspect layout/filtering or test other shopping/adblock extensions one at a time, refreshing between tests.

The report is a current snapshot, not a history, and is cleared by a page reload. It is local diagnostic text; the shared page can read the status codes and aggregate item counts.

The background listener uses `sendResponse` with a synchronous `return true`, so cart reviews also work on Chrome versions that do not support Promise-returning message listeners. WXT's native browser API has not included the Promise-listener polyfill since v0.20. An older Worth It build using a Promise listener can mount an empty panel container without receiving a review on those Chrome versions. See [WXT's migration guide](https://wxt.dev/guide/resources/upgrading#webextension-polyfill-removed).

Account-specific build settings (the stable extension key and Gmail OAuth client) are read from `.env.local`; see [.env.example](.env.example) and [Gmail setup](docs/GMAIL_SETUP.md). Never commit real values. Synthetic test receipts are described in [docs/SYNTHETIC_RECEIPTS.md](docs/SYNTHETIC_RECEIPTS.md).

## Permissions and why they are needed

| Permission | Why |
|---|---|
| `https://www.walmart.com/*` | Read cart rows (name, item link, quantity, displayed prices) on the cart page. Walmart is a single-page app, so the script is present on the site but stays inert everywhere except `/cart` and, only if you opt in to purchase recording, the order confirmation and purchase-history pages, where it reads item rows when you click "Record these purchases". It never reads checkout, payment, address, or sign-in fields and never clicks retailer controls. |
| `https://www.amazon.com/*` | Same as Walmart, for Amazon cart routes and (opt-in) order pages; inert on checkout and everywhere else. See [docs/AMAZON.md](docs/AMAZON.md). |
| `storage` | Keep preferences and per-tab panel state on this device. |
| `identity` | Optional, user-initiated Gmail connection (read-only) for importing receipts. |
| `https://gmail.googleapis.com/*` | Search and read likely order emails after the shopper connects Gmail. Parsed locally; email bodies are not kept. |
| `https://api.openai.com/*` | Optional phrasing of an already-computed summary using placeholder slots only (no product names, prices, history, or email content). Without a key, reviewed templates are used. |

Worth It requests no `tabs`, `history`, `cookies`, `webRequest`, `downloads`, or all-sites access.
