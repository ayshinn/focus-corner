// Centralized handle to the focus-corner IndexedDB. Every IDB-backed
// feature opens *the same* DB with the *same* version + store list, so
// upgrades happen exactly once instead of one feature racing another's
// upgrade. Adding a new store: bump DB_VERSION, append to STORES.

import { openDb, type DbSpec } from './idb';

export const DB_NAME = 'focus-corner';
// v1: sessions (Step 17)
// v2: sticky_notes (Step 36)
export const DB_VERSION = 2;

const STORES: DbSpec['stores'] = [
  {
    name: 'sessions',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [{ name: 'by-startedAt', keyPath: 'startedAt' }],
  },
  {
    name: 'sticky_notes',
    options: { keyPath: 'id' },
    indexes: [{ name: 'by-updatedAt', keyPath: 'updatedAt' }],
  },
];

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb({ name: DB_NAME, version: DB_VERSION, stores: STORES }).catch(
      (err: unknown) => {
        dbPromise = null;
        throw err;
      },
    );
  }
  return dbPromise;
}
