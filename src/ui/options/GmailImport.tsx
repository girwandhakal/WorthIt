import { useState } from 'react';
import type { PurchaseInput } from '../../domain/history';
import { GmailError, GOOGLE_PERMISSIONS_URL, GMAIL_READONLY_SCOPE, disconnectGmail, getGmailToken } from '../../ingestion/gmail/oauth';
import { SYNTHETIC_SUBJECT_MARKER } from '../../ingestion/gmail/parse-message';
import { WALMART_SENDERS, searchAndParseReceipts } from '../../ingestion/gmail/search-orders';
import { reviewGmailOutcomes, type ImportReview } from '../../ingestion/review-import';
import { ImportReviewList } from '../shared/ImportReviewList';
import { useServices } from './context';

const RANGES = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last 12 months' },
];

type State =
  | { step: 'idle' }
  | { step: 'searching' }
  | { step: 'review'; review: ImportReview; scanned: number; saving: boolean }
  | { step: 'message'; tone: 'info' | 'error'; text: string };

const ERROR_TEXT: Record<Exclude<GmailError['kind'], 'client_rejected'>, string> = {
  declined: 'Gmail wasn’t connected. That’s fine — you can add purchases manually in Purchase history.',
  auth: 'Gmail sign-in didn’t work. Try again, or disconnect and reconnect.',
  network: 'Couldn’t reach Gmail. Check your connection and try again.',
  api: 'Gmail returned an error. Try again later.',
};

/** Says what actually failed, with Chrome's own message when it gave one. */
function errorText(error: GmailError, extensionId: string | undefined): string {
  const chrome = error.detail ? ` Chrome said: “${error.detail}”.` : '';
  if (error.kind === 'client_rejected') {
    const id = extensionId ? ` This extension’s ID is ${extensionId}.` : '';
    return (
      `This build has a Gmail client ID, but Chrome or Google rejected it.${id} In Google Cloud, the OAuth client must be of type ` +
      '“Chrome extension” with that exact ID as its Item ID (a newly created client can take a few minutes to work). ' +
      `If the ID shown here is not the one you registered, you loaded a different copy of the extension. See docs/GMAIL_SETUP.md.${chrome}`
    );
  }
  return error.kind === 'auth' ? `${ERROR_TEXT.auth}${chrome}` : ERROR_TEXT[error.kind];
}

