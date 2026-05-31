import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  MidiClockSendProvider,
  useMidiClockSend,
  type MidiClockSendValue,
} from './MidiClockSendProvider';
import { MidiClockProvider } from './MidiClockProvider';
import { MidiRuntimeProvider } from './MidiRuntimeProvider';
import { ToastProvider } from '../components/toast/Toast';
import { TransportProvider, useTransport, type TransportValue } from '../hooks/useTransport';
import { __resetAccessCacheForTests } from './access';

interface SendCall {
  outId: string;
  data: number[];
  timestamp: number | undefined;
}

interface FakeOutput {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected';
  send: (data: number[] | Uint8Array, timestamp?: number) => void;
}

interface FakeInput {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected';
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

function makeOutput(id: string, calls: SendCall[]): FakeOutput {
  return {
    id,
    name: id,
    manufacturer: '',
    state: 'connected',
    send(data, timestamp) {
      calls.push({
        outId: id,
        data: Array.from(data as ArrayLike<number>),
        timestamp,
      });
    },
  };
}

function makeInput(id: string): FakeInput {
  return {
    id,
    name: id,
    manufacturer: '',
    state: 'connected',
    onmidimessage: null,
  };
}

function makeFakeAccess(
  inputs: FakeInput[] = [],
  outputs: FakeOutput[] = [],
): MIDIAccess {
  return {
    inputs: new Map<string, FakeInput>(inputs.map((i) => [i.id, i])),
    outputs: new Map<string, FakeOutput>(outputs.map((o) => [o.id, o])),
    sysexEnabled: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    onstatechange: null,
    dispatchEvent: () => true,
  } as unknown as MIDIAccess;
}

function fakeEvent(bytes: number[]): MIDIMessageEvent {
  return {
    data: new Uint8Array(bytes),
    timeStamp: typeof performance !== 'undefined' ? performance.now() : 0,
  } as unknown as MIDIMessageEvent;
}

async function mountStack(
  inputs: FakeInput[],
  outputs: FakeOutput[],
  opts: { supported?: boolean } = {},
) {
  const access = makeFakeAccess(inputs, outputs);
  const send: { current: MidiClockSendValue | null } = { current: null };
  const transport: { current: TransportValue | null } = { current: null };

  function Probe() {
    send.current = useMidiClockSend();
    transport.current = useTransport();
    return null;
  }

  await act(async () => {
    render(
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider
            supported={opts.supported ?? true}
            requestMIDIAccessImpl={() => Promise.resolve(access)}
          >
            <MidiClockProvider>
              <MidiClockSendProvider>
                <Probe />
              </MidiClockSendProvider>
            </MidiClockProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  return { send, transport, access };
}

function flushRaf() {
  act(() => {
    /* requestAnimationFrame is polyfilled by JSDOM via the registered
       fake timer integration — advance enough to trigger queued rAF. */
    vi.advanceTimersByTime(20);
  });
}

beforeEach(() => {
  __resetAccessCacheForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  __resetAccessCacheForTests();
});

describe('MidiClockSendProvider — state defaults', () => {
  test('mounts with enabled=false, no selected outputs, txPulse=0', async () => {
    const { send } = await mountStack([], [makeOutput('a', [])]);
    expect(send.current!.enabled).toBe(false);
    expect(send.current!.selectedOutputIds.size).toBe(0);
    expect(send.current!.txPulse).toBe(0);
  });

  test('gridAlignment defaults to disabled, no output, note 60 ch1 vel127, bar, 8 bars', async () => {
    const { send } = await mountStack([], []);
    expect(send.current!.gridAlignment).toEqual({
      enabled: false,
      outputId: null,
      message: { kind: 'note', channel: 1, note: 60, velocity: 127 },
      boundary: 'bar',
      phraseBars: 8,
    });
  });

  test('useMidiClockSend throws when used outside provider', () => {
    /* Render a probe that swallows the throw — must throw a named error. */
    function Probe() {
      useMidiClockSend();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(/MidiClockSendProvider/);
  });
});

describe('MidiClockSendProvider — setEnabled clamp under no-grant', () => {
  test('setEnabled(true) is a no-op when MIDI is unsupported', async () => {
    const { send } = await mountStack([], [], { supported: false });
    act(() => {
      send.current!.setEnabled(true);
    });
    expect(send.current!.enabled).toBe(false);
  });
});

describe('MidiClockSendProvider — output selection', () => {
  test('toggleOutput flips membership', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.toggleOutput('out-a');
    });
    expect(send.current!.selectedOutputIds.has('out-a')).toBe(true);
    act(() => {
      send.current!.toggleOutput('out-a');
    });
    expect(send.current!.selectedOutputIds.has('out-a')).toBe(false);
  });

  test('selected id persists across hotplug-style operations', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a', 'out-b']);
    });
    /* out-b is not connected, but the id stays. */
    expect(send.current!.selectedOutputIds.has('out-b')).toBe(true);
  });
});

