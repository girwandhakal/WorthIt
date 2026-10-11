import { checkoutButton, clickCheckout, daysAgo, debugReport, expect, expectNothingShown, retailerClicks, retailerMarkup, seedHistory, serveAmazon, setPreferences, storedPurchase, test, openExtensionPage, waitForReview } from './extension';

test.describe('Amazon', () => {
  test('cart without reviewed data: nothing shown, nothing guessed, cart untouched', async ({ context, serviceWorker }) => {
    await setPreferences(serviceWorker, {});
    await serveAmazon(context, { '/gp/cart/view.html': 'cart.html' });
    const page = await context.newPage();
    await page.goto('https://www.amazon.com/gp/cart/view.html?ref_=nav_cart');
    await waitForReview(page);
    const before = await retailerMarkup(page);
    expect(await debugReport(page)).toMatchObject({ checkout: 'nothing-to-show', extractedItems: 3 });
    await expectNothingShown(page);
    await checkoutButton(page).click();
    await expectNothingShown(page);
    expect(await retailerClicks(page)).toBe(1);
    expect(await retailerMarkup(page)).toBe(before);
  });

  test('asks about an exact repeat from purchase history', async ({ context, extensionId, serviceWorker }) => {
    await setPreferences(serviceWorker, {});
    await seedHistory(context, extensionId, [
      { ...storedPurchase({ title: 'Owala FreeSip Insulated Stainless Steel Water Bottle, 24 oz', purchasedOn: daysAgo(12), retailerItemId: 'B0WITEST01' }), merchant: 'Amazon' },
    ]);
    await serveAmazon(context, { '/cart': 'cart.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.amazon.com/cart');
    await clickCheckout(page);
    const panel = page.getByRole('dialog', { name: 'Worth It' });
    await expect(panel.getByText('You bought this 12 days ago. A past receipt doesn’t show whether you still have it.')).toBeVisible();
    await panel.getByRole('button', { name: 'It’s an extra' }).click();
    await expect(panel.getByRole('button', { name: 'It’s an extra' })).toHaveCount(0);
  });

  test('never appears on checkout', async ({ context }) => {
    await serveAmazon(context, { '*': 'checkout.html' });
    const page = await context.newPage();
    await page.goto('https://www.amazon.com/gp/buy/spc/handlers/display.html');
    await page.waitForTimeout(1500);
    await expect(page.locator('worth-it-panel')).toHaveCount(0);
  });

  test('records reviewed order rows when opted in', async ({ context, extensionId, serviceWorker }) => {
    await setPreferences(serviceWorker, { recordPurchases: true });
    await serveAmazon(context, { '/gp/css/order-history': 'orders.html' });
    const page = await context.newPage();
    await page.goto('https://www.amazon.com/gp/css/order-history');
    const panel = page.getByRole('region', { name: 'Worth It purchase recording' });
    await panel.getByRole('button', { name: 'Record these purchases' }).click();
    await expect(panel.getByText('Wireless Earbuds')).toBeVisible();
    await expect(panel.getByText(/SENTINEL/)).toHaveCount(0);
    await panel.getByRole('button', { name: 'Save 2 purchases' }).click();
    await expect(panel.getByText('Saved 2 purchases to your Worth It history.')).toBeVisible();
    const history = await openExtensionPage(context, extensionId, 'options.html#history');
    await expect(history.getByText('Amazon · Sep 20, 2026 · Qty 1 · $27.99 · Purchased')).toBeVisible();
    await expect(history.getByText('Amazon · Aug 2, 2026 · Qty 2 · $38.00 · Returned')).toBeVisible();
  });
});
