import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { handleContentMessage } from '../../src/background/handle-message';
import type { CartReview, ReviewFinding } from '../../src/domain/review';
import { FindingCard } from '../../src/ui/checkout/FindingCard';
import { tumblerReceipt, walkthroughSnapshot } from '../helpers/assessment';
import { EXTENSION_ID, testDeps } from '../helpers/background';

const sender = { id: EXTENSION_ID, tab: { id: 11 } };

async function review(deps: Awaited<ReturnType<typeof testDeps>>, tab = sender) {
  const response = (await handleContentMessage({ type: 'cart/review', snapshot: walkthroughSnapshot() }, tab, deps)) as { review: CartReview };
  return response.review;
}

const tumblerFinding = (r: CartReview) => r.findings.find((finding) => finding.itemName.startsWith('Stanley'))!;

describe('clarification messages', () => {
  it('stores an answer, reuses it, and re-runs the assessment', async () => {
    const deps = await testDeps();
    await deps.repos.purchases.add({ ...tumblerReceipt(), source: 'synthetic_gmail' });
    const before = tumblerFinding(await review(deps));
    expect(before.kind).toBe('skip_redundant');
    expect(before.question).not.toBeNull();

    expect(
      await handleContentMessage(
        {
          type: 'clarification/answer',
          questionId: before.question!.questionId,
          itemMatchKey: before.question!.itemMatchKey,
          itemTitle: before.itemName,
          answer: 'replacement',
        },
        sender,
        deps,
      ),
    ).toEqual({ ok: true });

    const after = tumblerFinding(await review(deps));
    expect(after).toMatchObject({ kind: 'cheaper_alternative', amountCents: 1200, question: null });
    // Remembered for future checkouts, in any tab.
    expect(tumblerFinding(await review(deps, { ...sender, tab: { id: 99 } })).kind).toBe('cheaper_alternative');
    expect(await deps.repos.clarifications.list()).toHaveLength(1);
  });

  it('skipping hides the question in this tab only and keeps the finding', async () => {
    const deps = await testDeps();
    await deps.repos.purchases.add({ ...tumblerReceipt(), source: 'synthetic_gmail' });
    const question = tumblerFinding(await review(deps)).question!;
    await handleContentMessage({ type: 'clarification/skip', questionId: question.questionId, itemMatchKey: question.itemMatchKey }, sender, deps);
    const skipped = tumblerFinding(await review(deps));
    expect(skipped).toMatchObject({ kind: 'skip_redundant', question: null });
    expect(tumblerFinding(await review(deps, { ...sender, tab: { id: 12 } })).question).not.toBeNull();
  });

  it('rejects an invalid answer', async () => {
    const deps = await testDeps();
    const response = await handleContentMessage(
      { type: 'clarification/answer', questionId: 'repeat_purpose', itemMatchKey: 'walmart:1', itemTitle: 'x', answer: 'buy it anyway' },
      sender,
      deps,
    );
    expect(response).toEqual({ ok: false, error: 'Message failed validation.' });
  });
});

describe('FindingCard', () => {
  const finding: ReviewFinding = {
    id: 'walmart:18256507800:skip_redundant',
    itemKey: 'walmart:18256507800',
    position: 0,
    kind: 'skip_redundant',
    imageUrl: null,
    itemName: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
    text: 'You bought this 20 days ago. Do you need another? Skipping it would take $24.97 off your cart.',
    points: ['You bought this 20 days ago', 'Do you need another one?'],
    watch: [],
    wording: null,
    amountCents: 2497,
    question: {
      questionId: 'repeat_purpose',
      itemMatchKey: 'walmart:18256507800',
      prompt: 'You bought this 20 days ago. Is this one replacing it, an extra, or for something different?',
      options: [
        { value: 'replacement', label: 'Replacing a worn one' },
        { value: 'additional', label: 'It’s an extra' },
        { value: 'different_purpose', label: 'For something different' },
      ],
    },
    why: [{ label: 'Same item (20 days ago)', value: 'Stanley Quencher: Purchased', source: 'purchase_history' }],
    sources: [{ id: 'purchase_history', label: 'Your Worth It purchase history (on this device)' }],
    confidence: 'high',
  };

  it('keeps evidence behind "Why?" and offers quick answers', async () => {
    const onAnswer = vi.fn();
    const onSkipQuestion = vi.fn();
    render(
      <ul>
        <FindingCard finding={finding} onAnswer={onAnswer} onSkipQuestion={onSkipQuestion} />
      </ul>,
    );
    expect(screen.queryByText('Same item (20 days ago)')).toBeNull();
    const why = screen.getByRole('button', { name: 'Why?' });
    expect(why.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(why);
    expect(screen.getByText('Same item (20 days ago)')).toBeTruthy();
    expect(screen.getByText('Certainty: high')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Replacing a worn one' }));
    expect(onAnswer).toHaveBeenCalledWith(finding.question, 'replacement', finding.itemName);
    await userEvent.click(screen.getByRole('button', { name: 'Skip question' }));
    expect(onSkipQuestion).toHaveBeenCalledWith(finding.question);
  });

  it('highlights an ingredient that is worth noting but not a concern, and shows nothing when there is none', () => {
    const { rerender } = render(
      <ul>
        <FindingCard finding={{ ...finding, question: null, watch: ['modified starch'] }} onAnswer={vi.fn()} onSkipQuestion={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText('Also noted:', { exact: false })).toBeTruthy();
    expect(document.querySelector('.wi-watch mark')?.textContent).toBe('modified starch');
    rerender(
      <ul>
        <FindingCard finding={{ ...finding, question: null }} onAnswer={vi.fn()} onSkipQuestion={vi.fn()} />
      </ul>,
    );
    expect(document.querySelector('.wi-watch')).toBeNull();
  });
});
