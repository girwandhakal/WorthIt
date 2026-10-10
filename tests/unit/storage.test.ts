import { describe, expect, it } from 'vitest';
import type { PurchaseInput } from '../../src/domain/history';
import { openWorthItDb } from '../../src/storage/database';
import { MIGRATIONS } from '../../src/storage/migrations';
import { createRepositories } from '../../src/storage/repositories';
import { testRepositories } from '../helpers/background';

const tumbler: PurchaseInput = {
  source: 'synthetic_gmail',
  merchant: 'Walmart',
  title: 'Stanley Quencher H2.0 FlowState Tumbler, 30 oz',
  retailerItemId: '18256507800',
  orderId: 'WI-TEST-0001',
  purchasedOn: '2026-09-20',
  quantity: 1,
  linePriceCents: 2497,
  status: 'purchased',
  description: null,
  gmailMessageId: 'msg-1',
};

const eggs: PurchaseInput = {
  ...tumbler,
  source: 'manual',
  title: 'Great Value Large White Eggs',
  retailerItemId: null,
  orderId: null,
  purchasedOn: '2026-10-01',
  quantity: null,
  linePriceCents: null,
  gmailMessageId: null,
};

describe('PurchaseRepository', () => {
  it('creates, lists newest first, searches, updates, and deletes', async () => {
    const { purchases } = await testRepositories(() => new Date('2026-10-10T12:00:00Z'));
    const saved = await purchases.add(tumbler);
    await purchases.add(eggs);
    expect(saved).toMatchObject({ incomplete: false, dedupeKey: 'walmart|WI-TEST-0001|18256507800' });

    expect((await purchases.list()).map((record) => record.title)).toEqual([eggs.title, tumbler.title]);
    expect((await purchases.list({ query: 'quencher 30' })).map((r) => r.title)).toEqual([tumbler.title]);
    expect(await purchases.list({ query: 'WI-TEST-0001' })).toHaveLength(1);
    expect(await purchases.list({ sources: ['manual'] })).toHaveLength(1);

    const updated = await purchases.update(saved.id, { status: 'returned', quantity: 2 });
    expect(updated).toMatchObject({ status: 'returned', quantity: 2, createdAt: saved.createdAt });

    await purchases.delete(saved.id);
    expect(await purchases.list()).toHaveLength(1);
  });

  it('flags records missing quantity or price as incomplete', async () => {
    const { purchases } = await testRepositories();
    expect((await purchases.add(eggs)).incomplete).toBe(true);
  });

  it('rejects invalid input', async () => {
    const { purchases } = await testRepositories();
    await expect(purchases.add({ ...tumbler, title: '' })).rejects.toThrow();
    await expect(purchases.add({ ...tumbler, purchasedOn: '09/20/2026' })).rejects.toThrow();
    await expect(purchases.add({ ...tumbler, linePriceCents: 12.5 })).rejects.toThrow();
  });

  it('skips duplicates already saved and within a batch', async () => {
    const { purchases } = await testRepositories();
    await purchases.add(tumbler);
    const result = await purchases.addMany([tumbler, eggs, eggs]);
    expect(result.saved).toHaveLength(1);
    expect(result.duplicates).toBe(2);
    expect(await purchases.list()).toHaveLength(2);
  });

  it('removes records by source without touching others', async () => {
    const { purchases } = await testRepositories();
    await purchases.addMany([tumbler, { ...tumbler, source: 'gmail_import', orderId: 'X' }, eggs]);
    expect(await purchases.deleteBySources(['synthetic_gmail'])).toBe(1);
    expect((await purchases.list()).map((r) => r.source).sort()).toEqual(['gmail_import', 'manual']);
  });

  it('exports purchase records only', async () => {
    const { purchases } = await testRepositories();
    await purchases.add(tumbler);
    const exported = JSON.parse(await purchases.exportJson());
    expect(exported.format).toBe('worth-it-purchase-history');
    expect(exported.records).toHaveLength(1);
    expect(Object.keys(exported)).toEqual(['format', 'version', 'exportedAt', 'records']);
  });
});

describe('database lifecycle', () => {
  it('keeps history across reopening (extension restart)', async () => {
    const name = `restart-${Math.random()}`;
    const first = await openWorthItDb({ name });
    await createRepositories(first).purchases.add(tumbler);
    first.close();
    const second = await openWorthItDb({ name });
    expect(await createRepositories(second).purchases.list()).toHaveLength(1);
    second.close();
  });

  it('upgrades the schema without losing records', async () => {
    const name = `upgrade-${Math.random()}`;
    const v1 = await openWorthItDb({ name, version: 1 });
    await createRepositories(v1).purchases.add(tumbler);
    await createRepositories(v1).clarifications.put({
      id: 'repeat:walmart:18256507800',
      questionId: 'repeat',
      itemMatchKey: 'walmart:18256507800',
      itemTitle: tumbler.title,
      answer: 'replacement',
      answeredAt: '2026-10-10T00:00:00Z',
    });
    v1.close();

    // A hypothetical future migration that adds an index.
    const migrations = {
      ...MIGRATIONS,
      2: ((_db, tx) => {
        tx.objectStore('purchases').createIndex('by-merchant' as never, 'merchant');
      }) as (typeof MIGRATIONS)[1],
    };
    const v2 = await openWorthItDb({ name, version: 2, migrations });
    expect(v2.version).toBe(2);
    const repos = createRepositories(v2);
    expect(await repos.purchases.list()).toHaveLength(1);
    expect(await repos.clarifications.list()).toHaveLength(1);
    v2.close();
  });

  it('refuses to open when a migration step is missing', async () => {
    await expect(openWorthItDb({ name: `missing-${Math.random()}`, version: 3 })).rejects.toThrow(/Missing migration/);
  });
});
