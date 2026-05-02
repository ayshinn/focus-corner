// Sticky notes IDB layer. Schema lives in `src/storage/db.ts`. Each note
// keeps its own position so the overlay can re-render at the saved
// coordinates after reload.

import { getDb } from '../storage/db';
import { requestToPromise } from '../storage/idb';

const STORE = 'sticky_notes';

export interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

export async function listNotes(): Promise<StickyNote[]> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    return await requestToPromise<StickyNote[]>(req);
  } catch {
    return [];
  }
}

export async function putNote(note: StickyNote): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* IDB unavailable; UI still updates in-memory */
  }
}

export async function deleteNote(id: string): Promise<void> {
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
