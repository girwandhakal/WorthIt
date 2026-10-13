import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import type { CartReview, CartSummary, ReviewFinding } from '../../domain/review';
import { formatCents } from '../../shared/currency';
import { FindingBody, type FindingHandlers } from '../checkout/FindingCard';
import { Thumb } from '../checkout/Thumb';
import { amountLabel, swapTarget, toneOf } from '../checkout/verdict';
import { AnimatedNumber } from './AnimatedNumber';
import { GROWTH_DRAW_MS, GrowthChart } from './GrowthChart';

/**
 * How long each scene stays up before advancing, in milliseconds. The shopper
 * cannot skip ahead, so the end-to-end tests (built with `--mode e2e`) play
 * the same scenes four times faster instead of waiting out the real timings.
 */
const SPEED = import.meta.env.MODE === 'e2e' ? 0.25 : 1;
export const SCENE_MS = { opening: 3200 * SPEED, highlight: 6000 * SPEED, grouped: 4000 * SPEED } as const;

/** How long the closing scene takes to play out: the savings count up, then the growth chart draws. */
export function finaleMs(summary: CartSummary): number {
  return summary.investment ? 1300 + GROWTH_DRAW_MS + 400 : 2600;
}

/** Most cart thumbnails shown in the opening scene. */
const OPENING_THUMBS = 12;

type Scene =
  | { type: 'opening' }
  | { type: 'highlight'; finding: ReviewFinding; number: number }
  | { type: 'grouped' }
  | { type: 'closing' };

export function scenesFor(summary: CartSummary): Scene[] {
  return [
    { type: 'opening' },
    ...summary.highlights.map((finding, index) => ({ type: 'highlight' as const, finding, number: index + 1 })),
    ...(summary.grouped ? [{ type: 'grouped' as const }] : []),
    { type: 'closing' },
  ];
}

export interface RecapProps extends FindingHandlers {
  review: CartReview;
  /** Called with true once the closing scene is up. */
  onEnded?: (ended: boolean) => void;
}

/**
 * The full-screen pre-checkout presentation: a short sequence of scenes built
 * from the deterministic summary (no generated video). It plays on its own and
 * is pausable and replayable, with its captions always shown and a live region
 * so it reads the same without animation. There is deliberately no way to skip ahead: the
 * shopper has to sit through it (reduced-motion shoppers get the static view).
 */
export function Recap({ review, onEnded, onAnswer, onSkipQuestion }: RecapProps) {
  const { summary } = review;
  const scenes = scenesFor(summary);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const current = scenes[Math.min(index, scenes.length - 1)]!;
  const atEnd = index >= scenes.length - 1;
  // A question waits for the shopper; it never advances away on its own.
  const waiting = current.type === 'highlight' && current.finding.question !== null;
  const duration = current.type === 'opening' ? SCENE_MS.opening : current.type === 'grouped' ? SCENE_MS.grouped : SCENE_MS.highlight;

  useEffect(() => {
    if (!playing || atEnd || waiting) return;
    const timer = setTimeout(() => setIndex((value) => value + 1), duration);
    return () => clearTimeout(timer);
  }, [playing, atEnd, waiting, duration, index]);

  // The presentation is done when the closing scene has played out (the count-up and the growth chart), not when it starts.
  useEffect(() => {
    if (!atEnd) {
      onEnded?.(false);
      return;
    }
    const timer = setTimeout(() => onEnded?.(true), finaleMs(summary));
    return () => clearTimeout(timer);
  }, [atEnd, onEnded, summary]);

  const caption = captionFor(current, summary);
  const savedSoFar = runningSavings(scenes, index, summary);

  return (
    <div className="wi-recap">
      <div className="wi-stage" aria-roledescription="recap scene" aria-label={`Scene ${index + 1} of ${scenes.length}`}>
        <div className={`wi-scene wi-scene-${current.type}`} key={index}>
          {current.type === 'opening' && <OpeningScene review={review} />}
          {current.type === 'highlight' && (
            <HighlightScene
              finding={current.finding}
              onAnswer={onAnswer}
              onSkipQuestion={onSkipQuestion}
              onWhyOpened={() => setPlaying(false)}
            />
          )}
          {current.type === 'grouped' && summary.grouped && <GroupedScene summary={summary} />}
          {current.type === 'closing' && <Finale summary={summary} animate />}
        </div>
        <p className="wi-sr-only" aria-live="polite">
          {caption}
        </p>
      </div>

      {summary.totals.combinedCents > 0 && (
        // Kept in place (hidden) before and after the highlights, so the ring animates from where it was.
        <SavingsMeter total={summary.totals.combinedCents} savedCents={savedSoFar} shown={current.type !== 'opening' && current.type !== 'closing'} />
      )}

      <div className="wi-controls" role="toolbar" aria-label="Recap controls">
        <button type="button" className="wi-control" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} aria-label="Previous scene">
          <ControlIcon name="prev" />
        </button>
        <button
          type="button"
          className="wi-control wi-control-main"
          onClick={() => setPlaying((value) => !value)}
          disabled={atEnd}
          aria-label={playing && !atEnd ? 'Pause recap' : 'Play recap'}
        >
          <ControlIcon name={playing && !atEnd ? 'pause' : 'play'} />
        </button>
        <span className="wi-control-gap" aria-hidden="true" />
        <button
          type="button"
          className="wi-control"
          onClick={() => {
            setIndex(0);
            setPlaying(true);
          }}
          aria-label="Replay recap"
        >
          <ControlIcon name="replay" />
        </button>
      </div>
    </div>
  );
}

