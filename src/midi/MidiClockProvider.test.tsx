import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  MidiClockProvider,
  useMidiClock,
  type MidiClockValue,
} from './MidiClockProvider';
import { MidiRuntimeProvider } from './MidiRuntimeProvider';
import { ToastProvider } from '../components/toast/Toast';
import { TransportProvider } from '../hooks/useTransport';
import { __resetAccessCacheForTests } from './access';

interface FakeInput {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected';
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
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

function makeFakeAccess(inputs: FakeInput[]): MIDIAccess {
  const inputsMap = new Map<string, FakeInput>(inputs.map((i) => [i.id, i]));
  return {
    inputs: inputsMap,
    outputs: new Map(),
    sysexEnabled: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    onstatechange: null,
    dispatchEvent: () => true,
  } as unknown as MIDIAccess;
}

function fakeEvent(bytes: number[]): MIDIMessageEvent {
  return { data: new Uint8Array(bytes), timeStamp: 0 } as unknown as MIDIMessageEvent;
}

async function mountAndGrant(inputs: FakeInput[]) {
  const access = makeFakeAccess(inputs);
  const captured: { current: MidiClockValue | null } = { current: null };

  function Probe() {
    captured.current = useMidiClock();
    return null;
  }

  await act(async () => {
    render(
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider supported={true} requestMIDIAccessImpl={() => Promise.resolve(access)}>
            <MidiClockProvider>
              <Probe />
            </MidiClockProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>,
    );
    // Let the grant promise resolve and the provider effect re-run with the granted state.
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(captured.current).not.toBeNull();
  return { captured, access };
}

function startFakeTimers() {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
}

function firePulse(input: FakeInput) {
  act(() => {
    input.onmidimessage?.(fakeEvent([0xf8]));
  });
}

function fireMany(input: FakeInput, n: number, gapMs = 0) {
  for (let i = 0; i < n; i++) {
    firePulse(input);
    if (gapMs > 0) {
      act(() => {
        vi.advanceTimersByTime(gapMs);
      });
    }
  }
}

function fireStart(input: FakeInput) {
  act(() => {
    input.onmidimessage?.(fakeEvent([0xfa]));
  });
}

function fireContinue(input: FakeInput) {
  act(() => {
    input.onmidimessage?.(fakeEvent([0xfb]));
  });
}

function fireStop(input: FakeInput) {
  act(() => {
    input.onmidimessage?.(fakeEvent([0xfc]));
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  __resetAccessCacheForTests();
});

describe('MidiClockProvider — no-op when MIDI runtime not granted', () => {
  test('returns default state and attaches no handlers when unsupported', () => {
    const input = makeInput('a');
    const captured: { current: MidiClockValue | null } = { current: null };
    function Probe() {
      captured.current = useMidiClock();
      return null;
    }
    render(
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider supported={false}>
            <MidiClockProvider>
              <Probe />
            </MidiClockProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>,
    );

    expect(captured.current).toEqual({
      present: false,
      bpm: null,
      pulse: 0,
      beat: 0,
      running: false,
      selection: 'auto',
      setSelection: expect.any(Function),
    });
    expect(input.onmidimessage).toBeNull();
  });
});

describe('MidiClockProvider — pulse and BPM', () => {
  test('bpm is null until 24 pulses observed; positive integer at 24th pulse', async () => {
    const input = makeInput('a');
    const { captured } = await mountAndGrant([input]);
    startFakeTimers();

    firePulse(input);
    for (let i = 1; i < 23; i++) {
      act(() => vi.advanceTimersByTime(21));
      firePulse(input);
      expect(captured.current!.bpm).toBeNull();
    }
    act(() => vi.advanceTimersByTime(21));
    firePulse(input);

    expect(captured.current!.bpm).not.toBeNull();
    expect(captured.current!.pulse).toBe(24);
    expect(captured.current!.beat).toBe(1);
  });

  test('pulse and beat are monotonic; beat = floor(pulse / 24)', async () => {
    const input = makeInput('a');
    const { captured } = await mountAndGrant([input]);
    startFakeTimers();

    fireMany(input, 50, 21);
    expect(captured.current!.pulse).toBe(50);
    expect(captured.current!.beat).toBe(2);
  });
});

describe('MidiClockProvider — running flag', () => {
  test('running follows Start and Stop from the active master', async () => {
    const input = makeInput('a');
    const { captured } = await mountAndGrant([input]);
    startFakeTimers();

    firePulse(input);
    expect(captured.current!.running).toBe(false);

    fireStart(input);
    expect(captured.current!.running).toBe(true);

    fireStop(input);
    expect(captured.current!.running).toBe(false);
  });

  test('Continue sets running without resetting pulse', async () => {
    const input = makeInput('a');
    const { captured } = await mountAndGrant([input]);
    startFakeTimers();

    fireMany(input, 10, 21);
    expect(captured.current!.pulse).toBe(10);
    fireContinue(input);
    expect(captured.current!.running).toBe(true);
    expect(captured.current!.pulse).toBe(10);
  });

  test('Start before any clock pulse is ignored', async () => {
    const input = makeInput('a');
    const { captured } = await mountAndGrant([input]);
    startFakeTimers();

    fireStart(input);
    expect(captured.current!.running).toBe(false);
  });
});

describe('MidiClockProvider — active master tracking', () => {
  test('second master is ignored while first is active', async () => {
    const a = makeInput('a');
    const b = makeInput('b');
    const { captured } = await mountAndGrant([a, b]);
    startFakeTimers();

    fireMany(a, 5, 21);
    expect(captured.current!.pulse).toBe(5);

    fireMany(b, 10, 21);
    expect(captured.current!.pulse).toBe(5);
  });

  test('active master changes after 2000 ms silence from prior master', async () => {
    const a = makeInput('a');
    const b = makeInput('b');
    const { captured } = await mountAndGrant([a, b]);
    startFakeTimers();

    fireMany(a, 30, 21);
    expect(captured.current!.pulse).toBe(30);

    act(() => vi.advanceTimersByTime(2100));

    firePulse(b);
    expect(captured.current!.pulse).toBe(1);
    expect(captured.current!.beat).toBe(0);
    expect(captured.current!.bpm).toBeNull();
  });
});

describe('MidiClockProvider — present flag', () => {
  test('present is true after a pulse, false after 500 ms silence (bpm preserved)', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    fireMany(a, 30, 21);
    expect(captured.current!.present).toBe(true);
    const bpmBefore = captured.current!.bpm;
    // 21 ms gap is close to but not exactly 20.833 ms, so allow ±1 BPM tolerance.
    expect(bpmBefore).toBeGreaterThanOrEqual(118);
    expect(bpmBefore).toBeLessThanOrEqual(121);

    act(() => vi.advanceTimersByTime(600));
    expect(captured.current!.present).toBe(false);
    expect(captured.current!.bpm).toBe(bpmBefore);
  });
});

describe('MidiClockProvider — selection', () => {
  test('default selection is auto', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    expect(captured.current!.selection).toBe('auto');
  });

  test('setSelection(internal) discards subsequent pulses and reverts clockSource', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    // First, lock in via auto pulse so clockSource flips to external.
    fireMany(a, 25, 21);
    expect(captured.current!.pulse).toBe(25);

    // User picks Internal.
    act(() => {
      captured.current!.setSelection('internal');
    });
    expect(captured.current!.selection).toBe('internal');
    expect(captured.current!.pulse).toBe(0);
    expect(captured.current!.bpm).toBeNull();

    // Further pulses must not advance counters.
    fireMany(a, 10, 21);
    expect(captured.current!.pulse).toBe(0);
    expect(captured.current!.bpm).toBeNull();
  });

  test('setSelection(<deviceId>) accepts only that device', async () => {
    const a = makeInput('a');
    const b = makeInput('b');
    const { captured } = await mountAndGrant([a, b]);
    startFakeTimers();

    act(() => {
      captured.current!.setSelection('b');
    });
    expect(captured.current!.selection).toBe('b');

    // A's pulses are discarded.
    fireMany(a, 30, 21);
    expect(captured.current!.pulse).toBe(0);

    // B's pulses count.
    fireMany(b, 30, 21);
    expect(captured.current!.pulse).toBe(30);
  });

  test('locked device silence does not auto-revert', async () => {
    const a = makeInput('a');
    const b = makeInput('b');
    const { captured } = await mountAndGrant([a, b]);
    startFakeTimers();

    act(() => {
      captured.current!.setSelection('b');
    });
    // Capture B at speed enough for bpm.
    fireMany(b, 30, 21);
    const lockedBpm = captured.current!.bpm;
    expect(lockedBpm).not.toBeNull();

    // B goes silent for 600 ms → present should flip false.
    act(() => vi.advanceTimersByTime(600));
    expect(captured.current!.present).toBe(false);

    // But bpm stays at last value (frozen — no reset to null).
    expect(captured.current!.bpm).toBe(lockedBpm);

    // setSelection('internal') recovers.
    act(() => {
      captured.current!.setSelection('internal');
    });
    expect(captured.current!.selection).toBe('internal');
    expect(captured.current!.bpm).toBeNull();
  });

  test('setSelection with same value is a no-op', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    fireMany(a, 30, 21);
    const pulseBefore = captured.current!.pulse;
    const bpmBefore = captured.current!.bpm;

    act(() => {
      captured.current!.setSelection('auto');
    });
    expect(captured.current!.pulse).toBe(pulseBefore);
    expect(captured.current!.bpm).toBe(bpmBefore);
  });

  test('setSelection resets pulse, beat, bpm, running, present', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    fireMany(a, 30, 21);
    fireStart(a);
    expect(captured.current!.pulse).toBe(30);
    expect(captured.current!.running).toBe(true);

    act(() => {
      captured.current!.setSelection('internal');
    });
    expect(captured.current!.pulse).toBe(0);
    expect(captured.current!.beat).toBe(0);
    expect(captured.current!.bpm).toBeNull();
    expect(captured.current!.running).toBe(false);
    expect(captured.current!.present).toBe(false);
  });
});
