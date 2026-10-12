import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import type { PanelHandlers } from '../../content/review-controller';
import type { CartReview } from '../../domain/review';
import { Recap } from '../animation/Recap';
import { preloadReviewImages } from '../shared/preload';
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
 * Worth It's full-screen checkout presentation. Nothing shows on the page until
 * it opens. Every control acts only on Worth It: nothing here reads or clicks
 * retailer controls or changes the cart.
 */
export function CheckoutPanel({ store, reducedMotion, openOnLoad = false, ...handlers }: CheckoutPanelProps) {
  const review = useSyncExternalStore(store.subscribe, store.get);
  const openRequests = useSyncExternalStore(store.subscribe, store.openRequests);
  // Load the thumbnails as soon as the review is ready, not when the checkout click opens it.
  useEffect(() => {
    if (review) preloadReviewImages(review);
  }, [review]);
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
  // Opened by the checkout click: move focus into the presentation.
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [recapEnded, setRecapEnded] = useState(false);
  const [lastReview, setLastReview] = useState(review);
  const [closedIds, setClosedIds] = useState<ReadonlySet<string>>(new Set());
  const overlayRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Where focus was when the presentation opened (usually the retailer's checkout button), restored on close. */
  const returnFocus = useRef<HTMLElement | null>(null);

  // The shopper clicked the retailer's checkout control: open now.
  if (openRequests !== seenOpenRequests) {
    setSeenOpenRequests(openRequests);
    if (!open) {
      setFocusOnOpen(true);
      setMode(initialMode());
      setOpen(true);
    }
  }

  // With openOnLoad, each new review reopens only if it carries a finding the
  // shopper has not already closed the presentation on.
  if (review !== lastReview) {
    setLastReview(review);
    if (openOnLoad && !open && review.autoOpen && review.findings.some((finding) => !closedIds.has(finding.id))) {
      setOpen(true);
      setMode(initialMode());
    }
  }

  useEffect(() => {
    if (!open || !focusOnOpen) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active instanceof HTMLElement && overlayRef.current && !active.contains(overlayRef.current)) returnFocus.current = active;
    headingRef.current?.focus();
  }, [open, focusOnOpen]);

  useEffect(() => {
    reportOpen(open);
    return () => reportOpen(false);
  }, [open, reportOpen]);

  // Sticky: once the shopper has sat through the presentation, stepping back or replaying does not lock it again.
  const onRecapEnded = useCallback((ended: boolean) => {
    if (ended) setRecapEnded(true);
  }, []);

  // While the animated presentation is still playing for the first time, the shopper cannot leave it or jump past it.
  const locked = mode === 'recap' && !recapEnded;

  const close = () => {
    const ids = review.findings.map((finding) => finding.id);
    setOpen(false);
    setFocusOnOpen(false);
    setRecapEnded(false);
    setClosedIds((previous) => new Set([...previous, ...ids]));
    onDismiss(ids);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) queueMicrotask(() => target.focus({ preventScroll: true }));
  };

  if (!open) return null;

  // Keep Tab inside the presentation while it covers the page.
  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!locked) close();
      return;
    }
    if (event.key !== 'Tab' || !overlayRef.current) return;
    const focusable = Array.from(overlayRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'));
    if (focusable.length === 0) return;
    const root = overlayRef.current.getRootNode() as Document | ShadowRoot;
    const active = root.activeElement;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (active === first || active === headingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const ready = !locked;

  return (
    <section ref={overlayRef} className="wi-overlay" role="dialog" aria-modal="true" aria-labelledby="wi-panel-title" onKeyDown={trapFocus}>
      <header className="wi-header">
        <h2 id="wi-panel-title" ref={headingRef} tabIndex={-1}>
          <span className="wi-logo" aria-hidden="true" />
          Worth It
        </h2>
        {!locked && (
          <button type="button" className="wi-icon-button" aria-label="Dismiss Worth It panel" onClick={close}>
            <span aria-hidden="true">×</span>
          </button>
        )}
      </header>
      <div className={`wi-body wi-body-${mode}`}>
        {mode === 'recap' && (
          <Recap
            review={review}
            onEnded={onRecapEnded}
            onAnswer={handlers.onAnswer}
            onSkipQuestion={handlers.onSkipQuestion}
          />
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
      {/* Hidden, not just disabled, while the presentation plays for the first time: there is nothing to press until it ends. */}
      {ready && (
        <footer className="wi-footer wi-footer-ready">
          {mode !== 'full' ? (
            <button type="button" className="wi-secondary wi-analysis-button" onClick={() => setMode('full')}>
              See full analysis
            </button>
          ) : (
            <span className="wi-handback">Worth It never changes your cart.</span>
          )}
          <span className="wi-footer-end">
            {focusOnOpen && <span className="wi-footer-hint">Your next checkout click goes straight through.</span>}
            <button type="button" className="wi-primary" onClick={close}>
              Continue
            </button>
          </span>
        </footer>
      )}
    </section>
  );
}
