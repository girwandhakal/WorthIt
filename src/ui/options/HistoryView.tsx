import { useCallback, useEffect, useState } from 'react';
import { HISTORY_SOURCE_LABELS, historySourceSchema, type HistorySource, type PurchaseInput, type PurchaseRecord } from '../../domain/history';
import { localIsoDate } from '../../shared/dates';
import { describePurchase } from '../shared/format';
import { useServices } from './context';
import { PurchaseForm } from './PurchaseForm';

type Bulk = 'gmail' | 'synthetic' | 'all';

const BULK_LABELS: Record<Bulk, string> = {
  gmail: 'Remove all Gmail-imported records',
  synthetic: 'Remove synthetic test records',
  all: 'Delete all purchase history',
};

/** Review, search, correct, delete, and export local purchase history. */
export function HistoryView() {
  const { repositories, now } = useServices();
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<HistorySource | 'any'>('any');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [confirming, setConfirming] = useState<Bulk | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { purchases } = await repositories();
    setRecords(await purchases.list({ query, sources: source === 'any' ? undefined : [source] }));
  }, [repositories, query, source]);

  useEffect(() => {
    let cancelled = false;
    void repositories()
      .then(({ purchases }) => purchases.list({ query, sources: source === 'any' ? undefined : [source] }))
      .then((list) => {
        if (!cancelled) setRecords(list);
      });
    return () => {
      cancelled = true;
    };
  }, [repositories, query, source]);

  const add = async (input: PurchaseInput) => {
    const { purchases } = await repositories();
    await purchases.add(input);
    setEditing(null);
    setStatus('Purchase added.');
    await refresh();
  };

  const save = async (id: string, input: PurchaseInput) => {
    const { purchases } = await repositories();
    await purchases.update(id, input);
    setEditing(null);
    setStatus('Purchase updated.');
    await refresh();
  };

  const remove = async (record: PurchaseRecord) => {
    const { purchases } = await repositories();
    await purchases.delete(record.id);
    setStatus(`Deleted “${record.title}”.`);
    await refresh();
  };

  const bulkRemove = async (kind: Bulk) => {
    const { purchases } = await repositories();
    if (kind === 'all') {
      await purchases.deleteAll();
      setStatus('All purchase history deleted.');
    } else {
      const removed = await purchases.deleteBySources(kind === 'gmail' ? ['gmail_import', 'synthetic_gmail'] : ['synthetic_gmail']);
      setStatus(`Removed ${removed} ${removed === 1 ? 'record' : 'records'}.`);
    }
    setConfirming(null);
    await refresh();
  };

  const exportHistory = async () => {
    const { purchases } = await repositories();
    const blob = new Blob([await purchases.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `worth-it-history-${localIsoDate(now())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Export ready. It contains purchase records only — no settings, keys, or email content.');
  };

  return (
    <div className="wi-stack">
      <p className="wi-hint">
        A purchase record shows an order was placed. It isn’t proof you still have the item, and Worth It treats routine
        groceries and household supplies as restocking.
      </p>

      <div className="wi-toolbar">
        <label className="wi-inline">
          <span>Search</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Item, store, order" />
        </label>
        <label className="wi-inline">
          <span>Source</span>
          <select
            value={source}
            onChange={(event) =>
              setSource(event.target.value === 'any' ? 'any' : historySourceSchema.parse(event.target.value))
            }
          >
            <option value="any">All sources</option>
            {historySourceSchema.options.map((option) => (
              <option key={option} value={option}>
                {HISTORY_SOURCE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="wi-button" onClick={() => setEditing('new')}>
          Add purchase
        </button>
        <button type="button" className="wi-button-secondary" onClick={() => void exportHistory()}>
          Export (JSON)
        </button>
      </div>

      {status && (
        <p className="wi-status" role="status">
          {status}
        </p>
      )}

      {editing === 'new' && (
        <div className="wi-card">
          <h3>Add a purchase</h3>
          <PurchaseForm today={now()} submitLabel="Save purchase" onSubmit={add} onCancel={() => setEditing(null)} />
        </div>
      )}

      {records.length === 0 ? (
        <p className="wi-empty">
          {query || source !== 'any'
            ? 'No purchases match.'
            : 'No purchase history yet. Add purchases here, import receipts from Gmail, or record purchases from Walmart order pages.'}
        </p>
      ) : (
        <ul className="wi-history" aria-label="Purchase history">
          {records.map((record) => (
            <li key={record.id} className="wi-card">
              {editing === record.id ? (
                <PurchaseForm
                  initial={record}
                  today={now()}
                  submitLabel="Save changes"
                  onSubmit={(input) => save(record.id, input)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="wi-history-row">
                  <div>
                    <strong>{record.title}</strong>
                    <div className="wi-muted">{describePurchase(record)}</div>
                    <div className="wi-badges">
                      <span className={`wi-badge wi-badge-${record.source}`}>{HISTORY_SOURCE_LABELS[record.source]}</span>
                      {record.incomplete && <span className="wi-badge wi-badge-warn">Incomplete</span>}
                    </div>
                  </div>
                  <div className="wi-actions">
                    <button type="button" className="wi-button-secondary" onClick={() => setEditing(record.id)} aria-label={`Edit ${record.title}`}>
                      Edit
                    </button>
                    <button type="button" className="wi-button-danger" onClick={() => void remove(record)} aria-label={`Delete ${record.title}`}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="wi-card wi-danger-zone" aria-labelledby="bulk-delete">
        <h3 id="bulk-delete">Remove records</h3>
        <p className="wi-hint">Disconnecting Gmail doesn’t delete imported records; remove them here if you want them gone.</p>
        <div className="wi-actions">
          {(Object.keys(BULK_LABELS) as Bulk[]).map((kind) =>
            confirming === kind ? (
              <span key={kind} className="wi-confirm">
                <span>Are you sure?</span>
                <button type="button" className="wi-button-danger" onClick={() => void bulkRemove(kind)}>
                  Yes, {BULK_LABELS[kind].toLowerCase()}
                </button>
                <button type="button" className="wi-button-secondary" onClick={() => setConfirming(null)}>
                  Keep them
                </button>
              </span>
            ) : (
              <button key={kind} type="button" className="wi-button-secondary" onClick={() => setConfirming(kind)}>
                {BULK_LABELS[kind]}
              </button>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
