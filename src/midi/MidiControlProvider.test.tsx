import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/toast/Toast';
import { TransportProvider, useTransport, type TransportValue } from '../hooks/useTransport';
import {
  ControlMapStoreProvider,
  useControlMapStore,
  type ControlMapStoreValue,
} from '../hooks/useControlMapStore';
import { MidiRuntimeProvider } from './MidiRuntimeProvider';
import { MidiClockProvider } from './MidiClockProvider';
import { MidiClockSendProvider } from './MidiClockSendProvider';
import { MidiControlProvider, useMidiControl, type MidiControlValue } from './MidiControlProvider';
import { __resetAccessCacheForTests } from './access';
import type { ControlMapStore } from '../storage/controlMapStore';
import { emptyControlMapState, type ControlMapState } from './controlMap';

afterEach(() => {
  cleanup();
});

/* ── Fake Web MIDI input + access ───────────────────────────────────────── */

class FakeInput {
  onmidimessage: ((event: MIDIMessageEvent) => void) | null = null;
  private listeners = new Set<(event: MIDIMessageEvent) => void>();
  constructor(
    public id: string,
    public name = id,
    public manufacturer = '',
    public state: 'connected' | 'disconnected' = 'connected',
  ) {}
  addEventListener(type: string, cb: (event: MIDIMessageEvent) => void) {
    if (type === 'midimessage') this.listeners.add(cb);
  }
  removeEventListener(type: string, cb: (event: MIDIMessageEvent) => void) {
    if (type === 'midimessage') this.listeners.delete(cb);
  }
  fire(data: number[]) {
    // Mirror the DOM: both the onmidimessage property and addEventListener
    // listeners receive the event.
    const event = { data: new Uint8Array(data), timeStamp: 0 } as MIDIMessageEvent;
    this.onmidimessage?.(event);
    for (const cb of this.listeners) cb(event);
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

function fakeStore(initial: ControlMapState | null): ControlMapStore {
  let held = initial;
  return {
    isFallback: true,
    async load() {
      return held;
    },
    async save(s) {
      held = s;
    },
  };
}

interface Captured {
  transport: TransportValue | null;
  control: MidiControlValue | null;
  store: ControlMapStoreValue | null;
}

async function harness(initial: ControlMapState | null, input: FakeInput, strict = false) {
  __resetAccessCacheForTests();
  const captured: Captured = { transport: null, control: null, store: null };
  function Probe() {
    captured.transport = useTransport();
    captured.control = useMidiControl();
    captured.store = useControlMapStore();
    return null;
  }
  const tree = (
    <ToastProvider>
      <TransportProvider>
        <MidiRuntimeProvider requestMIDIAccessImpl={async () => fakeAccess([input])} supported>
          <MidiClockProvider>
            <MidiClockSendProvider>
              <ControlMapStoreProvider createStore={async () => fakeStore(initial)}>
                <MidiControlProvider>
                  <Probe />
                </MidiControlProvider>
              </ControlMapStoreProvider>
            </MidiClockSendProvider>
          </MidiClockProvider>
        </MidiRuntimeProvider>
      </TransportProvider>
    </ToastProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  // Wait for MIDI access grant + store load, so the handler is attached.
  await waitFor(() => {
    expect(captured.store?.loaded).toBe(true);
    expect(input.onmidimessage).toBeTruthy();
  });
  return captured;
}

const playMapping: ControlMapState = {
  version: 1,
  mappings: [
    { target: 'play', source: { kind: 'note', portId: 'ctrl', channel: 1, data: 60 }, edge: 'press', minValue: 1 },
  ],
};

describe('MidiControlProvider', () => {
  it('dispatches the mapped action when a matching message arrives (live)', async () => {
    const input = new FakeInput('ctrl');
    const c = await harness(playMapping, input);
    expect(c.transport!.playing).toBe(false);
    act(() => {
      input.fire([0x90, 60, 100]); // note-on C, ch1
    });
    expect(c.transport!.playing).toBe(true);
  });

  it('flips a boolean toggle target (metronome) via MIDI', async () => {
    const input = new FakeInput('ctrl');
    const metroMapping: ControlMapState = {
      version: 1,
      mappings: [
        {
          target: 'toggleMetronome',
          source: { kind: 'note', portId: 'ctrl', channel: 1, data: 62 },
          edge: 'press',
          buttonMode: 'toggle',
          minValue: 1,
        },
      ],
    };
    const c = await harness(metroMapping, input);
    const before = c.transport!.metronomeOn;
    act(() => {
      input.fire([0x90, 62, 100]); // note-on, mapped to toggleMetronome
    });
    expect(c.transport!.metronomeOn).toBe(!before);
  });

  it('flips a toggle exactly once per message under StrictMode (no double-fire)', async () => {
    const input = new FakeInput('ctrl');
    const metroMapping: ControlMapState = {
      version: 1,
      mappings: [
        {
          target: 'toggleMetronome',
          source: { kind: 'note', portId: 'ctrl', channel: 1, data: 62 },
          edge: 'press',
          buttonMode: 'toggle',
          minValue: 1,
        },
      ],
    };
    const c = await harness(metroMapping, input, /* strict */ true);
    const before = c.transport!.metronomeOn;
    act(() => {
      input.fire([0x90, 62, 100]);
    });
    // A single message must flip the toggle exactly once. If the control handler
    // is attached twice (corrupted onmidimessage chain), it flips twice → no-op.
    expect(c.transport!.metronomeOn).toBe(!before);
  });

  it('keeps mapped controls effective in map mode when nothing is armed', async () => {
    const input = new FakeInput('ctrl');
    const c = await harness(playMapping, input);
    act(() => {
      c.control!.enterMapMode();
    });
    act(() => {
      input.fire([0x90, 60, 100]);
    });
    expect(c.transport!.playing).toBe(true); // still effective in map mode
  });

  it('captures (does not trigger) while a target is armed in map mode', async () => {
    const input = new FakeInput('ctrl');
    const c = await harness(playMapping, input);
    act(() => {
      c.control!.enterMapMode();
      c.control!.arm('record'); // arm a different target
    });
    act(() => {
      input.fire([0x90, 60, 100]); // the play-mapped source
    });
    // The press was captured for the armed target, not dispatched to play.
    expect(c.transport!.playing).toBe(false);
    const recordMapping = c.store!.state.mappings.find((m) => m.target === 'record');
    expect(recordMapping?.source).toMatchObject({ kind: 'note', data: 60 });
  });

  it('learns the next qualifying message into the armed target', async () => {
    const input = new FakeInput('ctrl');
    const c = await harness(emptyControlMapState(), input);
    act(() => {
      c.control!.enterMapMode();
      c.control!.arm('record');
    });
    act(() => {
      input.fire([0xb0, 21, 127]); // CC 21 on ch1
    });
    await waitFor(() => {
      expect(c.store!.state.mappings).toHaveLength(1);
    });
    const m = c.store!.state.mappings[0]!;
    expect(m.target).toBe('record');
    expect(m.source).toMatchObject({ kind: 'cc', channel: 1, data: 21, portId: 'ctrl' });
    expect(c.control!.armedTarget).toBeNull();
  });

  it('ignores messages from ports outside the listened-input filter', async () => {
    const input = new FakeInput('ctrl');
    const filtered: ControlMapState = { ...playMapping, listenInputIds: ['some-other-port'] };
    const c = await harness(filtered, input);
    act(() => {
      input.fire([0x90, 60, 100]); // from 'ctrl', which is not in the filter
    });
    expect(c.transport!.playing).toBe(false);
  });

  it('entering map mode stops an active recording', async () => {
    const input = new FakeInput('ctrl');
    const c = await harness(emptyControlMapState(), input);
    act(() => {
      c.transport!.record();
    });
    expect(c.transport!.recording).toBe(true);
    act(() => {
      c.control!.enterMapMode();
    });
    expect(c.transport!.recording).toBe(false);
  });
});