/** Every item in the cart flies in; the ones worth a second thought light up. */
function OpeningScene({ review }: { review: CartReview }) {
  const flagged = new Set(review.summary.highlights.map((finding) => finding.itemKey));
  const kinds = new Map(review.summary.highlights.map((finding) => [finding.itemKey, finding.kind]));
  const items = review.assessment.items.slice(0, OPENING_THUMBS);
  const more = review.assessment.items.length - items.length;
  return (
    <div className="wi-opening">
      <p className="wi-scene-title">
        <Words text={review.summary.opening} />
      </p>
      <div className="wi-constellation" aria-hidden="true">
        {items.map((item, i) => (
          <Thumb
            key={item.itemKey}
            src={item.imageUrl}
            kind={kinds.get(item.itemKey) ?? 'opening'}
            initial={item.itemName}
            size="sm"
            className={flagged.has(item.itemKey) ? `wi-star wi-star-lit wi-tone-${toneOf(kinds.get(item.itemKey)!)}` : 'wi-star wi-star-dim'}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
        {more > 0 && <span className="wi-star wi-star-more">+{more}</span>}
      </div>
    </div>
  );
}

/** A line whose words slide up into view one after another. Reads as the plain sentence. */
function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return words.map((word, i) => (
    <Fragment key={i}>
      <span className="wi-word">
        <span style={{ '--i': i } as CSSProperties}>{word}</span>
      </span>
      {i < words.length - 1 && ' '}
    </Fragment>
  ));
}

function HighlightScene({
  finding,
  onWhyOpened,
  ...handlers
}: FindingHandlers & { finding: ReviewFinding; onWhyOpened: () => void }) {
  const tone = toneOf(finding.kind);
  const swap = swapTarget(finding);
  return (
    <div className={`wi-highlight wi-tone-${tone}`}>
      <div className="wi-highlight-visual">
        <div className="wi-hero">
          <span className="wi-splash" aria-hidden="true" />
          <Thumb src={finding.imageUrl} kind={finding.kind} size="lg" className="wi-hero-thumb" />
        </div>
        {swap && (
          <div className="wi-swap" aria-hidden="true">
            <span className="wi-swap-arrow">→</span>
            <span className="wi-swap-target">
              <span className="wi-swap-badge">Store brand</span>
              {swap}
            </span>
          </div>
        )}
      </div>
      <div className="wi-highlight-text">
        <p className="wi-scene-item">{finding.itemName}</p>
        {finding.amountCents !== null && (
          <p className="wi-amount-line">
            <AnimatedNumber className="wi-amount-chip" cents={finding.amountCents} delayMs={350} />
            <span className="wi-amount-label">{amountLabel(finding)}</span>
          </p>
        )}
        <div className="wi-scene-body">
          {/* A few short points the shopper can read in the scene's time; the full sentence is read out and kept behind them. */}
          {finding.points.length > 0 && (
            <ul className="wi-points">
              {finding.points.map((point, i) => (
                <li key={point} style={{ '--i': i } as CSSProperties}>
                  {point}
                </li>
              ))}
            </ul>
          )}
          <FindingBody
            finding={finding}
            showName={false}
            showText={finding.points.length === 0}
            onWhyOpened={onWhyOpened}
            {...handlers}
          />
        </div>
      </div>
    </div>
  );
}

function GroupedScene({ summary }: { summary: CartSummary }) {
  const grouped = summary.grouped!;
  const thumbs = [...new Map(grouped.findings.map((finding) => [finding.itemKey, finding])).values()].slice(0, 8);
  return (
    <div className="wi-grouped-scene">
      <div className="wi-grouped-thumbs" aria-hidden="true">
        {thumbs.map((finding, i) => (
          <Thumb
            key={finding.itemKey}
            src={finding.imageUrl}
            kind={finding.kind}
            initial={finding.itemName}
            size="sm"
            className="wi-star wi-star-lit wi-tone-muted"
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </div>
      {grouped.itemCount > 0 ? (
        <p className="wi-grouped-big">
          +{grouped.itemCount} more
          {grouped.amountCents > 0 && (
            <>
              {' · '}
              <AnimatedNumber cents={grouped.amountCents} delayMs={300} />
            </>
          )}
        </p>
      ) : (
        <p className="wi-grouped-big">A few notes</p>
      )}
      <p className="wi-scene-caption">{grouped.label}</p>
    </div>
  );
}

/**
 * The closing scene (and the end of the static view): the cart's potential
 * savings, then the one investment illustration, then the hand-back.
 */
export function Finale({ summary, animate }: { summary: CartSummary; animate: boolean }) {
  const total = summary.totals.combinedCents;
  const sentence = summary.investment?.sentence ?? summary.savingsSentence;
  return (
    <div className={`wi-finale ${summary.investment ? 'wi-finale-split' : ''}`}>
      <div className="wi-finale-text">
        {total > 0 && (
          <div className="wi-finale-save">
            <h3 className="wi-finale-title">Follow this advice and keep</h3>
            <AnimatedNumber className="wi-amount-chip wi-amount-total" cents={total} durationMs={1100} animate={animate} />
          </div>
        )}
        {sentence && <p className="wi-closing-sentence">{sentence}</p>}
        <p className="wi-handback-line">{summary.handBack}</p>
      </div>
      {summary.investment && <GrowthChart investment={summary.investment} animate={animate} delayMs={animate ? 1300 : 0} />}
    </div>
  );
}

/** Ring radius, in the ring's own 56-unit box. */
const RING_R = 23;
const RING_LENGTH = 2 * Math.PI * RING_R;

/** A ring that fills with color as the savings add up, scene by scene, beside the running amount. */
function SavingsMeter({ total, savedCents, shown }: { total: number; savedCents: number; shown: boolean }) {
  const filled = total > 0 ? Math.min(1, savedCents / total) : 0;
  return (
    <div className={`wi-meter ${shown ? '' : 'wi-meter-hidden'}`} aria-hidden="true">
      <svg className="wi-meter-ring" viewBox="0 0 56 56" width="56" height="56" focusable="false">
        <circle className="wi-meter-ring-track" cx="28" cy="28" r={RING_R} />
        <circle
          className="wi-meter-ring-fill"
          cx="28"
          cy="28"
          r={RING_R}
          transform="rotate(-90 28 28)"
          style={{ strokeDasharray: RING_LENGTH, strokeDashoffset: RING_LENGTH * (1 - filled) }}
        />
      </svg>
      <div className="wi-meter-label">
        <span>Potential savings</span>
        <strong>
          {formatCents(savedCents)} <span className="wi-meter-of">of {formatCents(total)}</span>
        </strong>
      </div>
    </div>
  );
}

function sceneAmount(scene: Scene, summary: CartSummary): number {
  if (scene.type === 'highlight') return scene.finding.amountCents ?? 0;
  if (scene.type === 'grouped') return summary.grouped?.amountCents ?? 0;
  return 0;
}

function runningSavings(scenes: Scene[], index: number, summary: CartSummary): number {
  return scenes.slice(0, index + 1).reduce((sum, scene) => sum + sceneAmount(scene, summary), 0);
}

function captionFor(scene: Scene, summary: CartSummary): string {
  switch (scene.type) {
    case 'opening':
      return summary.opening;
    case 'highlight':
      return `${scene.finding.itemName}. ${scene.finding.text}`;
    case 'grouped':
      return summary.grouped?.label ?? '';
    case 'closing':
      return [summary.investment?.sentence ?? summary.savingsSentence, summary.handBack].filter(Boolean).join(' ');
  }
}

function ControlIcon({ name }: { name: 'prev' | 'play' | 'pause' | 'replay' }) {
  const paths = {
    prev: <path d="M15 6l-6 6 6 6" />,
    play: <path d="M8 5.5v13l11-6.5z" className="wi-fill" />,
    pause: (
      <>
        <path d="M9 6v12" />
        <path d="M15 6v12" />
      </>
    ),
    replay: (
      <>
        <path d="M4 12a8 8 0 1 0 2.4-5.7" />
        <path d="M4 4v4h4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" className="wi-control-icon">
      {paths[name]}
    </svg>
  );
}
