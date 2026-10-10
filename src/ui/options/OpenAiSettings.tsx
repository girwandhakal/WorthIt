import { useEffect, useId, useState } from 'react';
import { clearOpenAiKey, getOpenAiKey, maskKey, setOpenAiKey, validateOpenAiKey } from '../../storage/preferences';
import { useServices } from './context';

/**
 * The owner's OpenAI key for optional phrasing of the checkout recap. Stored
 * only in chrome.storage.local; never shown again in full, exported, or logged.
 */
export function OpenAiSettings() {
  const { local, wordingProxy } = useServices();
  const inputId = useId();
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void getOpenAiKey(local).then((key) => setSaved(key ? maskKey(key) : null));
  }, [local]);

  const save = async () => {
    const error = validateOpenAiKey(draft);
    if (error) {
      setMessage({ tone: 'error', text: error });
      return;
    }
    await setOpenAiKey(local, draft);
    setSaved(maskKey(draft.trim()));
    setDraft('');
    setMessage({ tone: 'ok', text: 'Key saved on this device.' });
  };

  const clear = async () => {
    await clearOpenAiKey(local);
    setSaved(null);
    setMessage({ tone: 'ok', text: 'Key removed. Worth It will use its built-in wording.' });
  };

  if (wordingProxy) {
    return (
      <div className="wi-card">
        <h3>Wording assistant</h3>
        <p>
          This version of Worth It phrases its recap through the Worth It wording service, which holds the OpenAI key. You
          don’t need a key. Requests contain only finding types, check names, and placeholders: no product names, prices,
          purchase history, email content, or settings.
        </p>
      </div>
    );
  }

  return (
    <div className="wi-stack">
      <div className="wi-card">
        <h3>What OpenAI receives</h3>
        <p>
          Worth It decides every finding, number, and source itself. If you add a key, it asks OpenAI only to make the
          recap’s sentences sound natural. Each request contains just:
        </p>
        <ul className="wi-list">
          <li>the kinds of findings (for example “store-brand swap” or “possible repeat purchase”),</li>
          <li>the names of the checks involved, and</li>
          <li>placeholders such as <code>{'{item_1}'}</code> and <code>{'{amount_1}'}</code> in place of real values.</li>
        </ul>
        <p>
          It never sends product names, prices, your purchase history, email content, Gmail sign-in, allergies or dietary
          settings, or any financial information. Worth It fills in the real values on your device and falls back to its
          own reviewed wording if OpenAI is slow, unavailable, or returns anything unexpected.
        </p>
        <p className="wi-hint">
          Tip: set a low monthly spending limit for this key in your OpenAI dashboard. Without a key, Worth It works the
          same, with built-in wording.
        </p>
      </div>

      <div className="wi-card">
        <p>
          Current key: <strong>{saved ?? 'none'}</strong>
        </p>
        <label htmlFor={inputId}>OpenAI API key</label>
        <div className="wi-actions">
          <input
            id={inputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            placeholder="sk-…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" className="wi-button" onClick={() => void save()} disabled={draft.trim() === ''}>
            Save key
          </button>
          <button type="button" className="wi-button-secondary" onClick={() => void clear()} disabled={!saved}>
            Remove key
          </button>
        </div>
        {message && (
          <p className={message.tone === 'error' ? 'wi-error' : 'wi-status'} role={message.tone === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
