import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../components/toast/Toast';
import { StageProvider, useStage, type StageState } from './useStage';
import {
  TimelineStorageProvider,
  useTimelineStorage,
  type UseTimelineStorageValue,
} from './useTimelineStorage';
import { TransportProvider } from './useTransport';
import { TimelineDropProvider, useTimelineDrop } from './useTimelineDrop';
import {
  STORAGE_SCHEMA_VERSION,
  emptyTransportAuthoring,
} from '../storage/timelinePayload';
import { serializeTimelineToJsonl } from '../storage/timelineJsonl';
import type { Channel, PianoRollTrack, ParamLane } from './useChannels';

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
});

function Tree({ children }: { children: ReactNode }) {
  return (
    <TransportProvider>
      <ToastProvider>
        <StageProvider>
          <TimelineStorageProvider>
            <TimelineDropProvider>{children}</TimelineDropProvider>
          </TimelineStorageProvider>
        </StageProvider>
      </ToastProvider>
    </TransportProvider>
  );
}

interface Probes {
  stage: StageState;
  storage: UseTimelineStorageValue;
  drop: ReturnType<typeof useTimelineDrop>;
}

async function mountAndReady() {
  const probes: { current: Probes | null } = { current: null };
  function Probe() {
    probes.current = {
      stage: useStage(),
      storage: useTimelineStorage(),
      drop: useTimelineDrop(),
    };
    return null;
  }
  render(
    <Tree>
      <Probe />
    </Tree>,
  );
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return probes;
}

function makeJsonl(): string {
  const channel: Channel = {
    id: 7,
    name: 'Dropped',
    color: '#ff00ff',
    collapsed: false,
    muted: false,
    soloed: false,
    inputSources: [],
  };
  const roll: PianoRollTrack = {
    channelId: 7,
    notes: [{ tTicks: 960, durTicks: 240, pitch: 60, vel: 100 }],
    muted: false,
    soloed: false,
    collapsed: false,
  };
  const lane: ParamLane = {
    channelId: 7,
    kind: 'cc',
    cc: 7,
    name: 'Volume',
    color: 'var(--mr-cc)',
    points: [{ tTicks: 0, v: 0.5 }],
    muted: false,
    soloed: false,
    collapsed: false,
  };
  return serializeTimelineToJsonl({
    channels: [channel],
    rolls: [roll],
    lanes: [lane],
    djActionTracks: [],
    transport: emptyTransportAuthoring(),
    loopRegion: null,
    name: 'fromDrop',
  });
}

class FakeFile {
  constructor(public readonly name: string, private readonly _text: string) {}
  async text(): Promise<string> {
    return this._text;
  }
}

describe('useTimelineDrop — openFile (programmatic)', () => {
  test('loads .jsonl content directly when not dirty', async () => {
    const probes = await mountAndReady();
    const file = new FakeFile('fromDrop.jsonl', makeJsonl()) as unknown as File;

    await act(async () => {
      await probes.current!.drop.openFile(file);
    });

    await waitFor(() => {
      expect(probes.current!.stage.channels.find((c) => c.id === 7)?.name).toBe('Dropped');
    });
  });

  test('rejects unsupported extensions', async () => {
    const probes = await mountAndReady();
    const file = new FakeFile('not-a-timeline.txt', 'whatever') as unknown as File;

    await act(async () => {
      await probes.current!.drop.openFile(file);
    });

    expect(probes.current!.stage.channels.find((c) => c.id === 7)).toBeUndefined();
  });

  test('shows save-before-open dialog when editor isDirty; Save commits then loads', async () => {
    const probes = await mountAndReady();
    /* Dirty the editor by adding a channel (snapshot now differs from the
       last save/load marker). */
    act(() => {
      probes.current!.stage.addChannel(3, 'Dirty', '#abcdef');
    });
    expect(probes.current!.storage.isDirty).toBe(true);

    const file = new FakeFile('fromDrop.jsonl', makeJsonl()) as unknown as File;
    await act(async () => {
      void probes.current!.drop.openFile(file);
    });

    expect(screen.getByText(/Save before opening/)).toBeDefined();

    const nameInput = screen.getByPlaceholderText('Name…') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'pre-drop-save' } });
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    });

    /* Pre-existing channel was saved under "pre-drop-save"; then the dropped
       payload hydrated, replacing channels. */
    await waitFor(() => {
      expect(probes.current!.stage.channels.find((c) => c.id === 7)?.name).toBe('Dropped');
    });
    await waitFor(() => {
      expect(probes.current!.storage.entries.map((e) => e.name)).toContain('pre-drop-save');
    });
  });

  test('Discard skips save and proceeds with load', async () => {
    const probes = await mountAndReady();
    act(() => {
      probes.current!.stage.addChannel(3, 'Dirty', '#abcdef');
    });
    const file = new FakeFile('fromDrop.jsonl', makeJsonl()) as unknown as File;
    await act(async () => {
      void probes.current!.drop.openFile(file);
    });

    expect(screen.getByText(/Save before opening/)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Discard$/ }));
    });

    await waitFor(() => {
      expect(probes.current!.stage.channels.find((c) => c.id === 7)?.name).toBe('Dropped');
    });
    expect(probes.current!.storage.entries).toEqual([]);
  });

  test('Cancel keeps the existing editor state and drops the file', async () => {
    const probes = await mountAndReady();
    act(() => {
      probes.current!.stage.addChannel(3, 'Dirty', '#abcdef');
    });
    const channelsBefore = probes.current!.stage.channels;
    const file = new FakeFile('fromDrop.jsonl', makeJsonl()) as unknown as File;
    await act(async () => {
      void probes.current!.drop.openFile(file);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    });

    expect(probes.current!.stage.channels).toBe(channelsBefore);
  });
});

describe('useTimelineDrop — payload rejection', () => {
  test('incompatible version is rejected without mutating state', async () => {
    const probes = await mountAndReady();
    const channelsBefore = probes.current!.stage.channels;
    const text =
      `{"kind":"meta","version":999,"appVersion":"x","name":"bad","savedAt":0}\n`;
    const file = new FakeFile('bad.jsonl', text) as unknown as File;
    await act(async () => {
      await probes.current!.drop.openFile(file);
    });

    expect(probes.current!.stage.channels).toBe(channelsBefore);
    void STORAGE_SCHEMA_VERSION;
  });
});
