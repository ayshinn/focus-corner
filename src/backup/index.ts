// Single-file JSON export / import. Captures every persisted blob the
// app owns *except* OAuth tokens and the transient PKCE bits — those
// can never round-trip safely between machines.

import { getDb, DB_NAME } from '../storage/db';
import { requestToPromise } from '../storage/idb';

const BACKUP_VERSION = 1;

const LOCAL_STORAGE_DENYLIST = new Set<string>([
  'spotify-tokens',
  'spotify-pkce-verifier',
  'spotify-pkce-state',
  'google-tokens',
]);

const STORE_NAMES = ['sessions', 'sticky_notes', 'habits'] as const;
type StoreName = (typeof STORE_NAMES)[number];

interface BackupBlob {
  version: number;
  exportedAt: string;
  app: 'focus-corner';
  localStorage: Record<string, unknown>;
  idb: Record<StoreName, unknown[]>;
}

function readAllLocalStorage(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || LOCAL_STORAGE_DENYLIST.has(key)) continue;
    if (key.startsWith('spotify-pkce-') || key.startsWith('focus-corner-focus-mode')) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

async function readAllIdb(): Promise<Record<StoreName, unknown[]>> {
  const out = {} as Record<StoreName, unknown[]>;
  try {
    const db = await getDb();
    for (const store of STORE_NAMES) {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      out[store] = await requestToPromise<unknown[]>(req);
    }
  } catch {
    for (const store of STORE_NAMES) out[store] = out[store] ?? [];
  }
  return out;
}

export async function buildBackup(): Promise<BackupBlob> {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'focus-corner',
    localStorage: readAllLocalStorage(),
    idb: await readAllIdb(),
  };
}

export async function downloadBackup(): Promise<void> {
  const blob = await buildBackup();
  const file = new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `focus-corner-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isBackupBlob(value: unknown): value is BackupBlob {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === 'focus-corner' &&
    typeof v.version === 'number' &&
    typeof v.localStorage === 'object' &&
    typeof v.idb === 'object'
  );
}

export interface ImportResult {
  ok: boolean;
  message: string;
}

export async function importBackup(text: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: 'File is not valid JSON.' };
  }
  if (!isBackupBlob(parsed)) {
    return { ok: false, message: 'Not a focus-corner backup file.' };
  }
  if (parsed.version > BACKUP_VERSION) {
    return {
      ok: false,
      message: `Backup is from a newer version (${parsed.version}). Update focus-corner before importing.`,
    };
  }

  // localStorage: replace everything we own (except denied keys).
  for (const [key, value] of Object.entries(parsed.localStorage)) {
    if (LOCAL_STORAGE_DENYLIST.has(key)) continue;
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      /* quota — keep going */
    }
  }

  // IDB: clear stores then bulk put the imported records. If IDB is
  // unavailable the localStorage portion still landed; surface a partial
  // success so the user knows.
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES as unknown as string[], 'readwrite');
      for (const store of STORE_NAMES) {
        const objectStore = tx.objectStore(store);
        objectStore.clear();
        const records = parsed.idb[store];
        if (Array.isArray(records)) {
          for (const record of records) {
            try {
              objectStore.put(record);
            } catch {
              /* skip malformed */
            }
          }
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    return {
      ok: true,
      message: `Imported settings (${err instanceof Error ? err.message : 'IDB unavailable'}). Reload to apply.`,
    };
  }

  return { ok: true, message: `Imported (DB: ${DB_NAME}). Reload to apply.` };
}

export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    input.click();
  });
}
