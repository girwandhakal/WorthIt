import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_ROOT = join(process.cwd(), 'tests', 'fixtures');

export function readFixture(...parts: string[]): string {
  return readFileSync(join(FIXTURE_ROOT, ...parts), 'utf8');
}

/** Parses a retailer fixture into a standalone Document (scripts do not run). */
export function loadRetailerDocument(retailer: string, file: string): Document {
  return new DOMParser().parseFromString(readFixture('retailer', retailer, file), 'text/html');
}
