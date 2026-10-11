import type { CartReview } from '../../domain/review';

/** Minimal external store that hands the latest review to React. */
export interface ReviewStore {
  get(): CartReview | null;
  set(review: CartReview | null): void;
  subscribe(listener: () => void): () => void;
  /** Asks the panel to open (the shopper clicked checkout). Counts up so each request is seen once. */
  requestOpen(): void;
  openRequests(): number;
  /** Whether the panel is showing right now, reported by the panel itself. */
  isOpen(): boolean;
  reportOpen(open: boolean): void;
}

export function createReviewStore(): ReviewStore {
  let current: CartReview | null = null;
  let opens = 0;
  let open = false;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (review) => {
      current = review;
      for (const listener of listeners) listener();
    },
    requestOpen: () => {
      opens += 1;
      for (const listener of listeners) listener();
    },
    openRequests: () => opens,
    isOpen: () => open,
    reportOpen: (value) => {
      open = value;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
