# Debugging a presentation that does not open

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
- `panel: "mounted"`, `background: "ok"`, `review: "delivered"`: the controller handed a review to the UI. Then `checkout: "armed"` means the next checkout click opens the presentation, and `checkout: "nothing-to-show"` means there was nothing to show. If it still does not open, inspect layout/filtering or test other shopping/adblock extensions one at a time, refreshing between tests.

The report is a current snapshot, not a history, and is cleared by a page reload. It is local diagnostic text; the shared page can read the status codes and aggregate item counts.

The background listener uses `sendResponse` with a synchronous `return true`, so cart reviews also work on Chrome versions that do not support Promise-returning message listeners. WXT's native browser API has not included the Promise-listener polyfill since v0.20. An older Worth It build using a Promise listener can mount an empty panel container without receiving a review on those Chrome versions. See [WXT's migration guide](https://wxt.dev/guide/resources/upgrading#webextension-polyfill-removed).
