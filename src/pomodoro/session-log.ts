// Persistent log of completed pomodoro work intervals. Writes go through
// here from the FSM's onIntervalEnd hook; the Phase 4 stats widget
// (step 35) reads them. Schema v1 — ridiculously small surface so the
// future widget can derive whatever it needs.

import { openDb, requestToPromise } from '../storage/idb';

const DB_NAME = 'focus-corner';
const DB_VERSION = 1;
const STORE = 'sessions';

export interface SessionRecord {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  kind: 'work';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb({
      name: DB_NAME,
      version: DB_VERSION,
      stores: [
        {
          name: STORE,
          options: { keyPath: 'id', autoIncrement: true },
          indexes: [{ name: 'by-startedAt', keyPath: 'startedAt' }],
        },
      ],
    }).catch((err) => {
      // Surface once for debugging; subsequent calls re-attempt next page load.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function appendSession(record: SessionRecord): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // IndexedDB unavailable / blocked. Stats widget will simply show
    // whatever did persist; we don't surface a UI error for this.
  }
}

export async function listSessions(): Promise<SessionRecord[]> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    return await requestToPromise<SessionRecord[]>(req);
  } catch {
    return [];
  }
}
