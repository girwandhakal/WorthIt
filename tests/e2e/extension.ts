import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION_PATH = path.join(process.cwd(), '.output', 'chrome-mv3');
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
