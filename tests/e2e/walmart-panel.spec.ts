import { checkoutButton, clickCheckout, debugReport, expect, expectNothingShown, openFullAnalysis, retailerClicks, retailerMarkup, serveWalmart, test, waitForReview } from './extension';

test.describe('Walmart cart panel', () => {
  test('a readable cart with no findings shows nothing, and checkout goes straight through', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-normal.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/cart');
    await waitForReview(page);
    const diagnosticText = await page.locator('html').getAttribute('data-worth-it-debug');
    expect(JSON.parse(diagnosticText!)).toMatchObject({ started: true, merchant: 'walmart', route: 'cart',
      panel: 'mounted', background: 'ok', review: 'delivered', checkout: 'nothing-to-show', extractedItems: 3, readableItems: 3, error: 'none' });
    expect(JSON.parse(diagnosticText!).build).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(diagnosticText).not.toContain('Great Value');
    await expectNothingShown(page);

    await checkoutButton(page).click();
    await expectNothingShown(page);
    expect(await retailerClicks(page)).toBe(1);
  });

  test('fills the screen on the checkout click, with Walmart thumbnails, and returns focus on Continue', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-mixed.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.walmart.com/cart');
    await waitForReview(page);
    await expectNothingShown(page);
    await clickCheckout(page);
    const panel = page.getByRole('dialog', { name: 'Worth It' });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    const thumb = panel.locator('.wi-finding img').first();
    await expect(thumb).toHaveAttribute('src', /^https:\/\/i5\.walmartimages\.com\/seo\/Stanley/);
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(panel.getByRole('img', { name: /becomes about \$1,\d{3}\.\d{2} after 40 years/ })).toBeVisible();
    await panel.getByRole('button', { name: 'Continue' }).click();
    await expect(panel).toHaveCount(0);
    await expect(checkoutButton(page)).toBeFocused();
    expect(await retailerClicks(page)).toBe(0);
  });

  test('holds the first checkout click, closes on Continue, then lets the next clicks through', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-missing-data.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.walmart.com/cart');
    await clickCheckout(page);
    const panel = page.getByRole('dialog', { name: 'Worth It' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Also:/ }).click();
    await expect(panel.getByText("Couldn't read this item's price reliably", { exact: false }).first()).toBeVisible();
    await expect(panel.getByText("Couldn't read this item's name reliably", { exact: false })).toBeVisible();

    const before = await retailerMarkup(page);
    await panel.getByRole('button', { name: 'Continue' }).click();
    await expect(panel).toHaveCount(0);
    await expect(checkoutButton(page)).toBeFocused();
    expect(await retailerMarkup(page)).toBe(before);

    // The shopper has seen it: their next click on Checkout goes straight through to Walmart.
    await clickCheckout(page);
    await expect(panel).toHaveCount(0);
    expect(await retailerClicks(page)).toBe(1);

    // A single-page-app rerender of the same cart does not hold the click again.
    await page.evaluate(() => {
      const main = document.querySelector('main')!;
      main.replaceWith(main.cloneNode(true));
    });
    await page.waitForTimeout(1200);
    await clickCheckout(page);
    await expect(panel).toHaveCount(0);
    expect(await retailerClicks(page)).toBe(2);

    // Reloading the cart page is a new visit: the first click is held and the panel opens again.
    await page.reload();
    await clickCheckout(page);
    await expect(panel).toBeVisible();
    expect(await retailerClicks(page)).toBe(0);
    expect((await debugReport(page)).checkout).toBe('held');
  });

  test('holds the click again only when a new finding appears', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-missing-data.html' });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('https://www.walmart.com/cart');
    const panel = page.getByRole('dialog', { name: 'Worth It' });
    // Nothing pops up on its own when the cart loads, and nothing sits on the page.
    await waitForReview(page);
    await expectNothingShown(page);

    await clickCheckout(page);
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Dismiss Worth It panel' }).click();
    await expect(panel).toHaveCount(0);

    // Barilla's price becomes unreadable: a new finding. The next click is held once more.
    await page.evaluate(() => {
      document.querySelector('[data-testid="line-price"]')!.textContent = 'Price unavailable';
    });
    await page.waitForTimeout(1200);
    await clickCheckout(page);
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Also:/ }).click();
    await expect(panel.getByText('Barilla Classic Spaghetti Pasta, 16 oz')).toBeVisible();
    expect(await retailerClicks(page)).toBe(0); // both held clicks never reached the page
  });

  test('Escape does nothing while the presentation plays, then closes it without clicking the page', async ({ context }) => {
    await serveWalmart(context, { '/cart': 'cart-missing-data.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/cart');
    await waitForReview(page);
    const before = await retailerMarkup(page);
    await clickCheckout(page);
    const panel = page.getByRole('dialog', { name: 'Worth It' });
    await expect(page.getByRole('heading', { name: 'Worth It' })).toBeFocused();
    await expect(panel.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    // Once it has finished, Escape closes it like Continue does.
    await expect(panel.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
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
    const panel = page.getByRole('dialog', { name: 'Worth It' });
    await waitForReview(page);
    await expectNothingShown(page); // nothing on its own

    // The first click on Checkout is held, and the panel opens instead.
    await page.click('#go-checkout');
    await expect(page).toHaveURL('https://www.walmart.com/cart');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Mystery Item').first()).toBeVisible();

    // The overlay covers the page until the shopper closes it.
    await panel.getByRole('button', { name: 'Continue' }).click();
    await expect(panel).toHaveCount(0);
    // The next click goes through and the review leaves with the cart route.
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
    await clickCheckout(page);
    const panel = page.locator('worth-it-panel').locator('.wi-overlay');
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
  await clickCheckout(page);
  const panel = page.getByRole('dialog', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Walmart shows 3 items in your cart, but Worth It couldn't read any of them/)).toBeVisible();
  await expect(panel.getByText(/would save/)).toHaveCount(0);
});

test('live walmart.com markup: reviews the 2 cart lines, not the recommendation carousel', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-live-2026-10.html' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  await clickCheckout(page);
  const before = await retailerMarkup(page);
  const panel = page.getByRole('dialog', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'See full analysis' }).click();
  await expect(panel.locator('.wi-analysis-item')).toHaveCount(2);
  await expect(panel.getByText('Great Value Large White Eggs, 12 Count')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Continue' }).click();
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('grouped Walmart tile: reviews cheese and milk independently with known prices and purpose', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-cheese-2026-10.html' });
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  await clickCheckout(page);
  const before = await retailerMarkup(page);
  const panel = page.getByRole('dialog', { name: 'Worth It' });
  await expect(panel).toBeVisible();
  const details = await openFullAnalysis(page, panel);
  await expect(panel.locator('.wi-analysis-item')).toHaveCount(2);
  // The details Worth It keeps for debugging: both prices read, so the cart total is known.
  const cheese = details.items.find((item) => item.itemName.startsWith('Kraft Natural Mild Cheddar Shredded Cheese, 16 oz Bag'))!;
  expect(cheese).toMatchObject({ linePriceCents: 564, purposeClass: 'essential_consumable' });
  expect(details.readableTotalCents).toBe(1160);
  await expect(panel.getByText(/You could keep/)).toBeVisible();
  const report = JSON.parse((await page.locator('html').getAttribute('data-worth-it-debug'))!);
  expect(report).toMatchObject({ extractedItems: 2, readableItems: 2, displayedItems: 2, review: 'delivered' });
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('three reviewed products: donut label finding, staple swaps, and correct source links', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-three-reviewed-2026-10.html' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  await clickCheckout(page);
  const before = await retailerMarkup(page);
  const panel = page.getByRole('dialog', { name: 'Worth It' });
  const details = await openFullAnalysis(page, panel);
  await expect(panel.locator('.wi-analysis-item')).toHaveCount(3);
  expect(details.readableTotalCents).toBe(1428);
  const donuts = panel.locator('.wi-analysis-item').filter({ hasText: 'Hostess Donettes Frightfully Frosted Mini Donuts' });
  await expect(donuts.getByText('Could save $2.68', { exact: true })).toBeVisible();
  await expect(donuts.getByRole('link', { name: 'CDC: Get the Facts: Added Sugars' })).toHaveAttribute('href', 'https://www.cdc.gov/nutrition/php/data-research/added-sugars.html');
  await expect(panel.getByText(/You could keep/)).toContainText('$6.37');
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('the checkout click is held even while product pages are still loading', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-mixed.html' });
  // Every product page takes 6 seconds to answer, far longer than this test waits for the first review.
  const slow = new Promise<void>((resolve) => setTimeout(resolve, 6000));
  await context.route('https://www.walmart.com/ip/**', async (route) => {
    await slow;
    await route.fallback().catch(() => undefined);
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const started = Date.now();
  await page.goto('https://www.walmart.com/cart');
  await expect.poll(async () => (await debugReport(page)).checkout, { timeout: 3000 }).toBe('armed');
  expect(Date.now() - started).toBeLessThan(4000);
  await checkoutButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Worth It' })).toBeVisible();
  expect(await retailerClicks(page)).toBe(0);
});

test('a fourth item on Rollback is read at its current price, not reported as unreadable', async ({ context }) => {
  await serveWalmart(context, { '/cart': 'cart-rollback-2026-10.html' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  await waitForReview(page);
  expect(await debugReport(page)).toMatchObject({ extractedItems: 4, readableItems: 4, displayedItems: 4 });
  await clickCheckout(page);
  const panel = page.getByRole('dialog', { name: 'Worth It' });
  await expect(panel.getByText(/couldn.t read this item.s price/i)).toHaveCount(0);
  const details = await openFullAnalysis(page, panel);
  const cheetos = details.items.find((item) => item.itemName.startsWith('Cheetos Puff Cheese Flavored Snack Chips, 8 oz'))!;
  expect(cheetos).toMatchObject({ linePriceCents: 397, shareOfCartBps: 2175 }); // its price and share of the cart are known
  // The readable total matches the $18.25 Walmart showed for this cart.
  expect(details.readableTotalCents).toBe(1825);
});
