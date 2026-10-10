// Prints the fictional receipt emails for the hackathon walkthrough, with order
// dates relative to today. It sends nothing: paste each one into a new Gmail
// message addressed to yourself. Template: docs/SYNTHETIC_RECEIPTS.md
//
//   node scripts/synthetic-receipts.mjs

const MARKER = '[Worth It Test Receipt]';

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

for (const receipt of receipts) {
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
  console.log('='.repeat(72));
  console.log('To:      (your own Gmail address)');
  console.log(`Subject: ${MARKER} Walmart order ${receipt.order}`);
  console.log('-'.repeat(72));
  console.log(lines.join('\n'));
  console.log('');
}
console.log('='.repeat(72));
console.log(`${receipts.length} emails. Send each to yourself, then use Worth It settings > Import from Gmail.`);
