import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  emitClick,
  MetronomeRunner,
  resolveClickFrequency,
} from './metronome';
import { DEFAULT_MIDI_TPQ } from './timelineTicks';

let mockTransport = {
  mode: 'idle' as 'idle' | 'play' | 'record',
  metronomeOn: true,
  playheadTicks: 0,
  sig: '4/4',
};

vi.mock('../hooks/useTransport', () => ({
  useTransport: () => mockTransport,
}));

/* ── Fake AudioContext infrastructure ──────────────────────────────────── */

interface FakeOscillator {
  type: string;
  frequency: { value: number };
  startedAt: number | null;
  stoppedAt: number | null;
  connect: (target: unknown) => unknown;
  start: (atSec: number) => void;
  stop: (atSec: number) => void;
}

interface FakeGain {
  gain: {
    setValueAtTime: (v: number, t: number) => void;
    linearRampToValueAtTime: (v: number, t: number) => void;
    exponentialRampToValueAtTime: (v: number, t: number) => void;
  };
  connect: (target: unknown) => unknown;
}

interface FakeContext {
  state: 'running' | 'suspended' | 'closed';
  currentTime: number;
  destination: unknown;
  oscillators: FakeOscillator[];
  resumeCalls: number;
  closeCalls: number;
  createOscillator: () => FakeOscillator;
  createGain: () => FakeGain;
  resume: () => Promise<void>;
  close: () => Promise<void>;
}

let activeContext: FakeContext | null = null;
let contextCtorCalls = 0;

