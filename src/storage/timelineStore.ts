/* IndexedDB-backed timeline store with an in-memory fallback.

   Drives the `timeline-storage` capability. See
   openspec/changes/timeline-storage/specs/timeline-storage/spec.md for the
   contract this implements (database `midirec`, object store `timelines`,
   key path `name`, sort order on `list()`, error mapping). */

import type { TimelinePayload } from './timelinePayload';

const DB_NAME = 'midirec';
const STORE_NAME = 'timelines';
const DB_VERSION = 1;

export interface TimelineSummary {
  name: string;
  savedAt: number;
}

export class StorageQuotaError extends Error {
  constructor(message = 'Storage full — delete a saved timeline to free space') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export class StorageUnavailableError extends Error {
  constructor(message = 'Storage unavailable — saved timelines won’t survive reload') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export class StorageReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageReadError';
  }
}

export interface TimelineStore {
  open(): Promise<void>;
  put(payload: TimelinePayload): Promise<void>;
  get(name: string): Promise<TimelinePayload | null>;
  list(): Promise<TimelineSummary[]>;
  delete(name: string): Promise<void>;
  /** True iff the underlying engine is the in-memory fallback. */
  readonly isFallback: boolean;
}

function sortSummaries(items: TimelineSummary[]): TimelineSummary[] {
  return items.slice().sort((a, b) => b.savedAt - a.savedAt);
}

function makeMemoryStore(): TimelineStore {
  const map = new Map<string, TimelinePayload>();
  return {
    isFallback: true,
    async open() {
      // No-op.
    },
    async put(payload) {
      map.set(payload.name, payload);
    },
    async get(name) {
      return map.get(name) ?? null;
    },
    async list() {
      const summaries: TimelineSummary[] = [];
      for (const [, p] of map) {
        summaries.push({ name: p.name, savedAt: p.savedAt });
      }
      return sortSummaries(summaries);
    },
    async delete(name) {
      map.delete(name);
    },
  };
}

function openIdbDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageUnavailableError());
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new StorageUnavailableError((err as Error).message));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new StorageUnavailableError(req.error?.message ?? 'open failed'));
    req.onblocked = () => reject(new StorageUnavailableError('database open blocked'));
  });
}

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb request failed'));
  });
}

function mapPutError(err: unknown): Error {
  if (err instanceof Error) {
    if (err.name === 'QuotaExceededError') return new StorageQuotaError();
    return new StorageReadError(err.message);
  }
  return new StorageReadError('unknown put error');
}

function makeIdbStore(db: IDBDatabase): TimelineStore {
  return {
    isFallback: false,
    async open() {
      // Already open.
    },
    async put(payload) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      try {
        await awaitRequest(store.put(payload));
      } catch (err) {
        throw mapPutError(err);
      }
    },
    async get(name) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      try {
        const result = await awaitRequest(store.get(name));
        return (result as TimelinePayload | undefined) ?? null;
      } catch (err) {
        throw new StorageReadError((err as Error).message);
      }
    },
    async list() {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      try {
        const all = (await awaitRequest(store.getAll())) as TimelinePayload[];
        return sortSummaries(all.map((p) => ({ name: p.name, savedAt: p.savedAt })));
      } catch (err) {
        throw new StorageReadError((err as Error).message);
      }
    },
    async delete(name) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      try {
        await awaitRequest(store.delete(name));
      } catch (err) {
        throw new StorageReadError((err as Error).message);
      }
    },
  };
}

export interface CreateStoreOptions {
  /** Called once when the IndexedDB engine cannot be opened and the in-memory fallback is selected. */
  onFallback?: (err: Error) => void;
}

/* Open the IndexedDB engine. If it rejects, fall back to the in-memory map
   and notify via `onFallback` exactly once. The returned promise always
   resolves; storage operations after fallback succeed for the page lifetime
   but do not persist across reload. */
export async function createTimelineStore(opts: CreateStoreOptions = {}): Promise<TimelineStore> {
  try {
    const db = await openIdbDatabase();
    const store = makeIdbStore(db);
    await store.open();
    return store;
  } catch (err) {
    const wrapped =
      err instanceof StorageUnavailableError ? err : new StorageUnavailableError((err as Error).message);
    opts.onFallback?.(wrapped);
    return makeMemoryStore();
  }
}

/* @internal — exported for tests that need to exercise the in-memory engine
   directly without going through `createTimelineStore`. */
export function _makeMemoryStoreForTests(): TimelineStore {
  return makeMemoryStore();
}
