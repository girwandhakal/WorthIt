import { defineConfig } from 'wxt';

/**
 * Worth It build configuration.
 *
 * Owner-specific values come from environment variables (see `.env.example`):
 * - WXT_EXTENSION_PUBLIC_KEY: the public `key` that pins a stable extension ID.
 * - WXT_GOOGLE_OAUTH_CLIENT_ID: the Chrome extension OAuth client for Gmail.
 * Neither is a secret, but both are account-specific, so they stay out of source.
 */
// WXT does not expose .env files to this config file, so load them here.
// Values already set in the real environment take precedence.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Optional file.
  }
}

const publicKey = process.env.WXT_EXTENSION_PUBLIC_KEY?.trim();
const oauthClientId = process.env.WXT_GOOGLE_OAUTH_CLIENT_ID?.trim();
/** Public builds route wording through a key-holding proxy instead of api.openai.com. */
const wordingProxyOrigin = (() => {
  try {
    const url = new URL(process.env.WXT_WORDING_PROXY_URL?.trim() ?? '');
    return url.protocol === 'https:' ? `${url.origin}/*` : null;
  } catch {
    return null;
  }
})();

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/**
 * `wxt build --mode e2e` (used by `npm run test:e2e`) writes to dist/chrome-mv3-e2e with a
 * placeholder OAuth client so the Gmail flow can run against stubbed identity and Gmail
 * responses. It never reaches Google. Normal builds are unaffected.
 */
const E2E_OAUTH_CLIENT_ID = 'e2e-placeholder.apps.googleusercontent.com';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  // A plain (not dot-prefixed) folder so it's easy to find in Chrome's Load unpacked dialog.
  outDir: 'dist',
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}{{modeSuffix}}',
  manifest: ({ mode }) => {
    const clientId = mode === 'e2e' ? E2E_OAUTH_CLIENT_ID : oauthClientId;
    return {
      name: 'Worth It',
      description:
        'A read-only pre-checkout advisor for Walmart and Amazon carts: highlights a few items worth a second thought. You make every cart change.',
      permissions: ['storage', 'identity'],
      host_permissions: [
        'https://www.walmart.com/*',
        'https://www.amazon.com/*',
        'https://gmail.googleapis.com/*',
        wordingProxyOrigin ?? 'https://api.openai.com/*',
      ],
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'",
      },
      ...(publicKey ? { key: publicKey } : {}),
      ...(clientId ? { oauth2: { client_id: clientId, scopes: [GMAIL_READONLY_SCOPE] } } : {}),
    };
  },
});
