import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createControlMapStore } from './controlMapStore';
import type { ControlMapState } from '../midi/controlMap';

function freshIndexedDb() {
  // Reset the in-memory IndexedDB between tests so DBs don't leak across cases.
  globalThis.indexedDB = new IDBFactory();
}

const sample: ControlMapState = {
  version: 1,
  mappings: [
    {
      target: 'play',
      source: { kind: 'note', portId: 'port-A', channel: 1, data: 60 },
      edge: 'press',
      minValue: 1,
    },
  ],
};

beforeEach(() => {
  freshIndexedDb();
});

afterEach(() => {
  freshIndexedDb();
});

describe('createControlMapStore', () => {
  it('returns null when nothing has been saved (empty by default)', async () => {
    const store = await createControlMapStore();
    expect(await store.load()).toBeNull();
  });

  it('round-trips a saved mapping state', async () => {
    const store = await createControlMapStore();
    await store.save(sample);
    expect(await store.load()).toEqual(sample);
  });

  it('persists across store instances (survives reload / session load)', async () => {
    const first = await createControlMapStore();
    await first.save(sample);
    // A second store instance on the same IndexedDB simulates an app reload or
    // a session load — the global mapping state is independent of the session.
    const second = await createControlMapStore();
    expect(await second.load()).toEqual(sample);
  });

  it('retains mappings whose ports are absent (no pruning on load)', async () => {
    const withGhostPort: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'play', source: { kind: 'note', portId: 'unplugged-port', channel: 1, data: 60 } },
      ],
    };
    const store = await createControlMapStore();
    await store.save(withGhostPort);
    const loaded = await store.load();
    expect(loaded?.mappings[0]?.source.portId).toBe('unplugged-port');
  });
});