describe('MidiClockSendProvider — transport message emission', () => {
  test('Start emitted on idle → play with timecodeMs=0', async () => {
    const calls: SendCall[] = [];
    const { send, transport } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
    });
    calls.length = 0;
    act(() => {
      transport.current!.play();
    });
    const startCalls = calls.filter((c) => c.data[0] === 0xfa);
    expect(startCalls.length).toBe(1);
    /* No Continue. */
    expect(calls.some((c) => c.data[0] === 0xfb)).toBe(false);
  });

  test('Continue emitted on idle → play with timecodeMs > 0', async () => {
    const calls: SendCall[] = [];
    const { send, transport } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
    });
    /* Seek to non-zero timecode while idle. */
    act(() => {
      transport.current!.seek(5000);
    });
    calls.length = 0;
    act(() => {
      transport.current!.play();
    });
    const continueCalls = calls.filter((c) => c.data[0] === 0xfb);
    expect(continueCalls.length).toBe(1);
    expect(calls.some((c) => c.data[0] === 0xfa)).toBe(false);
  });

  test('Stop emitted on play → idle (pause)', async () => {
    const calls: SendCall[] = [];
    const { send, transport } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
      transport.current!.play();
    });
    calls.length = 0;
    act(() => {
      transport.current!.pause();
    });
    const stopCalls = calls.filter((c) => c.data[0] === 0xfc);
    expect(stopCalls.length).toBe(1);
  });

  test('record mode entry and exit emit no transport messages', async () => {
    const calls: SendCall[] = [];
    const inputs = [makeInput('in-a')];
    const { send, transport } = await mountStack(inputs, [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
    });
    calls.length = 0;
    act(() => {
      transport.current!.record();
    });
    act(() => {
      transport.current!.pause();
    });
    /* No 0xFA/0xFB/0xFC attributable to the record transitions. */
    const transportBytes = calls.filter((c) =>
      [0xfa, 0xfb, 0xfc].includes(c.data[0]),
    );
    expect(transportBytes.length).toBe(0);
  });

  test('setEnabled(true) mid-play emits Continue when timecode > 0', async () => {
    const calls: SendCall[] = [];
    const { send, transport } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      transport.current!.play();
      transport.current!.seek(8000);
    });
    calls.length = 0;
    act(() => {
      send.current!.setEnabled(true);
    });
    const continueCalls = calls.filter((c) => c.data[0] === 0xfb);
    expect(continueCalls.length).toBe(1);
  });
});

describe('MidiClockSendProvider — sync action', () => {
  test('sync() is a no-op when disabled', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.sync();
    });
    expect(calls.length).toBe(0);
  });

  test('sync() emits Stop + SPP + Start at position 0', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
    });
    calls.length = 0;
    act(() => {
      send.current!.sync();
    });
    expect(calls.map((c) => c.data)).toEqual([
      [0xfc],
      [0xf2, 0x00, 0x00],
      [0xfa],
    ]);
  });

  test('sync() emits to every selected connected output', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack(
      [],
      [makeOutput('out-a', calls), makeOutput('out-b', calls)],
    );
    act(() => {
      send.current!.setSelectedOutputs(['out-a', 'out-b']);
      send.current!.setEnabled(true);
    });
    calls.length = 0;
    act(() => {
      send.current!.sync();
    });
    /* Each of the three bytes goes to both outputs (6 calls). */
    expect(calls.filter((c) => c.outId === 'out-a').length).toBe(3);
    expect(calls.filter((c) => c.outId === 'out-b').length).toBe(3);
  });

  test('sync() does not change txPulse', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
    });
    const txBefore = send.current!.txPulse;
    act(() => {
      send.current!.sync();
    });
    expect(send.current!.txPulse).toBe(txBefore);
  });
});

