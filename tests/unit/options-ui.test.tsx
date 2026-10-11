import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchLike } from '../../src/ingestion/gmail/search-orders';
import { getOpenAiKey, getPreferences, updatePreferences } from '../../src/storage/preferences';
import type { Repositories } from '../../src/storage/repositories';
import { OptionsApp } from '../../src/ui/options/OptionsApp';
import type { OptionsServices } from '../../src/ui/options/context';
import { memoryArea, testRepositories } from '../helpers/background';
import { loadEmail } from '../helpers/eml';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

const gmailFetch: FetchLike = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/messages')) return jsonResponse({ messages: [{ id: 'm1' }, { id: 'm2' }] });
  const id = parsed.pathname.split('/').pop()!;
  return jsonResponse(id === 'm1' ? loadEmail('synthetic-tumbler.eml', 'm1') : loadEmail('synthetic-malformed.eml', 'm2'));
};

async function setup(
  options: { onboarded?: boolean; gmailConfigured?: boolean; extensionId?: string; getAuthToken?: () => Promise<unknown> } = {},
) {
  const local = memoryArea();
  if (options.onboarded ?? true) await updatePreferences(local, { onboardingComplete: true });
  const repos: Repositories = await testRepositories(() => new Date('2026-10-10T12:00:00Z'));
  const identity = {
    getAuthToken: vi.fn(options.getAuthToken ?? (async () => ({ token: 'test-token' }))),
    removeCachedAuthToken: vi.fn(async () => undefined),
    clearAllCachedAuthTokens: vi.fn(async () => undefined),
  };
  const services: OptionsServices = {
    local,
    repositories: async () => repos,
    identity,
    fetch: vi.fn(gmailFetch),
    gmailConfigured: options.gmailConfigured ?? true,
    ...(options.extensionId ? { extensionId: options.extensionId } : {}),
    now: () => new Date(2026, 9, 10, 12),
  };
  render(<OptionsApp services={services} />);
  return { local, repos, identity, services, user: userEvent.setup() };
}

beforeEach(() => {
  window.location.hash = '';
});

describe('onboarding', () => {
  it('discloses data use, lets the shopper choose settings, then finishes', async () => {
    const { local, user } = await setup({ onboarded: false });
    expect(await screen.findByRole('heading', { name: 'Welcome to Worth It' })).toBeTruthy();
    expect(screen.getByText(/checkout, payment, address, sign-in, or account fields/)).toBeTruthy();
    expect(screen.getByText(/no product names, prices, history,/)).toBeTruthy();

    const recording = screen.getByRole('checkbox', { name: /Offer to record purchases/ });
    expect((recording as HTMLInputElement).checked).toBe(false);
    await user.click(recording);
    await user.click(screen.getByRole('checkbox', { name: 'Peanuts' }));
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByRole('heading', { name: 'Worth It settings' })).toBeTruthy();
    expect(await getPreferences(local)).toMatchObject({ onboardingComplete: true, recordPurchases: true, allergens: ['peanuts'] });
  });
});

