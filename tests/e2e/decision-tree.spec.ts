import type { PageSpec } from '../helpers/product-page';
import { PAGES } from '../helpers/product-page';
import { expect, retailerClicks, retailerMarkup, serveWalmart, test } from './extension';

/**
 * The decision tree in the real extension: every cart item's own product page
 * is read (served here as fixtures), and the panel shows only what the tree
 * finds. None of these IDs is in the reviewed reference list.
 */
const products: PageSpec[] = [
  { ...PAGES.milk, id: '90000001' },
  { ...PAGES.bananas, id: '90000002' },
  { ...PAGES.skittles, id: '90000003' },
  { ...PAGES.dietCoke, id: '90000004' },
  { ...PAGES.hotDog, id: '90000005' },
  { ...PAGES.plush, id: '90000006' },
  { ...PAGES.paperTowels, id: '90000007' },
];

test('reads product pages and shows the decision tree result: whole foods quiet, the rest explained with sources', async ({ context }) => {
  const requested = await serveWalmart(context, { '/cart': 'cart-decision-tree.html' }, products);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  const before = await retailerMarkup(page);
  const panel = page.getByRole('region', { name: 'Worth It' });

  await expect(panel.getByText('Before you check out, 3 things are worth a second thought.')).toBeVisible();
  const highlights = panel.getByRole('list', { name: 'Worth a second thought' }).getByRole('listitem');
  await expect(highlights).toHaveCount(3);

  // Non-food novelty item: "probably not worth it".
  await expect(
    panel.getByText('This looks like a novelty item with no practical use, so it’s probably not worth it. Consider skipping it to take $3.97 off your cart.'),
  ).toBeVisible();
  // Added sugar keeps its approved wording.
  await expect(panel.getByText(/^This has added sugar\. Too much added sugar over time can contribute to health problems/)).toBeVisible();
  // Cured, processed meat: the third highlight (same kind of finding ranks by dollar amount).
  const meat = highlights.filter({ hasText: 'cured, processed meat' });
  await expect(meat.getByText(/\(it lists sodium nitrite\)\. The WHO’s cancer agency \(IARC\) classifies processed meat as carcinogenic to humans/)).toBeVisible();

  // Whole foods and plain household goods are never mentioned.
  for (const quiet of ['Horizon Organic', 'Fresh Banana', 'Bounty Essentials']) await expect(panel.getByText(quiet)).toHaveCount(0);

  // Evidence and its citation are one tap away, with a real link.
  await meat.getByRole('button', { name: 'Why?' }).click();
  await expect(meat.getByText('Cured, processed meat').first()).toBeVisible();
  await expect(meat.getByRole('link', { name: /WHO \/ IARC: cancer risk of red meat and processed meat/ })).toHaveAttribute('href', /who\.int/);

  // The fourth finding (Diet Coke) is grouped, not highlighted: the sweetener is named and the WHO claim kept calibrated.
  await panel.getByRole('button', { name: /^You also had 1 other item/ }).click();
  const soda = panel.getByRole('listitem').filter({ hasText: 'aspartame' });
  await expect(soda.getByText(/^This has aspartame, a non-sugar sweetener\. The WHO advises against using these to control weight/)).toBeVisible();
  await soda.getByRole('button', { name: 'Why?' }).click();
  await expect(soda.getByRole('link', { name: /WHO: guideline on non-sugar sweeteners/ })).toHaveAttribute('href', /who\.int/);

  // Full analysis lists every item, including the quiet ones, with the new check.
  await panel.getByRole('button', { name: 'See full analysis' }).click();
  await expect(panel.getByRole('table')).toHaveCount(7);
  await expect(panel.getByRole('row', { name: /Ingredients and nutrition \(label\)/ }).first()).toBeVisible();
  await expect(panel.getByRole('link', { name: 'The product’s own Walmart.com page (ingredients, Nutrition Facts, category)' }).first()).toHaveAttribute(
    'href',
    /^https:\/\/www\.walmart\.com\/ip\/9000000\d$/,
  );

  // Exactly one read of each cart item's own page; nothing else, and nothing clicked or changed.
  expect([...new Set(requested)].sort()).toEqual(products.map((product) => product.id).sort());
  expect(requested).toHaveLength(7);
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('when product pages cannot be read, Worth It says nothing it cannot support', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-decision-tree.html' }, []); // every product page is a 404
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  await expect(page.getByRole('button', { name: 'Worth It: Reviewed 7 items. Open review' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Worth It' })).toHaveCount(0);
});
