import { GmailError } from './oauth';
import { SYNTHETIC_SUBJECT_MARKER, parseGmailMessage, type GmailMessage, type ParseOutcome } from './parse-message';

export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const WALMART_SENDERS = ['help@walmart.com', 'noreply@walmart.com', 'no-reply@walmart.com', 'orders@walmart.com'];
const MAX_MESSAGES = 50;

export interface SearchOptions {
  /** Inclusive start of the shopper-chosen date range. */
  after: Date;
  /** Exclusive end (usually tomorrow). */
  before: Date;
  includeSynthetic: boolean;
  includeWalmart: boolean;
}

export type FetchLike = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const gmailDate = (date: Date) =>
  `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

/** Builds the bounded Gmail search: only likely receipts, only in the chosen range. */
export function buildGmailQuery(options: SearchOptions): string | null {
  const groups: string[] = [];
  if (options.includeSynthetic) groups.push(`(subject:"${SYNTHETIC_SUBJECT_MARKER}" from:me)`);
  if (options.includeWalmart) groups.push(`(from:(${WALMART_SENDERS.join(' OR ')}) subject:order)`);
  if (groups.length === 0) return null;
  const which = groups.length === 1 ? groups[0] : `{${groups.join(' ')}}`;
  return `${which} after:${gmailDate(options.after)} before:${gmailDate(options.before)}`;
}

async function gmailGet(fetchFn: FetchLike, token: string, url: string): Promise<unknown> {
  let response;
  try {
    response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new GmailError('network', 'Could not reach Gmail. Check your connection and try again.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new GmailError('auth', 'Gmail rejected the request. Disconnect and connect Gmail again.');
  }
  if (!response.ok) throw new GmailError('api', `Gmail returned an error (${response.status}).`);
  return response.json();
}

/** `users.messages.list` with pagination, capped at `max` message IDs. */
export async function listMessageIds(fetchFn: FetchLike, token: string, query: string, max = MAX_MESSAGES): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(25, max - ids.length)) });
    if (pageToken) params.set('pageToken', pageToken);
    const page = (await gmailGet(fetchFn, token, `${GMAIL_API}/messages?${params}`)) as {
      messages?: { id?: unknown }[];
      nextPageToken?: unknown;
    };
    for (const message of page.messages ?? []) {
      if (typeof message.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(message.id)) ids.push(message.id);
    }
    pageToken = typeof page.nextPageToken === 'string' ? page.nextPageToken : undefined;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

async function fetchMessage(fetchFn: FetchLike, token: string, id: string): Promise<GmailMessage> {
  const message = (await gmailGet(fetchFn, token, `${GMAIL_API}/messages/${encodeURIComponent(id)}?format=full`)) as GmailMessage;
  return { id, internalDate: message.internalDate, payload: message.payload };
}

export interface SearchResult {
  query: string;
  messagesScanned: number;
  outcomes: ParseOutcome[];
}

/**
 * Searches, fetches, and parses candidate messages one at a time. Each raw
 * message goes out of scope right after parsing; only parse outcomes return.
 */
export async function searchAndParseReceipts(fetchFn: FetchLike, token: string, options: SearchOptions): Promise<SearchResult> {
  const query = buildGmailQuery(options);
  if (!query) return { query: '', messagesScanned: 0, outcomes: [] };
  const ids = await listMessageIds(fetchFn, token, query);
  const outcomes: ParseOutcome[] = [];
  for (const id of ids) {
    outcomes.push(parseGmailMessage(await fetchMessage(fetchFn, token, id)));
  }
  return { query, messagesScanned: ids.length, outcomes };
}
