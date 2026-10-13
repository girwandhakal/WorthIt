import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewCart } from '../../src/background/review-cart';
import type { CartReview } from '../../src/domain/review';
import { SCENE_MS, finaleMs } from '../../src/ui/animation/Recap';
import { CheckoutPanel } from '../../src/ui/checkout/CheckoutPanel';
import { createReviewStore } from '../../src/ui/shared/review-store';
import { line, snapshot, tumblerReceipt, walkthroughSnapshot } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';

const summaryOf = (review: CartReview) => review.summary;
const mixed = () => reviewCart(walkthroughSnapshot(), reviewContext({ history: [tumblerReceipt()] }));
/** Same cart, but the tumbler question has been answered or skipped, so the presentation plays straight through. */
const settled = () =>
  reviewCart(
    walkthroughSnapshot(),
    reviewContext({ history: [tumblerReceipt()], skippedQuestions: new Set(['repeat_purpose:walmart:18256507800']) }),
  );
const normal = () => reviewCart(snapshot([line('10315798'), line('145051970', {}, 1), line('10315395', {}, 2)]), reviewContext());
const unreadable = () => reviewCart(snapshot([line('10315798', { linePriceCents: null })]), reviewContext());

function setup(review: CartReview, options: { reducedMotion?: boolean; fakeTimers?: boolean; openOnLoad?: boolean } = {}) {
  if (options.fakeTimers) vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = createReviewStore();
  store.set(review);
  const handlers = { onDismiss: vi.fn(), onAnswer: vi.fn(), onSkipQuestion: vi.fn() };
  // Content tests open the panel up front; the extension itself opens it on the checkout click (see below).
  render(<CheckoutPanel store={store} reducedMotion={options.reducedMotion ?? false} openOnLoad={options.openOnLoad ?? true} {...handlers} />);
  const user = userEvent.setup(options.fakeTimers ? { advanceTimers: vi.advanceTimersByTime } : {});
  return { store, user, ...handlers };
}

function withReview(review: CartReview) {
  const store = createReviewStore();
  store.set(review);
  return store;
}

afterEach(() => vi.useRealTimers());

/** Lets each scene's timer fire in its own act, so React re-renders (and schedules the next scene) in between. */
async function playScenes(...durations: number[]) {
  for (const ms of durations) await act(() => vi.advanceTimersByTimeAsync(ms));
}

