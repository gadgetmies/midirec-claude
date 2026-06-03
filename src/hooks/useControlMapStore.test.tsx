import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import {
  ControlMapStoreProvider,
  useControlMapStore,
  type ControlMapStoreValue,
} from './useControlMapStore';
import { serializeControlMap, type ControlMapState } from '../midi/controlMap';
import type { ControlMapStore } from '../storage/controlMapStore';

afterEach(() => {
  cleanup();
});

function fakeStore(initial: ControlMapState | null = null): ControlMapStore & { saved: ControlMapState[] } {
  const saved: ControlMapState[] = [];
  let held = initial;
  return {
    isFallback: true,
    saved,
    async load() {
      return held;
    },
    async save(state) {
      held = state;
      saved.push(state);
    },
  };
}

async function harness(store: ControlMapStore) {
  const captured: { current: ControlMapStoreValue | null } = { current: null };
  function Probe() {
    captured.current = useControlMapStore();
    return null;
  }
  render(
    <ControlMapStoreProvider createStore={async () => store}>
      <Probe />
    </ControlMapStoreProvider>,
  );
  await waitFor(() => expect(captured.current?.loaded).toBe(true));
  return captured;
}

describe('useControlMapStore', () => {
  it('starts with an empty mapping set when nothing is stored', async () => {
    const c = await harness(fakeStore(null));
    expect(c.current!.state.mappings).toEqual([]);
  });

  it('loads previously stored mappings at start', async () => {
    const stored: ControlMapState = {
      version: 1,
      mappings: [{ target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 } }],
    };
    const c = await harness(fakeStore(stored));
    expect(c.current!.state.mappings).toHaveLength(1);
  });

  it('assign adds a mapping and persists it', async () => {
    const store = fakeStore(null);
    const c = await harness(store);
    act(() => {
      c.current!.assign('play', { kind: 'note', portId: 'p', channel: 1, data: 60 });
    });
    expect(c.current!.state.mappings).toHaveLength(1);
    await waitFor(() => expect(store.saved.length).toBeGreaterThan(0));
  });

  it('assign binds a source to multiple targets and reports the others', async () => {
    const store = fakeStore({
      version: 1,
      mappings: [{ target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 } }],
    });
    const c = await harness(store);
    let alsoBoundTo: string[] = [];
    act(() => {
      alsoBoundTo = c.current!.assign('record', { kind: 'note', portId: 'p', channel: 1, data: 60 });
    });
    expect(alsoBoundTo).toEqual(['play']);
    expect(c.current!.state.mappings).toHaveLength(2);
    expect(c.current!.state.mappings.map((m) => m.target).sort()).toEqual(['play', 'record']);
  });

  it('importJson replaces the active set', async () => {
    const c = await harness(fakeStore(null));
    const incoming = serializeControlMap({
      version: 1,
      mappings: [{ target: 'cue', source: { kind: 'note', portId: 'q', channel: 2, data: 40 } }],
    });
    act(() => {
      c.current!.importJson(incoming);
    });
    expect(c.current!.state.mappings).toHaveLength(1);
    expect(c.current!.state.mappings[0]!.target).toBe('cue');
  });

  it('setListenInputs records which input ports the receiver listens to', async () => {
    const c = await harness(fakeStore(null));
    act(() => {
      c.current!.setListenInputs(['port-A', 'port-B']);
    });
    expect(c.current!.state.listenInputIds).toEqual(['port-A', 'port-B']);
  });

  it('importJson throws and leaves state unchanged on an invalid payload', async () => {
    const c = await harness(fakeStore(null));
    expect(() => c.current!.importJson('{ not valid json')).toThrow();
    expect(c.current!.state.mappings).toEqual([]);
  });
});
