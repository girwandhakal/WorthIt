import type { CartReview } from '../../domain/review';

/** Minimal external store that hands the latest review to React. */
export interface ReviewStore {
  get(): CartReview | null;
  set(review: CartReview | null): void;
  subscribe(listener: () => void): () => void;
}

export function createReviewStore(): ReviewStore {
  let current: CartReview | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (review) => {
      current = review;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