describe('MidiClockSendProvider — gridAlignment', () => {
  test('setGridAlignment clamps channel/note/velocity/phraseBars', async () => {
    const { send } = await mountStack([], []);
    act(() => {
      send.current!.setGridAlignment({
        message: { kind: 'note', channel: 99, note: 200, velocity: -5 },
      });
    });
    expect(send.current!.gridAlignment.message).toEqual({
      kind: 'note',
      channel: 16,
      note: 127,
      velocity: 0,
    });
    act(() => {
      send.current!.setGridAlignment({ phraseBars: 40 });
    });
    expect(send.current!.gridAlignment.phraseBars).toBe(32);
    act(() => {
      send.current!.setGridAlignment({ phraseBars: 0 });
    });
    expect(send.current!.gridAlignment.phraseBars).toBe(1);
  });

  test('manual fireGridAlignment emits regardless of grid enabled', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setGridAlignment({ outputId: 'out-a' });
    });
    act(() => {
      send.current!.fireGridAlignment();
    });
    /* Default message is Note ch1 note60 vel127 — expect [0x90, 60, 127]. */
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].data).toEqual([0x90, 60, 127]);
  });

  test('manual fireGridAlignment is a no-op when outputId === null', async () => {
    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.fireGridAlignment();
    });
    expect(calls.length).toBe(0);
  });

  test('automatic phrase-boundary fire in external mode', async () => {
    /* External relay path drives the pulse counter. With sig=4/4,
       phrase=1 bar, each 96 pulses (24 * 4 * 1) triggers a fire. */
    const outCalls: SendCall[] = [];
    const inputs = [makeInput('in-a')];
    const { send, transport } = await mountStack(
      inputs,
      [makeOutput('out-a', outCalls)],
    );
    /* Drive the clock receiver into external mode by firing a pulse. */
    const input = inputs[0];
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    act(() => {
      transport.current!.play();
    });
    act(() => {
      input.onmidimessage?.(fakeEvent([0xf8]));
    });
    /* clockSource should now be 'external-clock'. */
    expect(transport.current!.clockSource).toBe('external-clock');

    act(() => {
      send.current!.setGridAlignment({
        enabled: true,
        outputId: 'out-a',
        boundary: 'phrase',
        phraseBars: 1,
        message: { kind: 'cc', channel: 1, cc: 20, value: 64 },
      });
    });

    outCalls.length = 0;
    /* Subscription started after setGridAlignment; counter at 0. Fire 96
       pulses (= 1 phrase of 1 bar at 4/4) to hit the boundary. */
    for (let i = 0; i < 96; i++) {
      act(() => {
        vi.advanceTimersByTime(21);
        input.onmidimessage?.(fakeEvent([0xf8]));
      });
    }
    const ccBytes = outCalls.filter((c) => c.data[0] === 0xb0);
    expect(ccBytes.length).toBe(1);
    expect(ccBytes[0].data).toEqual([0xb0, 20, 64]);
  });

  test('pulse counter resets on incoming Start (external mode)', async () => {
    const outCalls: SendCall[] = [];
    const inputs = [makeInput('in-a')];
    const { send, transport } = await mountStack(
      inputs,
      [makeOutput('out-a', outCalls)],
    );
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    const input = inputs[0];
    act(() => {
      transport.current!.play();
    });
    /* Prime external mode and accumulate 47 pulses. */
    act(() => {
      input.onmidimessage?.(fakeEvent([0xf8]));
    });
    for (let i = 0; i < 46; i++) {
      act(() => {
        vi.advanceTimersByTime(21);
        input.onmidimessage?.(fakeEvent([0xf8]));
      });
    }
    act(() => {
      send.current!.setGridAlignment({
        enabled: true,
        outputId: 'out-a',
        boundary: 'bar',
        message: { kind: 'cc', channel: 1, cc: 20, value: 64 },
      });
    });
    outCalls.length = 0;
    /* Send Start (resets pulse counter to 0). */
    act(() => {
      input.onmidimessage?.(fakeEvent([0xfa]));
    });
    /* Fire 95 more pulses — counter just reset, would not yet hit 96 if
       reset worked. */
    for (let i = 0; i < 95; i++) {
      act(() => {
        vi.advanceTimersByTime(21);
        input.onmidimessage?.(fakeEvent([0xf8]));
      });
    }
    /* Counter at 95 — no fire yet. */
    expect(outCalls.filter((c) => c.data[0] === 0xb0).length).toBe(0);
    /* One more pulse — should fire now (counter hits 96). */
    act(() => {
      vi.advanceTimersByTime(21);
      input.onmidimessage?.(fakeEvent([0xf8]));
    });
    expect(outCalls.filter((c) => c.data[0] === 0xb0).length).toBe(1);
  });
});

describe('MidiClockSendProvider — internal scheduler / txPulse', () => {
  test('txPulse advances after pulses are emitted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    const calls: SendCall[] = [];
    const { send } = await mountStack([], [makeOutput('out-a', calls)]);
    act(() => {
      send.current!.setSelectedOutputs(['out-a']);
      send.current!.setEnabled(true);
    });
    /* Let the scheduler emit some pulses, then advance time so the
       rAF-coalesced bump fires. */
    act(() => {
      vi.advanceTimersByTime(200);
    });
    flushRaf();
    expect(send.current!.txPulse).toBeGreaterThan(0);
    const clockBytes = calls.filter((c) => c.data[0] === 0xf8);
    expect(clockBytes.length).toBeGreaterThan(0);
    act(() => {
      send.current!.setEnabled(false);
    });
  });
});
