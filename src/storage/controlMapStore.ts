/* IndexedDB-backed persistence for the global control-mapping state, with an
   in-memory fallback. This is intentionally separate from the timeline store
   (its own database + key) so the mapping set is app-wide and independent of
   the session `TimelinePayload` — it loads at app start and survives creating
   or loading a session. Mirrors the engine/fallback shape of `timelineStore`. */

import { emptyControlMapState, type ControlMapState } from '../midi/controlMap';

const DB_NAME = 'midirec-controlmap';
const STORE_NAME = 'controlMap';
const DB_VERSION = 1;
/** Single-record key — the whole `ControlMapState` lives under one key. */
const STATE_KEY = 'state';

export interface ControlMapStore {
  /** The persisted state, or `null` if nothing has been saved yet. */
  load(): Promise<ControlMapState | null>;
  save(state: ControlMapState): Promise<void>;
  /** True iff the underlying engine is the in-memory fallback. */
  readonly isFallback: boolean;
}

interface StoredRecord {
  key: string;
  state: ControlMapState;
}

function makeMemoryStore(): ControlMapStore {
  let held: ControlMapState | null = null;
  return {
    isFallback: true,
    async load() {
      return held;
    },
    async save(state) {
      held = state;
    },
  };
}

function openIdbDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('open failed'));
    req.onblocked = () => reject(new Error('database open blocked'));
  });
}

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb request failed'));
  });
}

function makeIdbStore(db: IDBDatabase): ControlMapStore {
  return {
    isFallback: false,
    async load() {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const result = (await awaitRequest(store.get(STATE_KEY))) as StoredRecord | undefined;
      return result?.state ?? null;
    },
    async save(state) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredRecord = { key: STATE_KEY, state };
      await awaitRequest(store.put(record));
    },
  };
}

/* Open the IndexedDB engine; on any failure fall back to an in-memory store so
   the app keeps working for the page lifetime. */
export async function createControlMapStore(): Promise<ControlMapStore> {
  try {
    const db = await openIdbDatabase();
    return makeIdbStore(db);
  } catch {
    return makeMemoryStore();
  }
}

export { emptyControlMapState };