describe('opening on the checkout click', () => {
  it('shows nothing on the page until asked, even with findings, then fills the screen', async () => {
    const { store } = setup(mixed(), { openOnLoad: false, reducedMotion: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(store.isOpen()).toBe(false);

    act(() => store.requestOpen());
    const dialog = screen.getByRole('dialog', { name: 'Worth It' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.classList.contains('wi-overlay')).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Worth It' }));
    // No hint about the next click: it simply goes through.
    expect(screen.queryByText(/goes straight through/)).toBeNull();
    expect(store.isOpen()).toBe(true);
  });

  it('reports closed again after Continue, so a later checkout click is not held', async () => {
    const { store, user } = setup(mixed(), { openOnLoad: false, reducedMotion: true });
    act(() => store.requestOpen());
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(store.isOpen()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('returns focus to where it was (the checkout button) on close', async () => {
    const checkout = document.createElement('button');
    checkout.textContent = 'Continue to checkout';
    document.body.append(checkout);
    try {
      const { store, user } = setup(mixed(), { openOnLoad: false, reducedMotion: true });
      checkout.focus();
      act(() => store.requestOpen());
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Worth It' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await act(() => Promise.resolve());
      expect(document.activeElement).toBe(checkout);
    } finally {
      checkout.remove();
    }
  });

  it('a request while already open changes nothing', () => {
    const { store } = setup(mixed(), { reducedMotion: true });
    act(() => store.requestOpen());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});

describe('nothing to show', () => {
  it('renders nothing at all: no pill, no panel', () => {
    const { container } = render(<CheckoutPanel store={withReview(normal())} reducedMotion openOnLoad onDismiss={vi.fn()} onAnswer={vi.fn()} onSkipQuestion={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('still says so plainly if it is opened anyway', () => {
    const { store } = setup(normal(), { reducedMotion: true });
    act(() => store.requestOpen());
    expect(screen.getByText('Reviewed 3 items. Nothing here needs a second look.')).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Recap controls' })).toBeNull();
  });
});

describe('animated recap', () => {
  it('opens on its own with the reflection prompt and recap controls', () => {
    setup(mixed());
    const panel = screen.getByRole('dialog', { name: 'Worth It' });
    // The words animate in one by one, but read as the plain sentence.
    expect(panel.querySelector('.wi-scene-title')?.textContent).toBe('Before you check out, 3 things are worth a second thought.');
    // Every cart item appears in the opening scene, and the three highlights light up.
    expect(panel.querySelectorAll('.wi-constellation .wi-thumb')).toHaveLength(7);
    expect(panel.querySelectorAll('.wi-constellation .wi-star-lit')).toHaveLength(3);
    for (const name of ['Pause recap', 'Replay recap', 'Previous scene']) {
      expect(within(panel).getByRole('button', { name })).toBeTruthy();
    }
    // There is no way to skip ahead.
    for (const name of ['Skip recap', 'Next scene']) expect(within(panel).queryByRole('button', { name })).toBeNull();
  });

  it('advances to highlights in ranking order and waits on a question', async () => {
    setup(mixed(), { fakeTimers: true });
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.opening));
    expect(screen.getByText('Stanley Quencher H2.0 FlowState Tumbler, 30 oz', { selector: '.wi-scene-item' })).toBeTruthy();
    // No count or verdict label above it: just the product, its name, the amount, and the advice.
    expect(document.querySelector('.wi-highlight .wi-verdict, .wi-highlight .wi-eyebrow')).toBeNull();
    // The product's own Walmart thumbnail, requested as a crisp square.
    const hero = document.querySelector<HTMLImageElement>('.wi-hero-thumb img')!;
    expect(hero.getAttribute('src')).toBe('https://i5.walmartimages.com/seo/Stanley-Quencher-H2-0-FlowState-Tumbler-30-oz_fixture.jpeg?odnHeight=480&odnWidth=480&odnBg=FFFFFF');
    expect(hero.getAttribute('alt')).toBe('');
    // The reason in short points instead of the full sentence (which is still read out).
    expect([...document.querySelectorAll('.wi-highlight .wi-points li')].map((point) => point.textContent)).toEqual([
      'You bought this 20 days ago',
      'Do you need another one?',
    ]);
    expect(document.querySelector('.wi-highlight .wi-finding-text')).toBeNull();
    // The amount counts up, then settles on the exact figure.
    await act(() => vi.advanceTimersByTimeAsync(1400));
    expect(screen.getByText('$24.97', { selector: '.wi-amount-chip' })).toBeTruthy();
    expect(screen.getByText('$24.97', { selector: '.wi-meter-label strong', exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replacing a worn one' })).toBeTruthy();
    // The tumbler asks a question, so the recap waits for the shopper.
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.highlight * 3));
    expect(screen.getByText('Stanley Quencher H2.0 FlowState Tumbler, 30 oz', { selector: '.wi-scene-item' })).toBeTruthy();
  });

  it('can be paused and replayed, with no captions switch', async () => {
    const { user } = setup(settled(), { fakeTimers: true });
    await playScenes(SCENE_MS.opening, SCENE_MS.highlight, SCENE_MS.highlight);
    expect(screen.getByText('Squishmallows FuzzAMallow 5 inch Plush', { selector: '.wi-scene-item' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pause recap' }));
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.highlight * 2));
    expect(screen.getByText('Squishmallows FuzzAMallow 5 inch Plush', { selector: '.wi-scene-item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play recap' })).toBeTruthy();

    // There is no captions switch: the reason is always shown, and screen readers get it through the live region.
    expect(screen.queryByRole('button', { name: 'Captions' })).toBeNull();
    expect([...document.querySelectorAll('.wi-highlight .wi-points li')].length).toBeGreaterThan(0);
    expect(screen.getByText(/probably not worth it/, { selector: '.wi-sr-only' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Replay recap' }));
    expect(document.querySelector('.wi-scene-title')?.textContent).toBe('Before you check out, 3 things are worth a second thought.');
  });

  it('ends with the savings total, the investment sentence, and a hand-back', async () => {
    setup(settled(), { fakeTimers: true });
    await playScenes(SCENE_MS.opening, SCENE_MS.highlight, SCENE_MS.highlight, SCENE_MS.highlight);
    expect(screen.getByText('You also had 3 other items you could reconsider or swap for a different one, worth about $4.81 more.', { selector: '.wi-scene-caption' })).toBeTruthy();
    expect(screen.getByText('+3 more', { selector: '.wi-grouped-big', exact: false })).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(SCENE_MS.grouped));
    // The savings count up, then the growth chart draws to the exact illustrated amount.
    await act(() => vi.advanceTimersByTimeAsync(finaleMs(summaryOf(settled())) + 100));
    expect(screen.getByText('$38.72', { selector: '.wi-amount-chip' })).toBeTruthy();
    expect(screen.getByText('$1,752.44', { selector: '.wi-growth-value' })).toBeTruthy();
    expect(screen.getByText('45× what you kept', { selector: '.wi-growth-multiple' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /\$38\.72 at 10% a year becomes about \$1,752\.44 after 40 years/ })).toBeTruthy();
    // At the end, the full analysis is offered.
    expect(document.querySelector('.wi-footer-ready .wi-analysis-button')).toBeTruthy();
    expect(
      screen.getByText(
        'Invested at an assumed 10% a year, $38.72 could grow to about $1,752.44 in 40 years.',
        { selector: '.wi-closing-sentence' },
      ),
    ).toBeTruthy();
    expect(screen.getByText('It’s your call.', { selector: '.wi-handback-line' })).toBeTruthy();
    // The illustration appears once.
    expect(screen.getAllByText(/could grow to about/, { selector: '.wi-closing-sentence' })).toHaveLength(1);
  });

  it('cannot be skipped: Continue, Dismiss and full analysis stay hidden, and Escape does nothing, until it ends', async () => {
    const { user, onDismiss } = setup(settled(), { fakeTimers: true });
    const shown = (name: string) => screen.queryByRole('button', { name }) !== null;
    expect(shown('Continue')).toBe(false);
    expect(shown('See full analysis')).toBe(false);
    expect(shown('Dismiss Worth It panel')).toBe(false);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Worth It' })).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();

    // Mid-way is still locked.
    await playScenes(SCENE_MS.opening, SCENE_MS.highlight, SCENE_MS.highlight);
    expect(shown('Continue')).toBe(false);

    await playScenes(SCENE_MS.highlight, SCENE_MS.grouped);
    // The last scene has started, but the presentation is only done once it has played out.
    expect(shown('Continue')).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(finaleMs(summaryOf(settled())) + 100));
    expect(shown('Continue')).toBe(true);
    expect(shown('See full analysis')).toBe(true);
    expect(shown('Dismiss Worth It panel')).toBe(true);

    // Stepping back after watching it does not lock it again.
    await user.click(screen.getByRole('button', { name: 'Previous scene' }));
    expect(shown('Continue')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('static view (reduced motion)', () => {
  it('starts static and shows at most three highlights in ranking order', () => {
    setup(mixed(), { reducedMotion: true });
    expect(screen.queryByRole('toolbar', { name: 'Recap controls' })).toBeNull();
    const highlights = within(screen.getByRole('list', { name: 'Worth a second thought' })).getAllByRole('listitem');
    expect(highlights.map((item) => item.querySelector('.wi-item-name')?.textContent)).toEqual([
      'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
      'Skittles Original Fruity Candy, Sharing Size, 15.6 oz',
      'Squishmallows FuzzAMallow 5 inch Plush',
    ]);
    expect(screen.queryByRole('button', { name: 'Replay recap' })).toBeNull();
  });

  it('shows each highlight with its thumbnail, verdict, and amount, then the drawn growth chart', () => {
    setup(mixed(), { reducedMotion: true });
    const cards = within(screen.getByRole('list', { name: 'Worth a second thought' })).getAllByRole('listitem');
    expect(cards[0]!.querySelector('img')?.getAttribute('src')).toContain('https://i5.walmartimages.com/seo/Stanley');
    expect(cards[0]!.querySelector('.wi-verdict')?.textContent).toBe('Already have one?');
    expect(cards[0]!.querySelector('.wi-finding-amount')?.textContent).toBe('$24.97 off your cart if you skip it');
    // No usable image (Squishmallows' is from another host): an illustration instead.
    expect(cards[2]!.querySelector('img')).toBeNull();
    expect(cards[2]!.querySelector('.wi-thumb-empty svg')).toBeTruthy();
    // Without motion the chart is complete at once.
    expect(screen.getByText('$1,752.44', { selector: '.wi-growth-value' })).toBeTruthy();
    expect(screen.getAllByText(/could grow to about/, { selector: '.wi-closing-sentence' })).toHaveLength(1);
  });

  it('shows the savings without a chart when the investment illustration is off', () => {
    setup(reviewCart(walkthroughSnapshot(), reviewContext({ history: [tumblerReceipt()], investmentIllustration: false })), { reducedMotion: true });
    expect(document.querySelector('.wi-growth')).toBeNull();
    expect(screen.getByText('$38.72', { selector: '.wi-amount-chip' })).toBeTruthy();
    expect(screen.getByText('By following these suggestions, you would save $38.72.')).toBeTruthy();
  });

  it('groups the rest behind one line, and says nothing about the paper towels whose store brand costs more', async () => {
    const { user } = setup(mixed(), { reducedMotion: true });
    expect(screen.queryByText(/Bounty Essentials/)).toBeNull();
    const toggle = screen.getByRole('button', { name: /You also had 3 other items you could reconsider or swap for a different one, worth about \$4\.81 more/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(screen.getByText(/Horizon Organic/)).toBeTruthy();
    expect(screen.queryByText(/Bounty Essentials/)).toBeNull();
  });

  it('keeps evidence behind "Why?" and shows no scores, classes, criteria, or tables by default', async () => {
    const { user } = setup(mixed(), { reducedMotion: true });
    const panel = screen.getByRole('dialog', { name: 'Worth It' });
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

describe('one screen, no extra scrollbar', () => {
  it('stops the page behind from scrolling while open, and hands it back on Continue', async () => {
    document.documentElement.style.overflow = 'auto';
    const { user } = setup(mixed(), { reducedMotion: true });
    expect(document.documentElement.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });
});

describe('See full analysis', () => {
  const open = async (review: CartReview) => {
    const { user } = setup(review, { reducedMotion: true });
    await user.click(screen.getByRole('button', { name: 'See full analysis' }));
    return user;
  };

  it('opens only on request, groups every item, and returns to the highlights', async () => {
    const { user } = setup(mixed(), { reducedMotion: true });
    expect(screen.queryByRole('heading', { name: 'Full analysis' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'See full analysis' }));
    expect(screen.getByRole('heading', { name: 'Full analysis' })).toBeTruthy();
    const worth = screen.getByRole('region', { name: 'Worth a look' });
    expect(within(worth).getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent)).toEqual(
      expect.arrayContaining(['Stanley Quencher H2.0 FlowState Tumbler, 30 oz', 'Skittles Original Fruity Candy, Sharing Size, 15.6 oz', 'Squishmallows FuzzAMallow 5 inch Plush']),
    );
    // Every item in the cart is on the page, and the quiet ones say so.
    expect(document.querySelectorAll('.wi-analysis-item')).toHaveLength(7);
    expect(within(screen.getByRole('region', { name: 'Looks fine' })).getByText(/Bounty Essentials/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Looks fine' })).getAllByText('Nothing to flag').length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Back to highlights' })[0]!);
    expect(screen.getByRole('list', { name: 'Worth a second thought' })).toBeTruthy();
  });

  it('has no corner X and no "never changes your cart" line: Continue is the way out', async () => {
    await open(mixed());
    expect(screen.queryByRole('button', { name: 'Dismiss Worth It panel' })).toBeNull();
    expect(screen.queryByText(/never changes your cart/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('gives each item its main points and what it could save, in plain words', async () => {
    await open(mixed());
    const stanley = screen.getByRole('heading', { level: 5, name: /Stanley Quencher/ }).closest('li')!;
    expect(within(stanley).getByText('Could save $24.97')).toBeTruthy();
    expect(within(stanley).getByText('You bought this 20 days ago')).toBeTruthy();
    expect(screen.getByText(/You could keep/).textContent).toContain('$38.72');
    // The hypothetical note, short and plain.
    expect(screen.getByText(/^\*Hypothetical: 10% a year, compounded annually, for 40 years/)).toBeTruthy();
  });

  it('leaves out the technical detail: no tables, classes, prices, quantities, shares, or check names', async () => {
    await open(mixed());
    const page = document.querySelector('.wi-analysis')!;
    expect(page.querySelector('table')).toBeNull();
    for (const hidden of ['Purpose class', 'Price', 'Quantity', 'Unit price', 'Share of cart', 'Purchase history', 'Store-brand value', 'certainty', 'criteria version', 'Essential (consumable)']) {
      expect(page.textContent).not.toContain(hidden);
    }
  });

  it('names the source behind a health note, and links it', async () => {
    await open(reviewCart(snapshot([line('16275314128'), line('43981978'), line('10309701')]), reviewContext()));
    const donuts = screen.getByRole('heading', { level: 5, name: /Hostess Donettes/ }).closest('li')!;
    expect(within(donuts).getByRole('link', { name: 'CDC: Get the Facts: Added Sugars' }).getAttribute('href')).toBe('https://www.cdc.gov/nutrition/php/data-research/added-sugars.html');
    // Retailer pages and the shopper's own cart are not "sources" a reader would look up.
    expect(within(document.querySelector('.wi-analysis') as HTMLElement).queryByRole('link', { name: /Your Walmart cart page|product reference/ })).toBeNull();
  });

  it('says plainly when an item could not be checked', async () => {
    await open(unreadable());
    const group = screen.getByRole('region', { name: 'Couldn’t check' });
    expect(within(group).getByText(/Couldn't read this item's price reliably/)).toBeTruthy();
  });

  it('keeps the full assessment in the console for debugging, not on the page', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    await open(mixed());
    expect(debug).toHaveBeenCalledWith('[Worth It] full analysis details', expect.objectContaining({ items: expect.any(Array) }));
    debug.mockRestore();
  });
});

describe('closing the panel', () => {
  it('Continue, Dismiss, and Escape only close Worth It and record the dismissal', async () => {
    const { user, store, onDismiss } = setup(mixed(), { reducedMotion: true });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => store.requestOpen());
    await user.click(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => store.requestOpen());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('stays closed for a re-sent review with the same findings, and reopens for a new one', async () => {
    const { user, store } = setup(unreadable(), { reducedMotion: true });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    act(() => store.set({ ...unreadable() }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => store.set(mixed()));
    expect(screen.getByRole('dialog', { name: 'Worth It' })).toBeTruthy();
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

  it('is keyboard operable and keeps Tab inside the full-screen view', async () => {
    const { user, store } = setup(normal(), { openOnLoad: false });
    act(() => store.requestOpen());
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Worth It' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'See full analysis' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss Worth It panel' }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
  });
});