describe('purchase history', () => {
  it('adds, searches, edits, deletes, and bulk-removes records', async () => {
    window.location.hash = '#history';
    const { repos, user } = await setup();
    await screen.findByText(/No purchase history yet/);

    await user.click(screen.getByRole('button', { name: 'Add purchase' }));
    const form = screen.getByRole('form', { name: 'Save purchase' });
    await user.type(within(form).getByLabelText('Item name'), 'Stanley tumbler');
    await user.clear(within(form).getByLabelText('Purchase date'));
    await user.type(within(form).getByLabelText('Purchase date'), '2026-09-20');
    await user.type(within(form).getByLabelText('Total price'), '24.97');
    await user.click(within(form).getByRole('button', { name: 'Save purchase' }));
    expect(await screen.findByText('Purchase added.')).toBeTruthy();
    expect(screen.getByText('Walmart · Sep 20, 2026 · Qty 1 · $24.97 · Purchased')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit Stanley tumbler' }));
    const editForm = screen.getByRole('form', { name: 'Save changes' });
    await user.selectOptions(within(editForm).getByLabelText('Status'), 'returned');
    await user.click(within(editForm).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Walmart · Sep 20, 2026 · Qty 1 · $24.97 · Returned')).toBeTruthy();

    await user.type(screen.getByRole('searchbox'), 'nothing-matches');
    expect(await screen.findByText('No purchases match.')).toBeTruthy();
    await user.clear(screen.getByRole('searchbox'));

    await user.click(await screen.findByRole('button', { name: 'Delete Stanley tumbler' }));
    expect(await screen.findByText('Deleted “Stanley tumbler”.')).toBeTruthy();
    expect(await repos.purchases.list()).toEqual([]);
  });

  it('rejects an invalid price', async () => {
    window.location.hash = '#history';
    const { user } = await setup();
    await user.click(await screen.findByRole('button', { name: 'Add purchase' }));
    const form = screen.getByRole('form', { name: 'Save purchase' });
    await user.type(within(form).getByLabelText('Item name'), 'Thing');
    await user.type(within(form).getByLabelText('Total price'), 'ten dollars');
    await user.click(within(form).getByRole('button', { name: 'Save purchase' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a price like 4.97');
  });
});

describe('Gmail import', () => {
  it('connects only on click, shows a review, and saves approved synthetic records', async () => {
    window.location.hash = '#gmail';
    const { identity, repos, services, user } = await setup();
    await screen.findByText('What this does');
    expect(identity.getAuthToken).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Connect Gmail and find receipts' }));
    expect(await screen.findByText('Checked 2 emails.')).toBeTruthy();
    expect(identity.getAuthToken).toHaveBeenCalledWith({ interactive: true, scopes: ['https://www.googleapis.com/auth/gmail.readonly'] });
    expect(screen.getByText(/1 message couldn.t be read/)).toBeTruthy();
    expect(vi.mocked(services.fetch).mock.calls.every(([url]) => url.startsWith('https://gmail.googleapis.com/'))).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Save 2 purchases' }));
    expect(await screen.findByText('Saved 2 purchases to your history.')).toBeTruthy();
    const saved = await repos.purchases.list();
    expect(saved.map((record) => record.source)).toEqual(['synthetic_gmail', 'synthetic_gmail']);
    // Only parsed fields and the message ID are stored.
    expect(JSON.stringify(saved)).not.toMatch(/BODY-ONLY-SENTINEL|test-token|owner@example\.com/);
  });

  it('handles a declined consent with guidance', async () => {
    window.location.hash = '#gmail';
    const { user } = await setup({
      getAuthToken: async () => {
        throw new Error('The user did not approve access.');
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Connect Gmail and find receipts' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Gmail wasn’t connected.*add purchases manually/);
  });

  it('says when Chrome rejects the OAuth client, with the extension ID and Chrome’s message', async () => {
    window.location.hash = '#gmail';
    const { user } = await setup({
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      getAuthToken: async () => {
        throw new Error("OAuth2 request failed: Service responded with error: 'bad client id'");
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Connect Gmail and find receipts' }));
    const text = (await screen.findByRole('alert')).textContent ?? '';
    expect(text).toMatch(/This build has a Gmail client ID, but Chrome or Google rejected it/);
    expect(text).toContain('abcdefghijklmnopabcdefghijklmnop');
    expect(text).toContain('bad client id');
    expect(text).not.toMatch(/isn’t configured in this build/);
  });

  it('explains when Gmail is not configured in this build', async () => {
    window.location.hash = '#gmail';
    await setup({ gmailConfigured: false });
    expect(await screen.findByText(/isn’t set up in this build/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Connect Gmail and find receipts' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disconnect clears the cached token and keeps records', async () => {
    window.location.hash = '#gmail';
    const { identity, user } = await setup();
    await user.click(await screen.findByRole('button', { name: 'Disconnect Gmail' }));
    expect(await screen.findByText(/Imported records are kept/)).toBeTruthy();
    expect(identity.removeCachedAuthToken).toHaveBeenCalledWith({ token: 'test-token' });
    expect(screen.getByRole('link', { name: 'Open Google Account connections' })).toBeTruthy();
  });
});

describe('OpenAI key', () => {
  it('saves masked, never redisplays the full key, and clears', async () => {
    window.location.hash = '#openai';
    const { local, user } = await setup();
    const input = await screen.findByLabelText('OpenAI API key');
    await user.type(input, 'sk-proj-abcdefghijklmnopqrstuvwxyz9876');
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(await screen.findByText('sk-…9876')).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.body.textContent).not.toContain('abcdefghijklmnop');
    expect(await getOpenAiKey(local)).toBe('sk-proj-abcdefghijklmnopqrstuvwxyz9876');

    await user.click(screen.getByRole('button', { name: 'Remove key' }));
    await waitFor(async () => expect(await getOpenAiKey(local)).toBeNull());
  });
});

describe('delete everything', () => {
  it('also forgets the product labels saved from Walmart pages', async () => {
    window.location.hash = '#privacy';
    const { local, user } = await setup();
    await local.set({ walmartProductFacts: { '90000001': { at: Date.now(), facts: {} } } });
    await user.click(await screen.findByRole('button', { name: 'Delete all Worth It data' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, delete all Worth It data' }));
    await waitFor(() => expect(local.data.has('walmartProductFacts')).toBe(false));
  });
});
