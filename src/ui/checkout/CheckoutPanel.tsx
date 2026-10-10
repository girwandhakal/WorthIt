import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PanelHandlers } from '../../content/review-controller';
import type { CartReview } from '../../domain/review';
import type { ReviewStore } from '../shared/review-store';
import { FindingCard } from './FindingCard';

export interface CheckoutPanelProps extends PanelHandlers {
  store: ReviewStore;
}

/**
 * Worth It's checkout panel. Every control acts only on this panel: nothing
 * here reads or clicks retailer controls or changes the cart.
 */
export function CheckoutPanel({ store, ...handlers }: CheckoutPanelProps) {
  const review = useSyncExternalStore(store.subscribe, store.get);
  if (!review) return null;
  return <PanelForReview key={review.merchant} review={review} handlers={handlers} />;
}

function PanelForReview({ review, handlers }: { review: CartReview; handlers: PanelHandlers }) {
  const { onDismiss } = handlers;
  const [open, setOpen] = useState(review.autoOpen);
  const [lastReview, setLastReview] = useState(review);
  const [closedIds, setClosedIds] = useState<ReadonlySet<string>>(new Set());
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openedByUser = useRef(false);

  // Each new review reopens the panel only if it carries a finding the shopper
  // has not already closed the panel on.
  if (review !== lastReview) {
    setLastReview(review);
    if (review.autoOpen && review.findings.some((finding) => !closedIds.has(finding.id))) setOpen(true);
  }

  useEffect(() => {
    if (open && openedByUser.current) headingRef.current?.focus();
  }, [open]);

  const close = () => {
    const ids = review.findings.map((finding) => finding.id);
    setOpen(false);
    setClosedIds((previous) => new Set([...previous, ...ids]));
    openedByUser.current = false;
    onDismiss(ids);
    // Return focus to the indicator only if focus was inside the panel.
    queueMicrotask(() => indicatorRef.current?.focus());
  };

  const reviewedLabel = `Reviewed ${review.itemCount} ${review.itemCount === 1 ? 'item' : 'items'}`;

  if (!open) {
    return (
      <button
        ref={indicatorRef}
        type="button"
        className="wi-indicator"
        aria-expanded="false"
        aria-label={`Worth It: ${reviewedLabel}. Open review`}
        onClick={() => {
          openedByUser.current = true;
          setOpen(true);
        }}
      >
        <span className="wi-indicator-dot" aria-hidden="true" />
        <span>Worth It · {reviewedLabel}</span>
      </button>
    );
  }

  return (
    <section
      className="wi-panel"
      role="region"
      aria-labelledby="wi-panel-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      <header className="wi-header">
        <h2 id="wi-panel-title" ref={headingRef} tabIndex={-1}>
          Worth It
        </h2>
        <button type="button" className="wi-icon-button" aria-label="Dismiss Worth It panel" onClick={close}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="wi-body" aria-live="polite">
        {review.findings.length === 0 ? (
          <p className="wi-lead">{reviewedLabel}. Nothing here needs a second look.</p>
        ) : (
          <>
            <p className="wi-lead">Before you check out, a quick note on your cart.</p>
            <ul className="wi-findings">
              {review.findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onAnswer={handlers.onAnswer}
                  onSkipQuestion={handlers.onSkipQuestion}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="wi-footer">
        <p className="wi-handback">It&apos;s your call. Worth It never changes your cart.</p>
        <button type="button" className="wi-primary" onClick={close}>
          Continue
        </button>
      </footer>
    </section>
  );
}
