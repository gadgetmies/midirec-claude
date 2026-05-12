import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Note } from '../components/piano-roll/notes';
import { createScheduler, type ChannelSnapshot, type SchedulerOutput } from './scheduler';

interface SendCall {
  data: number[];
  timestamp: number | undefined;
}

function makeFakeOutput(id = 'out-A'): SchedulerOutput & { calls: SendCall[] } {
  const calls: SendCall[] = [];
  return {
    id,
    send(data: number[] | Uint8Array, timestamp?: number) {
      const arr =
        data instanceof Uint8Array
          ? Array.from(data)
          : (data as number[]).slice();
      calls.push({ data: arr, timestamp });
    },
    calls,
  };
}

function makeToast(): { show: (m: string) => void; messages: string[] } {
  const messages: string[] = [];
  return {
    show: (m: string) => messages.push(m),
    messages,
  };
}

function note(t: number, dur: number, pitch: number, vel: number): Note {
  return { t, dur, pitch, vel };
}

function channel(
  id: number,
  notes: Note[],
  opts: { muted?: boolean; soloed?: boolean } = {},
): ChannelSnapshot {
  return {
    id,
    notes,
    muted: opts.muted ?? false,
    soloed: opts.soloed ?? false,
    rollMuted: false,
    rollSoloed: false,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createScheduler — dispatch within lookahead window', () => {
  test('dispatches note-on and note-off for a note within the lookahead window', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'MicroFreak', toast: toast.show });
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)])];
    scheduler.start(0, 120, channels);
    const now = performance.now();
    scheduler.tick(now, 0, channels);

    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    const noteOffs = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x80);
    expect(noteOns).toHaveLength(1);
    expect(noteOffs).toHaveLength(1);
    expect(noteOns[0]!.data).toEqual([0x90, 60, 100]);
    expect(noteOffs[0]!.data).toEqual([0x80, 60, 0]);
    expect(noteOns[0]!.timestamp).toBeCloseTo(now + 50, 1);
    expect(noteOffs[0]!.timestamp).toBeCloseTo(now + 100, 1);
  });

  test('notes past the lookahead window are deferred', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(5.0, 0.5, 64, 90)])];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(output.calls).toHaveLength(0);
    scheduler.tick(performance.now(), 2450, channels);
    expect(output.calls.length).toBeGreaterThan(0);
    expect(output.calls[0]!.data[1]).toBe(64);
  });

  test('notes before the playhead are skipped without emit', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(0.5, 0.5, 60, 100)])];
    scheduler.start(1000, 120, channels);
    scheduler.tick(performance.now(), 1000, channels);
    expect(output.calls).toHaveLength(0);
  });

  test('timestamp is clamped to at least performance.now()', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(0.0, 0.1, 60, 100)])];
    scheduler.start(0, 120, channels);
    const now = performance.now();
    scheduler.tick(now, 0, channels);
    for (const c of output.calls) {
      expect(c.timestamp).toBeGreaterThanOrEqual(now);
    }
  });
});

describe('createScheduler — mute and solo', () => {
  test('muted channel emits zero send calls', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)], { muted: true })];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(output.calls).toHaveLength(0);
  });

  test('solo on one channel silences the rest', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [
      channel(1, [note(0.1, 0.1, 60, 100)], { soloed: true }),
      channel(2, [note(0.1, 0.1, 64, 100)]),
      channel(3, [note(0.1, 0.1, 67, 100)]),
    ];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[0]! & 0x0f).toBe(0);
    expect(noteOns[0]!.data[1]).toBe(60);
  });

  test('roll-level mute also silences the channel', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [
      {
        id: 1,
        muted: false,
        soloed: false,
        rollMuted: true,
        rollSoloed: false,
        notes: [note(0.1, 0.1, 60, 100)],
      } satisfies ChannelSnapshot,
    ];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(output.calls).toHaveLength(0);
  });

  test('external solo (e.g. lane) silences all channel notes when no channel/roll is soloed', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [
      channel(1, [note(0.1, 0.1, 60, 100)]),
      channel(2, [note(0.1, 0.1, 64, 100)]),
    ];
    scheduler.start(0, 120, channels, true);
    scheduler.tick(performance.now(), 0, channels, true);
    expect(output.calls).toHaveLength(0);
  });

  test('external solo plus channel solo: only soloed channel plays', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [
      channel(1, [note(0.1, 0.1, 60, 100)], { soloed: true }),
      channel(2, [note(0.1, 0.1, 64, 100)]),
    ];
    scheduler.start(0, 120, channels, true);
    scheduler.tick(performance.now(), 0, channels, true);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[1]).toBe(60);
  });

  test('roll-level solo silences channels with no solo at either level', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels: ChannelSnapshot[] = [
      {
        id: 1,
        muted: false,
        soloed: false,
        rollMuted: false,
        rollSoloed: true,
        notes: [note(0.1, 0.1, 60, 100)],
      },
      {
        id: 2,
        muted: false,
        soloed: false,
        rollMuted: false,
        rollSoloed: false,
        notes: [note(0.1, 0.1, 64, 100)],
      },
    ];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[1]).toBe(60);
  });

  test('mid-playback un-mute does not retroactively dispatch past notes', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const mutedCh = channel(1, [note(0.5, 0.1, 60, 100), note(10.0, 0.1, 72, 100)], {
      muted: true,
    });
    scheduler.start(0, 120, [mutedCh]);
    scheduler.tick(performance.now(), 0, [mutedCh]);
    scheduler.tick(performance.now(), 300, [mutedCh]);

    const unmutedCh = channel(1, [note(0.5, 0.1, 60, 100), note(10.0, 0.1, 72, 100)]);
    scheduler.tick(performance.now(), 1000, [unmutedCh]);
    expect(output.calls).toHaveLength(0);

    scheduler.tick(performance.now(), 4950, [unmutedCh]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[1]).toBe(72);
  });
});

