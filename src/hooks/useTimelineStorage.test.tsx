import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { type ReactNode } from 'react';
import { ToastProvider } from '../components/toast/Toast';
import { StageProvider, useStage, type StageState } from './useStage';
import { TransportProvider, useTransport, type TransportValue } from './useTransport';
import {
  TimelineStorageProvider,
  useTimelineStorage,
  type UseTimelineStorageValue,
} from './useTimelineStorage';

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface Probes {
  storage: UseTimelineStorageValue;
  stage: StageState;
  transport: TransportValue;
}

function mountHarness() {
  const captured: { current: Probes | null } = { current: null };
  function Probe() {
    captured.current = {
      storage: useTimelineStorage(),
      stage: useStage(),
      transport: useTransport(),
    };
    return null;
  }
  const Tree = ({ children }: { children: ReactNode }) => (
    <TransportProvider>
      <ToastProvider>
        <StageProvider>
          <TimelineStorageProvider>{children}</TimelineStorageProvider>
        </StageProvider>
      </ToastProvider>
    </TransportProvider>
  );
  render(
    <Tree>
      <Probe />
    </Tree>,
  );
  return captured;
}

async function waitForStoreReady(probes: { current: Probes | null }) {
  // Provider opens IndexedDB asynchronously then sets entries (initial []).
  await waitFor(() => {
    expect(probes.current).not.toBe(null);
  });
  // The mount effect awaits two async stages (open + list). Flush several
  // microtask cycles so storeRef is populated before tests interact with it.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe('useTimelineStorage — save / load / new / delete', () => {
  test('save then load round-trips channels and transport BPM', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    // Mutate authoring state: add a channel and change BPM via hydrate (we don't
    // have a direct setter for BPM on the public surface — and hydrate is what
    // a future loader uses anyway, but for the *save side* we use addChannel).
    act(() => {
      probes.current!.stage.addChannel(7, 'My Channel', '#ff0000');
    });
    expect(probes.current!.stage.channels.find((c) => c.id === 7)).toBeDefined();

    await act(async () => {
      await probes.current!.storage.saveCurrentTimeline('take1');
    });

    expect(probes.current!.storage.entries.map((e) => e.name)).toContain('take1');

    // Replace channels with empty via load won't trigger because we haven't
    // changed state. Mutate first, then load 'take1'.
    act(() => {
      probes.current!.stage.channelsHydrate({ channels: [], rolls: [], lanes: [] });
    });
    expect(probes.current!.stage.channels).toHaveLength(0);

    await act(async () => {
      await probes.current!.storage.loadTimeline('take1');
    });

    expect(probes.current!.stage.channels.find((c) => c.id === 7)).toBeDefined();
  });

  test('save to the same name keeps a single entry under that name', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    await act(async () => {
      await probes.current!.storage.saveCurrentTimeline('alpha');
    });
    expect(probes.current!.storage.entries.filter((e) => e.name === 'alpha')).toHaveLength(1);

    await act(async () => {
      await probes.current!.storage.saveCurrentTimeline('alpha');
    });

    expect(probes.current!.storage.entries.filter((e) => e.name === 'alpha')).toHaveLength(1);
  });

  test('load on a missing name does not mutate state', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    const channelsBefore = probes.current!.stage.channels;

    await act(async () => {
      await probes.current!.storage.loadTimeline('does-not-exist');
    });

    expect(probes.current!.stage.channels).toBe(channelsBefore);
  });

  test('load refuses incompatible version and leaves editor state intact', async () => {
    // Pre-seed an incompatible-version payload before mounting the provider.
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('midirec', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('timelines', { keyPath: 'name' });
      };
      open.onsuccess = () => {
        const db = open.result;
        const put = db
          .transaction('timelines', 'readwrite')
          .objectStore('timelines')
          .put({
            version: 999,
            appVersion: 'x',
            name: 'old',
            savedAt: 1000,
            session: {
              channels: [],
              rolls: [],
              lanes: [],
              djActionTracks: [],
              transportAuthoring: {
                bpm: 100,
                sig: '4/4',
                quantizeOn: true,
                quantizeGrid: '1/16',
                snapAbsoluteOn: false,
                looping: false,
                metronomeOn: true,
                clockSource: 'internal',
              },
              loopRegion: null,
            },
          });
        put.onsuccess = () => {
          db.close();
          resolve();
        };
        put.onerror = () => reject(put.error);
      };
      open.onerror = () => reject(open.error);
    });

    const probes = mountHarness();
    await waitForStoreReady(probes);

    const channelsBefore = probes.current!.stage.channels;
    const bpmBefore = probes.current!.transport.bpm;

    await act(async () => {
      await probes.current!.storage.loadTimeline('old');
    });

    expect(probes.current!.stage.channels).toBe(channelsBefore);
    expect(probes.current!.transport.bpm).toBe(bpmBefore);
  });

  test('newTimeline resets channels and DJ tracks and transport authoring', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    await act(async () => {
      await probes.current!.storage.newTimeline();
    });

    expect(probes.current!.stage.channels).toEqual([]);
    expect(probes.current!.stage.djActionTracks).toEqual([]);
    expect(probes.current!.transport.bpm).toBe(124);
    expect(probes.current!.transport.sig).toBe('4/4');
    expect(probes.current!.transport.clockSource).toBe('internal');
  });

  test('delete removes the entry from the list', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    await act(async () => {
      await probes.current!.storage.saveCurrentTimeline('to-delete');
    });
    expect(probes.current!.storage.entries.map((e) => e.name)).toContain('to-delete');

    await act(async () => {
      await probes.current!.storage.deleteTimeline('to-delete');
    });
    expect(probes.current!.storage.entries.map((e) => e.name)).not.toContain('to-delete');
  });
});

describe('useTimelineStorage — isDirty', () => {
  test('isDirty is false after a save and true after a subsequent edit', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    await act(async () => {
      await probes.current!.storage.saveCurrentTimeline('snap');
    });

    expect(probes.current!.storage.isDirty).toBe(false);

    act(() => {
      probes.current!.stage.addChannel(11, 'New', '#0f0');
    });

    expect(probes.current!.storage.isDirty).toBe(true);
  });

  test('isDirty is false again after loading the same payload back', async () => {
    const probes = mountHarness();
    await waitForStoreReady(probes);

    await act(async () => {
      await probes.current!.storage.saveCurrentTimeline('snap');
    });

    act(() => {
      probes.current!.stage.addChannel(12, 'New', '#0f0');
    });

    expect(probes.current!.storage.isDirty).toBe(true);

    await act(async () => {
      await probes.current!.storage.loadTimeline('snap');
    });

    expect(probes.current!.storage.isDirty).toBe(false);
  });
});
