import { reversalStatus, type PurchaseStatus } from '../../domain/history';
import { ITEM_ID_PATTERN } from '../../domain/schemas';
import { parsePriceToCents } from '../../shared/currency';
import { localIsoDate, toIsoDate } from '../../shared/dates';

/**
 * Local receipt parsing. Runs entirely in the extension; message content is
 * read into memory, reduced to order fields, and then dropped. The result
 * never contains the email body, headers other than the subject line for
 * error reporting, or attachments.
 */

export const SYNTHETIC_SUBJECT_MARKER = '[Worth It Test Receipt]';
const MAX_BODY_CHARS = 200_000;
const MAX_ITEMS = 100;

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

/** Shape of `users.messages.get?format=full` that the parser reads. */
export interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: GmailPart;
}

export interface ParsedItem {
  title: string;
  retailerItemId: string | null;
  quantity: number | null;
  linePriceCents: number | null;
  status: PurchaseStatus;
}

export interface ParsedReceipt {
  messageId: string;
  synthetic: boolean;
  merchant: string;
  orderId: string | null;
  orderDate: string;
  items: ParsedItem[];
}

export type ParseOutcome =
  | { kind: 'parsed'; receipt: ParsedReceipt }
  | { kind: 'unparsed'; messageId: string; subject: string; reason: string };

export function parseGmailMessage(message: GmailMessage): ParseOutcome {
  const headers = message.payload?.headers ?? [];
  const subject = cleanLine(header(headers, 'Subject') ?? '').slice(0, 200);
  const from = header(headers, 'From') ?? '';
  const fallbackDate = dateFromInternal(message.internalDate);
  const { text, html } = collectBodies(message.payload);
  const body = text ?? (html ? htmlToText(html) : null);
  const unparsed = (reason: string): ParseOutcome => ({ kind: 'unparsed', messageId: message.id, subject, reason });

  const parsed = (receipt: ParsedReceipt): ParseOutcome => ({ kind: 'parsed', receipt });

  if (!body) return unparsed('No readable text in this message.');

  if (subject.startsWith(SYNTHETIC_SUBJECT_MARKER)) {
    // Prefer the HTML part: mail clients may hard-wrap long plain-text lines,
    // splitting an item row, while HTML keeps each line intact.
    const receipt =
      (html ? parseTemplate(htmlToText(html), message.id, fallbackDate, true) : null) ??
      (text ? parseTemplate(text, message.id, fallbackDate, true) : null);
    return receipt ? parsed(receipt) : unparsed('Synthetic receipt did not match the documented template.');
  }

  if (/walmart\.com/i.test(from)) {
    const receipt = parseWalmartEmail(body, subject, message.id, fallbackDate);
    return receipt ? parsed(receipt) : unparsed('No item lines with a quantity and price were found.');
  }

  return unparsed('Not a supported receipt.');
}

// ---------------------------------------------------------------------------
// Synthetic template (docs/SYNTHETIC_RECEIPTS.md)

const TEMPLATE_COLUMNS = { 'item id': 'id', item: 'title', qty: 'qty', price: 'price', status: 'status' } as const;
type TemplateColumn = (typeof TEMPLATE_COLUMNS)[keyof typeof TEMPLATE_COLUMNS];

