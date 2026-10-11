import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { useId, useMemo, useState, type PointerEvent } from 'react';
import type { InvestmentIllustration } from '../../assessment/investment';
import { formatCents } from '../../shared/currency';
import { easeInOutCubic, useTween } from './motion';

/** How long the curve takes to draw, in milliseconds. */
export const GROWTH_DRAW_MS = 3600;

const W = 640;
const H = 230;
const M = { top: 16, right: 20, bottom: 30, left: 52 };

interface Point {
  year: number;
  cents: number;
}

/**
 * The one investment illustration, drawn with d3: the cart's potential savings
 * compounding at the assumed annual return, against the same amount kept as
 * cash. Hypothetical; the amounts come from the deterministic summary.
 */
export function GrowthChart({ investment, animate = true, delayMs = 0 }: { investment: InvestmentIllustration; animate?: boolean; delayMs?: number }) {
  const { principalCents, futureValueCents, annualReturn, years } = investment;
  const progress = useTween(GROWTH_DRAW_MS, { delayMs, animate, ease: easeInOutCubic });
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const gradientId = `wi-growth-${useId().replace(/:/g, '')}`;

  const valueAt = (year: number) => (year >= years ? futureValueCents : principalCents * Math.pow(1 + annualReturn, year));
  const { x, y, yTicks } = useMemo(() => {
    const x = scaleLinear().domain([0, years]).range([M.left, W - M.right]);
    const y = scaleLinear().domain([0, futureValueCents]).nice(4).range([H - M.bottom, M.top]);
    return { x, y, yTicks: y.ticks(4) };
  }, [years, futureValueCents]);

  const done = progress >= 1;
  const head = progress * years;
  const points: Point[] = [];
  for (let year = 0; year < head; year++) points.push({ year, cents: valueAt(year) });
  points.push({ year: head, cents: valueAt(head) });

  const curve = line<Point>().x((d) => x(d.year)).y((d) => y(d.cents)).curve(curveMonotoneX);
  const fill = area<Point>().x((d) => x(d.year)).y0(y(0)).y1((d) => y(d.cents)).curve(curveMonotoneX);
  const headPoint = points[points.length - 1]!;
  const headValue = done ? futureValueCents : Math.round(headPoint.cents);
  const multiple = Math.round(futureValueCents / principalCents);
  const hover = hoverYear === null ? null : { year: hoverYear, cents: Math.round(valueAt(hoverYear)) };

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
    if (!done) return;
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const px = ((event.clientX - box.left) / box.width) * W;
    setHoverYear(Math.max(0, Math.min(years, Math.round(x.invert(px)))));
  };

  return (
    <figure className={`wi-growth ${done ? 'wi-growth-done' : ''}`}>
      <figcaption className="wi-growth-head">
        <span className="wi-eyebrow">
          Invested at {Math.round(annualReturn * 100)}% a year for {years} years
        </span>
        <span className="wi-growth-value" aria-hidden="true">
          {formatCents(headValue)}
        </span>
        <span className="wi-growth-multiple" aria-hidden="true">
          {multiple}× what you kept
        </span>
      </figcaption>
      <svg
        className="wi-growth-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Hypothetical growth: ${formatCents(principalCents)} at ${Math.round(annualReturn * 100)}% a year becomes about ${formatCents(futureValueCents)} after ${years} years.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="wi-growth-stop-top" />
            <stop offset="100%" className="wi-growth-stop-bottom" />
          </linearGradient>
        </defs>
        <g className="wi-growth-grid" aria-hidden="true">
          {yTicks.map((tick) => (
            <g key={tick} transform={`translate(0 ${y(tick)})`}>
              <line x1={M.left} x2={W - M.right} />
              <text x={M.left - 8} dy="0.32em" textAnchor="end">
                {compactDollars(tick)}
              </text>
            </g>
          ))}
          {[0, 10, 20, 30, 40].filter((tick) => tick <= years).map((tick) => (
            <text key={tick} x={x(tick)} y={H - 8} textAnchor={tick === 0 ? 'start' : tick === years ? 'end' : 'middle'}>
              {tick === 0 ? 'Today' : `${tick} yrs`}
            </text>
          ))}
        </g>
        <path className="wi-growth-area" d={fill(points) ?? ''} fill={`url(#${gradientId})`} />
        <line className="wi-growth-cash" x1={x(0)} x2={x(head)} y1={y(principalCents)} y2={y(principalCents)} />
        {done && (
          <text className="wi-growth-cash-label" x={W - M.right} y={y(principalCents) - 8} textAnchor="end">
            Kept as cash: {formatCents(principalCents)}
          </text>
        )}
        <path className="wi-growth-line" d={curve(points) ?? ''} />
        <circle className="wi-growth-glow" cx={x(headPoint.year)} cy={y(headPoint.cents)} r="12" />
        <circle className="wi-growth-head-dot" cx={x(headPoint.year)} cy={y(headPoint.cents)} r="5" />
        {hover && (
          <g className="wi-growth-hover" aria-hidden="true">
            <line x1={x(hover.year)} x2={x(hover.year)} y1={M.top} y2={H - M.bottom} />
            <circle cx={x(hover.year)} cy={y(hover.cents)} r="5" />
            <g transform={`translate(${Math.min(Math.max(x(hover.year), M.left + 60), W - M.right - 60)} ${M.top + 4})`}>
              <rect x="-58" y="0" width="116" height="40" rx="8" />
              <text y="16" textAnchor="middle" className="wi-growth-tip-label">
                {hover.year === 0 ? 'Today' : `Year ${hover.year}`}
              </text>
              <text y="32" textAnchor="middle" className="wi-growth-tip-value">
                {formatCents(hover.cents)}
              </text>
            </g>
          </g>
        )}
        <rect
          className="wi-growth-hit"
          x={M.left}
          y={M.top}
          width={W - M.left - M.right}
          height={H - M.top - M.bottom}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverYear(null)}
        />
      </svg>
      <p className="wi-growth-note">Hypothetical. Compounded annually, before inflation. Returns aren’t guaranteed.</p>
    </figure>
  );
}

/** Axis labels: $0, $500, $1.5K, $20K. */
function compactDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 1000) return `$${Math.round(dollars)}`;
  const thousands = dollars / 1000;
  return `$${Number.isInteger(thousands) || thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}K`;
}
