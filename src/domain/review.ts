import type { Merchant } from './cart';

/**
 * What the checkout panel renders. Built by the service worker from the cart
 * snapshot; the content script never computes findings itself.
 */
export interface CartReview {
  version: 1;
  merchant: Merchant;
  itemCount: number;
  /** Items whose name, quantity, and price were all read. */
  readableCount: number;
  findings: ReviewFinding[];
  /** False when there is nothing to show, prompts are off, or the shopper dismissed these findings. */
  autoOpen: boolean;
}

export interface ReviewFinding {
  /** Stable across rerenders: `${itemKey}:${kind}`. Used for dismissal. */
  id: string;
  itemKey: string;
  kind: 'uncertain';
  itemName: string;
  text: string;
}
