import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { TransportProvider, useTransport, type TransportValue } from '../hooks/useTransport';
import { StageProvider, useStage, type StageState } from '../hooks/useStage';
import {
  ControlMapStoreProvider,
  useControlMapStore,
  type ControlMapStoreValue,
} from '../hooks/useControlMapStore';
import { MidiRuntimeProvider } from './MidiRuntimeProvider';
import { ToastProvider } from '../components/toast/Toast';
import { MidiRecorderRunner } from './recorder';
import { __resetAccessCacheForTests } from './access';
import type { ControlMapStore } from '../storage/controlMapStore';
import type { ControlMapState } from './controlMap';

afterEach(() => {
  cleanup();
});

class FakeInput {
  onmidimessage: ((event: MIDIMessageEvent) => void) | null = null;
  constructor(public id: string, public name = id, public manufacturer = '', public state: 'connected' | 'disconnected' = 'connected') {}
  fire(data: number[]) {
    this.onmidimessage?.({ data: new Uint8Array(data) } as MIDIMessageEvent);
  }
}

function fakeAccess(inputs: FakeInput[]): MIDIAccess {
  const inMap = new Map<string, FakeInput>();
  for (const i of inputs) inMap.set(i.id, i);
  return {
    inputs: inMap,
    outputs: new Map(),
    addEventListener() {},
    removeEventListener() {},
    onstatechange: null,
  } as unknown as MIDIAccess;
}

function fakeStore(initial: ControlMapState): ControlMapStore {
  let held: ControlMapState | null = initial;
  return { isFallback: true, async load() { return held; }, async save(s) { held = s; } };
}

// A mapping that claims note 60 on channel 15 for `play`. A high channel keeps
// the recorder's wire-channel row out of the default seed so a captured note
// is observable as a *new* channel row.
const MIDI_CH = 15;
const STATUS = 0x90 | (MIDI_CH - 1); // note-on, channel 15
const mapped: ControlMapState = {
  version: 1,
  mappings: [
    { target: 'play', source: { kind: 'note', portId: 'ctrl', channel: MIDI_CH, data: 60 }, edge: 'press', minValue: 1 },
  ],
};

interface Captured {
  transport: TransportValue | null;
  stage: StageState | null;
  store: ControlMapStoreValue | null;
}

async function harness(input: FakeInput) {
  __resetAccessCacheForTests();
  const captured: Captured = { transport: null, stage: null, store: null };
  function Probe() {
    captured.transport = useTransport();
    captured.stage = useStage();
    captured.store = useControlMapStore();
    return null;
  }
  render(
    <ToastProvider>
      <TransportProvider>
        <MidiRuntimeProvider requestMIDIAccessImpl={async () => fakeAccess([input])} supported>
          <ControlMapStoreProvider createStore={async () => fakeStore(mapped)}>
            <StageProvider>
              <MidiRecorderRunner />
              <Probe />
            </StageProvider>
          </ControlMapStoreProvider>
        </MidiRuntimeProvider>
      </TransportProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(captured.store?.loaded).toBe(true));
  return captured;
}

describe('recorder consumption of mapped messages', () => {
  it('skips a message matching an active mapping but captures an unmapped one', async () => {
    const input = new FakeInput('ctrl');
    const c = await harness(input);

    act(() => {
      c.transport!.record();
    });
    // Recorder attaches once recording is active and access is granted.
    await waitFor(() => expect(input.onmidimessage).toBeTruthy());

    const before = c.stage!.channels.length;

    // Mapped note (60) → consumed by control mapping → not recorded.
    act(() => {
      input.fire([STATUS, 60, 100]);
    });
    expect(c.stage!.channels.length).toBe(before);

    // Unmapped note (62) on the same channel → captured (new channel row).
    act(() => {
      input.fire([STATUS, 62, 100]);
    });
    expect(c.stage!.channels.length).toBe(before + 1);
  });
});
