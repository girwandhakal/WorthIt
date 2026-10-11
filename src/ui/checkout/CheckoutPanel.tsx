import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PanelHandlers } from '../../content/review-controller';
import type { CartReview } from '../../domain/review';
import { Recap } from '../animation/Recap';
import type { ReviewStore } from '../shared/review-store';
import { FullAnalysis } from './FullAnalysis';
import { StaticSummary } from './StaticSummary';

export interface CheckoutPanelProps extends PanelHandlers {
  store: ReviewStore;
  /** Defaults to the shopper's `prefers-reduced-motion` setting. */
  reducedMotion?: boolean;
  /** Open as soon as a review with something to show arrives. Off in the extension: it opens when the shopper clicks checkout. */
  openOnLoad?: boolean;
}

type Mode = 'recap' | 'static' | 'full';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Worth It's checkout panel. Every control acts only on this panel: nothing
 * here reads or clicks retailer controls or changes the cart.
 */
export function CheckoutPanel({ store, reducedMotion, openOnLoad = false, ...handlers }: CheckoutPanelProps) {
  const review = useSyncExternalStore(store.subscribe, store.get);
  const openRequests = useSyncExternalStore(store.subscribe, store.openRequests);
  if (!review) return null;
  return (
    <PanelForReview
      key={review.merchant}
      review={review}
      handlers={handlers}
      reducedMotion={reducedMotion ?? prefersReducedMotion()}
      openOnLoad={openOnLoad}
      openRequests={openRequests}
      reportOpen={store.reportOpen}
    />
  );
}

function PanelForReview({
  review,
  handlers,
  reducedMotion,
  openOnLoad,
  openRequests,
  reportOpen,
}: {
  review: CartReview;
  handlers: PanelHandlers;
  reducedMotion: boolean;
  openOnLoad: boolean;
  openRequests: number;
  reportOpen: (open: boolean) => void;
}) {
  const { onDismiss } = handlers;
  const initialMode = (): Mode => (reducedMotion || review.summary.highlights.length === 0 ? 'static' : 'recap');
  const [open, setOpen] = useState(openOnLoad && review.autoOpen);
  const [seenOpenRequests, setSeenOpenRequests] = useState(openRequests);
  // Opened by the checkout click: move focus into the panel, like opening it by hand.
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lastReview, setLastReview] = useState(review);
  const [closedIds, setClosedIds] = useState<ReadonlySet<string>>(new Set());
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openedByUser = useRef(false);

  // The shopper clicked the retailer's checkout control: open now.
  if (openRequests !== seenOpenRequests) {
    setSeenOpenRequests(openRequests);
    if (!open) {
      setFocusOnOpen(true);
      setMode(initialMode());
      setOpen(true);
    }
  }

  // With openOnLoad, each new review reopens the panel only if it carries a finding the
  // shopper has not already closed the panel on.
  if (review !== lastReview) {
    setLastReview(review);
    if (openOnLoad && !open && review.autoOpen && review.findings.some((finding) => !closedIds.has(finding.id))) {
      setOpen(true);
      setMode(initialMode());
    }
  }

  useEffect(() => {
    if (open && (openedByUser.current || focusOnOpen)) headingRef.current?.focus();
  }, [open, focusOnOpen]);

  useEffect(() => {
    reportOpen(open);
    return () => reportOpen(false);
  }, [open, reportOpen]);

  const close = () => {
    const ids = review.findings.map((finding) => finding.id);
    setOpen(false);
    setFocusOnOpen(false);
    setClosedIds((previous) => new Set([...previous, ...ids]));
    openedByUser.current = false;
    onDismiss(ids);
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
          setMode(initialMode());
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
      <div className="wi-body">
        {mode === 'recap' && (
          <Recap summary={review.summary} onSkip={() => setMode('static')} onAnswer={handlers.onAnswer} onSkipQuestion={handlers.onSkipQuestion} />
        )}
        {mode === 'static' && (
          <div aria-live="polite">
            <StaticSummary
              review={review}
              onAnswer={handlers.onAnswer}
              onSkipQuestion={handlers.onSkipQuestion}
              onReplay={!reducedMotion && review.summary.highlights.length > 0 ? () => setMode('recap') : undefined}
            />
          </div>
        )}
        {mode === 'full' && <FullAnalysis review={review} onBack={() => setMode('static')} />}
      </div>
      <footer className="wi-footer">
        {mode !== 'full' ? (
          <button type="button" className="wi-link" onClick={() => setMode('full')}>
            See full analysis
          </button>
        ) : (
          <span className="wi-handback">Worth It never changes your cart.</span>
        )}
        <button type="button" className="wi-primary" onClick={close}>
          Continue
        </button>
      </footer>
    </section>
  );
}
