import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewCart } from '../../src/background/review-cart';
import type { CartReview } from '../../src/domain/review';
import { SCENE_MS } from '../../src/ui/animation/Recap';
import { CheckoutPanel } from '../../src/ui/checkout/CheckoutPanel';
import { createReviewStore } from '../../src/ui/shared/review-store';
import { line, snapshot, tumblerReceipt, walkthroughSnapshot } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';

const mixed = () => reviewCart(walkthroughSnapshot(), reviewContext({ history: [tumblerReceipt()] }));
const normal = () => reviewCart(snapshot([line('10315798'), line('145051970', {}, 1), line('10315395', {}, 2)]), reviewContext());
const unreadable = () => reviewCart(snapshot([line('10315798', { linePriceCents: null })]), reviewContext());

function setup(review: CartReview, options: { reducedMotion?: boolean; fakeTimers?: boolean } = {}) {
  if (options.fakeTimers) vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = createReviewStore();
  store.set(review);
  const handlers = { onDismiss: vi.fn(), onAnswer: vi.fn(), onSkipQuestion: vi.fn() };
  render(<CheckoutPanel store={store} reducedMotion={options.reducedMotion ?? false} {...handlers} />);
  const user = userEvent.setup(options.fakeTimers ? { advanceTimers: vi.advanceTimersByTime } : {});
  return { store, user, ...handlers };
}

afterEach(() => vi.useRealTimers());

describe('collapsed indicator', () => {
  it('is all that shows when nothing needs attention', async () => {
    const { user } = setup(normal());
    expect(screen.queryByRole('region')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Worth It: Reviewed 3 items. Open review' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Worth It' }));
    expect(screen.getByText('Reviewed 3 items. Nothing here needs a second look.')).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Recap controls' })).toBeNull();
  });
});

