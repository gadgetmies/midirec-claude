import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createInternalScheduler,
  emitCC,
  emitClock,
  emitContinue,
  emitNoteOff,
  emitNoteOn,
  emitSongPositionPointer,
  emitStart,
  emitStop,
  emitSyncBundle,
  ticksToSppBeats,
  type ClockOutput,
} from './clockSender';

interface SendCall {
  outId: string;
  data: number[];
  timestamp: number | undefined;
}

function makeMockOutput(id: string, calls: SendCall[]): ClockOutput {
  return {
    id,
    send(data, timestamp) {
      calls.push({
        outId: id,
        data: Array.from(data as ArrayLike<number>),
        timestamp,
      });
    },
  };
}

function makeThrowingOutput(id: string): ClockOutput {
  return {
    id,
    send() {
      throw new Error('stale port');
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('clockSender — single-byte emits', () => {
  test('emitClock sends [0xF8] to every output exactly once with the given timestamp', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    const b = makeMockOutput('b', calls);
    emitClock([a, b], 12345);
    expect(calls).toEqual([
      { outId: 'a', data: [0xf8], timestamp: 12345 },
      { outId: 'b', data: [0xf8], timestamp: 12345 },
    ]);
  });

  test('emitStart, emitContinue, emitStop send the correct status bytes', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitStart([a]);
    emitContinue([a]);
    emitStop([a]);
    expect(calls.map((c) => c.data)).toEqual([[0xfa], [0xfb], [0xfc]]);
  });

  test('a throwing output is silently skipped without aborting the batch', () => {
    const calls: SendCall[] = [];
    const good = makeMockOutput('good', calls);
    const bad = makeThrowingOutput('bad');
    emitClock([bad, good], 0);
    expect(calls).toEqual([{ outId: 'good', data: [0xf8], timestamp: 0 }]);
  });
});

describe('clockSender — Song Position Pointer', () => {
  test('emitSongPositionPointer(out, 32) sends [0xF2, 0x20, 0x00]', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitSongPositionPointer([a], 32);
    expect(calls).toEqual([{ outId: 'a', data: [0xf2, 0x20, 0x00], timestamp: 0 }]);
  });

  test('emitSongPositionPointer(out, 30000) clamps to [0xF2, 0x7F, 0x7F]', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitSongPositionPointer([a], 30000);
    expect(calls).toEqual([{ outId: 'a', data: [0xf2, 0x7f, 0x7f], timestamp: 0 }]);
  });

  test('emitSongPositionPointer(out, -5) clamps to 0', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitSongPositionPointer([a], -5);
    expect(calls).toEqual([{ outId: 'a', data: [0xf2, 0x00, 0x00], timestamp: 0 }]);
  });

  test('ticksToSppBeats maps tick counts to sixteenth-note counts at TPQ=480', () => {
    expect(ticksToSppBeats(0, 480)).toBe(0);
    expect(ticksToSppBeats(120, 480)).toBe(1); // one sixteenth
    expect(ticksToSppBeats(480 * 8, 480)).toBe(32); // 8 quarter notes = 32 sixteenths
    expect(ticksToSppBeats(0, 0)).toBe(0); // degenerate TPQ
  });
});

describe('clockSender — Note On/Off and CC', () => {
  test('emitNoteOn(out, ch=2, note=60, vel=100) sends [0x91, 60, 100]', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitNoteOn([a], 2, 60, 100);
    expect(calls).toEqual([{ outId: 'a', data: [0x91, 60, 100], timestamp: 0 }]);
  });

  test('emitNoteOff(out, ch=1, note=60) sends [0x80, 60, 0]', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitNoteOff([a], 1, 60);
    expect(calls).toEqual([{ outId: 'a', data: [0x80, 60, 0], timestamp: 0 }]);
  });

  test('emitCC(out, ch=1, cc=20, val=64) sends [0xB0, 20, 64]', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitCC([a], 1, 20, 64);
    expect(calls).toEqual([{ outId: 'a', data: [0xb0, 20, 64], timestamp: 0 }]);
  });

  test('emit helpers clamp channel and value bytes', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitNoteOn([a], 99, 200, -5); // ch>16, note>127, vel<0
    expect(calls).toEqual([{ outId: 'a', data: [0x90 | 15, 127, 0], timestamp: 0 }]);
  });
});

describe('clockSender — Sync bundle', () => {
  test('emitSyncBundle at position 0 emits Stop → SPP(0) → Start, in order, no microtask boundary', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    emitSyncBundle([a], 0, 480);
    expect(calls.map((c) => c.data)).toEqual([[0xfc], [0xf2, 0x00, 0x00], [0xfa]]);
  });

  test('emitSyncBundle mid-song emits Stop → SPP(beats) → Continue', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    // playheadTicks = 480 * 8 = 3840, TPQ = 480 → SPP = 32 (0x20)
    emitSyncBundle([a], 3840, 480);
    expect(calls.map((c) => c.data)).toEqual([[0xfc], [0xf2, 0x20, 0x00], [0xfb]]);
  });

  test('emitSyncBundle emits to every selected output in order', () => {
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    const b = makeMockOutput('b', calls);
    emitSyncBundle([a, b], 0, 480);
    // Order: stop(a, b), spp(a, b), start(a, b) — each emit function fully
    // iterates outputs before the next emit function runs.
    expect(calls).toEqual([
      { outId: 'a', data: [0xfc], timestamp: 0 },
      { outId: 'b', data: [0xfc], timestamp: 0 },
      { outId: 'a', data: [0xf2, 0x00, 0x00], timestamp: 0 },
      { outId: 'b', data: [0xf2, 0x00, 0x00], timestamp: 0 },
      { outId: 'a', data: [0xfa], timestamp: 0 },
      { outId: 'b', data: [0xfa], timestamp: 0 },
    ]);
  });

  test('emitSyncBundle on empty output list is a no-op', () => {
    const calls: SendCall[] = [];
    emitSyncBundle([], 0, 480);
    expect(calls).toEqual([]);
  });
});