/** Optional, user-initiated, read-only Gmail receipt import. */
export function GmailImport() {
  const { identity, fetch, repositories, gmailConfigured, extensionId, now } = useServices();
  const [days, setDays] = useState(90);
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [includeWalmart, setIncludeWalmart] = useState(true);
  const [state, setState] = useState<State>({ step: 'idle' });

  const search = async () => {
    setState({ step: 'searching' });
    try {
      // Consent is requested here, only after the shopper clicks.
      const token = await getGmailToken(identity, true);
      const today = now();
      const after = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
      const before = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const result = await searchAndParseReceipts(fetch, token, { after, before, includeSynthetic, includeWalmart });
      const { purchases } = await repositories();
      const review = await reviewGmailOutcomes(result.outcomes, (key) => purchases.hasDedupeKey(key));
      if (result.messagesScanned === 0) {
        setState({
          step: 'message',
          tone: 'info',
          text: 'No matching receipt emails were found in that date range. You can widen the range or add purchases manually.',
        });
        return;
      }
      setState({ step: 'review', review, scanned: result.messagesScanned, saving: false });
    } catch (error) {
      const text = error instanceof GmailError ? errorText(error, extensionId) : 'Something went wrong while importing. Nothing was saved.';
      setState({ step: 'message', tone: 'error', text });
    }
  };

  const save = async (inputs: PurchaseInput[]) => {
    if (state.step !== 'review') return;
    setState({ ...state, saving: true });
    const { purchases } = await repositories();
    const result = await purchases.addMany(inputs);
    setState({
      step: 'message',
      tone: 'info',
      text: `Saved ${result.saved.length} ${result.saved.length === 1 ? 'purchase' : 'purchases'} to your history.${
        result.duplicates ? ` Skipped ${result.duplicates} already saved.` : ''
      }`,
    });
  };

  const disconnect = async () => {
    await disconnectGmail(identity);
    setState({
      step: 'message',
      tone: 'info',
      text: 'Disconnected: Worth It’s cached Gmail sign-in was cleared. Imported records are kept until you remove them in Purchase history. To revoke access completely, remove Worth It in your Google Account’s third-party connections.',
    });
  };

  return (
    <div className="wi-stack">
      <div className="wi-card">
        <h3>What this does</h3>
        <ul className="wi-list">
          <li>
            Asks Google for <strong>read-only</strong> Gmail access (<code>{GMAIL_READONLY_SCOPE}</code>) when you click
            Connect. Google’s consent screen describes this as reading your email; Worth It uses it only for the search
            below and never sends, changes, or deletes email.
          </li>
          <li>
            Searches only the date range you pick, for{' '}
            {[
              includeSynthetic ? `test receipts you sent yourself with the subject “${SYNTHETIC_SUBJECT_MARKER}”` : null,
              includeWalmart ? `Walmart order emails (${WALMART_SENDERS.join(', ')})` : null,
            ]
              .filter(Boolean)
              .join(' and ') || 'nothing (choose a source below)'}
            , up to 50 messages.
          </li>
          <li>
            Reads each match on this device to pull out the store, order number, date, item names, quantities, prices, and
            canceled/returned status. Email bodies and attachments are discarded right after; nothing is sent to a server.
          </li>
          <li>Shows you every item first. Only what you approve is saved, locally.</li>
        </ul>
      </div>

      {!gmailConfigured && (
        <p className="wi-status" role="status">
          Gmail import isn’t set up in this build (no OAuth client ID). See <code>docs/GMAIL_SETUP.md</code>. You can still
          add purchases manually.
        </p>
      )}

      <div className="wi-toolbar">
        <label className="wi-inline">
          <span>Date range</span>
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {RANGES.map((range) => (
              <option key={range.days} value={range.days}>
                {range.label}
              </option>
            ))}
          </select>
        </label>
        <label className="wi-check-inline">
          <input type="checkbox" checked={includeSynthetic} onChange={(event) => setIncludeSynthetic(event.target.checked)} />
          Synthetic test receipts
        </label>
        <label className="wi-check-inline">
          <input type="checkbox" checked={includeWalmart} onChange={(event) => setIncludeWalmart(event.target.checked)} />
          Walmart order emails
        </label>
      </div>

      <div className="wi-actions">
        <button
          type="button"
          className="wi-button"
          disabled={!gmailConfigured || state.step === 'searching' || (!includeSynthetic && !includeWalmart)}
          onClick={() => void search()}
        >
          {state.step === 'searching' ? 'Searching Gmail…' : 'Connect Gmail and find receipts'}
        </button>
        <button type="button" className="wi-button-secondary" disabled={!gmailConfigured} onClick={() => void disconnect()}>
          Disconnect Gmail
        </button>
      </div>

      <div aria-live="polite">
        {state.step === 'message' && (
          <p className={state.tone === 'error' ? 'wi-error' : 'wi-status'} role={state.tone === 'error' ? 'alert' : 'status'}>
            {state.text}{' '}
            {state.text.startsWith('Disconnected') && (
              <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noreferrer">
                Open Google Account connections
              </a>
            )}
          </p>
        )}
        {state.step === 'review' && (
          <div className="wi-card">
            <p className="wi-muted">
              Checked {state.scanned} {state.scanned === 1 ? 'email' : 'emails'}.
            </p>
            <ImportReviewList
              proposals={state.review.proposals}
              unparsed={state.review.unparsed}
              saving={state.saving}
              onSave={(inputs) => void save(inputs)}
              onCancel={() => setState({ step: 'idle' })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
