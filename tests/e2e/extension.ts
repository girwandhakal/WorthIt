import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { productPageHtml, type PageSpec } from '../helpers/product-page';

// Built by `wxt build --mode e2e` (placeholder OAuth client; see wxt.config.ts).
const EXTENSION_PATH = path.join(process.cwd(), 'dist', 'chrome-mv3-e2e');
const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'retailer');
const PRODUCT_IMAGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#e8f0ff"/><circle cx="120" cy="120" r="70" fill="#0071dc"/></svg>';

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

/**
 * Serves synthetic fixture pages for the given Walmart paths. Product pages
 * (`/ip/<id>`) come from `products` when given; any other product page is a 404,
 * like an unreadable page on the real site.
 */
export async function serveWalmart(context: BrowserContext, pages: Record<string, string>, products: readonly PageSpec[] = []) {
  const requested: string[] = [];
  // Product thumbnails come from Walmart's image CDN; serve a stand-in image.
  await context.route('https://i5.walmartimages.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PRODUCT_IMAGE_SVG }),
  );
  await context.route('https://www.walmart.com/**', async (route) => {
    const url = new URL(route.request().url());
    const productId = /^\/ip\/(?:[^/]+\/)?(\d+)$/.exec(url.pathname)?.[1];
    if (productId) {
      requested.push(productId);
      const spec = products.find((candidate) => candidate.id === productId);
      if (!spec) return route.fulfill({ status: 404, body: 'Not found (fixture)' });
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: productPageHtml(spec) });
    }
    const file = pages[url.pathname] ?? pages['*'];
    if (!file) return route.fulfill({ status: 404, body: 'Not found (fixture)' });
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: readFileSync(path.join(FIXTURES, 'walmart', file), 'utf8'),
    });
  });
  return requested;
}

/**
 * A real click on the retailer's checkout control. Worth It holds the first one, once, when it
 * has something to show, and opens its panel; it never clicks anything itself.
 */
export async function clickCheckout(page: Page) {
  await waitForReview(page);
  await checkoutButton(page).click();
}

export function checkoutButton(page: Page) {
  return page.getByRole('button', { name: /^(continue to |proceed to )?check ?out/i }).first();
}

/** Worth It's own debug marker on the page (counts and states only, never cart contents). */
export async function debugReport(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.locator('html').getAttribute('data-worth-it-debug')) ?? '{}');
}

/** Waits until Worth It has reviewed the cart. Nothing is visible on the page until the checkout click. */
export async function waitForReview(page: Page) {
  await expect.poll(async () => (await debugReport(page)).review).toBe('delivered');
}

/** Waits until the next real checkout click will be held (everything this cart's findings depend on has loaded). */
export async function waitForArmed(page: Page) {
  await expect.poll(async () => (await debugReport(page)).checkout).toBe('armed');
}

/** Worth It shows nothing on the page: no pill, no panel, no buttons. */
export async function expectNothingShown(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Worth It' })).toHaveCount(0);
  await expect(page.locator('worth-it-panel').getByRole('button')).toHaveCount(0);
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

/** Serves synthetic Amazon fixture pages for the given paths (`*` = any path). */
export async function serveAmazon(context: BrowserContext, pages: Record<string, string>) {
  await context.route('https://www.amazon.com/**', async (route) => {
    const url = new URL(route.request().url());
    const file = pages[url.pathname] ?? pages['*'];
    if (!file) return route.fulfill({ status: 404, body: 'Not found (fixture)' });
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: readFileSync(path.join(FIXTURES, 'amazon', file), 'utf8'),
    });
  });
}
