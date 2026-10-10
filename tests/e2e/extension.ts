import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Built by `wxt build --mode e2e` (placeholder OAuth client; see wxt.config.ts).
const EXTENSION_PATH = path.join(process.cwd(), '.output', 'chrome-mv3-e2e');
const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'retailer');

export interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

/**
 * Loads the built unpacked extension into Playwright's bundled Chromium with a
 * persistent profile. Headless works with the `chromium` channel.
 */
export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, provide) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    // No test may reach a real retailer, Google, or OpenAI.
    await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort('blockedbyclient'));
    // On first install the worker opens onboarding, and Chrome may reuse a blank
    // tab for it. Let that settle so it can't hijack a test's navigation.
    const deadline = Date.now() + 10_000;
    while (!context.pages().some((page) => page.url().includes('/options.html')) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await provide(context);
    await context.close();
  },
  serviceWorker: async ({ context }, provide) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await provide(worker);
  },
  extensionId: async ({ serviceWorker }, provide) => {
    await provide(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

/** Serves synthetic fixture pages for the given Walmart paths. */
export async function serveWalmart(context: BrowserContext, pages: Record<string, string>) {
  await context.route('https://www.walmart.com/**', async (route) => {
    const url = new URL(route.request().url());
    const file = pages[url.pathname] ?? pages['*'];
    if (!file) return route.fulfill({ status: 404, body: 'Not found (fixture)' });
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: readFileSync(path.join(FIXTURES, 'walmart', file), 'utf8'),
    });
  });
}

/** The cart page markup, excluding Worth It's own panel host. */
export function retailerMarkup(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('worth-it-panel').forEach((node) => node.remove());
    return clone.innerHTML;
  });
}

export function retailerClicks(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __retailerClicks?: number }).__retailerClicks ?? 0);
}

/** Opens a Worth It extension page, e.g. `options.html#history`. */
export async function openExtensionPage(context: BrowserContext, extensionId: string, pagePath: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${pagePath}`);
  return page;
}

/** Writes preferences directly, as if the shopper had set them in settings. */
export async function setPreferences(serviceWorker: Worker, preferences: Record<string, unknown>) {
  await serviceWorker.evaluate(async (changes) => {
    const current = (await chrome.storage.local.get('preferences')).preferences ?? {};
    await chrome.storage.local.set({ preferences: { onboardingComplete: true, ...current, ...changes } });
  }, preferences);
}

/** Puts purchase records straight into the extension's IndexedDB (test setup only). */
export async function seedHistory(context: BrowserContext, extensionId: string, records: Record<string, unknown>[]) {
  const page = await context.newPage();
  // Opening an extension page creates the database with the current schema.
  await page.goto(`chrome-extension://${extensionId}/options.html#history`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async (rows) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('worth-it');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('purchases', 'readwrite');
    for (const row of rows) tx.objectStore('purchases').put(row);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, records);
  await page.close();
}

/** A purchase record as the importer would store it. */
export function storedPurchase(fields: { title: string; purchasedOn: string; retailerItemId?: string | null }) {
  return {
    id: `seed-${fields.title.length}-${fields.purchasedOn}`,
    source: 'synthetic_gmail',
    merchant: 'Walmart',
    title: fields.title,
    retailerItemId: fields.retailerItemId ?? null,
    orderId: 'WI-TEST-0001',
    purchasedOn: fields.purchasedOn,
    quantity: 1,
    linePriceCents: 2497,
    status: 'purchased',
    description: 'Synthetic test receipt',
    gmailMessageId: 'seed',
    incomplete: false,
    dedupeKey: `walmart|WI-TEST-0001|${fields.retailerItemId ?? fields.title.toLowerCase()}`,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

/** Local YYYY-MM-DD for `days` days before today. */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