describe('clockSender — internal scheduler', () => {
  function startFakeTimersAtZero() {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  }

  test('emits ~48 pulses to each output in 1000 ms at 120 BPM', () => {
    startFakeTimersAtZero();
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    let pulses = 0;
    const sched = createInternalScheduler({
      getBpm: () => 120,
      getOutputs: () => [a],
      onPulse: () => {
        pulses++;
      },
    });
    sched.start();
    vi.advanceTimersByTime(1000);
    sched.stop();

    /* 120 BPM × 24 PPQ / 60s = 48 pulses/sec. With 25 ms lookahead the
       scheduler emits the first second's pulses plus the next few pulses
       inside the trailing lookahead window — tolerance ±2 isn't enough.
       Accept the lookahead bias by widening the window slightly. */
    const onClockCount = calls.filter((c) => c.data[0] === 0xf8).length;
    expect(onClockCount).toBeGreaterThanOrEqual(46);
    expect(onClockCount).toBeLessThanOrEqual(52);
    expect(pulses).toBe(onClockCount);
  });

  test('stop halts emissions within 50 ms', () => {
    startFakeTimersAtZero();
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    const sched = createInternalScheduler({
      getBpm: () => 120,
      getOutputs: () => [a],
      onPulse: () => {},
    });
    sched.start();
    vi.advanceTimersByTime(200);
    const callsBefore = calls.length;
    sched.stop();
    vi.advanceTimersByTime(50);
    expect(calls.length).toBe(callsBefore);
  });

  test('bpm change between batches is honored', () => {
    startFakeTimersAtZero();
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    let currentBpm = 60; // 24 pulses/sec
    const sched = createInternalScheduler({
      getBpm: () => currentBpm,
      getOutputs: () => [a],
      onPulse: () => {},
    });
    sched.start();
    vi.advanceTimersByTime(1000);
    const after60Bpm = calls.length;
    /* ~24 pulses + lookahead bias. Accept 22..30. */
    expect(after60Bpm).toBeGreaterThanOrEqual(22);
    expect(after60Bpm).toBeLessThanOrEqual(30);

    currentBpm = 240; // 96 pulses/sec
    vi.advanceTimersByTime(1000);
    sched.stop();
    const totalAfter = calls.length;
    const secondSecond = totalAfter - after60Bpm;
    /* ~96 pulses; allow generous window for boundary behavior. */
    expect(secondSecond).toBeGreaterThanOrEqual(90);
    expect(secondSecond).toBeLessThanOrEqual(102);
  });

  test('a disconnected output is silently skipped without aborting other outputs', () => {
    startFakeTimersAtZero();
    const calls: SendCall[] = [];
    const good = makeMockOutput('good', calls);
    const bad = makeThrowingOutput('bad');
    /* getOutputs returns both each batch; bad throws on every send. */
    const sched = createInternalScheduler({
      getBpm: () => 120,
      getOutputs: () => [bad, good],
      onPulse: () => {},
    });
    sched.start();
    vi.advanceTimersByTime(200);
    sched.stop();
    /* good should have received clock pulses; bad should have produced none. */
    expect(calls.some((c) => c.outId === 'good')).toBe(true);
    expect(calls.every((c) => c.outId !== 'bad')).toBe(true);
  });

  test('reset() re-syncs the schedule to "now"', () => {
    startFakeTimersAtZero();
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    const sched = createInternalScheduler({
      getBpm: () => 120,
      getOutputs: () => [a],
      onPulse: () => {},
    });
    sched.start();
    vi.advanceTimersByTime(100);
    const callsBefore = calls.length;
    sched.reset();
    vi.advanceTimersByTime(100);
    sched.stop();
    /* After reset the second 100 ms emits roughly the same number of pulses
       as the first 100 ms — neither phase nor cadence regress. */
    const callsAfter = calls.length - callsBefore;
    expect(callsAfter).toBeGreaterThanOrEqual(callsBefore - 1);
  });

  test('start is idempotent; second start while running does not double-schedule', () => {
    startFakeTimersAtZero();
    const calls: SendCall[] = [];
    const a = makeMockOutput('a', calls);
    const sched = createInternalScheduler({
      getBpm: () => 120,
      getOutputs: () => [a],
      onPulse: () => {},
    });
    sched.start();
    sched.start(); // should be a no-op
    vi.advanceTimersByTime(500);
    sched.stop();
    /* If start double-scheduled, we'd see ~2× the pulses. Expect ~24, not ~48. */
    const onClockCount = calls.length;
    expect(onClockCount).toBeGreaterThanOrEqual(22);
    expect(onClockCount).toBeLessThanOrEqual(30);
  });
});
