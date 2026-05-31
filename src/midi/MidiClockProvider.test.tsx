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
  /* The provider now reads `event.timeStamp` for inter-pulse delta math
     (immune to JS main-thread jitter). Populate from performance.now()
     which is spied to track fake-time in these tests. */
  return {
    data: new Uint8Array(bytes),
    timeStamp: typeof performance !== 'undefined' ? performance.now() : 0,
  } as unknown as MIDIMessageEvent;
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
      strictStart: true,
      setSelection: expect.any(Function),
      setStrictStart: expect.any(Function),
      onPulse: expect.any(Function),
      onStart: expect.any(Function),
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

  test('clockSource does NOT revert after 500ms silence (only present flips)', async () => {
    /* Spec: revert is at 2000ms, not 500ms. A brief gap (USB jitter, GC
       pause) should NOT drop us back to internal. */
    const { useTransport } = await import('../hooks/useTransport');
    const a = makeInput('a');
    const access = makeFakeAccess([a]);
    const transportProbe: {
      current: ReturnType<typeof useTransport> | null;
    } = { current: null };

    function Probe() {
      transportProbe.current = useTransport();
      return null;
    }

    await act(async () => {
      render(
        <TransportProvider>
          <ToastProvider>
            <MidiRuntimeProvider
              supported={true}
              requestMIDIAccessImpl={() => Promise.resolve(access)}
            >
              <MidiClockProvider>
                <Probe />
              </MidiClockProvider>
            </MidiRuntimeProvider>
          </ToastProvider>
        </TransportProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    startFakeTimers();

    fireMany(a, 30, 21);
    expect(transportProbe.current!.clockSource).toBe('external-clock');

    /* 600ms silence: present flips false, but source stays external. */
    act(() => vi.advanceTimersByTime(600));
    expect(transportProbe.current!.clockSource).toBe('external-clock');

    /* Another 1500ms (cumulative ~2100ms): source reverts to internal. */
    act(() => vi.advanceTimersByTime(1500));
    expect(transportProbe.current!.clockSource).toBe('internal');
  });
});

describe('MidiClockProvider — deltaMs cap protects timecode from jolts', () => {
  test('a long gap followed by a resumed pulse advances timecode by at most one pulse interval', async () => {
    const { useTransport } = await import('../hooks/useTransport');
    const a = makeInput('a');
    const access = makeFakeAccess([a]);
    const transportProbe: {
      current: ReturnType<typeof useTransport> | null;
    } = { current: null };

    function Probe() {
      transportProbe.current = useTransport();
      return null;
    }

    await act(async () => {
      render(
        <TransportProvider>
          <ToastProvider>
            <MidiRuntimeProvider
              supported={true}
              requestMIDIAccessImpl={() => Promise.resolve(access)}
            >
              <MidiClockProvider>
                <Probe />
              </MidiClockProvider>
            </MidiRuntimeProvider>
          </ToastProvider>
        </TransportProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    startFakeTimers();

    /* Build up a normal pulse history and enter play mode so external
       pulses advance timecodeMs. */
    act(() => transportProbe.current!.play());
    fireMany(a, 24, 21);
    const tcBefore = transportProbe.current!.timecodeMs;

    /* Long silence (1000ms) then a single resumed pulse — the raw delta
       would be ~1000ms, but the cap forces ≤50ms. */
    act(() => vi.advanceTimersByTime(1000));
    firePulse(a);

    const tcAfter = transportProbe.current!.timecodeMs;
    const advanced = tcAfter - tcBefore;
    expect(advanced).toBeLessThanOrEqual(60); // cap is 50 + flush slack
  });
});

describe('MidiClockProvider — event.timeStamp drives delta math', () => {
  test('subscriber timestamps mirror event.timeStamp, not performance.now()', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    const calls: number[] = [];
    act(() => {
      captured.current!.onPulse((ts) => calls.push(ts));
    });

    /* Fire one pulse, then advance time, then verify the subscriber saw the
       event's timestamp (= performance.now() at fire time), not a later
       value. */
    const tBefore = performance.now();
    firePulse(a);

    expect(calls.length).toBe(1);
    expect(calls[0]).toBeCloseTo(tBefore, 0);
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

describe('MidiClockProvider — onPulse subscription', () => {
  test('subscriber fires once per accepted pulse with monotonic timestamps', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    const calls: number[] = [];
    act(() => {
      captured.current!.onPulse((ts) => calls.push(ts));
    });

    fireMany(a, 5, 21);
    expect(calls.length).toBe(5);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1]);
    }
  });

  test('discarded pulses (non-active master) do not fire subscribers', async () => {
    const a = makeInput('a');
    const b = makeInput('b');
    const { captured } = await mountAndGrant([a, b]);
    startFakeTimers();

    const calls: number[] = [];
    act(() => {
      captured.current!.onPulse((ts) => calls.push(ts));
    });

    firePulse(a); // A becomes master
    expect(calls.length).toBe(1);

    firePulse(b); // B should be discarded
    expect(calls.length).toBe(1);
  });

  test('selection === "internal" silences subscribers', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    act(() => {
      captured.current!.setSelection('internal');
    });

    const calls: number[] = [];
    act(() => {
      captured.current!.onPulse((ts) => calls.push(ts));
    });

    fireMany(a, 5, 21);
    expect(calls.length).toBe(0);
  });

  test('returned unsubscribe stops calls', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();

    const calls: number[] = [];
    let unsub: (() => void) | null = null;
    act(() => {
      unsub = captured.current!.onPulse((ts) => calls.push(ts));
    });

    firePulse(a);
    expect(calls.length).toBe(1);

    act(() => {
      unsub!();
    });

    fireMany(a, 3, 21);
    expect(calls.length).toBe(1);
  });

  test('throwing subscriber does not block other subscribers; logs error', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    startFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const goodCalls: number[] = [];
    act(() => {
      captured.current!.onPulse(() => {
        throw new Error('boom');
      });
      captured.current!.onPulse((ts) => goodCalls.push(ts));
    });

    firePulse(a);
    expect(goodCalls.length).toBe(1);
    expect(captured.current!.pulse).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('MidiClockProvider — strictStart', () => {
  test('default strictStart is true (matches MIDI 1.0 Start semantics)', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    expect(captured.current!.strictStart).toBe(true);
  });

  test('setStrictStart(false) flips state; setStrictStart(true) flips back', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    act(() => {
      captured.current!.setStrictStart(false);
    });
    expect(captured.current!.strictStart).toBe(false);
    act(() => {
      captured.current!.setStrictStart(true);
    });
    expect(captured.current!.strictStart).toBe(true);
  });

  test('setStrictStart with same value is a no-op', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    const before = captured.current!;
    act(() => {
      captured.current!.setStrictStart(true);
    });
    expect(captured.current!.pulse).toBe(before.pulse);
    expect(captured.current!.bpm).toBe(before.bpm);
  });

  test('setSelection preserves strictStart across selection changes', async () => {
    const a = makeInput('a');
    const { captured } = await mountAndGrant([a]);
    act(() => {
      captured.current!.setStrictStart(false);
    });
    expect(captured.current!.strictStart).toBe(false);
    act(() => {
      captured.current!.setSelection('internal');
    });
    expect(captured.current!.strictStart).toBe(false);
  });

  test('strictStart=true causes Start to rewind transport before play', async () => {
    /* End-to-end: probe transport alongside MidiClock so we can advance the
       playhead, then send Start and verify it rewinds to 0. */
    const { useTransport } = await import('../hooks/useTransport');
    const a = makeInput('a');
    const access = makeFakeAccess([a]);
    const clockProbe: { current: MidiClockValue | null } = { current: null };
    const transportProbe: {
      current: ReturnType<typeof useTransport> | null;
    } = { current: null };

    function Probe() {
      clockProbe.current = useMidiClock();
      transportProbe.current = useTransport();
      return null;
    }

    await act(async () => {
      render(
        <TransportProvider>
          <ToastProvider>
            <MidiRuntimeProvider
              supported={true}
              requestMIDIAccessImpl={() => Promise.resolve(access)}
            >
              <MidiClockProvider>
                <Probe />
              </MidiClockProvider>
            </MidiRuntimeProvider>
          </ToastProvider>
        </TransportProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    startFakeTimers();

    /* Drive timecodeMs > 0 via play + external pulses (under external clock
       the rAF tick is gated, so pulses are the only advance path). */
    act(() => {
      transportProbe.current!.play();
    });
    fireMany(a, 48, 21); // 2 beats at 120 BPM-ish → tc advances by ~1000 ms
    act(() => {
      transportProbe.current!.pause();
    });

    const tcBeforeStart = transportProbe.current!.timecodeMs;
    expect(tcBeforeStart).toBeGreaterThan(0);

    /* strictStart is true by default — no need to flip it. */
    expect(clockProbe.current!.strictStart).toBe(true);

    fireStart(a);

    expect(transportProbe.current!.mode).toBe('play');
    expect(transportProbe.current!.timecodeMs).toBe(0);
    expect(transportProbe.current!.playheadTicks).toBe(0);
  });

  test('with strictStart=false, Start preserves position (resume-style)', async () => {
    const { useTransport } = await import('../hooks/useTransport');
    const a = makeInput('a');
    const access = makeFakeAccess([a]);
    const clockProbe: { current: MidiClockValue | null } = { current: null };
    const transportProbe: {
      current: ReturnType<typeof useTransport> | null;
    } = { current: null };

    function Probe() {
      clockProbe.current = useMidiClock();
      transportProbe.current = useTransport();
      return null;
    }

    await act(async () => {
      render(
        <TransportProvider>
          <ToastProvider>
            <MidiRuntimeProvider
              supported={true}
              requestMIDIAccessImpl={() => Promise.resolve(access)}
            >
              <MidiClockProvider>
                <Probe />
              </MidiClockProvider>
            </MidiRuntimeProvider>
          </ToastProvider>
        </TransportProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    startFakeTimers();

    act(() => {
      clockProbe.current!.setStrictStart(false);
    });

    act(() => {
      transportProbe.current!.play();
    });
    fireMany(a, 48, 21);
    act(() => {
      transportProbe.current!.pause();
    });

    const tcBefore = transportProbe.current!.timecodeMs;
    expect(tcBefore).toBeGreaterThan(0);

    fireStart(a);

    expect(transportProbe.current!.mode).toBe('play');
    /* Position preserved (within a small tolerance for floating-point math
       and the post-Start pulse-cap behavior). */
    expect(transportProbe.current!.timecodeMs).toBeGreaterThan(tcBefore - 1);
  });
});
