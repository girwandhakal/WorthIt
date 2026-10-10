import {
  dedupeKeyFor,
  isIncomplete,
  normalizeTitle,
  purchaseInputSchema,
  type ClarificationRecord,
  type FeedbackKind,
  type FeedbackRecord,
  type HistorySource,
  type PurchaseInput,
  type PurchaseRecord,
} from '../domain/history';
import type { WorthItDb } from './database';

export interface PurchaseFilter {
  query?: string;
  sources?: readonly HistorySource[];
}

export interface AddManyResult {
  saved: PurchaseRecord[];
  duplicates: number;
}

export const EXPORT_FORMAT = 'worth-it-purchase-history';

/** Local purchase history. Every write is validated against the schema. */
export class PurchaseRepository {
  constructor(
    private readonly db: WorthItDb,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async add(input: PurchaseInput): Promise<PurchaseRecord> {
    const record = this.toRecord(purchaseInputSchema.parse(input));
    await this.db.add('purchases', record);
    return record;
  }

  /** Saves records, skipping any whose dedupe key already exists (or repeats within the batch). */
  async addMany(inputs: readonly PurchaseInput[]): Promise<AddManyResult> {
    const records = inputs.map((input) => this.toRecord(purchaseInputSchema.parse(input)));
    const tx = this.db.transaction('purchases', 'readwrite');
    const index = tx.store.index('by-dedupe-key');
    const seen = new Set<string>();
    const saved: PurchaseRecord[] = [];
    let duplicates = 0;
    for (const record of records) {
      if (seen.has(record.dedupeKey) || (await index.count(record.dedupeKey)) > 0) {
        duplicates++;
        continue;
      }
      seen.add(record.dedupeKey);
      await tx.store.add(record);
      saved.push(record);
    }
    await tx.done;
    return { saved, duplicates };
  }

  async update(id: string, changes: Partial<PurchaseInput>): Promise<PurchaseRecord> {
    const existing = await this.db.get('purchases', id);
    if (!existing) throw new Error('Purchase record not found.');
    const { id: _id, incomplete: _incomplete, dedupeKey: _dedupe, createdAt, updatedAt: _updated, ...current } = existing;
    const merged = purchaseInputSchema.parse({ ...current, ...changes });
    const record: PurchaseRecord = {
      ...merged,
      id,
      incomplete: isIncomplete(merged),
      dedupeKey: dedupeKeyFor(merged),
      createdAt,
      updatedAt: this.now().toISOString(),
    };
    await this.db.put('purchases', record);
    return record;
  }

  async get(id: string): Promise<PurchaseRecord | undefined> {
    return this.db.get('purchases', id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('purchases', id);
  }

  /** Removes every record from the given sources (e.g. all Gmail imports). Returns the count. */
  async deleteBySources(sources: readonly HistorySource[]): Promise<number> {
    const tx = this.db.transaction('purchases', 'readwrite');
    let removed = 0;
    for (const source of sources) {
      for (const key of await tx.store.index('by-source').getAllKeys(source)) {
        await tx.store.delete(key);
        removed++;
      }
    }
    await tx.done;
    return removed;
  }

  async deleteAll(): Promise<void> {
    await this.db.clear('purchases');
  }

  async hasDedupeKey(key: string): Promise<boolean> {
    return (await this.db.countFromIndex('purchases', 'by-dedupe-key', key)) > 0;
  }

  /** Newest first. `query` matches title, merchant, order ID, and item ID. */
  async list(filter: PurchaseFilter = {}): Promise<PurchaseRecord[]> {
    const all = await this.db.getAllFromIndex('purchases', 'by-purchased-on');
    const terms = normalizeTitle(filter.query ?? '')
      .split(' ')
      .filter(Boolean);
    return all
      .filter((record) => !filter.sources || filter.sources.includes(record.source))
      .filter((record) => {
        if (terms.length === 0) return true;
        const haystack = normalizeTitle(
          [record.title, record.merchant, record.orderId ?? '', record.retailerItemId ?? ''].join(' '),
        );
        return terms.every((term) => haystack.includes(term));
      })
      .reverse();
  }

  /** Local, explicit export. Contains purchase records only: no tokens, settings, or email content. */
  async exportJson(): Promise<string> {
    const records = await this.list();
    return JSON.stringify(
      { format: EXPORT_FORMAT, version: 1, exportedAt: this.now().toISOString(), records },
      null,
      2,
    );
  }

  private toRecord(input: PurchaseInput): PurchaseRecord {
    const timestamp = this.now().toISOString();
    return {
      ...input,
      id: crypto.randomUUID(),
      incomplete: isIncomplete(input),
      dedupeKey: dedupeKeyFor(input),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}

export class ClarificationRepository {
  constructor(private readonly db: WorthItDb) {}

  async get(id: string): Promise<ClarificationRecord | undefined> {
    return this.db.get('clarifications', id);
  }

  async put(record: ClarificationRecord): Promise<void> {
    await this.db.put('clarifications', record);
  }

  async list(): Promise<ClarificationRecord[]> {
    return this.db.getAll('clarifications');
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('clarifications', id);
  }

  async deleteAll(): Promise<void> {
    await this.db.clear('clarifications');
  }
}

export class FeedbackRepository {
  constructor(
    private readonly db: WorthItDb,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async add(findingId: string, kind: FeedbackKind): Promise<FeedbackRecord> {
    const record: FeedbackRecord = { id: crypto.randomUUID(), findingId, kind, createdAt: this.now().toISOString() };
    await this.db.add('feedback', record);
    return record;
  }

  async list(): Promise<FeedbackRecord[]> {
    return this.db.getAll('feedback');
  }

  async deleteAll(): Promise<void> {
    await this.db.clear('feedback');
  }
}

export interface Repositories {
  purchases: PurchaseRepository;
  clarifications: ClarificationRepository;
  feedback: FeedbackRepository;
}

export function createRepositories(db: WorthItDb, now?: () => Date): Repositories {
  return {
    purchases: new PurchaseRepository(db, now),
    clarifications: new ClarificationRepository(db),
    feedback: new FeedbackRepository(db, now),
  };
}
