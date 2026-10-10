/**
 * Gmail access through Chrome Identity. Consent is requested only from an
 * explicit "Connect Gmail" click; tokens stay in Chrome's identity cache and
 * are never stored by Worth It or sent anywhere except Gmail API.
 */

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GOOGLE_PERMISSIONS_URL = 'https://myaccount.google.com/connections';

export type GmailErrorKind = 'not_configured' | 'declined' | 'auth' | 'network' | 'api';

export class GmailError extends Error {
  constructor(
    readonly kind: GmailErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'GmailError';
  }
}

/** The subset of `chrome.identity` Worth It uses. */
export interface IdentityApi {
  getAuthToken(details: { interactive: boolean; scopes?: string[] }): Promise<unknown>;
  removeCachedAuthToken(details: { token: string }): Promise<void>;
  clearAllCachedAuthTokens?: () => Promise<void>;
}

export function isGmailConfigured(manifest: { oauth2?: { client_id?: string } }): boolean {
  return Boolean(manifest.oauth2?.client_id);
}

export async function getGmailToken(identity: IdentityApi, interactive: boolean): Promise<string> {
  let result: unknown;
  try {
    result = await identity.getAuthToken({ interactive, scopes: [GMAIL_READONLY_SCOPE] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/did not approve|canceled|cancelled|user denied|not granted/i.test(message)) {
      throw new GmailError('declined', 'Gmail access was not granted.');
    }
    if (/oauth2|client_id|bad client/i.test(message)) {
      throw new GmailError('not_configured', 'Gmail sign-in is not configured for this build.');
    }
    throw new GmailError('auth', 'Could not sign in to Gmail.');
  }
  const token = typeof result === 'string' ? result : (result as { token?: unknown } | undefined)?.token;
  if (typeof token !== 'string' || token.length === 0) throw new GmailError('declined', 'Gmail access was not granted.');
  return token;
}

/**
 * Clears Worth It's cached Gmail token. Revoking access entirely happens in
 * the Google Account (see GOOGLE_PERMISSIONS_URL). Imported records are kept.
 */
export async function disconnectGmail(identity: IdentityApi): Promise<void> {
  try {
    const token = await getGmailToken(identity, false);
    await identity.removeCachedAuthToken({ token });
  } catch {
    // No cached token: nothing to clear.
  }
  await identity.clearAllCachedAuthTokens?.();
}
