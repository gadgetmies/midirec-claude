import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  StorageUnavailableError,
  createTimelineStore,
  _makeMemoryStoreForTests,
} from './timelineStore';
import {
  STORAGE_SCHEMA_VERSION,
  emptySessionPayload,
  type TimelinePayload,
} from './timelinePayload';

function makePayload(name: string, savedAt: number): TimelinePayload {
  return {
    version: STORAGE_SCHEMA_VERSION,
    appVersion: '1.2.3',
    name,
    savedAt,
    session: emptySessionPayload(),
  };
}

beforeEach(() => {
  // Reset the IDB instance between tests so they don't share state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimelineStore — IndexedDB engine', () => {
  it('round-trips a payload via put / get', async () => {
    const store = await createTimelineStore();
    const payload = makePayload('alpha', 1000);
    await store.put(payload);
    const back = await store.get('alpha');
    expect(back).toEqual(payload);
  });

  it('overwrites a payload written under the same name', async () => {
    const store = await createTimelineStore();
    await store.put(makePayload('alpha', 1000));
    await store.put(makePayload('alpha', 2000));
    const back = await store.get('alpha');
    expect(back?.savedAt).toBe(2000);
    const list = await store.list();
    expect(list.filter((s) => s.name === 'alpha')).toHaveLength(1);
  });

  it('list returns summaries sorted by savedAt descending', async () => {
    const store = await createTimelineStore();
    await store.put(makePayload('A', 1000));
    await store.put(makePayload('B', 3000));
    await store.put(makePayload('C', 2000));
    const list = await store.list();
    expect(list).toEqual([
      { name: 'B', savedAt: 3000 },
      { name: 'C', savedAt: 2000 },
      { name: 'A', savedAt: 1000 },
    ]);
  });

  it('delete removes the entry and list reflects it', async () => {
    const store = await createTimelineStore();
    await store.put(makePayload('X', 1000));
    await store.delete('X');
    expect(await store.get('X')).toBe(null);
    expect(await store.list()).toEqual([]);
  });

  it('get returns null for missing names', async () => {
    const store = await createTimelineStore();
    expect(await store.get('nope')).toBe(null);
  });

  it('list is empty after every entry has been deleted', async () => {
    const store = await createTimelineStore();
    await store.put(makePayload('A', 1000));
    await store.put(makePayload('B', 2000));
    await store.delete('A');
    await store.delete('B');
    expect(await store.list()).toEqual([]);
  });
});

describe('TimelineStore — fallback path', () => {
  it('falls back to in-memory engine when IndexedDB is unavailable and reports the fallback once', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).indexedDB;
    const onFallback = vi.fn();
    const store = await createTimelineStore({ onFallback });
    expect(store.isFallback).toBe(true);
    expect(onFallback).toHaveBeenCalledTimes(1);
    const err = onFallback.mock.calls[0]![0];
    expect(err).toBeInstanceOf(StorageUnavailableError);

    await store.put(makePayload('A', 1000));
    expect((await store.get('A'))?.savedAt).toBe(1000);
    expect(await store.list()).toEqual([{ name: 'A', savedAt: 1000 }]);
  });
});

describe('TimelineStore — in-memory engine (direct)', () => {
  it('round-trips and sorts on list', async () => {
    const store = _makeMemoryStoreForTests();
    await store.put(makePayload('A', 1000));
    await store.put(makePayload('B', 3000));
    await store.put(makePayload('C', 2000));
    expect((await store.list()).map((s) => s.name)).toEqual(['B', 'C', 'A']);
    await store.delete('B');
    expect((await store.list()).map((s) => s.name)).toEqual(['C', 'A']);
  });
});
