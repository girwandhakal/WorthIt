## Instructions for judges

Worth It is a Chrome extension. You don't need an account, password, or API key to try it.

### Install (about 3 minutes)

1. Install Node.js 22+ and Google Chrome.
2. Run:
   ```
   git clone https://github.com/girwandhakal/WorthIt.git
   cd WorthIt
   npm ci
   npm run build
   ```
3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `dist/chrome-mv3` folder.
4. On first install, Worth It opens a short onboarding page. Finish setup there.

### Try it

1. Go to walmart.com as a guest. You don't need to sign in.
2. Add a few items to your cart. A good mix is milk (Horizon), Skittles, a Stanley tumbler, and a Squishmallows plush.
3. Open walmart.com/cart and click **Checkout**.
4. If there is something worth a second look, Worth It holds that first click once and plays a full-screen presentation. It plays to the end before you can continue.
5. Click **Continue**, then click Checkout again. That click goes straight through. Worth It never changes your cart or clicks anything for you.

If you see nothing, refresh the Walmart tab after loading the extension. Troubleshooting steps are in `docs/DEBUGGING.md`.

### Optional: purchase history

The "you bought this 20 days ago" question needs a past purchase. The easy way is **Settings > Purchase history > Add**: enter "Stanley tumbler", $24.97, dated 20 days ago.

Gmail receipt import also exists, but it needs the owner's Google OAuth client, and the app is in Google's Testing mode. Only approved test users can connect, so there are no credentials for judges to use. Everything else works without it.

### Test credentials

None required. Worth It uses no logins, no backend, and no paid services. The optional OpenAI wording feature is off unless a key is entered. Without it, Worth It uses fixed reviewed wording, and the findings and numbers are the same.

### Automated tests

`npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`. The browser tests run the real extension against fixture pages copied from the live Walmart cart.

### Known limits

- Live Gmail import, OpenAI wording, and order-page recording are tested against stubs, not live accounts.
- Walmart changes its pages often. If Worth It can't read a cart line, it says so instead of guessing.
- Amazon carts are supported, but Amazon products have no reviewed data yet. Walmart is the main demo path.

## Prior work and what was created before Hacklanta

- All source code, documentation, tests, and the logo were created during Hacklanta. The repository's first commit is dated 2026-10-09, and the full history is public at github.com/girwandhakal/WorthIt.
- No code or assets from a previous project were reused. **[Confirm this is true before submitting.]**
- **Open-source libraries:** WXT, Vite, React, TypeScript, `idb`, Vitest, Playwright.
- **Public data:** Walmart product page information and prices, which Worth It reads only for items already in the shopper's cart. Health notes cite public sources such as the CDC.
- **AI assistance:** we used Claude Code (Anthropic's AI coding assistant) to help write code, tests, and documentation. Commits it co-authored are marked in the git history. The product's findings and numbers are computed by code, not by an AI model.
