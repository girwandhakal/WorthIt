import type { GmailMessage, GmailPart } from '../../src/ingestion/gmail/parse-message';
import { readFixture } from './fixtures';

/**
 * Converts a fictional .eml fixture into the Gmail API `format=full` message
 * shape (base64url bodies, nested parts), so parser tests and the e2e Gmail
 * stub exercise the same input the real API returns.
 */
export function emlToGmailMessage(eml: string, id: string, internalDate = '1790000000000'): GmailMessage {
  return { id, internalDate, payload: parsePart(eml.replace(/\r\n/g, '\n')) };
}

export function loadEmail(file: string, id = file.replace(/\W+/g, '-'), internalDate?: string): GmailMessage {
  return emlToGmailMessage(readFixture('email', file), id, internalDate);
}

function parsePart(raw: string): GmailPart {
  const split = raw.indexOf('\n\n');
  const headerText = split >= 0 ? raw.slice(0, split) : raw;
  const body = split >= 0 ? raw.slice(split + 2) : '';
  const headers = headerText
    .replace(/\n[ \t]+/g, ' ')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':');
      return { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
    });
  const contentType = headers.find((h) => h.name.toLowerCase() === 'content-type')?.value ?? 'text/plain';
  const disposition = headers.find((h) => h.name.toLowerCase() === 'content-disposition')?.value ?? '';
  const mimeType = contentType.split(';')[0]!.trim().toLowerCase();
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? '';

  if (mimeType.startsWith('multipart/')) {
    const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
    const parts = boundary
      ? body
          .split(`--${boundary}`)
          .slice(1)
          .filter((chunk) => !chunk.startsWith('--'))
          .map((chunk) => parsePart(chunk.replace(/^\n/, '')))
      : [];
    return { mimeType, filename: '', headers, body: { size: 0 }, parts };
  }

  if (filename) {
    return { mimeType, filename, headers, body: { size: body.length, attachmentId: `att-${filename}` } };
  }
  return { mimeType, filename: '', headers, body: { size: body.length, data: toBase64Url(body.trimEnd()) } };
}

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
