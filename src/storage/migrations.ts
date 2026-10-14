import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { WorthItSchema } from './database';

/**
 * Ordered schema migrations. Each entry upgrades from `version - 1` to
 * `version` and must preserve existing records. Never edit a shipped
 * migration; add a new one.
 */
export type Migration = (
  db: IDBPDatabase<WorthItSchema>,
  tx: IDBPTransaction<WorthItSchema, StoreNames<WorthItSchema>[], 'versionchange'>,
) => void;

export const MIGRATIONS: Record<number, Migration> = {
  1: (db) => {
    const purchases = db.createObjectStore('purchases', { keyPath: 'id' });
    purchases.createIndex('by-purchased-on', 'purchasedOn');
    purchases.createIndex('by-source', 'source');
    purchases.createIndex('by-dedupe-key', 'dedupeKey');
    db.createObjectStore('clarifications', { keyPath: 'id' });
  },
};

export const LATEST_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

export function runMigrations(
  db: IDBPDatabase<WorthItSchema>,
  tx: IDBPTransaction<WorthItSchema, StoreNames<WorthItSchema>[], 'versionchange'>,
  oldVersion: number,
  newVersion: number,
  migrations: Record<number, Migration> = MIGRATIONS,
): void {
  for (let version = oldVersion + 1; version <= newVersion; version++) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`Missing migration for schema version ${version}`);
    migrate(db, tx);
  }
}
