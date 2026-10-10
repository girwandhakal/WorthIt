import { useState } from 'react';
import { clearOpenAiKey, updatePreferences, DEFAULT_PREFERENCES } from '../../storage/preferences';
import { useServices } from './context';

/** Plain-language summary of data handling, plus a full local reset. */
export function PrivacySummary() {
  return (
    <div className="wi-stack">
      <div className="wi-card">
        <h3>What Worth It reads</h3>
        <ul className="wi-list">
          <li>
            <strong>Walmart and Amazon cart pages</strong>: each cart line’s product name, item link, quantity, and displayed prices,
            only while you’re on the cart page.
          </li>
          <li>
            <strong>Walmart and Amazon order pages (only if you turn on purchase recording)</strong>: item names, item links,
            quantities, prices, and order dates, only when you choose “Record these purchases.”
          </li>
          <li>
            <strong>Never</strong>: checkout, payment, address, sign-in, or account fields. Worth It never changes your cart
            or clicks checkout.
          </li>
          <li>
            <strong>Gmail (optional)</strong>: read-only search for receipts you choose to import. See “Import from
            Gmail.”
          </li>
        </ul>
      </div>
      <div className="wi-card">
        <h3>What Worth It stores, and where</h3>
        <ul className="wi-list">
          <li>Purchase history, clarification answers, and feedback: in this browser’s extension storage (IndexedDB).</li>
          <li>Preferences, allergies, and your OpenAI key: in <code>chrome.storage.local</code> on this device.</li>
          <li>Nothing is synced to other devices or sent to a Worth It server (there isn’t one).</li>
          <li>Email bodies and attachments are never stored.</li>
        </ul>
      </div>
      <div className="wi-card">
        <h3>What leaves your device</h3>
        <ul className="wi-list">
          <li>Gmail API requests, from your browser to Google, only when you import.</li>
          <li>
            If you add an OpenAI key: finding types, check names, and placeholders (no product names, prices, history,
            email content, or settings).
          </li>
          <li>No analytics or tracking. No bank, card, or account connections.</li>
        </ul>
      </div>
    </div>
  );
}

export function ResetAllData() {
  const { local, repositories } = useServices();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const reset = async () => {
    const { purchases, clarifications, feedback } = await repositories();
    await Promise.all([purchases.deleteAll(), clarifications.deleteAll(), feedback.deleteAll(), clearOpenAiKey(local)]);
    await updatePreferences(local, { ...DEFAULT_PREFERENCES, onboardingComplete: true });
    setConfirming(false);
    setDone(true);
  };

  return (
    <div className="wi-card wi-danger-zone">
      <h3>Delete everything</h3>
      <p className="wi-hint">
        Deletes purchase history, clarification answers, feedback, your OpenAI key, and resets preferences. Gmail access
        is managed separately under “Import from Gmail.”
      </p>
      {confirming ? (
        <div className="wi-actions">
          <button type="button" className="wi-button-danger" onClick={() => void reset()}>
            Yes, delete all Worth It data
          </button>
          <button type="button" className="wi-button-secondary" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="wi-button-secondary" onClick={() => setConfirming(true)}>
          Delete all Worth It data
        </button>
      )}
      {done && (
        <p className="wi-status" role="status">
          All Worth It data on this device was deleted.
        </p>
      )}
    </div>
  );
}
