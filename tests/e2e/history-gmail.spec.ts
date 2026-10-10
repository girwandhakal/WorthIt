import { emlToGmailMessage } from '../helpers/eml';
import { readFixture } from '../helpers/fixtures';
import { expect, openExtensionPage, serveWalmart, setPreferences, test } from './extension';

test.describe('onboarding and local history', () => {
  test('opens onboarding on install and remembers choices', async ({ context, extensionId }) => {
    // The service worker opens onboarding in a new tab on first install.
    await expect.poll(() => context.pages().some((page) => page.url().includes('/options.html')), { timeout: 10_000 }).toBe(true);
    const onboarding = context.pages().find((page) => page.url().includes('/options.html'))!;
    await expect(onboarding.getByRole('heading', { name: 'Welcome to Worth It' })).toBeVisible();
    await onboarding.getByRole('checkbox', { name: /Offer to record purchases/ }).check();
    await onboarding.getByRole('button', { name: 'Finish setup' }).click();
    await expect(onboarding.getByRole('heading', { name: 'Worth It settings' })).toBeVisible();

    const again = await openExtensionPage(context, extensionId, 'options.html#preferences');
    await expect(again.getByRole('checkbox', { name: /Offer to record purchases/ })).toBeChecked();
  });

  test('manual purchases survive a reload', async ({ context, extensionId, serviceWorker }) => {
    await setPreferences(serviceWorker, {});
    const page = await openExtensionPage(context, extensionId, 'options.html#history');
    await page.getByRole('button', { name: 'Add purchase' }).click();
    const form = page.getByRole('form', { name: 'Save purchase' });
    await form.getByLabel('Item name').fill('Ozark Trail tumbler');
    await form.getByLabel('Total price').fill('12.97');
    await form.getByRole('button', { name: 'Save purchase' }).click();
    await expect(page.getByText('Purchase added.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Ozark Trail tumbler')).toBeVisible();
    await expect(page.locator('.wi-badge', { hasText: 'Added manually' })).toBeVisible();
  });
});

test.describe('Gmail import (stubbed identity and Gmail API)', () => {
  test('imports synthetic receipts through review and labels them', async ({ context, extensionId, serviceWorker }) => {
    await setPreferences(serviceWorker, {});
    const messages = {
      m1: emlToGmailMessage(readFixture('email', 'synthetic-tumbler.eml'), 'm1'),
      m2: emlToGmailMessage(readFixture('email', 'synthetic-malformed.eml'), 'm2'),
    };
    const gmailRequests: string[] = [];
    await context.route('https://gmail.googleapis.com/**', async (route) => {
      const url = new URL(route.request().url());
      gmailRequests.push(url.pathname.endsWith('/messages') ? `list q=${url.searchParams.get('q')}` : url.pathname + url.search);
      expect(route.request().headers()['authorization']).toBe('Bearer e2e-token');
      if (url.pathname.endsWith('/messages')) {
        return route.fulfill({ json: { messages: [{ id: 'm1' }, { id: 'm2' }] } });
      }
      const id = url.pathname.split('/').pop() as keyof typeof messages;
      return route.fulfill({ json: messages[id] });
    });

    const page = await context.newPage();
    // Playwright's Chromium has no Google sign-in; stub Chrome Identity on the page.
    await page.addInitScript(() => {
      const identity = chrome.identity as unknown as Record<string, unknown>;
      identity.getAuthToken = async () => ({ token: 'e2e-token' });
      identity.removeCachedAuthToken = async () => undefined;
      identity.clearAllCachedAuthTokens = async () => undefined;
    });
    await page.goto(`chrome-extension://${extensionId}/options.html#gmail`);

    await page.getByRole('button', { name: 'Connect Gmail and find receipts' }).click();
    await expect(page.getByText('Checked 2 emails.')).toBeVisible();
    await expect(page.getByText('Stanley Quencher H2.0 FlowState Tumbler, 30 oz')).toBeVisible();
    await expect(page.getByText(/1 message couldn.t be read/)).toBeVisible();
    await page.getByRole('button', { name: 'Save 2 purchases' }).click();
    await expect(page.getByText('Saved 2 purchases to your history.')).toBeVisible();

    expect(gmailRequests[0]).toContain('(subject:"[Worth It Test Receipt]" from:me)');
    expect(gmailRequests[0]).toMatch(/ after:\d{4}\/\d{2}\/\d{2} before:\d{4}\/\d{2}\/\d{2}$/);
    expect(gmailRequests.filter((request) => request.includes('format=full'))).toHaveLength(2);

    await page.goto(`chrome-extension://${extensionId}/options.html#history`);
    await expect(page.locator('.wi-badge', { hasText: 'Synthetic test receipt (Gmail)' })).toHaveCount(2);

    // Nothing from the email body was stored.
    const stored = await page.evaluate(async () => {
      const request = indexedDB.open('worth-it');
      const db = await new Promise<IDBDatabase>((resolve) => (request.onsuccess = () => resolve(request.result)));
      const all = db.transaction('purchases').objectStore('purchases').getAll();
      return new Promise<string>((resolve) => (all.onsuccess = () => resolve(JSON.stringify(all.result))));
    });
    expect(stored).not.toContain('BODY-ONLY-SENTINEL');
    expect(stored).not.toContain('e2e-token');
  });
});

test.describe('observed purchases from Walmart order pages', () => {
  test('nothing appears while recording is off', async ({ context, serviceWorker }) => {
    await setPreferences(serviceWorker, { recordPurchases: false });
    await serveWalmart(context, { '/orders': 'orders-history.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/orders');
    await page.waitForTimeout(1200);
    await expect(page.locator('worth-it-panel')).toHaveCount(0);
  });

  test('records reviewed item rows when opted in', async ({ context, extensionId, serviceWorker }) => {
    await setPreferences(serviceWorker, { recordPurchases: true });
    await serveWalmart(context, { '/orders': 'orders-history.html' });
    const page = await context.newPage();
    await page.goto('https://www.walmart.com/orders');
    const panel = page.getByRole('region', { name: 'Worth It purchase recording' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Record these purchases' }).click();
    await expect(panel.getByText('Monster 16.4 ft LED Strip Lights')).toBeVisible();
    await expect(panel.getByText(/SENTINEL/)).toHaveCount(0);
    await panel.getByRole('button', { name: 'Save 3 purchases' }).click();
    await expect(panel.getByText('Saved 3 purchases to your Worth It history.')).toBeVisible();

    const history = await openExtensionPage(context, extensionId, 'options.html#history');
    await expect(history.locator('.wi-badge', { hasText: 'Recorded from order page' })).toHaveCount(3);
    await expect(history.getByText(/Canceled/)).toBeVisible();
  });
});
