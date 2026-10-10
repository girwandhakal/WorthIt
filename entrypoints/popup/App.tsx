import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { DEFAULT_PREFERENCES, getPreferences, updatePreferences, type Preferences } from '../../src/storage/preferences';

const openSettings = (tab: string) => {
  void browser.tabs.create({ url: browser.runtime.getURL(`/options.html#${tab}`) });
  window.close();
};

export function App() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    void getPreferences(browser.storage.local).then(setPreferences);
  }, []);

  return (
    <main className="wi-page wi-popup">
      <h1>Worth It</h1>
      <p>
        Open your Walmart cart and Worth It reviews it: a small “Reviewed N items” note, or a short recap when a few items
        deserve a second thought. It never changes your cart.
      </p>
      <label className="wi-check">
        <input
          type="checkbox"
          checked={preferences.promptsEnabled}
          onChange={(event) => void updatePreferences(browser.storage.local, { promptsEnabled: event.target.checked }).then(setPreferences)}
        />
        <span>
          <strong>Checkout prompts</strong>
          <span className="wi-hint">Off: only the small indicator, never an automatic recap.</span>
        </span>
      </label>
      <div className="wi-actions">
        <button type="button" className="wi-button" onClick={() => openSettings('history')}>
          Purchase history
        </button>
        <button type="button" className="wi-button-secondary" onClick={() => openSettings('preferences')}>
          Settings
        </button>
      </div>
    </main>
  );
}
