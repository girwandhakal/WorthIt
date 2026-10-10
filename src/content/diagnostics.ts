import type { Merchant } from '../domain/cart';

// Replaced by Vite at build time; the fallback is used by unit tests.
declare const __WORTH_IT_BUILD__: string;
export const CONTENT_BUILD = typeof __WORTH_IT_BUILD__ === 'undefined' ? 'test' : __WORTH_IT_BUILD__;
export const DIAGNOSTIC_ATTRIBUTE = 'data-worth-it-debug';

export interface DiagnosticUpdate {
  context?: 'valid' | 'invalidated';
  route?: 'cart' | 'other';
  panel?: 'not-requested' | 'mounting' | 'mounted' | 'failed' | 'removed';
  background?: 'not-requested' | 'pending' | 'ok' | 'invalid-response' | 'unavailable';
  review?: 'not-requested' | 'pending' | 'delivered';
  extractedItems?: number | null;
  readableItems?: number | null;
  displayedItems?: number | null;
  error?: 'none' | 'context-invalidated' | 'background-unavailable' | 'panel-mount-failed';
}

/** Fixed status codes only: never print arbitrary errors, URLs, messages or product details. */
export function messagingErrorCode(error: unknown): 'context-invalidated' | 'background-unavailable' {
  return error instanceof Error && error.message.includes('Extension context invalidated')
    ? 'context-invalidated'
    : 'background-unavailable';
}

/** Local, bounded report readable from the page's DevTools even with a closed shadow root. */
export function createContentDiagnostics(doc: Document, merchant: Merchant, build = CONTENT_BUILD) {
  const state: Required<DiagnosticUpdate> & { schema: number; build: string; merchant: Merchant; started: boolean } = {
    schema: 1, build, merchant, started: true,
    context: 'valid', route: 'other', panel: 'not-requested', background: 'not-requested',
    review: 'not-requested', extractedItems: null, readableItems: null, displayedItems: null, error: 'none',
  };
  const fields = Object.keys(state).filter((key) => !['schema', 'build', 'merchant', 'started'].includes(key));
  let previous = '';
  const update = (patch: DiagnosticUpdate) => {
    // Explicit allowlist prevents accidental extra payload fields from being logged.
    Object.assign(state, Object.fromEntries(fields.filter((key) => key in patch).map((key) => [key, patch[key as keyof DiagnosticUpdate]])));
    const report = JSON.stringify(state);
    if (report === previous) return;
    previous = report;
    try {
      doc.documentElement.setAttribute(DIAGNOSTIC_ATTRIBUTE, report);
      console.info(`[Worth It] ${report}`);
    } catch {
      // Diagnostics must never prevent the shopper's review from starting.
    }
  };
  update({});
  return { update };
}
