import { describe, expect, it, vi } from 'vitest';
import { GmailError, disconnectGmail, getGmailToken, isGmailConfigured, type IdentityApi } from '../../src/ingestion/gmail/oauth';
import { GMAIL_API, buildGmailQuery, listMessageIds, searchAndParseReceipts, type FetchLike } from '../../src/ingestion/gmail/search-orders';
import { reviewGmailOutcomes } from '../../src/ingestion/review-import';
import { loadEmail } from '../helpers/eml';

const range = { after: new Date(2026, 6, 12), before: new Date(2026, 9, 11) };

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** A fake Gmail API serving fixture messages, recording every request. */
function fakeGmail(messages: Record<string, ReturnType<typeof loadEmail>>, pageSize = 1) {
  const requests: { url: string; headers?: Record<string, string> }[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    requests.push({ url, headers: init?.headers });
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/messages')) {
      const ids = Object.keys(messages);
      const start = Number(parsed.searchParams.get('pageToken') ?? 0);
      const page = ids.slice(start, start + pageSize).map((id) => ({ id, threadId: id }));
      const next = start + pageSize < ids.length ? String(start + pageSize) : undefined;
      return jsonResponse({ messages: page, nextPageToken: next, resultSizeEstimate: ids.length });
    }
    const id = decodeURIComponent(parsed.pathname.split('/').pop()!);
    return messages[id] ? jsonResponse(messages[id]) : jsonResponse({}, 404);
  };
  return { fetchFn, requests };
}

describe('buildGmailQuery', () => {
  it('searches only the chosen range and likely receipts', () => {
    expect(buildGmailQuery({ ...range, includeSynthetic: true, includeWalmart: false })).toBe(
      '(subject:"[Worth It Test Receipt]" from:me) after:2026/07/12 before:2026/10/11',
    );
    expect(buildGmailQuery({ ...range, includeSynthetic: true, includeWalmart: true })).toMatch(
      /^\{\(subject:"\[Worth It Test Receipt\]" from:me\) \(from:\(help@walmart\.com OR .+\) subject:order\)\} after:/,
    );
    expect(buildGmailQuery({ ...range, includeSynthetic: false, includeWalmart: false })).toBeNull();
  });
});

