import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentDiagnostics, DIAGNOSTIC_ATTRIBUTE, messagingErrorCode } from '../../src/content/diagnostics';

describe('content diagnostics', () => {
  afterEach(() => document.documentElement.removeAttribute(DIAGNOSTIC_ATTRIBUTE));

  it('publishes a bounded status report without copying extra payload fields or error details', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const diagnostics = createContentDiagnostics(document, 'walmart', '2026-10-10T00:00:00.000Z');
    diagnostics.update({ background: 'unavailable', error: messagingErrorCode(new Error('private-token@example.com')),
      ...{ snapshot: { items: ['Private purchase'], pageUrl: 'https://example.com/?token=secret' } },
    });
    const report = document.documentElement.getAttribute(DIAGNOSTIC_ATTRIBUTE)!;
    expect(JSON.parse(report)).toMatchObject({ build: '2026-10-10T00:00:00.000Z', started: true,
      merchant: 'walmart', background: 'unavailable', error: 'background-unavailable' });
    expect(report).not.toMatch(/private|token|snapshot|example\.com/i);
    expect(log).toHaveBeenLastCalledWith(`[Worth It] ${report}`);
    const count = log.mock.calls.length;
    diagnostics.update({ background: 'unavailable' });
    expect(log).toHaveBeenCalledTimes(count);
  });

  it('identifies invalidation and keeps diagnostics failures from blocking startup', () => {
    expect(messagingErrorCode(new Error('Extension context invalidated.'))).toBe('context-invalidated');
    expect(messagingErrorCode(null)).toBe('background-unavailable');
    vi.spyOn(document.documentElement, 'setAttribute').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => createContentDiagnostics(document, 'amazon')).not.toThrow();
  });
});
