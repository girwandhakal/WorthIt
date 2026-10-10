import { PURPOSE_CLASS_LABELS } from '../../assessment/reference/categories';
import { referenceUrl } from '../../assessment/reference/products';
import { SOURCES } from '../../assessment/evidence/sources';
import { MERCHANT_LABELS, type Merchant } from '../../domain/cart';
import { CRITERION_LABELS, type CriterionStatus, type ItemAssessment } from '../../domain/finding';
import { PURCHASE_STATUS_LABELS } from '../../domain/history';
import type { CartReview } from '../../domain/review';
import { formatCents } from '../../shared/currency';
import { INVESTMENT_ASSUMPTIONS } from '../../shared/calculations';

const STATUS_LABELS: Record<CriterionStatus, string> = {
  finding: 'Finding',
  no_concern: 'No concern',
  not_applicable: 'Not applicable',
  unknown: 'Unknown (not enough information)',
};

/**
 * "See full analysis": every reviewed item with every criterion result,
 * rendered from the deterministic assessment. Opened only on request.
 */
export function FullAnalysis({ review, onBack }: { review: CartReview; onBack: () => void }) {
  const { assessment, summary } = review;
  const options = savingOptions(assessment.items);
  return (
    <div className="wi-full">
      <div className="wi-full-header">
        <h3>Full analysis</h3>
        <button type="button" className="wi-link" onClick={onBack}>
          Back to highlights
        </button>
      </div>
      <p className="wi-muted">
        {assessment.items.length} items reviewed with criteria version {assessment.criteriaVersion} and reference data{' '}
        {assessment.referenceVersion}. Store-brand prices are last-checked reference prices, so their savings are estimates.
      </p>
      <ol className="wi-full-items">
        {assessment.items.map((item) => (
          <ItemAnalysis key={item.itemKey} item={item} merchant={review.merchant} />
        ))}
      </ol>
      <section className="wi-full-savings" aria-label="Every possible saving">
        <h4>Every possible saving</h4>
        <p className="wi-muted">
          All the options Worth It found, biggest first. Each item adds only one to the cart total (marked “counted”); the others are alternatives to the same item, so
          they are shown but never added together.
        </p>
        {options.length === 0 ? (
          <p>No savings were found for this cart.</p>
        ) : (
          <ol className="wi-savings-list">
            {options.map((option) => (
              <li key={`${option.itemKey}:${option.kind}`}>
                <strong>{option.itemName}</strong>: {suggestionLabel(option.kind)}, {formatCents(option.amountCents)}{' '}
                <span className="wi-muted">({option.counted ? 'counted in the total' : 'alternative, not added to the total'})</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="wi-full-totals" aria-label="Cart totals">
        <h4>Cart totals (potential, not realized)</h4>
        <dl>
          <Row label="Readable cart total (before tax and fees)" value={assessment.readableTotalCents === null ? 'Unknown (a price wasn’t readable)' : formatCents(assessment.readableTotalCents)} />
          <Row label="From cheaper alternatives (price differences)" value={formatCents(summary.totals.alternativeCents)} />
          <Row label="From skip or reduce suggestions (full line prices)" value={formatCents(summary.totals.skipCents)} />
          <Row label="Combined (each item counted once)" value={formatCents(summary.totals.combinedCents)} />
        </dl>
        <h4>Investment illustration assumptions</h4>
        <p className="wi-muted">
          {Math.round(INVESTMENT_ASSUMPTIONS.annualReturn * 100)}% assumed annual return, compounded {INVESTMENT_ASSUMPTIONS.compounding}, for{' '}
          {INVESTMENT_ASSUMPTIONS.years} years, {INVESTMENT_ASSUMPTIONS.basis}: future value = amount × (1 + 0.10)^40. Hypothetical, not a forecast;
          returns are not guaranteed.{' '}
          {summary.investment ? `Illustrated: ${formatCents(summary.investment.principalCents)} → about ${formatCents(summary.investment.futureValueCents)}.` : 'Not shown for this cart.'}
        </p>
        <p className="wi-muted">Wording: {summary.wordingSource === 'openai' ? 'phrased by OpenAI from reviewed templates' : 'Worth It’s reviewed templates'}.</p>
      </section>
      <button type="button" className="wi-link" onClick={onBack}>
        Back to highlights
      </button>
    </div>
  );
}

function ItemAnalysis({ item, merchant }: { item: ItemAssessment; merchant: Merchant }) {
  const storeBrand = item.criteria.find((criterion) => criterion.criterion === 'store_brand');
  const alternative = [item.primary, ...item.secondary].find((suggestion) => suggestion?.alternative)?.alternative;
  const cartUrl = merchant === 'walmart' ? 'https://www.walmart.com/cart' : 'https://www.amazon.com/gp/cart/view.html';
  const productUrl = item.referenceId ? referenceUrl(item.referenceId) : undefined;
  const ownPageUrl = merchant === 'walmart' && item.retailerItemId ? `https://www.walmart.com/ip/${item.retailerItemId}` : undefined;
  return (
    <li className="wi-full-item">
      <h4>{item.itemName}</h4>
      <dl className="wi-full-facts">
        <Row label="Purpose class" value={PURPOSE_CLASS_LABELS[item.purposeClass]} />
        <Row label="Price" value={item.linePriceCents === null ? 'Unknown' : formatCents(item.linePriceCents)} />
        <Row label="Quantity" value={item.quantity === null ? 'Unknown' : String(item.quantity)} />
        <Row label="Unit price" value={item.unitPriceCents === null ? 'Unknown' : formatCents(item.unitPriceCents)} />
        <Row label="Share of cart" value={item.shareOfCartBps === null ? 'Unknown' : `${(item.shareOfCartBps / 100).toFixed(1)}%`} />
        {alternative && (
          <Row
            label="Store-brand comparison"
            value={`${alternative.name}: ${formatCents(alternative.referencePriceCents)} (checked ${alternative.priceCheckedOn}); ${alternative.unitPriceComparison}`}
          />
        )}
        <Row
          label="Purchase history"
          value={
            item.historyMatches.length === 0
              ? 'No match'
              : item.historyMatches
                  .slice(0, 3)
                  .map((match) => `${match.kind === 'exact' ? 'Same' : 'Similar'}: ${match.title} (${match.daysAgo} days ago, ${PURCHASE_STATUS_LABELS[match.status].toLowerCase()})`)
                  .join('; ')
          }
        />
        <Row label="Primary suggestion" value={item.primary ? `${suggestionLabel(item.primary.kind)}${item.primary.amountCents !== null ? `: ${formatCents(item.primary.amountCents)}` : ''}` : 'None'} />
      </dl>
      <table className="wi-criteria">
        <caption className="wi-sr-only">Checks for {item.itemName}</caption>
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col">Result</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {item.criteria.map((criterion) => (
            <tr key={criterion.criterion}>
              <th scope="row">{CRITERION_LABELS[criterion.criterion]}</th>
              <td>
                {STATUS_LABELS[criterion.status]}
                <span className="wi-muted"> · certainty {criterion.confidence}</span>
              </td>
              <td>
                {criterion.summary}
                {criterion.evidence.length > 0 && (
                  <ul className="wi-evidence">
                    {criterion.evidence.map((evidence, index) => (
                      <li key={index}>
                        {evidence.label}: {evidence.value}{' '}
                        <span className="wi-muted">({sourceLabel(
                          evidence.source,
                          evidence.source === 'cart_page'
                            ? cartUrl
                            : evidence.source === 'walmart_reference'
                              ? criterion === storeBrand ? alternative?.url : productUrl
                              : evidence.source === 'walmart_product_page'
                                ? ownPageUrl
                                : undefined,
                          evidence.source === 'cart_page' ? `Your ${MERCHANT_LABELS[merchant]} cart page` : undefined,
                        )})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </li>
  );
}

function sourceLabel(id: keyof typeof SOURCES, url?: string, label?: string) {
  const source = SOURCES[id];
  const href = url ?? source.url;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {label ?? source.label}
    </a>
  ) : (
    label ?? source.label
  );
}

/** Every suggestion with a calculable amount, biggest first; the primary one per item is the one the total counts. */
export function savingOptions(items: readonly ItemAssessment[]) {
  return items
    .flatMap((item) =>
      [item.primary, ...item.secondary].flatMap((suggestion) =>
        suggestion && suggestion.amountCents !== null && suggestion.amountCents > 0
          ? [{ itemKey: item.itemKey, itemName: item.itemName, kind: suggestion.kind, amountCents: suggestion.amountCents, counted: suggestion === item.primary }]
          : [],
      ),
    )
    .sort((a, b) => b.amountCents - a.amountCents);
}

function suggestionLabel(kind: string): string {
  return (
    {
      skip_redundant: 'Consider skipping (recent similar purchase)',
      skip_novelty: 'Consider skipping (novelty item)',
      reduce_added_sugar: 'Skip or reduce (added sugar)',
      reduce_food_concern: 'Skip or reduce (ingredients or nutrition label)',
      cheaper_alternative: 'Cheaper alternative',
      store_brand_note: 'Store-brand note',
    } as Record<string, string>
  )[kind] ?? kind;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="wi-why-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
