import { daysAgo, expect, retailerClicks, retailerMarkup, seedHistory, serveWalmart, setPreferences, storedPurchase, test } from './extension';

test('mixed cart: concerns appear, the tumbler question updates the advice, and the cart is untouched', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await setPreferences(serviceWorker, {});
  await seedHistory(context, extensionId, [
    storedPurchase({ title: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz', purchasedOn: daysAgo(20), retailerItemId: '18256507800' }),
  ]);
  await serveWalmart(context, { '/cart': 'cart-mixed.html' });
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  const before = await retailerMarkup(page);

  const panel = page.getByRole('region', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  const cards = panel.locator('.wi-finding');
  await expect(cards.first()).toContainText('Stanley Quencher');
  await expect(cards.first()).toContainText('You bought this 20 days ago.');
  await expect(panel.getByText(/This has added sugar\. Too much added sugar over time/)).toBeVisible();
  await expect(panel.getByText(/Great Value Organic Whole Vitamin D Milk, 64 fl oz has similar ingredients and costs about \$1\.99 less/)).toBeVisible();

  // Evidence stays behind "Why?".
  await expect(panel.getByText('Share of your cart')).toHaveCount(0);
  await cards.first().getByRole('button', { name: 'Why?' }).click();
  await expect(cards.first().getByText('Share of your cart')).toBeVisible();

  await cards.first().getByRole('button', { name: 'Replacing a worn one' }).click();
  await expect(panel.getByText(/Ozark Trail Insulated Tumbler with Handle, 30 oz costs about \$12\.00 less/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Replacing a worn one' })).toHaveCount(0);

  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('a store-brand-only staples cart stays collapsed', async ({ context, serviceWorker }) => {
  await setPreferences(serviceWorker, {});
  await serveWalmart(context, { '/cart': 'cart-normal.html' });
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  await expect(page.getByRole('button', { name: 'Worth It: Reviewed 3 items. Open review' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Worth It' })).toHaveCount(0);
});
