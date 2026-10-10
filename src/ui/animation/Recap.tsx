import { useEffect, useState } from 'react';
import type { CartSummary, ReviewFinding } from '../../domain/review';
import { formatCents } from '../../shared/currency';
import { FindingBody, type FindingHandlers } from '../checkout/FindingCard';
import { SceneIcon } from './icons';

/** How long each scene stays up before advancing, in milliseconds. */
export const SCENE_MS = { opening: 2800, highlight: 6000, grouped: 4000 } as const;

type Scene =
  | { type: 'opening' }
  | { type: 'highlight'; finding: ReviewFinding }
  | { type: 'grouped' }
  | { type: 'closing' };

export function scenesFor(summary: CartSummary): Scene[] {
  return [
    { type: 'opening' },
    ...summary.highlights.map((finding) => ({ type: 'highlight' as const, finding })),
    ...(summary.grouped ? [{ type: 'grouped' as const }] : []),
    { type: 'closing' },
  ];
}

export interface RecapProps extends FindingHandlers {
  summary: CartSummary;
  /** Switches to the equivalent static view. */
  onSkip: () => void;
}

/**
 * The animated pre-checkout recap: a short sequence of scenes built from the
 * deterministic summary (no generated video). Pausable, replayable, skippable,
 * with captions and a live region so it reads the same without animation.
 */
export function Recap({ summary, onSkip, onAnswer, onSkipQuestion }: RecapProps) {
  const scenes = scenesFor(summary);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [captions, setCaptions] = useState(true);
  const current = scenes[Math.min(index, scenes.length - 1)]!;
  const atEnd = index >= scenes.length - 1;
  // A question waits for the shopper; it never advances away on its own.
  const waiting = current.type === 'highlight' && current.finding.question !== null;

  useEffect(() => {
    if (!playing || atEnd || waiting) return;
    const duration = current.type === 'opening' ? SCENE_MS.opening : current.type === 'grouped' ? SCENE_MS.grouped : SCENE_MS.highlight;
    const timer = setTimeout(() => setIndex((value) => value + 1), duration);
    return () => clearTimeout(timer);
  }, [playing, atEnd, waiting, current, index]);

  const caption = captionFor(current, summary);

  return (
    <div className="wi-recap">
      <div className="wi-stage" aria-roledescription="recap scene" aria-label={`Scene ${index + 1} of ${scenes.length}`}>
        <div className="wi-scene" key={index}>
          <SceneIcon kind={current.type === 'highlight' ? current.finding.kind : current.type} />
          {current.type === 'opening' && <p className="wi-scene-title">{summary.opening}</p>}
          {current.type === 'highlight' && (
            <div className="wi-scene-highlight">
              <p className="wi-scene-item">{current.finding.itemName}</p>
              {current.finding.amountCents !== null && (
                <span className="wi-amount-chip">{formatCents(current.finding.amountCents)}</span>
              )}
              <div className="wi-scene-body">
                <FindingBody
                  finding={current.finding}
                  showName={false}
                  showText={captions}
                  onAnswer={onAnswer}
                  onSkipQuestion={onSkipQuestion}
                  onWhyOpened={() => setPlaying(false)}
                />
              </div>
            </div>
          )}
          {current.type === 'grouped' && summary.grouped && <p className="wi-scene-title">{summary.grouped.label}</p>}
          {current.type === 'closing' && <ClosingScene summary={summary} captions={captions} />}
        </div>
        <p className="wi-sr-only" aria-live="polite">
          {caption}
        </p>
      </div>

      <div className="wi-progress" aria-hidden="true">
        {scenes.map((_, dot) => (
          <span key={dot} className={dot === index ? 'wi-dot wi-dot-active' : dot < index ? 'wi-dot wi-dot-done' : 'wi-dot'} />
        ))}
      </div>

      <div className="wi-controls" role="toolbar" aria-label="Recap controls">
        <button type="button" className="wi-control" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} aria-label="Previous scene">
          ‹
        </button>
        <button
          type="button"
          className="wi-control"
          onClick={() => setPlaying((value) => !value)}
          disabled={atEnd}
          aria-label={playing ? 'Pause recap' : 'Play recap'}
        >
          {playing && !atEnd ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="wi-control" onClick={() => setIndex((value) => Math.min(scenes.length - 1, value + 1))} disabled={atEnd} aria-label="Next scene">
          ›
        </button>
        <button
          type="button"
          className="wi-control"
          onClick={() => {
            setIndex(0);
            setPlaying(true);
          }}
          aria-label="Replay recap"
        >
          Replay
        </button>
        <button type="button" className="wi-control" aria-pressed={captions} onClick={() => setCaptions((value) => !value)}>
          Captions
        </button>
        <button type="button" className="wi-control wi-control-skip" onClick={onSkip}>
          Skip recap
        </button>
      </div>
    </div>
  );
}

function ClosingScene({ summary, captions }: { summary: CartSummary; captions: boolean }) {
  const sentence = summary.investment?.sentence ?? summary.savingsSentence;
  return (
    <div className="wi-scene-closing">
      {summary.totals.combinedCents > 0 && <span className="wi-amount-chip wi-amount-total">{formatCents(summary.totals.combinedCents)}</span>}
      {captions && sentence && <p className="wi-closing-sentence">{sentence}</p>}
      <p className="wi-handback-line">{summary.handBack}</p>
    </div>
  );
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