describe('createScheduler — panic on stop', () => {
  test('emits note-off and All Notes Off, with note-offs first', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [
      channel(1, [note(0.0, 10.0, 60, 100)]),
      channel(3, [note(0.0, 10.0, 36, 90)]),
    ];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(output.calls.length).toBeGreaterThanOrEqual(4);
    const callsBeforePanic = output.calls.length;
    scheduler.panic();
    const callsAfter = output.calls.slice(callsBeforePanic);
    const panicOffs = callsAfter.filter((c) => (c.data[0]! & 0xf0) === 0x80);
    const allNotesOffs = callsAfter.filter(
      (c) => (c.data[0]! & 0xf0) === 0xb0 && c.data[1] === 0x7b,
    );
    expect(panicOffs).toHaveLength(2);
    expect(allNotesOffs).toHaveLength(2);
    const firstPanicOffIdx = callsAfter.findIndex((c) => (c.data[0]! & 0xf0) === 0x80);
    const firstAllNotesOffIdx = callsAfter.findIndex(
      (c) => (c.data[0]! & 0xf0) === 0xb0 && c.data[1] === 0x7b,
    );
    expect(firstPanicOffIdx).toBeLessThan(firstAllNotesOffIdx);
    const panicChannelBytes = new Set(allNotesOffs.map((c) => c.data[0]! & 0x0f));
    expect(panicChannelBytes).toEqual(new Set([0, 2]));
  });

  test('panic with no output is a no-op and does not throw', () => {
    const toast = makeToast();
    const scheduler = createScheduler({ output: null, outputName: undefined, toast: toast.show });
    const channels = [channel(1, [note(0.0, 10.0, 60, 100)])];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(() => scheduler.panic()).not.toThrow();
  });

  test('activeNoteCount is zero after panic', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(0.0, 10.0, 60, 100)])];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(scheduler.activeNoteCount()).toBe(1);
    scheduler.panic();
    expect(scheduler.activeNoteCount()).toBe(0);
  });

  test('rapid play/stop/play leaves activeNoteOns empty at start of second play', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(0.0, 10.0, 60, 100)])];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    scheduler.panic();
    expect(scheduler.activeNoteCount()).toBe(0);
    scheduler.start(0, 120, channels);
    expect(scheduler.activeNoteCount()).toBe(0);
  });
});

describe('createScheduler — toasts', () => {
  test('no output emits the no-output toast exactly once', () => {
    const toast = makeToast();
    const scheduler = createScheduler({ output: null, outputName: undefined, toast: toast.show });
    scheduler.start(0, 120, []);
    scheduler.tick(performance.now(), 0, []);
    scheduler.tick(performance.now(), 50, []);
    expect(toast.messages).toEqual(['No output device available']);
  });

  test('with output emits playing-to toast exactly once with output name', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({
      output,
      outputName: 'MicroFreak',
      toast: toast.show,
    });
    scheduler.start(0, 120, []);
    scheduler.tick(performance.now(), 0, []);
    scheduler.tick(performance.now(), 50, []);
    expect(toast.messages).toEqual(['Playing to MicroFreak']);
  });

  test('empty-name output falls back to (unnamed device)', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({
      output,
      outputName: undefined,
      toast: toast.show,
    });
    scheduler.start(0, 120, []);
    expect(toast.messages).toEqual(['Playing to (unnamed device)']);
  });
});

describe('createScheduler — seek and loop wrap', () => {
  test('seek backward resets cursors so later notes still fire', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [
      channel(1, [note(0.1, 0.1, 60, 100), note(2.0, 0.1, 64, 100)]),
    ];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    const initialCallCount = output.calls.length;
    expect(initialCallCount).toBe(2);

    scheduler.tick(performance.now(), 30000, channels);

    scheduler.tick(performance.now(), 0, channels);
    expect(output.calls.length).toBe(initialCallCount + 2);
  });
});

describe('createScheduler — tempo snapshot', () => {
  test('tempo snapshot persists across mid-playback bpm changes', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler({ output, outputName: 'X', toast: toast.show });
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)])];
    scheduler.start(0, 120, channels);
    const now1 = performance.now();
    scheduler.tick(now1, 0, channels);
    const noteOns1 = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns1).toHaveLength(1);
    expect(noteOns1[0]!.timestamp).toBeCloseTo(now1 + 50, 1);
  });
});
