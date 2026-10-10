import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseGmailMessage } from '../../src/ingestion/gmail/parse-message';

const toBase64Url = (text: string) => Buffer.from(text, 'utf8').toString('base64url');

/** Gmail's web composer sends each typed line as its own <div>. */
const asComposerHtml = (body: string) =>
  `<div dir="ltr">${body
    .split('\n')
    .map((line) => (line ? `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>` : '<div><br></div>'))
    .join('')}</div>`;

/** Simulates a client that hard-wraps plain text at 76 characters. */
const hardWrap = (body: string) =>
  body
    .split('\n')
    .flatMap((line) => (line.length > 76 ? [line.slice(0, 76), line.slice(76)] : [line]))
    .join('\n');

describe('scripts/synthetic-receipts.mjs', () => {
  const output = execFileSync(process.execPath, ['scripts/synthetic-receipts.mjs'], { encoding: 'utf8' });
  const emails = output
    .split(/^=+$/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('To:'))
    .map((chunk) => {
      const subject = /^Subject: (.+)$/m.exec(chunk)![1]!;
      const body = chunk.split(/^-+$/m)[1]!.trim();
      return { subject, body };
    });

  it('prints five receipts that follow the documented template', () => {
    expect(emails).toHaveLength(5);
    expect(emails.every((email) => email.subject.startsWith('[Worth It Test Receipt] Walmart order WI-TEST-'))).toBe(true);
  });

  it('parses as sent from Gmail (HTML + hard-wrapped plain text), with the tumbler dated 20 days ago', () => {
    const outcomes = emails.map((email, index) =>
      parseGmailMessage({
        id: `s${index}`,
        payload: {
          mimeType: 'multipart/alternative',
          headers: [{ name: 'Subject', value: email.subject }],
          parts: [
            { mimeType: 'text/plain', body: { data: toBase64Url(hardWrap(email.body)) } },
            { mimeType: 'text/html', body: { data: toBase64Url(asComposerHtml(email.body)) } },
          ],
        },
      }),
    );
    expect(outcomes.every((outcome) => outcome.kind === 'parsed')).toBe(true);
    const first = outcomes[0]!;
    if (first.kind !== 'parsed') throw new Error('unreachable');
    expect(first.receipt.items[0]).toMatchObject({ title: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz', linePriceCents: 2497 });
    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 20);
    expect(first.receipt.orderDate).toBe(
      `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`,
    );
    const statuses = outcomes.flatMap((outcome) => (outcome.kind === 'parsed' ? outcome.receipt.items.map((item) => item.status) : []));
    expect(statuses).toEqual(['purchased', 'purchased', 'purchased', 'purchased', 'purchased', 'returned', 'canceled']);
  });
});