describe('animated recap', () => {
  it('opens on its own with the reflection prompt and recap controls', () => {
    setup(mixed());
    const panel = screen.getByRole('region', { name: 'Worth It' });
    expect(within(panel).getByText('Before you check out, 3 things are worth a second thought.', { selector: '.wi-scene-title' })).toBeTruthy();
    for (const name of ['Pause recap', 'Replay recap', 'Captions', 'Skip recap', 'Next scene', 'Previous scene']) {
      expect(within(panel).getByRole('button', { name })).toBeTruthy();
    }
  });

  it('advances to highlights in ranking order and waits on a question', async () => {
    setup(mixed(), { fakeTimers: true });
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.opening));
    expect(screen.getByText('Stanley Quencher H2.0 FlowState Tumbler, 30 oz', { selector: '.wi-scene-item' })).toBeTruthy();
    expect(screen.getByText('$24.97', { selector: '.wi-amount-chip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replacing a worn one' })).toBeTruthy();
    // The tumbler asks a question, so the recap waits for the shopper.
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.highlight * 3));
    expect(screen.getByText('Stanley Quencher H2.0 FlowState Tumbler, 30 oz', { selector: '.wi-scene-item' })).toBeTruthy();
  });

  it('can be paused, moved, replayed, and captioned', async () => {
    const { user } = setup(mixed(), { fakeTimers: true });
    await user.click(screen.getByRole('button', { name: 'Next scene' }));
    await user.click(screen.getByRole('button', { name: 'Next scene' }));
    expect(screen.getByText('Squishmallows FuzzAMallow 5 inch Plush', { selector: '.wi-scene-item' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pause recap' }));
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.highlight * 2));
    expect(screen.getByText('Squishmallows FuzzAMallow 5 inch Plush', { selector: '.wi-scene-item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play recap' })).toBeTruthy();

    const captions = screen.getByRole('button', { name: 'Captions' });
    expect(captions.getAttribute('aria-pressed')).toBe('true');
    await user.click(captions);
    expect(screen.queryByText(/This is a collectible without a practical use/, { selector: '.wi-finding-text' })).toBeNull();
    // Screen readers still get the caption through the live region.
    expect(screen.getByText(/This is a collectible without a practical use/, { selector: '.wi-sr-only' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Replay recap' }));
    expect(screen.getByText('Before you check out, 3 things are worth a second thought.', { selector: '.wi-scene-title' })).toBeTruthy();
  });

  it('ends with the savings total, the investment sentence, and a hand-back', async () => {
    const { user } = setup(mixed(), { fakeTimers: true });
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Next scene' }));
    expect(screen.getByText('Also: 3 store-brand swaps could save $4.81', { selector: '.wi-scene-title' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next scene' }));
    expect(screen.getByText('$38.72', { selector: '.wi-amount-chip' })).toBeTruthy();
    expect(
      screen.getByText(
        'By following these suggestions, you would save $38.72. If you invested that $38.72 at an assumed 10% annual return, compounded annually, it could grow to about $1,752.44 in 40 years (before inflation; returns are not guaranteed).',
        { selector: '.wi-closing-sentence' },
      ),
    ).toBeTruthy();
    expect(screen.getByText('It’s your call.', { selector: '.wi-handback-line' })).toBeTruthy();
    // The illustration appears once.
    expect(screen.getAllByText(/could grow to about/, { selector: '.wi-closing-sentence' })).toHaveLength(1);
  });

  it('Skip recap shows the equivalent static view', async () => {
    const { user } = setup(mixed());
    await user.click(screen.getByRole('button', { name: 'Skip recap' }));
    expect(screen.queryByRole('toolbar', { name: 'Recap controls' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Worth a second thought' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replay recap' })).toBeTruthy();
  });
});

describe('static view (reduced motion)', () => {
  it('starts static and shows at most three highlights in ranking order', () => {
    setup(mixed(), { reducedMotion: true });
    expect(screen.queryByRole('toolbar', { name: 'Recap controls' })).toBeNull();
    const highlights = within(screen.getByRole('list', { name: 'Worth a second thought' })).getAllByRole('listitem');
    expect(highlights.map((item) => item.querySelector('.wi-item-name')?.textContent)).toEqual([
      'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
      'Squishmallows FuzzAMallow 5 inch Plush',
      'Skittles Original Fruity Candy, Sharing Size, 15.6 oz',
    ]);
    expect(screen.queryByRole('button', { name: 'Replay recap' })).toBeNull();
  });

  it('groups the rest behind one line, including the no-savings paper-towel note', async () => {
    const { user } = setup(mixed(), { reducedMotion: true });
    expect(screen.queryByText(/Bounty Essentials/)).toBeNull();
    const toggle = screen.getByRole('button', { name: /Also: 3 store-brand swaps could save \$4\.81/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(screen.getByText('Bounty Essentials Select-A-Size Paper Towels, 6 Double Rolls')).toBeTruthy();
    expect(screen.getByText(/costs more per unit \(\$1\.23 vs \$1\.50 per 100 sheets\)/)).toBeTruthy();
  });

  it('keeps evidence behind "Why?" and shows no scores, classes, criteria, or tables by default', async () => {
    const { user } = setup(mixed(), { reducedMotion: true });
    const panel = screen.getByRole('region', { name: 'Worth It' });
    const text = panel.textContent ?? '';
    for (const hidden of ['Purpose class', 'Discretionary', 'Essential', 'Store-brand value', 'Recent similar purchase', 'No concern', 'Share of your cart', 'score']) {
      expect(text).not.toContain(hidden);
    }
    expect(panel.querySelector('table')).toBeNull();
    await user.click(within(panel).getAllByRole('button', { name: 'Why?' })[0]!);
    expect(within(panel).getByText('Share of your cart')).toBeTruthy();
    expect(within(panel).getByText('Your Worth It purchase history (on this device)')).toBeTruthy();
  });

  it('shows uncertainty when an item could not be read', () => {
    setup(unreadable(), { reducedMotion: true });
    expect(screen.getByText(/Worth It couldn’t read everything in your cart/)).toBeTruthy();
    expect(screen.getByText(/Couldn't read this item's price reliably/)).toBeTruthy();
  });
});

describe('See full analysis', () => {
  it('opens only on request, lists every item and check, and returns to the highlights', async () => {
    const { user } = setup(mixed(), { reducedMotion: true });
    expect(screen.queryByRole('heading', { name: 'Full analysis' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'See full analysis' }));
    expect(screen.getByRole('heading', { name: 'Full analysis' })).toBeTruthy();
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(7);
    expect(within(tables[2]!).getByText('Store-brand value')).toBeTruthy();
    expect(screen.getByText('Combined (each item counted once)').nextSibling?.textContent).toBe('$38.72');
    expect(screen.getAllByText('Essential (consumable)').length).toBeGreaterThan(0);
    expect(screen.getByText(/10% assumed annual return, compounded annually, for 40 years, before inflation/)).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Back to highlights' })[0]!);
    expect(screen.getByRole('list', { name: 'Worth a second thought' })).toBeTruthy();
  });
});

describe('closing the panel', () => {
  it('Continue, Dismiss, and Escape only close Worth It and record the dismissal', async () => {
    const { user, onDismiss } = setup(mixed(), { reducedMotion: true });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Reviewed 7 items/ }));

    await user.click(screen.getByRole('button', { name: /Reviewed 7 items/ }));
    await user.click(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    await user.click(screen.getByRole('button', { name: /Reviewed 7 items/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('stays closed for a re-sent review with the same findings, and reopens for a new one', async () => {
    const { user, store } = setup(unreadable(), { reducedMotion: true });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    act(() => store.set({ ...unreadable() }));
    expect(screen.queryByRole('region')).toBeNull();
    act(() => store.set(mixed()));
    expect(screen.getByRole('region', { name: 'Worth It' })).toBeTruthy();
  });

  it('answering a question reports it to the controller', async () => {
    const { user, onAnswer } = setup(mixed(), { reducedMotion: true });
    await user.click(screen.getByRole('button', { name: 'Replacing a worn one' }));
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 'repeat_purpose', itemMatchKey: 'walmart:18256507800' }),
      'replacement',
      'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
    );
  });

  it('is keyboard operable', async () => {
    const { user } = setup(normal());
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'Worth It' })).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'See full analysis' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
  });
});
