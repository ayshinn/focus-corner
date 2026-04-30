// Tiny Promise wrapper around IndexedDB. Just enough for the session
// log (step 17) and the sticky notes / cached calendar work that arrives
// later. No external deps — `idb` would be overkill at this size.

export interface ObjectStoreSpec {
  name: string;
  options?: IDBObjectStoreParameters;
  indexes?: Array<{ name: string; keyPath: string | string[]; options?: IDBIndexParameters }>;
}

export interface DbSpec {
  name: string;
  version: number;
  stores: ObjectStoreSpec[];
}

export function openDb(spec: DbSpec): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(spec.name, spec.version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of spec.stores) {
        const objectStore = db.objectStoreNames.contains(store.name)
          ? req.transaction!.objectStore(store.name)
          : db.createObjectStore(store.name, store.options);
        for (const index of store.indexes ?? []) {
          if (!objectStore.indexNames.contains(index.name)) {
            objectStore.createIndex(index.name, index.keyPath, index.options);
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export function withStore<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => {
      if (result instanceof IDBRequest) resolve(result.result as T);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    if (!(result instanceof IDBRequest)) {
      result
        .then((value) => resolve(value))
        .catch((err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    }
  });
}

export function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
