import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/toast/Toast';
import { TransportProvider, useTransport, type TransportValue } from '../hooks/useTransport';
import { ControlMapStoreProvider, useControlMapStore, type ControlMapStoreValue } from '../hooks/useControlMapStore';
import { MidiRuntimeProvider } from './MidiRuntimeProvider';
import { MidiClockProvider } from './MidiClockProvider';
import { MidiClockSendProvider } from './MidiClockSendProvider';
import { MidiControlProvider } from './MidiControlProvider';
import { __resetAccessCacheForTests } from './access';
import type { ControlMapStore } from '../storage/controlMapStore';
import type { ControlMapState } from './controlMap';

afterEach(() => cleanup());

/* A fake MIDIInput that mirrors the DOM: both the `onmidimessage` property and
   any `addEventListener('midimessage', …)` listeners fire for an event. This
   lets the test exercise either attachment strategy. */
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
    const event = { data: new Uint8Array(data), timeStamp: 0 } as MIDIMessageEvent;
    this.onmidimessage?.(event);
    for (const cb of this.listeners) cb(event);
  }
}

/* A controllable MIDIAccess: inputs can be mutated and a `statechange` fired to
   drive the runtime's hotplug path (which re-runs the attach effects). */
class FakeAccess {
  inputs = new Map<string, FakeInput>();
  outputs = new Map<string, never>();
  private stateListeners = new Set<(e: Event) => void>();
  addEventListener(type: string, cb: (e: Event) => void) {
    if (type === 'statechange') this.stateListeners.add(cb);
  }
  removeEventListener(type: string, cb: (e: Event) => void) {
    if (type === 'statechange') this.stateListeners.delete(cb);
  }
  fireStatechange() {
    for (const cb of this.stateListeners) cb({} as Event);
  }
}

function fakeStore(initial: ControlMapState): ControlMapStore {
  let held: ControlMapState | null = initial;
  return { isFallback: true, async load() { return held; }, async save(s) { held = s; } };
}

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

describe('MidiControlProvider — no double-fire across re-attach', () => {
  it('flips a toggle once per message even after a hotplug re-attach (with clock receiver present)', async () => {
    __resetAccessCacheForTests();
    const access = new FakeAccess();
    const inputA = new FakeInput('ctrl');
    access.inputs.set(inputA.id, inputA);

    const captured: { transport: TransportValue | null; store: ControlMapStoreValue | null } = {
      transport: null,
      store: null,
    };
    function Probe() {
      captured.transport = useTransport();
      captured.store = useControlMapStore();
      return null;
    }

    render(
      <StrictMode>
        <ToastProvider>
          <TransportProvider>
            <MidiRuntimeProvider requestMIDIAccessImpl={async () => access as unknown as MIDIAccess} supported>
              <MidiClockProvider>
                <MidiClockSendProvider>
                  <ControlMapStoreProvider createStore={async () => fakeStore(metroMapping)}>
                    <MidiControlProvider>
                      <Probe />
                    </MidiControlProvider>
                  </ControlMapStoreProvider>
                </MidiClockSendProvider>
              </MidiClockProvider>
            </MidiRuntimeProvider>
          </TransportProvider>
        </ToastProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(captured.store?.loaded).toBe(true));

    // Force a hotplug so both the clock receiver and the control receiver
    // re-run their attach effects — this is where a chained onmidimessage slot
    // gets corrupted into a double control handler.
    act(() => {
      access.fireStatechange();
    });

    const before = captured.transport!.metronomeOn;
    act(() => {
      inputA.fire([0x90, 62, 100]);
    });
    expect(captured.transport!.metronomeOn).toBe(!before);
  });
});
