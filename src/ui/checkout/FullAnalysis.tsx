import { useEffect } from 'react';
import { isHighlightable } from '../../assessment/describe';
import { INVESTMENT_ASSUMPTIONS } from '../../shared/calculations';
import type { Source } from '../../assessment/evidence/sources';
import type { ItemAssessment } from '../../domain/finding';
import type { CartReview, ReviewFinding } from '../../domain/review';
import { formatCents } from '../../shared/currency';
import { SourceLink } from './SourceLink';
import { Thumb } from './Thumb';

/** Sources about the shopper's own cart or about Walmart itself: not the health and nutrition sources a reader would look up. */
const INTERNAL_SOURCES = new Set(['cart_page', 'purchase_history', 'your_answer', 'walmart_product_page', 'walmart_reference']);

interface Entry {
  item: ItemAssessment;
  findings: ReviewFinding[];
}

/**
 * "See full analysis": every item in the cart, one short block each. Plain words, the main points only, and
 * the sources behind any health note. Prices, quantities, purchase history, and every individual check are
 * left out of the page; the full assessment is written to the browser console for debugging.
 */
export function FullAnalysis({ review, onBack }: { review: CartReview; onBack: () => void }) {
  const { assessment, summary } = review;
  useEffect(() => {
    // For our own use when debugging: everything the checks found, kept out of the page and away from the retailer's scripts.
    console.debug('[Worth It] full analysis details', assessment);
  }, [assessment]);

  const entries: Entry[] = assessment.items.map((item) => ({ item, findings: review.findings.filter((finding) => finding.itemKey === item.itemKey) }));
  const worthALook = entries.filter((entry) => entry.findings.some(isHighlightable));
  // Couldn't read the item, or couldn't tell what kind of product it is: say so rather than calling it fine.
  const couldntCheck = entries.filter(
    (entry) =>
      !worthALook.includes(entry) &&
      (entry.findings.some((finding) => finding.kind === 'uncertain') || entry.item.criteria.some((criterion) => criterion.criterion === 'purpose' && criterion.status === 'unknown')),
  );
  const looksFine = entries.filter((entry) => !worthALook.includes(entry) && !couldntCheck.includes(entry));
  const keep = summary.totals.combinedCents;
  const hasSwap = review.findings.some((finding) => finding.kind === 'cheaper_alternative');

  return (
    <div className="wi-analysis">
      <header className="wi-analysis-head">
        <h3>Full analysis</h3>
        <button type="button" className="wi-link" onClick={onBack}>
          Back to highlights
        </button>
      </header>

      {keep > 0 && (
        <p className="wi-analysis-keep">
          You could keep <strong>{formatCents(keep)}</strong>
          {hasSwap && <span className="wi-analysis-muted"> (store-brand prices are estimates)</span>}
        </p>
      )}

      <Group title="Worth a look" entries={worthALook} />
      <Group title="Couldn’t check" entries={couldntCheck} empty="Couldn’t check this one" />
      <Group title="Looks fine" entries={looksFine} empty="Nothing to flag" />

      {summary.investment && (
        <p className="wi-analysis-note">
          *Hypothetical: {Math.round(INVESTMENT_ASSUMPTIONS.annualReturn * 100)}% a year, compounded {INVESTMENT_ASSUMPTIONS.compounding}, for{' '}
          {INVESTMENT_ASSUMPTIONS.years} years, {INVESTMENT_ASSUMPTIONS.basis}. Returns aren’t guaranteed.
        </p>
      )}

      <button type="button" className="wi-link" onClick={onBack}>
        Back to highlights
      </button>
    </div>
  );
}

function Group({ title, entries, empty }: { title: string; entries: Entry[]; empty?: string }) {
  if (entries.length === 0) return null;
  return (
    <section className="wi-analysis-group" aria-label={title}>
      <h4>
        {title} <span className="wi-analysis-count">{entries.length}</span>
      </h4>
      <ul className="wi-analysis-items">
        {entries.map(({ item, findings }) => (
          <ItemBlock key={item.itemKey} item={item} findings={findings} empty={empty} />
        ))}
      </ul>
    </section>
  );
}

function ItemBlock({ item, findings, empty }: { item: ItemAssessment; findings: ReviewFinding[]; empty?: string }) {
  const notable = findings.filter(isHighlightable);
  const shown = notable.length > 0 ? notable : findings.filter((finding) => finding.kind === 'uncertain');
  const points = shown.flatMap((finding) => (finding.points.length > 0 ? finding.points : [finding.text])).slice(0, 4);
  const save = notable.find((finding) => finding.amountCents !== null && finding.amountCents > 0)?.amountCents ?? null;
  const watch = [...new Set(findings.flatMap((finding) => finding.watch))];
  const sources = uniqueSources(notable);
  return (
    <li className="wi-analysis-item">
      <div className="wi-analysis-title">
        <Thumb src={item.imageUrl} kind="opening" initial={item.itemName} size="sm" />
        <div>
          <h5>{item.itemName}</h5>
          {save !== null && <p className="wi-analysis-save">Could save {formatCents(save)}</p>}
        </div>
      </div>
      {points.length === 0 && empty && <p className="wi-analysis-muted wi-analysis-empty">{empty}</p>}
      {points.length > 0 && (
        <ul className="wi-analysis-points">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {watch.length > 0 && (
        <p className="wi-analysis-note">
          Also noted: <mark>{watch.join(', ')}</mark>
        </p>
      )}
      {sources.length > 0 && (
        <p className="wi-analysis-note">
          Source:{' '}
          {sources.map((source, index) => (
            <span key={source.id}>
              {index > 0 && ', '}
              <SourceLink source={source} />
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function uniqueSources(findings: readonly ReviewFinding[]): Source[] {
  const seen = new Map<string, Source>();
  for (const source of findings.flatMap((finding) => finding.sources)) {
    if (!INTERNAL_SOURCES.has(source.id) && !seen.has(source.id)) seen.set(source.id, source);
  }
  return [...seen.values()];
}
