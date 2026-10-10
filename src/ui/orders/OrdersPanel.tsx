import { useState } from 'react';
import type { PurchaseInput } from '../../domain/history';
import type { OrderPageKind } from '../../domain/orders';
import type { ImportReview } from '../../ingestion/review-import';
import { ImportReviewList } from '../shared/ImportReviewList';

export interface OrdersPanelProps {
  pageKind: OrderPageKind;
  /** Reads item rows from the page and returns review proposals. */
  loadReview: () => Promise<ImportReview>;
  save: (inputs: PurchaseInput[]) => Promise<number>;
}

type State =
  | { step: 'idle' }
  | { step: 'loading' }
  | { step: 'review'; review: ImportReview; saving: boolean }
  | { step: 'done'; message: string }
  | { step: 'closed' };

/**
 * Opt-in purchase recorder shown on order pages. It only reads item rows when
 * the shopper asks, and saves only what they approve.
 */
export function OrdersPanel({ pageKind, loadReview, save }: OrdersPanelProps) {
  const [state, setState] = useState<State>({ step: 'idle' });

  const start = async () => {
    setState({ step: 'loading' });
    try {
      const review = await loadReview();
      setState(
        review.proposals.length === 0
          ? { step: 'done', message: 'No purchased items were found on this page.' }
          : { step: 'review', review, saving: false },
      );
    } catch {
      setState({ step: 'done', message: 'Worth It couldn’t read the items on this page.' });
    }
  };

  const onSave = async (inputs: PurchaseInput[]) => {
    if (state.step !== 'review') return;
    setState({ ...state, saving: true });
    try {
      const saved = await save(inputs);
      setState({ step: 'done', message: `Saved ${saved} ${saved === 1 ? 'purchase' : 'purchases'} to your Worth It history.` });
    } catch {
      setState({ step: 'done', message: 'Worth It couldn’t save these purchases. Nothing was changed.' });
    }
  };

  if (state.step === 'closed') return null;

  if (state.step === 'idle') {
    return (
      <div className="wi-panel wi-orders" role="region" aria-label="Worth It purchase recording">
        <div className="wi-body">
          <p className="wi-lead">
            {pageKind === 'confirmation' ? 'Record this order in Worth It?' : 'Record these purchases in Worth It?'}
          </p>
          <p className="wi-muted">
            Worth It reads only the item names, quantities, and prices on this page. You review everything before it’s
            saved on this device.
          </p>
        </div>
        <footer className="wi-footer">
          <button type="button" className="wi-secondary" onClick={() => setState({ step: 'closed' })}>
            Not now
          </button>
          <button type="button" className="wi-primary" onClick={() => void start()}>
            Record these purchases
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="wi-panel wi-orders" role="region" aria-label="Worth It purchase recording">
      <div className="wi-body" aria-live="polite">
        {state.step === 'loading' && <p>Reading items…</p>}
        {state.step === 'review' && (
          <ImportReviewList
            proposals={state.review.proposals}
            saving={state.saving}
            onSave={(inputs) => void onSave(inputs)}
            onCancel={() => setState({ step: 'closed' })}
          />
        )}
        {state.step === 'done' && (
          <>
            <p>{state.message}</p>
            <button type="button" className="wi-secondary" onClick={() => setState({ step: 'closed' })}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