function makeFakeContext(): FakeContext {
  const ctx: FakeContext = {
    state: 'running',
    currentTime: 0,
    destination: { __dest: true },
    oscillators: [],
    resumeCalls: 0,
    closeCalls: 0,
    createOscillator(): FakeOscillator {
      const osc: FakeOscillator = {
        type: '',
        frequency: { value: 0 },
        startedAt: null,
        stoppedAt: null,
        connect: () => osc,
        start: (atSec: number) => {
          osc.startedAt = atSec;
        },
        stop: (atSec: number) => {
          osc.stoppedAt = atSec;
        },
      };
      ctx.oscillators.push(osc);
      return osc;
    },
    createGain(): FakeGain {
      const gain: FakeGain = {
        gain: {
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => gain,
      };
      return gain;
    },
    resume(): Promise<void> {
      ctx.resumeCalls++;
      ctx.state = 'running';
      return Promise.resolve();
    },
    close(): Promise<void> {
      ctx.closeCalls++;
      ctx.state = 'closed';
      return Promise.resolve();
    },
  };
  return ctx;
}

class FakeAudioContext {
  constructor() {
    contextCtorCalls++;
    activeContext = makeFakeContext();
    Object.assign(this, activeContext);
    return activeContext as unknown as FakeAudioContext;
  }
}

beforeEach(() => {
  activeContext = null;
  contextCtorCalls = 0;
  mockTransport = { mode: 'idle', metronomeOn: true, playheadTicks: 0, sig: '4/4' };
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderRunner() {
  return render(<MetronomeRunner />);
}

function updateTransport(patch: Partial<typeof mockTransport>) {
  mockTransport = { ...mockTransport, ...patch };
}

describe('metronome — pure helpers', () => {
  test('resolveClickFrequency: beat 0 is the higher accent pitch, others are tick pitch', () => {
    expect(resolveClickFrequency(0)).toBe(1500);
    for (const b of [1, 2, 3, 6]) {
      expect(resolveClickFrequency(b)).toBe(1000);
    }
  });

  test('emitClick wires an oscillator with the requested frequency and triangle waveform', () => {
    const ctx = makeFakeContext();
    emitClick(ctx as unknown as AudioContext, 1234, 5);
    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.oscillators[0].type).toBe('triangle');
    expect(ctx.oscillators[0].frequency.value).toBe(1234);
    expect(ctx.oscillators[0].startedAt).toBe(5);
    expect(ctx.oscillators[0].stoppedAt).toBeGreaterThan(5);
  });
});

describe('metronome — runner', () => {
  test('does not create an AudioContext while idle', () => {
    renderRunner();
    expect(contextCtorCalls).toBe(0);
    expect(activeContext).toBeNull();
  });

  test('does not create an AudioContext when metronomeOn is false even while playing', () => {
    mockTransport = { ...mockTransport, mode: 'play', metronomeOn: false };
    const { rerender } = renderRunner();
    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ });
    rerender(<MetronomeRunner />);
    expect(contextCtorCalls).toBe(0);
  });

  test('creates AudioContext lazily on first beat and emits accent click at beat 0', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    renderRunner();
    expect(contextCtorCalls).toBe(1);
    expect(activeContext).not.toBeNull();
    expect(activeContext!.oscillators.length).toBe(1);
    expect(activeContext!.oscillators[0].frequency.value).toBe(1500);
  });

  test('reuses the same AudioContext across multiple beats', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    const { rerender } = renderRunner();
    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ });
    rerender(<MetronomeRunner />);
    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ * 2 });
    rerender(<MetronomeRunner />);
    expect(contextCtorCalls).toBe(1);
    expect(activeContext!.oscillators.length).toBe(3);
  });

  test('emits the tick frequency on non-accent beats', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    const { rerender } = renderRunner();
    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ });
    rerender(<MetronomeRunner />);
    expect(activeContext!.oscillators[1].frequency.value).toBe(1000);
  });

  test('accent fires on beat 4 (start of bar 2 in 4/4)', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    const { rerender } = renderRunner();
    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ * 4 });
    rerender(<MetronomeRunner />);
    const lastOsc = activeContext!.oscillators[activeContext!.oscillators.length - 1];
    expect(lastOsc.frequency.value).toBe(1500);
  });

  test('respects 3/4 time signature: accent every 3 beats', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0, sig: '3/4' };
    const { rerender } = renderRunner();
    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ * 3 });
    rerender(<MetronomeRunner />);
    const lastOsc = activeContext!.oscillators[activeContext!.oscillators.length - 1];
    expect(lastOsc.frequency.value).toBe(1500);
  });

  test('does not double-fire within the same beat', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    const { rerender } = renderRunner();
    const oscCountAfterBeat0 = activeContext!.oscillators.length;
    updateTransport({ playheadTicks: 120 });
    rerender(<MetronomeRunner />);
    updateTransport({ playheadTicks: 240 });
    rerender(<MetronomeRunner />);
    expect(activeContext!.oscillators.length).toBe(oscCountAfterBeat0);
  });

  test('rewind (playhead backwards) re-fires the next beat', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: DEFAULT_MIDI_TPQ * 4 };
    const { rerender } = renderRunner();
    const before = activeContext!.oscillators.length;
    updateTransport({ playheadTicks: 0 });
    rerender(<MetronomeRunner />);
    expect(activeContext!.oscillators.length).toBe(before + 1);
    const lastOsc = activeContext!.oscillators[activeContext!.oscillators.length - 1];
    expect(lastOsc.frequency.value).toBe(1500);
  });

  test('resumes a suspended context on the next beat', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    const { rerender } = renderRunner();
    // First beat created and "ran" the context.
    expect(activeContext!.state).toBe('running');

    // Simulate the browser suspending it (e.g. tab backgrounded).
    activeContext!.state = 'suspended';

    updateTransport({ playheadTicks: DEFAULT_MIDI_TPQ });
    rerender(<MetronomeRunner />);

    expect(activeContext!.resumeCalls).toBe(1);
  });

  test('closes the AudioContext on unmount', () => {
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    const { unmount } = renderRunner();
    expect(activeContext).not.toBeNull();
    const ctx = activeContext!;
    act(() => {
      unmount();
    });
    expect(ctx.closeCalls).toBe(1);
  });

  test('no AudioContext is created when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    mockTransport = { ...mockTransport, mode: 'play', playheadTicks: 0 };
    renderRunner();
    /* Test asserts no crash; activeContext remains null. */
    expect(activeContext).toBeNull();
  });
});