describe('Gmail search and fetch', () => {
  it('pages through results, fetches each message, and parses locally', async () => {
    const { fetchFn, requests } = fakeGmail({
      a: loadEmail('synthetic-tumbler.eml', 'a'),
      b: loadEmail('synthetic-malformed.eml', 'b'),
      c: loadEmail('walmart-order.eml', 'c'),
    });
    const result = await searchAndParseReceipts(fetchFn, 'token-123', { ...range, includeSynthetic: true, includeWalmart: true });
    expect(result.messagesScanned).toBe(3);
    expect(result.outcomes.map((outcome) => outcome.kind)).toEqual(['parsed', 'unparsed', 'parsed']);
    // Every request goes to Gmail API with the bearer token, nowhere else.
    expect(requests.every((request) => request.url.startsWith(GMAIL_API))).toBe(true);
    expect(requests.every((request) => request.headers?.Authorization === 'Bearer token-123')).toBe(true);
    expect(requests.filter((request) => request.url.includes('format=full'))).toHaveLength(3);
  });

  it('caps the number of messages', async () => {
    const many = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`m${i}`, loadEmail('unrelated.eml', `m${i}`)]));
    const { fetchFn } = fakeGmail(many, 3);
    expect(await listMessageIds(fetchFn, 't', 'q', 5)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });

  it('handles an empty mailbox', async () => {
    const { fetchFn } = fakeGmail({});
    const result = await searchAndParseReceipts(fetchFn, 't', { ...range, includeSynthetic: true, includeWalmart: false });
    expect(result).toMatchObject({ messagesScanned: 0, outcomes: [] });
  });

  it('maps HTTP and network failures to clear errors', async () => {
    await expect(listMessageIds(async () => jsonResponse({}, 401), 't', 'q')).rejects.toMatchObject({ kind: 'auth' });
    await expect(listMessageIds(async () => jsonResponse({}, 500), 't', 'q')).rejects.toMatchObject({ kind: 'api' });
    await expect(
      listMessageIds(async () => {
        throw new TypeError('Failed to fetch');
      }, 't', 'q'),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('builds a review with duplicates detected against history', async () => {
    const { fetchFn } = fakeGmail({ a: loadEmail('synthetic-tumbler.eml', 'a'), b: loadEmail('synthetic-tumbler.eml', 'b') });
    const result = await searchAndParseReceipts(fetchFn, 't', { ...range, includeSynthetic: true, includeWalmart: false });
    const existing = new Set(['walmart|WI-TEST-0001|656700117']);
    const review = await reviewGmailOutcomes(result.outcomes, async (key) => existing.has(key));
    expect(review.proposals.map((p) => [p.input.title.slice(0, 14), p.input.source, p.duplicate])).toEqual([
      ['Stanley Quench', 'synthetic_gmail', false],
      ['Skittles Origi', 'synthetic_gmail', true],
      ['Stanley Quench', 'synthetic_gmail', true],
      ['Skittles Origi', 'synthetic_gmail', true],
    ]);
    expect(review.proposals[0]!.input.gmailMessageId).toBe('a');
  });
});

describe('Chrome identity', () => {
  const identity = (getAuthToken: IdentityApi['getAuthToken']): IdentityApi & { removed: string[]; cleared: number } => {
    const api = {
      removed: [] as string[],
      cleared: 0,
      getAuthToken,
      removeCachedAuthToken: async ({ token }: { token: string }) => {
        api.removed.push(token);
      },
      clearAllCachedAuthTokens: async () => {
        api.cleared++;
      },
    };
    return api;
  };

  it('requests only the read-only scope and accepts both result shapes', async () => {
    const getAuthToken = vi.fn(async () => ({ token: 'abc', grantedScopes: [] }));
    expect(await getGmailToken(identity(getAuthToken), true)).toBe('abc');
    expect(getAuthToken).toHaveBeenCalledWith({ interactive: true, scopes: ['https://www.googleapis.com/auth/gmail.readonly'] });
    expect(await getGmailToken(identity(async () => 'xyz'), false)).toBe('xyz');
  });

  it('reports a declined consent', async () => {
    const declined = identity(async () => {
      throw new Error('The user did not approve access.');
    });
    await expect(getGmailToken(declined, true)).rejects.toEqual(new GmailError('declined', 'Gmail access was not granted.'));
  });

  it.each([
    ["OAuth2 request failed: Service responded with error: 'bad client id: 123-abc.apps.googleusercontent.com'"],
    ['Invalid OAuth2 Client ID.'],
    ['OAuth2 client_id is not specified in the manifest'],
  ])('reports a rejected OAuth client, keeping Chrome’s message: %s', async (message) => {
    const rejected = identity(async () => {
      throw new Error(message);
    });
    await expect(getGmailToken(rejected, true)).rejects.toMatchObject({ kind: 'client_rejected', detail: message });
  });

  it('keeps Chrome’s message for other sign-in failures and strips token-shaped text', async () => {
    const failing = identity(async () => {
      throw new Error('Something broke ya29.SECRET-TOKEN_value here');
    });
    const error = await getGmailToken(failing, true).catch((caught: GmailError) => caught);
    expect(error).toMatchObject({ kind: 'auth', detail: 'Something broke [token] here' });
  });

  it('disconnect clears the cached token without needing consent', async () => {
    const api = identity(async (details) => {
      expect(details.interactive).toBe(false);
      return { token: 'cached' };
    });
    await disconnectGmail(api);
    expect(api.removed).toEqual(['cached']);
    expect(api.cleared).toBe(1);
  });


  it('detects whether this build has an OAuth client', () => {
    expect(isGmailConfigured({})).toBe(false);
    expect(isGmailConfigured({ oauth2: { client_id: 'x.apps.googleusercontent.com' } })).toBe(true);
  });
});
