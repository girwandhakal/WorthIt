import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { IdentityApi } from '../../src/ingestion/gmail/oauth';
import { isGmailConfigured } from '../../src/ingestion/gmail/oauth';
import { openWorthItDb } from '../../src/storage/database';
import { createRepositories, type Repositories } from '../../src/storage/repositories';
import { WORDING_PROXY_URL } from '../../src/wording/config';
import { OptionsApp } from '../../src/ui/options/OptionsApp';
import type { OptionsServices } from '../../src/ui/options/context';
import '../../src/ui/shared/page.css';
import '../../src/ui/shared/review-list.css';

let repositories: Promise<Repositories> | null = null;

const services: OptionsServices = {
  local: browser.storage.local,
  repositories: () => (repositories ??= openWorthItDb().then((db) => createRepositories(db))),
  // Resolved at call time so the identity API is looked up only when used.
  identity: {
    getAuthToken: (details) => browser.identity.getAuthToken(details),
    removeCachedAuthToken: (details) => browser.identity.removeCachedAuthToken(details),
    clearAllCachedAuthTokens: () => browser.identity.clearAllCachedAuthTokens(),
  } satisfies IdentityApi,
  fetch: (input, init) => fetch(input, init),
  gmailConfigured: isGmailConfigured(browser.runtime.getManifest() as { oauth2?: { client_id?: string } }),
  extensionId: browser.runtime.id,
  wordingProxy: WORDING_PROXY_URL !== null,
  now: () => new Date(),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp services={services} />
  </StrictMode>,
);
