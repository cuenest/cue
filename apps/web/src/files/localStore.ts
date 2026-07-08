/**
 * A local IndexedDB store of encrypted chunks, keyed by hash. "Keep offline"
 * pins download every chunk here so the file works when the hub is down. The
 * Service Worker reads the same store (local-first) so preview works offline too.
 */

const DB = 'cue-blobs';
const STORE = 'chunks';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const localChunks = {
  async has(hash: string): Promise<boolean> {
    const db = await openDb();
    const count = await reqPromise(db.transaction(STORE).objectStore(STORE).count(hash));
    return count > 0;
  },
  async get(hash: string): Promise<Uint8Array | undefined> {
    const db = await openDb();
    return reqPromise<Uint8Array | undefined>(
      db.transaction(STORE).objectStore(STORE).get(hash) as IDBRequest<Uint8Array | undefined>,
    );
  },
  async put(hash: string, cipher: Uint8Array): Promise<void> {
    const db = await openDb();
    await reqPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(cipher, hash));
  },
  async del(hash: string): Promise<void> {
    const db = await openDb();
    await reqPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(hash));
  },
};

const PINNED_KEY = 'cue-pinned';

export function pinnedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function setPinned(id: string, pinned: boolean): void {
  const ids = pinnedIds();
  if (pinned) ids.add(id);
  else ids.delete(id);
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]));
  } catch {
    /* private mode */
  }
}
