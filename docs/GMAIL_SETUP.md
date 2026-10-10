# Gmail import setup (owner)

Gmail import is optional. Without this setup Worth It works normally and shows "Gmail import isn't set up in this build" on the Import from Gmail tab; purchases can still be added manually or recorded from Walmart order pages.

These steps configure the single-user hackathon build ([issue #4](https://github.com/girwandhakal/WorthIt/issues/4)). Nothing here requires sharing a password or a client secret, and nothing account-specific is committed.

## 1. Give the unpacked extension a stable ID

An unpacked extension's ID depends on its folder path unless the manifest has a `key`. The Google OAuth client is tied to that ID, so pin it once:

```sh
# Private key: keep it outside the repository (*.pem is git-ignored anyway).
openssl genrsa -out ~/worth-it-extension.pem 2048
# Public key, base64 DER, on one line: this is the manifest `key`.
openssl rsa -in ~/worth-it-extension.pem -pubout -outform DER | openssl base64 -A
```

Create `.env.local` in the repository root (git-ignored) from [.env.example](../.env.example) and set:

```
WXT_EXTENSION_PUBLIC_KEY=<the one-line base64 public key>
```

Run `npm run build`, load `dist/chrome-mv3` in `chrome://extensions` (Developer mode → Load unpacked), and copy the extension **ID** shown there. It stays the same across rebuilds and folders.

## 2. Create the Google Cloud OAuth client

1. In the [Google Cloud console](https://console.cloud.google.com/), create or pick a project and **enable the Gmail API**.
2. **OAuth consent screen**: user type *External*, publishing status *Testing*. Add your own Google account under **Test users**. Add the scope `https://www.googleapis.com/auth/gmail.readonly`.
3. **Credentials → Create credentials → OAuth client ID → Application type: Chrome extension**. Paste the extension ID from step 1 as the item ID.
4. Copy the client ID (`….apps.googleusercontent.com`) into `.env.local`:

```
WXT_GOOGLE_OAUTH_CLIENT_ID=<client id>.apps.googleusercontent.com
```

5. Rebuild (`npm run build`) and reload the extension in `chrome://extensions`. The manifest now includes an `oauth2` block with only the read-only Gmail scope.

## 3. Send the synthetic receipts

```sh
node scripts/synthetic-receipts.mjs
```

Send each printed email from your Gmail account to yourself, with the subject and body exactly as printed (see [SYNTHETIC_RECEIPTS.md](SYNTHETIC_RECEIPTS.md)).

## 4. Import

Use Google Chrome signed in to the same Google account. Open Worth It settings → **Import from Gmail**, pick a date range that covers the receipts, and choose **Connect Gmail and find receipts**. Approve Google's consent screen (it warns the app is unverified while in Testing; that is expected for a private test app). Review the items, then save. They appear in **Purchase history** labeled **Synthetic test receipt (Gmail)**.

## Disconnecting and revoking

- **Disconnect Gmail** in Worth It clears its cached token. Imported records stay until you remove them under Purchase history → Remove records.
- To revoke access entirely, remove Worth It at [Google Account → Third-party connections](https://myaccount.google.com/connections).

## Notes and limits

- `chrome.identity.getAuthToken` works only in Google Chrome with a signed-in profile. Automated tests stub it (Playwright's Chromium cannot sign in), so live Gmail import is verified manually.
- `gmail.readonly` is a restricted scope. A private Testing-mode app is fine for the owner; public distribution needs Google verification ([issue #11](https://github.com/girwandhakal/WorthIt/issues/11)).
