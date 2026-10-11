import type { BrowserContext, Page, Worker } from '@playwright/test';
import { clickCheckout, daysAgo, expect, retailerClicks, retailerMarkup, seedHistory, serveWalmart, setPreferences, storedPurchase, test } from './extension';

const INVESTMENT_SENTENCE = (x: string, y: string) =>
  `By following these suggestions, you would save ${x}. If you invested that ${x} at an assumed 10% annual return, compounded annually, it could grow to about ${y} in 40 years (before inflation; returns are not guaranteed).`;

async function openMixedCart(context: BrowserContext, extensionId: string, serviceWorker: Worker, preferences: Record<string, unknown> = {}): Promise<Page> {
  await setPreferences(serviceWorker, preferences);
  await seedHistory(context, extensionId, [
    storedPurchase({ title: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz', purchasedOn: daysAgo(20), retailerItemId: '18256507800' }),
  ]);
  await serveWalmart(context, { '/cart': 'cart-mixed.html' });
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  await clickCheckout(page);
  return page;
}

test('acceptance walkthrough: recap, clarification, totals, full analysis, and control', async ({ context, extensionId, serviceWorker }) => {
  const page = await openMixedCart(context, extensionId, serviceWorker);
  const before = await retailerMarkup(page);
  const panel = page.getByRole('region', { name: 'Worth It' });

  // The recap opens on its own with the reflection prompt.
  await expect(panel.locator('.wi-scene-title')).toHaveText('Before you check out, 3 things are worth a second thought.');
  await panel.getByRole('button', { name: 'Pause recap' }).click();
  await panel.getByRole('button', { name: 'Next scene' }).click();
  await expect(panel.locator('.wi-scene-item')).toHaveText('Stanley Quencher H2.0 FlowState Tumbler, 30 oz');
  await panel.getByRole('button', { name: 'Next scene' }).click();
  await expect(panel.locator('.wi-scene-item')).toHaveText('Skittles Original Fruity Candy, Sharing Size, 15.6 oz');
  await panel.getByRole('button', { name: 'Next scene' }).click();
  await expect(panel.locator('.wi-scene-item')).toHaveText('Squishmallows FuzzAMallow 5 inch Plush');
  await panel.getByRole('button', { name: 'Next scene' }).click();
  await expect(panel.locator('.wi-scene-title')).toHaveText('You also had 3 other items you could reconsider or swap for a different one, worth about $4.81 more.');
  await panel.getByRole('button', { name: 'Next scene' }).click();
  await expect(panel.locator('.wi-closing-sentence')).toHaveText(INVESTMENT_SENTENCE('$38.72', '$1,752.44'));

  // Replay, then skip to the static view.
  await panel.getByRole('button', { name: 'Replay recap' }).click();
  await expect(panel.locator('.wi-scene-title')).toHaveText('Before you check out, 3 things are worth a second thought.');
  await panel.getByRole('button', { name: 'Skip recap' }).click();
  await expect(panel.getByRole('list', { name: 'Worth a second thought' }).getByRole('listitem')).toHaveCount(3);
  await expect(panel.getByText('Bounty Essentials Select-A-Size Paper Towels, 6 Double Rolls')).toHaveCount(0);

  // Clarification: the tumbler is replacing a worn one.
  await panel.getByRole('button', { name: 'Replacing a worn one' }).click();
  await expect(panel.locator('.wi-closing-sentence')).toHaveText(INVESTMENT_SENTENCE('$25.75', '$1,165.43'));
  await expect(panel.getByText(/Ozark Trail Insulated Tumbler with Handle, 30 oz/).first()).toBeVisible();

  // Full analysis on request.
  await panel.getByRole('button', { name: 'See full analysis' }).click();
  await expect(panel.getByRole('heading', { name: 'Full analysis' })).toBeVisible();
  await expect(panel.getByRole('table')).toHaveCount(7);
  await panel.getByRole('button', { name: 'Back to highlights' }).first().click();

  // Continue closes only Worth It; the cart is untouched.
  await panel.getByRole('button', { name: 'Continue' }).click();
  await expect(panel).toHaveCount(0);
  expect(await retailerClicks(page)).toBe(0);
  expect(await retailerMarkup(page)).toBe(before);
});

test('reduced motion shows the static view, and the illustration can be turned off', async ({ context, extensionId, serviceWorker }) => {
  await context.pages()[0]?.emulateMedia({ reducedMotion: 'reduce' });
  await setPreferences(serviceWorker, { investmentIllustration: false });
  await seedHistory(context, extensionId, []);
  await serveWalmart(context, { '/cart': 'cart-mixed.html' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('https://www.walmart.com/cart');
  await clickCheckout(page);
  const panel = page.getByRole('region', { name: 'Worth It' });
  await expect(panel.getByRole('toolbar', { name: 'Recap controls' })).toHaveCount(0);
  await expect(panel.getByText('Before you check out, 3 things are worth a second thought.')).toBeVisible();
  // Without history, the tumbler gets the cheaper option: 12.00 + 3.97 + 4.97 + 4.81 = 25.75.
  await expect(panel.locator('.wi-closing-sentence')).toHaveText('By following these suggestions, you would save $25.75.');
  await expect(panel.getByText(/could grow to about/)).toHaveCount(0);
});

test('a store-brand-only staples cart stays collapsed', async ({ context, serviceWorker }) => {
  await setPreferences(serviceWorker, {});
  await serveWalmart(context, { '/cart': 'cart-normal.html' });
  const page = await context.newPage();
  await page.goto('https://www.walmart.com/cart');
  await expect(page.getByRole('button', { name: 'Worth It: Reviewed 3 items. Open review' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Worth It' })).toHaveCount(0);
});

test('OpenAI wording (stubbed) is validated and filled with real values; nothing identifying is sent', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await serviceWorker.evaluate(() => chrome.storage.local.set({ openaiApiKey: 'sk-e2e-abcdefghijklmnopqrstuvwxyz' }));
  const bodies: string[] = [];
  await context.route('https://api.openai.com/**', async (route) => {
    bodies.push(route.request().postData() ?? '');
    expect(route.request().headers()['authorization']).toBe('Bearer sk-e2e-abcdefghijklmnopqrstuvwxyz');
    const content = JSON.stringify({
      opening: 'Hold on a moment: {count_phrase} worth a second thought.',
      highlights: [
        { id: 'h1', text: 'You already picked up {what} {when}. Is a second one needed? Leaving it saves {amount}.' },
        { id: 'h2', text: 'Skip this one and keep {amount} — it has $99 of value!' },
      ],
    });
    await route.fulfill({ json: { choices: [{ message: { content } }] } });
  });
  const page = await openMixedCart(context, extensionId, serviceWorker, { investmentIllustration: true });
  const panel = page.getByRole('region', { name: 'Worth It' });
  await expect(panel.locator('.wi-scene-title')).toHaveText('Hold on a moment: 3 things are worth a second thought.');
  await panel.getByRole('button', { name: 'Skip recap' }).click();
  await expect(panel.getByText('You already picked up this 20 days ago. Is a second one needed? Leaving it saves $24.97.')).toBeVisible();
  // The invalid rephrasing (it added a number) falls back to the reviewed template.
  await expect(panel.getByText('This looks like a novelty item with no practical use, so it’s probably not worth it. Consider skipping it to take $3.97 off your cart.')).toBeVisible();

  expect(bodies.length).toBeGreaterThanOrEqual(1);
  for (const forbidden of ['Stanley', 'Skittles', 'Great Value', '24.97', '18256507800', 'days ago']) {
    expect(bodies.join('\n')).not.toContain(forbidden);
  }
});
