import { defineConfig } from 'wxt';

/**
 * Worth It build configuration.
 *
 * Owner-specific values come from environment variables (see `.env.example`):
 * - WXT_EXTENSION_PUBLIC_KEY: the public `key` that pins a stable extension ID.
 * - WXT_GOOGLE_OAUTH_CLIENT_ID: the Chrome extension OAuth client for Gmail.
 * Neither is a secret, but both are account-specific, so they stay out of source.
 */
const publicKey = process.env.WXT_EXTENSION_PUBLIC_KEY?.trim();
const oauthClientId = process.env.WXT_GOOGLE_OAUTH_CLIENT_ID?.trim();

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'Worth It',
    description:
      'A read-only pre-checkout advisor: highlights a few cart items worth a second thought. You make every cart change.',
    permissions: ['storage', 'identity'],
    host_permissions: [
      'https://www.walmart.com/*',
      'https://gmail.googleapis.com/*',
      'https://api.openai.com/*',
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    ...(publicKey ? { key: publicKey } : {}),
    ...(oauthClientId
      ? { oauth2: { client_id: oauthClientId, scopes: [GMAIL_READONLY_SCOPE] } }
      : {}),
  },
});