function parseTemplate(body: string, messageId: string, fallbackDate: string, synthetic: boolean): ParsedReceipt | null {
  const lines = body.split(/\r?\n/).map(cleanLine);
  const field = (label: string) => {
    const pattern = new RegExp(`^${label}:\\s*(.+)$`, 'i');
    for (const line of lines) {
      const match = pattern.exec(line);
      if (match?.[1]) return match[1].trim();
    }
    return null;
  };

  const merchant = field('Merchant');
  if (!merchant) return null;
  const defaultStatus = toStatus(field('Order status'));

  const headerIndex = lines.findIndex((line) => {
    const cells = splitRow(line).map((cell) => cell.toLowerCase());
    return cells.includes('item') && cells.length >= 2 && cells.every((cell) => cell in TEMPLATE_COLUMNS);
  });
  if (headerIndex < 0) return null;
  const columns = splitRow(lines[headerIndex]!).map((cell) => TEMPLATE_COLUMNS[cell.toLowerCase() as keyof typeof TEMPLATE_COLUMNS]);

  const items: ParsedItem[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.includes('|')) continue;
    const cells = splitRow(line, columns.length);
    const get = (column: TemplateColumn) => {
      const index = columns.indexOf(column);
      return index >= 0 ? (cells[index] ?? '').trim() : '';
    };
    const title = get('title');
    if (!title) continue;
    items.push({
      title: title.slice(0, 300),
      retailerItemId: ITEM_ID_PATTERN.test(get('id')) ? get('id') : null,
      quantity: toQuantity(get('qty')),
      linePriceCents: parsePriceToCents(get('price')),
      status: get('status') ? toStatus(get('status')) : defaultStatus,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  if (items.length === 0) return null;

  return {
    messageId,
    synthetic,
    merchant: merchant.slice(0, 80),
    orderId: field('Order number')?.slice(0, 80) ?? null,
    orderDate: toIsoDate(field('Order date')) ?? fallbackDate,
    items,
  };
}

/**
 * Splits a pipe row. Leading/trailing pipes (markdown or HTML-derived rows)
 * are dropped only when the row has more cells than the header, so a genuinely
 * empty first or last cell keeps the columns aligned.
 */
function splitRow(line: string, expected?: number): string[] {
  const cells = line.split('|').map((cell) => cell.trim());
  if (expected === undefined) return cells.filter((cell, index) => cell !== '' || (index > 0 && index < cells.length - 1));
  if (cells.length > expected && cells.at(-1) === '') cells.pop();
  if (cells.length > expected && cells[0] === '') cells.shift();
  return cells;
}

// ---------------------------------------------------------------------------
// Best-effort Walmart order email

function parseWalmartEmail(body: string, subject: string, messageId: string, fallbackDate: string): ParsedReceipt | null {
  const lines = body
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0);
  const subjectStatus = reversalStatus(subject) ?? 'purchased';

  const orderId = /order\s*(?:number|#|no\.?)?[:#\s]*([0-9]{7,}-[0-9]{4,}|[0-9]{10,})/i.exec(`${subject}\n${body}`)?.[1] ?? null;
  const dateLine = lines.find((line) => /^(order date|ordered on|placed on)\b/i.test(line));
  const orderDate = toIsoDate(dateLine?.replace(/^(order date|ordered on|placed on):?\s*/i, '') ?? null) ?? fallbackDate;

  const items: ParsedItem[] = [];
  lines.forEach((line, index) => {
    const qty = /^(?:qty|quantity):?\s*(\d{1,3})\b(.*)$/i.exec(line);
    if (!qty) return;
    const title = [...lines.slice(Math.max(0, index - 3), index)]
      .reverse()
      .find((candidate) => !candidate.includes('$') && !/^(qty|quantity|order|item|items)\b/i.test(candidate) && candidate.length > 3);
    if (!title) return;
    const priceText = qty[2]?.includes('$') ? qty[2] : lines.slice(index + 1, index + 3).find((candidate) => candidate.includes('$'));
    items.push({
      title: title.slice(0, 300),
      retailerItemId: null,
      quantity: toQuantity(qty[1] ?? ''),
      linePriceCents: parsePriceToCents(priceText ?? null),
      status: subjectStatus,
    });
  });
  if (items.length === 0) return null;
  return { messageId, synthetic: false, merchant: 'Walmart', orderId, orderDate, items: items.slice(0, MAX_ITEMS) };
}

// ---------------------------------------------------------------------------
// Helpers

function header(headers: GmailHeader[], name: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function collectBodies(part: GmailPart | undefined): { text: string | null; html: string | null } {
  let text: string | null = null;
  let html: string | null = null;
  const visit = (node: GmailPart | undefined) => {
    if (!node) return;
    // Attachments are never read.
    if (node.filename || node.body?.attachmentId) return;
    const data = node.body?.data;
    if (data && node.mimeType === 'text/plain' && text === null) text = decodeBase64Url(data);
    if (data && node.mimeType === 'text/html' && html === null) html = decodeBase64Url(data);
    node.parts?.forEach(visit);
  };
  visit(part);
  return { text, html };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes).slice(0, MAX_BODY_CHARS);
}

/**
 * Converts receipt HTML to text without a DOM (works in the service worker)
 * and without executing anything: drops script/style, turns table cells into
 * pipe-separated rows, strips tags, and decodes common entities.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .slice(0, MAX_BODY_CHARS)
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, '')
      // Source formatting whitespace is insignificant in HTML; rows break only at tags below.
      .replace(/\s+/g, ' ')
      .replace(/<\/t[hd]\s*>/gi, ' | ')
      .replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d)\b[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower in named) return named[lower]!;
    if (lower.startsWith('#x')) return safeCodePoint(parseInt(lower.slice(2), 16), entity);
    if (lower.startsWith('#')) return safeCodePoint(parseInt(lower.slice(1), 10), entity);
    return entity;
  });
}

function safeCodePoint(code: number, fallback: string): string {
  return Number.isInteger(code) && code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : fallback;
}

function cleanLine(line: string): string {
  // Strip control characters and collapse whitespace; content stays plain text.
  // eslint-disable-next-line no-control-regex
  return line.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toQuantity(value: string): number | null {
  if (!/^\d{1,3}$/.test(value.trim())) return null;
  const quantity = Number(value);
  return quantity >= 1 && quantity <= 999 ? quantity : null;
}

function toStatus(value: string | null): PurchaseStatus {
  if (!value) return 'purchased';
  return reversalStatus(value) ?? (/deliver|purchas|shipped|placed|picked up|complete/i.test(value) ? 'purchased' : 'unknown');
}

function dateFromInternal(internalDate: string | undefined): string {
  const ms = Number(internalDate);
  const date = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date();
  return localIsoDate(date);
}
