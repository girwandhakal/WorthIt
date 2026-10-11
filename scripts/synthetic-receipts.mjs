// Prints the fictional receipt emails for the hackathon walkthrough, with order
// dates relative to today. It sends nothing: paste each one into a new Gmail
// message addressed to yourself, or pass --to to print a Gmail compose link per
// receipt (address, subject, and body prefilled; you still click Send). Add
// --open to launch the links in your default browser.
// Template: docs/SYNTHETIC_RECEIPTS.md
//
//   node scripts/synthetic-receipts.mjs
//   node scripts/synthetic-receipts.mjs --to you@gmail.com [--open]

import { execFile } from 'node:child_process';

const MARKER = '[Worth It Test Receipt]';
const args = process.argv.slice(2);
const toIndex = args.indexOf('--to');
const recipient = toIndex >= 0 ? args[toIndex + 1] : null;
if (toIndex >= 0 && !recipient?.includes('@')) {
  console.error('Usage: node scripts/synthetic-receipts.mjs --to you@gmail.com [--open]');
  process.exit(1);
}
const shouldOpen = args.includes('--open');
// --only 2,3 limits the output to those receipts (1-based), e.g. to resend failed ones.
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? '').split(',').map(Number)) : null;
if (only && ![...only].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) {
  console.error('Usage: --only 2,3 (receipt numbers 1 to 5)');
  process.exit(1);
}
let opened = 0;
const composeUrl = (to, subject, body) =>
  `https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', authuser: to, to, su: subject, body })}`;
const openInBrowser = (url) => {
  // Staggered so Gmail isn't asked to load every composer at once.
  setTimeout(() => {
    if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')]);
    else execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
  }, opened++ * 5000);
};

const receipts = [
  {
    order: 'WI-TEST-0001',
    daysAgo: 20,
    status: 'Delivered',
    items: [['18256507800', 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz', 1, '$24.97', 'Delivered']],
  },
  {
    order: 'WI-TEST-0002',
    daysAgo: 10,
    status: 'Delivered',
    items: [
      ['10309701', 'Horizon Organic Vitamin D Whole Milk, 64 fl oz', 1, '$5.96', 'Delivered'],
      ['47088920', 'Kraft Natural Mild Cheddar Finely Shredded Cheese, 8 oz', 1, '$2.98', 'Delivered'],
      ['145051970', 'Great Value Large White Eggs, 12 Count', 1, '$1.67', 'Delivered'],
    ],
  },
  {
    order: 'WI-TEST-0003',
    daysAgo: 7,
    status: 'Delivered',
    items: [['656700117', 'Skittles Original Fruity Candy, Sharing Size, 15.6 oz', 1, '$4.97', 'Delivered']],
  },
  {
    order: 'WI-TEST-0004',
    daysAgo: 45,
    status: 'Returned',
    items: [['697314670', "Hanes Men's Value Pack Crew T-Shirts, 6 pk", 1, '$23.98', 'Returned']],
  },
  {
    order: 'WI-TEST-0005',
    daysAgo: 30,
    status: 'Canceled',
    items: [['18110413708', 'Monster 16.4 ft LED Strip Lights', 1, '$14.88', 'Canceled']],
  },
];

const isoDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

for (const [index, receipt] of receipts.entries()) {
  if (only && !only.has(index + 1)) continue;
  const lines = [
    'WORTH IT TEST RECEIPT (synthetic, fictional)',
    'Merchant: Walmart',
    `Order number: ${receipt.order}`,
    `Order date: ${isoDaysAgo(receipt.daysAgo)}`,
    `Order status: ${receipt.status}`,
    '',
    'Item ID | Item | Qty | Price | Status',
    ...receipt.items.map((item) => item.join(' | ')),
  ];
  const subject = `${MARKER} Walmart order ${receipt.order}`;
  if (recipient) {
    const url = composeUrl(recipient, subject, lines.join('\n'));
    console.log(`${subject}\n${url}\n`);
    if (shouldOpen) openInBrowser(url);
    continue;
  }
  console.log('='.repeat(72));
  console.log('To:      (your own Gmail address)');
  console.log(`Subject: ${subject}`);
  console.log('-'.repeat(72));
  console.log(lines.join('\n'));
  console.log('');
}
if (!recipient) console.log('='.repeat(72));
console.log(
  recipient
    ? `${only ? only.size : receipts.length} compose links. Click Send on each, then use Worth It settings > Import from Gmail.`
    : `${receipts.length} emails. Send each to yourself, then use Worth It settings > Import from Gmail.`,
);
