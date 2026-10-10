# Public release preparation (deferred)

**Status:** Deferred. [Issue #11](https://github.com/girwandhakal/WorthIt/issues/11) proceeds only if the owner chooses public Chrome Web Store distribution. Nothing here has been submitted, approved, or published.

The hackathon build is a single-user, load-unpacked extension. These drafts and the engineering below make a public release possible without redesign; the owner decisions and external reviews remain.

## Prepared

| Item | Where | Notes |
|---|---|---|
| No OpenAI key in public builds | `src/summary/config.ts`, `src/summary/openai-client.ts` (`wordingTransport`) | Build with `WXT_WORDING_PROXY_URL=https://…`: the extension posts wording requests to the proxy with no key, the manifest requests the proxy origin instead of `api.openai.com`, and the settings tab no longer asks for a key |
| Reference wording proxy | `server/wording-proxy/` | Holds the key server-side; accepts only Worth It wording bodies (fixed model, output cap, schema, system prompt, placeholder-only templates with no digits/money/links), extension-origin CORS, per-client rate limit, size caps, no body logging. Tested in `tests/unit/wording-proxy.test.ts` |
| Privacy policy draft | [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | Matches current data flows |
| Store listing, single purpose, permission justifications, data-use disclosures | [STORE_LISTING.md](STORE_LISTING.md) | Drafts for the owner to edit |
| Reviewer test instructions | [REVIEWER_GUIDE.md](REVIEWER_GUIDE.md) | Includes Gmail and order-page steps |

## Owner decisions and external steps (not done)

1. **Decide to publish.** Until then this stays deferred.
2. **Deploy the wording proxy** behind HTTPS (any Node 22.18+ host), with `OPENAI_API_KEY`, `ALLOWED_ORIGINS=chrome-extension://<published extension id>`, rate limits, and a low monthly spending limit plus usage alerts on the OpenAI account. Or ship without wording assistance (templates only) by leaving both the proxy URL and the key UI unused.
3. **Build the release:** set `WXT_WORDING_PROXY_URL`, the production `WXT_GOOGLE_OAUTH_CLIENT_ID`, and the extension `key`; run all checks and `npm run zip`.
4. **Refresh reference data:** recheck prices and label facts in `docs/WALMART_REFERENCE_PRODUCTS.md` / `products.ts` and update their dates.
5. **Google OAuth verification** for the restricted `gmail.readonly` scope (production OAuth consent screen, privacy policy URL, demo video, and any security assessment Google requires for the declared data flow). Worth It processes email locally and stores no Gmail data on servers; recheck Google's current requirements at submission. Alternatively, ship without Gmail import.
6. **Chrome Web Store:** developer account, listing assets (screenshots, 440×280 promo tile, 128×128 icon), privacy practices form matching STORE_LISTING.md, support contact, and a hosted privacy policy URL.
7. **Release testing:** install, update from the previous version (IndexedDB migrations keep history), and uninstall (storage removed) on a clean profile; live smoke checks from [WALKTHROUGH.md](../WALKTHROUGH.md) and [AMAZON.md](../AMAZON.md).
8. Record the published listing URL and version in issue #11 only after publication.

Chrome Web Store and Google API policies change; recheck the official pages linked in [TECH_SPEC.md section 16](../TECH_SPEC.md#16-primary-documentation) at submission time.
