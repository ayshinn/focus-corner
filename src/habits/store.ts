// Habits IDB layer. Each habit owns its own "completed dates" array so
// the UI can derive both the daily checkbox state and the 30-day grid
// from a single record.

import { getDb } from '../storage/db';
import { requestToPromise } from '../storage/idb';

const STORE = 'habits';

export interface Habit {
  id: string;
  name: string;
  createdAt: number;
  // Completed dates as YYYY-MM-DD local strings, sorted ascending.
  dates: string[];
}

export async function listHabits(): Promise<Habit[]> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    const all = await requestToPromise<Habit[]>(req);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function putHabit(habit: Habit): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(habit);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function deleteHabit(id: string): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
