import { useId, useState } from 'react';
import type { PurchaseInput } from '../../domain/history';
import type { ImportProposal, UnparsedMessage } from '../../ingestion/review-import';
import { describePurchase, sourceLabel } from './format';

export interface ImportReviewListProps {
  proposals: readonly ImportProposal[];
  unparsed?: readonly UnparsedMessage[];
  saving?: boolean;
  onSave: (inputs: PurchaseInput[]) => void;
  onCancel: () => void;
}

/**
 * The review step shared by Gmail import and order-page recording. Nothing is
 * saved until the shopper confirms; duplicates start unchecked.
 */
export function ImportReviewList({ proposals, unparsed = [], saving = false, onSave, onCancel }: ImportReviewListProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(proposals.filter((proposal) => !proposal.duplicate).map((proposal) => proposal.id)),
  );
  const headingId = useId();
  const chosen = proposals.filter((proposal) => selected.has(proposal.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="wi-review" aria-labelledby={headingId}>
      <h3 id={headingId} className="wi-review-title">
        Review before saving
      </h3>
      {proposals.length === 0 ? (
        <p className="wi-muted">No purchases were found to import.</p>
      ) : (
        <ul className="wi-review-list">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="wi-review-row">
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(proposal.id)}
                  onChange={() => toggle(proposal.id)}
                  disabled={saving}
                />
                <span className="wi-review-text">
                  <strong>{proposal.input.title}</strong>
                  <span className="wi-muted">{describePurchase(proposal.input)}</span>
                  <span className="wi-badges">
                    <span className={`wi-badge wi-badge-${proposal.input.source}`}>{sourceLabel(proposal.input)}</span>
                    {proposal.duplicate && <span className="wi-badge">Already in history</span>}
                    {proposal.incomplete && <span className="wi-badge wi-badge-warn">Missing quantity or price</span>}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {unparsed.length > 0 && (
        <details className="wi-unparsed">
          <summary>
            {unparsed.length} {unparsed.length === 1 ? 'message' : 'messages'} couldn&apos;t be read
          </summary>
          <ul>
            {unparsed.map((message) => (
              <li key={message.messageId}>
                <strong>{message.subject || '(no subject)'}</strong>: {message.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="wi-review-actions">
        <button
          type="button"
          className="wi-primary"
          disabled={saving || chosen.length === 0}
          onClick={() => onSave(chosen.map((proposal) => proposal.input))}
        >
          {saving ? 'Saving…' : `Save ${chosen.length} ${chosen.length === 1 ? 'purchase' : 'purchases'}`}
        </button>
        <button type="button" className="wi-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </section>
  );
}
