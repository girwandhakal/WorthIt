import { useId, useState } from 'react';
import type { ClarificationQuestion } from '../../domain/finding';
import type { ClarificationAnswer } from '../../domain/history';
import type { ReviewFinding } from '../../domain/review';
import { formatCents } from '../../shared/currency';
import { Thumb } from './Thumb';
import { VERDICTS, amountLabel, toneOf } from './verdict';

export interface FindingHandlers {
  onAnswer: (question: ClarificationQuestion, answer: ClarificationAnswer, itemName: string) => void;
  onSkipQuestion: (question: ClarificationQuestion) => void;
}

export interface FindingCardProps extends FindingHandlers {
  finding: ReviewFinding;
  /** Called when "Why?" opens, e.g. to pause the recap. */
  onWhyOpened?: () => void;
  showName?: boolean;
  showText?: boolean;
}

/** One concern: item name, short advice, an optional question, and evidence behind "Why?". */
export function FindingBody({ finding, onAnswer, onSkipQuestion, onWhyOpened, showName = true, showText = true }: FindingCardProps) {
  const [showWhy, setShowWhy] = useState(false);
  const whyId = useId();
  const hasWhy = finding.why.length > 0 || finding.sources.length > 0;

  return (
    <>
      {showName && <strong className="wi-item-name">{finding.itemName}</strong>}
      {showText && <span className="wi-finding-text">{finding.text}</span>}
      {finding.watch.length > 0 && (
        <p className="wi-watch">
          Also noted: <mark>{finding.watch.join(', ')}</mark>
        </p>
      )}
      {finding.question && (
        <div className="wi-question" role="group" aria-label={finding.question.prompt}>
          <span className="wi-question-prompt">{finding.question.prompt}</span>
          <div className="wi-question-options">
            {finding.question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="wi-chip-button"
                onClick={() => onAnswer(finding.question!, option.value, finding.itemName)}
              >
                {option.label}
              </button>
            ))}
            <button type="button" className="wi-link" onClick={() => onSkipQuestion(finding.question!)}>
              Skip question
            </button>
          </div>
        </div>
      )}
      {hasWhy && (
        <>
          <button
            type="button"
            className="wi-link wi-why"
            aria-expanded={showWhy}
            aria-controls={whyId}
            onClick={() => {
              if (!showWhy) onWhyOpened?.();
              setShowWhy((value) => !value);
            }}
          >
            Why?
          </button>
          {showWhy && (
            <div id={whyId} className="wi-why-details">
              {finding.why.length > 0 && (
                <dl>
                  {finding.why.map((evidence, index) => (
                    <div key={index} className="wi-why-row">
                      <dt>{evidence.label}</dt>
                      <dd>{evidence.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="wi-why-meta">
                Certainty: {finding.confidence === 'high' ? 'high' : finding.confidence === 'medium' ? 'medium (uses an estimate)' : 'low'}
              </p>
              {finding.sources.length > 0 && (
                <ul className="wi-sources" aria-label="Sources">
                  {finding.sources.map((source) => (
                    <li key={source.id}>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer noopener">
                          {source.label}
                        </a>
                      ) : (
                        source.label
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

/** A highlight card for the static view: thumbnail, verdict, amount, then the details. */
export function FindingCard(props: FindingCardProps) {
  const { finding } = props;
  return (
    <li className={`wi-finding wi-finding-${finding.kind} wi-tone-${toneOf(finding.kind)}`}>
      <div className="wi-finding-top">
        <Thumb src={finding.imageUrl} kind={finding.kind} size="sm" />
        <div className="wi-finding-head">
          <span className="wi-verdict">{VERDICTS[finding.kind]}</span>
          {finding.amountCents !== null && (
            <span className="wi-finding-amount">
              {formatCents(finding.amountCents)} <span className="wi-finding-amount-label">{amountLabel(finding)}</span>
            </span>
          )}
        </div>
      </div>
      <FindingBody {...props} />
    </li>
  );
}
