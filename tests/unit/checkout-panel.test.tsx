import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CartReview } from '../../src/domain/review';
import { CheckoutPanel } from '../../src/ui/checkout/CheckoutPanel';
import { createReviewStore } from '../../src/ui/shared/review-store';

const emptyAssessment = { criteriaVersion: 1, referenceVersion: 'test', assessedOn: '2026-10-10', items: [], readableTotalCents: 0 };

const noFindings: CartReview = {
  version: 1,
  merchant: 'walmart',
  itemCount: 3,
  readableCount: 3,
  findings: [],
  assessment: emptyAssessment,
  autoOpen: false,
};

const withFinding: CartReview = {
  version: 1,
  merchant: 'walmart',
  itemCount: 2,
  readableCount: 1,
  findings: [
    {
      id: 'walmart:15529427:uncertain',
      itemKey: 'walmart:15529427',
      kind: 'uncertain',
      itemName: 'Heinz Tomato Ketchup, 32 oz',
      text: "Couldn't read this item's price reliably, so Worth It couldn't fully check it.",
      amountCents: null,
      question: null,
      why: [],
      sources: [],
      confidence: 'low',
    },
  ],
  assessment: emptyAssessment,
  autoOpen: true,
};

function setup(review: CartReview) {
  const store = createReviewStore();
  store.set(review);
  const onDismiss = vi.fn();
  render(<CheckoutPanel store={store} onDismiss={onDismiss} onAnswer={vi.fn()} onSkipQuestion={vi.fn()} />);
  return { store, onDismiss, user: userEvent.setup() };
}

describe('CheckoutPanel', () => {
  it('shows only the collapsed indicator when nothing needs attention', () => {
    setup(noFindings);
    expect(screen.getByRole('button', { name: 'Worth It: Reviewed 3 items. Open review' })).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('opens on request from the indicator and moves focus to the panel', async () => {
    const { user } = setup(noFindings);
    await user.click(screen.getByRole('button', { name: /Reviewed 3 items/ }));
    const heading = screen.getByRole('heading', { name: 'Worth It' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('Reviewed 3 items. Nothing here needs a second look.')).toBeTruthy();
  });

  it('opens automatically for findings and closes with Continue', async () => {
    const { user, onDismiss } = setup(withFinding);
    expect(screen.getByRole('region', { name: 'Worth It' })).toBeTruthy();
    expect(screen.getByText('Heinz Tomato Ketchup, 32 oz')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith(['walmart:15529427:uncertain']);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Reviewed 2 items/ }));
  });

  it('closes with the dismiss button and with Escape', async () => {
    const { user, onDismiss } = setup(withFinding);
    await user.click(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    expect(screen.queryByRole('region')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Reviewed 2 items/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('stays collapsed on rerender after dismissal, and reopens for a new finding', async () => {
    const { user, store } = setup(withFinding);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    act(() => store.set({ ...withFinding, autoOpen: false }));
    expect(screen.queryByRole('region')).toBeNull();
    // A review that raced the dismissal still carries only the closed finding.
    act(() => store.set({ ...withFinding, autoOpen: true }));
    expect(screen.queryByRole('region')).toBeNull();
    const newFinding = { ...withFinding.findings[0]!, id: 'walmart:10309153:uncertain', itemName: 'Barilla' };
    act(() => store.set({ ...withFinding, findings: [...withFinding.findings, newFinding], autoOpen: true }));
    expect(screen.getByRole('region', { name: 'Worth It' })).toBeTruthy();
  });

  it('is keyboard operable', async () => {
    const { user } = setup(noFindings);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Reviewed 3 items/ }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'Worth It' })).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
  });
});
