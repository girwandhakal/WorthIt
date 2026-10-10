import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ClarificationRecord, FeedbackRecord, PurchaseRecord } from '../domain/history';
import { LATEST_VERSION, MIGRATIONS, runMigrations, type Migration } from './migrations';

export const DATABASE_NAME = 'worth-it';

export interface WorthItSchema extends DBSchema {
  purchases: {
    key: string;
    value: PurchaseRecord;
    indexes: { 'by-purchased-on': string; 'by-source': string; 'by-dedupe-key': string };
  };
  clarifications: { key: string; value: ClarificationRecord };
  feedback: { key: string; value: FeedbackRecord };
}

export type WorthItDb = IDBPDatabase<WorthItSchema>;

export interface OpenOptions {
  name?: string;
  version?: number;
  migrations?: Record<number, Migration>;
}

/**
 * Opens the local history database (extension origin only: service worker and
 * extension pages). Content scripts never open it directly.
 */
export function openWorthItDb(options: OpenOptions = {}): Promise<WorthItDb> {
  const migrations = options.migrations ?? MIGRATIONS;
  const version = options.version ?? LATEST_VERSION;
  for (let step = 1; step <= version; step++) {
    if (!migrations[step]) return Promise.reject(new Error(`Missing migration for schema version ${step}`));
  }
  return openDB<WorthItSchema>(options.name ?? DATABASE_NAME, version, {
    upgrade(db, oldVersion, newVersion, tx) {
      runMigrations(db, tx, oldVersion, newVersion ?? oldVersion, migrations);
    },
  });
}
