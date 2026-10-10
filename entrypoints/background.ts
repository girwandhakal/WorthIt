import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { clearDismissed } from '../src/background/dismissals';
import { handleContentMessage } from '../src/background/handle-message';

export default defineBackground({
  type: 'module',
  main() {
    const session = browser.storage.session;

    browser.runtime.onMessage.addListener((message, sender) =>
      handleContentMessage(message, sender, { extensionId: browser.runtime.id, session }),
    );

    browser.tabs.onRemoved.addListener((tabId) => {
      void clearDismissed(session, tabId);
    });
  },
});
