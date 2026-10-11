import { useId, useState } from 'react';
import type { CartReview } from '../../domain/review';
import { Finale } from '../animation/Recap';
import { FindingCard, type FindingHandlers } from './FindingCard';

export interface StaticSummaryProps extends FindingHandlers {
  review: CartReview;
  onReplay?: () => void;
}

/** The readable, motion-free equivalent of the recap, with the same facts. */
export function StaticSummary({ review, onReplay, ...handlers }: StaticSummaryProps) {
  const { summary } = review;
  const [expanded, setExpanded] = useState(false);
  const groupId = useId();

  if (review.findings.length === 0) {
    return (
      <p className="wi-lead">
        Reviewed {review.itemCount} {review.itemCount === 1 ? 'item' : 'items'}. Nothing here needs a second look.
      </p>
    );
  }

  return (
    <div className="wi-static">
      <p className="wi-lead">{summary.opening}</p>
      <ul className="wi-findings" aria-label="Worth a second thought">
        {summary.highlights.map((finding) => (
          <FindingCard key={finding.id} finding={finding} {...handlers} />
        ))}
      </ul>
      {summary.grouped && (
        <div className="wi-grouped">
          <button
            type="button"
            className="wi-grouped-toggle"
            aria-expanded={expanded}
            aria-controls={groupId}
            onClick={() => setExpanded((value) => !value)}
          >
            {summary.grouped.label}
            <span aria-hidden="true">{expanded ? ' ▴' : ' ▾'}</span>
          </button>
          {expanded && (
            <ul id={groupId} className="wi-findings wi-findings-grouped">
              {summary.grouped.findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} {...handlers} />
              ))}
            </ul>
          )}
        </div>
      )}
      <Finale summary={summary} captions animate={false} />
      {summary.totals.uncountedItems > 0 && (
        <p className="wi-muted">
          {summary.totals.uncountedItems} {summary.totals.uncountedItems === 1 ? 'suggestion has' : 'suggestions have'} no
          amount because a price couldn’t be read.
        </p>
      )}
      {onReplay && (
        <button type="button" className="wi-link wi-replay" onClick={onReplay}>
          Replay recap
        </button>
      )}
    </div>
  );
}
