# Worth It

A Chrome extension that makes you think twice before checkout. It reviews your Walmart (or Amazon) cart and, when something deserves a second look, shows a short animated presentation: a cheaper store-brand swap, a recent similar purchase, a novelty item, or a label-based health note. At most three items are highlighted, and a running savings meter ends with a hypothetical investment-growth chart.

- **Advisor only.** It never changes your cart or clicks anything. You decide.
- **Quiet.** Nothing appears on the cart page. If there is something to show, your first click on Checkout is held once and the presentation opens; the next click goes straight through.
- **Private.** Everything stays on your device. No bank or financial data. Gmail purchase history is optional, read-only, parsed locally, and reviewed by you before saving.

## Quick start

Requires Node.js 22+ and Google Chrome.

```sh
npm ci
npm run build
```

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `dist/chrome-mv3`. Then open your cart at `walmart.com/cart`.

Optional Gmail import and account-specific build settings (`.env.local`, see [.env.example](.env.example)) are covered in [Gmail setup](docs/GMAIL_SETUP.md). Never commit real values.

## Development

```sh
npm run dev         # WXT dev server with extension reload
npm run lint
npm run typecheck
npm run test        # Vitest unit and integration tests
npm run test:e2e    # Playwright on local fixture pages (needs: npx playwright install chromium)
```

If the presentation doesn't open after a rebuild, reload the extension and refresh the retailer tab; see [Debugging](docs/DEBUGGING.md).

## Permissions

| Permission | Why |
|---|---|
| `walmart.com`, `amazon.com` | Read cart rows on the cart page. Inert elsewhere; reads order pages only if you opt in to purchase recording. Never reads payment, address, or sign-in fields. |
| `storage` | Keep preferences on this device. |
| `identity`, `gmail.googleapis.com` | Optional read-only Gmail connection to import receipts. Email bodies are not kept. |
| `api.openai.com` | Optional wording polish using placeholder slots only (no names, prices, or history). Reviewed templates are used without a key. |

No `tabs`, `history`, `cookies`, `webRequest`, `downloads`, or all-sites access.

## Docs

- [Product requirements](docs/PRD.md) and [technical specification](docs/TECH_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): ordered GitHub issues and status
- [Walkthrough and verification record](docs/WALKTHROUGH.md): demo steps, what's verified, limitations
- [Gmail setup](docs/GMAIL_SETUP.md), [synthetic receipts](docs/SYNTHETIC_RECEIPTS.md), [Amazon](docs/AMAZON.md), [Debugging](docs/DEBUGGING.md)
