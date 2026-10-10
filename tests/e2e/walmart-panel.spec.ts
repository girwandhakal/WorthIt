import { expect, retailerClicks, retailerMarkup, serveWalmart, test } from './extension';

test.describe('Walmart cart panel', () => {
  test('a readable cart with no findings shows only the collapsed indicator', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-normal.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/cart');
    const indicator = page.getByRole('button', { name: 'Worth It: Reviewed 3 items. Open review' });
    await expect(indicator).toBeVisible();
    const diagnosticText = await page.locator('html').getAttribute('data-worth-it-debug');
    expect(JSON.parse(diagnosticText!)).toMatchObject({ started: true, merchant: 'walmart', route: 'cart',
      panel: 'mounted', background: 'ok', review: 'delivered', extractedItems: 3, readableItems: 3, error: 'none' });
    expect(JSON.parse(diagnosticText!).build).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(diagnosticText).not.toContain('Great Value');
    await expect(page.getByRole('region', { name: 'Worth It' })).toHaveCount(0);

    await indicator.click();
    await expect(page.getByRole('region', { name: 'Worth It' })).toBeVisible();
    await expect(page.getByText('Nothing here needs a second look.')).toBeVisible();
  });

  test('reports unreadable items, closes on Continue, and stays closed on rerender and reload', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-missing-data.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.walmart.com/cart');
    const panel = page.getByRole('region', { name: 'Worth It' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Also:/ }).click();
    await expect(panel.getByText("Couldn't read this item's price reliably", { exact: false }).first()).toBeVisible();
    await expect(panel.getByText("Couldn't read this item's name reliably", { exact: false })).toBeVisible();

    const before = await retailerMarkup(page);
    await panel.getByRole('button', { name: 'Continue' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reviewed 5 items/ })).toBeFocused();
    expect(await retailerMarkup(page)).toBe(before);

    // A single-page-app rerender of the same cart does not reopen the panel.
    await page.evaluate(() => {
      const main = document.querySelector('main')!;
      main.replaceWith(main.cloneNode(true));
    });
    await page.waitForTimeout(1200);
    await expect(panel).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('button', { name: /Reviewed 5 items/ })).toBeVisible();
    await expect(panel).toHaveCount(0);
  });

  test('reopens on its own only when a new finding appears', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-missing-data.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.walmart.com/cart');
    const panel = page.getByRole('region', { name: 'Worth It' });
    await panel.getByRole('button', { name: 'Dismiss Worth It panel' }).click();
    await expect(panel).toHaveCount(0);

    // Barilla's price becomes unreadable: a new finding.
    await page.evaluate(() => {
      document.querySelector('[data-testid="line-price"]')!.textContent = 'Price unavailable';
    });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Also:/ }).click();
    await expect(panel.getByText('Barilla Classic Spaghetti Pasta, 16 oz')).toBeVisible();
  });

  test('Escape closes the panel and nothing on the page is clicked', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-normal.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/cart');
    const before = await retailerMarkup(page);
    const indicator = page.getByRole('button', { name: /Reviewed 3 items/ });
    await indicator.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Worth It' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Worth It' })).toHaveCount(0);
    expect(await retailerClicks(page)).toBe(0);
    expect(await retailerMarkup(page)).toBe(before);
  });

  test('never appears on checkout pages', async ({ context }) => {
    await serveWalmart(context, { '/checkout': 'checkout.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/checkout');
    await page.waitForTimeout(1500);
    await expect(page.locator('worth-it-panel')).toHaveCount(0);
  });

  test('activates after client-side navigation to the cart and leaves on navigation away', async ({ context }) => {
    await serveWalmart(context, { '*': 'home-spa.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/');
    await page.waitForTimeout(800);
    await expect(page.locator('worth-it-panel')).toHaveCount(0);

    await page.click('#go-cart');
    await expect(page).toHaveURL('https://www.walmart.com/cart');
    const panel = page.getByRole('region', { name: 'Worth It' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Mystery Item').first()).toBeVisible();

    await page.click('#go-checkout');
    await expect(page.locator('worth-it-panel')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('worth-it-panel')).toHaveCount(1);
  });

  test('respects reduced motion', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-missing-data.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.walmart.com/cart');
    const panel = page.locator('worth-it-panel').locator('.wi-panel');
    await expect(panel).toBeVisible();
    const duration = await panel.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });
});

test('a cart layout Worth It cannot read is reported, not guessed', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-unrecognized.html' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  const panel = page.getByRole('region', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Walmart shows 3 items in your cart, but Worth It couldn't read any of them/)).toBeVisible();
  await expect(panel.getByText(/would save/)).toHaveCount(0);
});

test('live walmart.com markup: reviews the 2 cart lines, not the recommendation carousel', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-live-2026-10.html' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  const before = await retailerMarkup(page);
  const panel = page.getByRole('region', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'See full analysis' }).click();
  await expect(panel.getByRole('table')).toHaveCount(2);
  await expect(panel.getByText('Great Value Large White Eggs, 12 Count')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Continue' }).click();
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('grouped Walmart tile: reviews cheese and milk independently with known prices and purpose', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-cheese-2026-10.html' });
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  const before = await retailerMarkup(page);
  const panel = page.getByRole('region', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'See full analysis' }).click();
  await expect(panel.getByRole('table')).toHaveCount(2);
  const cheese = panel.locator('.wi-full-item').filter({ hasText: 'Kraft Natural Mild Cheddar Shredded Cheese, 16 oz Bag' });
  await expect(cheese.locator('.wi-full-facts').getByText('$5.64', { exact: true })).toHaveCount(2);
  await expect(cheese.getByText('Essential (consumable)', { exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Cart totals' }).getByText('$11.60', { exact: true })).toBeVisible();
  await expect(panel.getByText('Unknown (a price wasn’t readable)', { exact: true })).toHaveCount(0);
  const report = JSON.parse((await page.locator('html').getAttribute('data-worth-it-debug'))!);
  expect(report).toMatchObject({ extractedItems: 2, readableItems: 2, displayedItems: 2, review: 'delivered' });
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});
