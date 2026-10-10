import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { clearDismissed } from '../src/background/dismissals';
import { handleContentMessage } from '../src/background/handle-message';
import { openWorthItDb } from '../src/storage/database';
import { createRepositories, type Repositories } from '../src/storage/repositories';

export default defineBackground({
  type: 'module',
  main() {
    const session = browser.storage.session;
    const local = browser.storage.local;

    // The worker is short-lived; open the database lazily per wake-up.
    let repositories: Promise<Repositories> | null = null;
    const getRepositories = () => (repositories ??= openWorthItDb().then((db) => createRepositories(db)));

    browser.runtime.onMessage.addListener((message, sender) =>
      handleContentMessage(message, sender, {
        extensionId: browser.runtime.id,
        session,
        local,
        repositories: getRepositories,
        post: (url, init) => fetch(url, init),
      }),
    );

    browser.tabs.onRemoved.addListener((tabId) => {
      void clearDismissed(session, tabId);
    });

    // First install: open onboarding so the shopper sees what Worth It reads.
    browser.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') void browser.runtime.openOptionsPage();
    });
  },
});
