import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Note } from '../components/piano-roll/notes';
import type { ActionMapEntry, OutputMapping, PressurePoint } from '../data/dj';
import {
  createScheduler,
  type ChannelSnapshot,
  type DJEventSnapshot,
  type DJTrackSnapshot,
  type SchedulerDeps,
  type SchedulerOutput,
} from './scheduler';

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

function schedDeps(
  primary: SchedulerOutput | null,
  toastFn: (m: string) => void,
  primaryName?: string,
  getMidiOutput?: (portId: string | undefined) => SchedulerOutput | null,
): SchedulerDeps {
  return {
    primaryOutput: primary,
    primaryOutputName: primaryName,
    getMidiOutput:
      getMidiOutput ??
      ((id) => {
        if (id === undefined || id === '') return primary;
        if (primary && id === primary.id) return primary;
        return null;
      }),
    toast: toastFn,
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
    const scheduler = createScheduler(schedDeps(output, toast.show, 'MicroFreak'));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const channels = [channel(1, [note(0.5, 0.5, 60, 100)])];
    scheduler.start(1000, 120, channels);
    scheduler.tick(performance.now(), 1000, channels);
    expect(output.calls).toHaveLength(0);
  });

  test('timestamp is clamped to at least performance.now()', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)], { muted: true })];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(output.calls).toHaveLength(0);
  });

  test('solo on one channel silences the rest', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(null, toast.show, undefined));
    const channels = [channel(1, [note(0.0, 10.0, 60, 100)])];
    scheduler.start(0, 120, channels);
    scheduler.tick(performance.now(), 0, channels);
    expect(() => scheduler.panic()).not.toThrow();
  });

  test('activeNoteCount is zero after panic', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(null, toast.show, undefined));
    scheduler.start(0, 120, []);
    scheduler.tick(performance.now(), 0, []);
    scheduler.tick(performance.now(), 50, []);
    expect(toast.messages).toEqual(['No output device available']);
  });

  test('with output emits playing-to toast exactly once with output name', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show, 'MicroFreak'));
    scheduler.start(0, 120, []);
    scheduler.tick(performance.now(), 0, []);
    scheduler.tick(performance.now(), 50, []);
    expect(toast.messages).toEqual(['Playing to MicroFreak']);
  });

  test('empty-name output falls back to (unnamed device)', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show, undefined));
    scheduler.start(0, 120, []);
    expect(toast.messages).toEqual(['Playing to (unnamed device)']);
  });
});

describe('createScheduler — seek and loop wrap', () => {
  test('seek backward resets cursors so later notes still fire', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
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
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)])];
    scheduler.start(0, 120, channels);
    const now1 = performance.now();
    scheduler.tick(now1, 0, channels);
    const noteOns1 = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns1).toHaveLength(1);
    expect(noteOns1[0]!.timestamp).toBeCloseTo(now1 + 50, 1);
  });
});

function makeAction(opts: Partial<ActionMapEntry> & { id: string }): ActionMapEntry {
  return {
    cat: opts.cat ?? 'deck',
    label: opts.label ?? opts.id,
    short: opts.short ?? opts.id,
    device: opts.device ?? 'global',
    pad: opts.pad,
    pressure: opts.pressure,
    trigger: opts.trigger,
    id: opts.id,
  };
}

function djEvent(
  pitch: number,
  t: number,
  dur: number,
  vel: number,
  opts: { pressure?: PressurePoint[]; perPitchIndex?: number } = {},
): DJEventSnapshot {
  return {
    pitch,
    t,
    dur,
    vel,
    pressure: opts.pressure,
    perPitchIndex: opts.perPitchIndex ?? 0,
  };
}

function makeDJTrack(opts: {
  id?: string;
  midiChannel?: number;
  events?: DJEventSnapshot[];
  actionMap?: Record<number, ActionMapEntry>;
  outputMap?: Record<number, OutputMapping>;
  defaultMidiOutputDeviceId?: string;
  muted?: boolean;
  soloed?: boolean;
  mutedRows?: number[];
  soloedRows?: number[];
}): DJTrackSnapshot {
  return {
    id: opts.id ?? 'dj1',
    midiChannel: opts.midiChannel ?? 1,
    events: opts.events ?? [],
    actionMap: opts.actionMap ?? {},
    outputMap: opts.outputMap ?? {},
    defaultMidiOutputDeviceId: opts.defaultMidiOutputDeviceId ?? '',
    muted: opts.muted ?? false,
    soloed: opts.soloed ?? false,
    mutedRows: opts.mutedRows ?? [],
    soloedRows: opts.soloedRows ?? [],
  };
}

function pulseMany(scheduler: ReturnType<typeof createScheduler>, fromMs: number, toMs: number, stepMs: number, channels: ChannelSnapshot[], djTracks: DJTrackSnapshot[]) {
  for (let pm = fromMs; pm <= toMs; pm += stepMs) {
    scheduler.tick(performance.now(), pm, channels, false, djTracks);
  }
}

describe('createScheduler — DJ note-mode dispatch', () => {
  test('emits note-on/note-off using mapping.pitch and scaled velocity', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.1, 0.1, 0.5)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 3, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    const now = performance.now();
    scheduler.tick(now, 0, [], false, [track]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    const noteOffs = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x80);
    expect(noteOns).toHaveLength(1);
    expect(noteOffs).toHaveLength(1);
    expect(noteOns[0]!.data).toEqual([0x92, 60, 64]);
    expect(noteOffs[0]!.data).toEqual([0x82, 60, 0]);
    expect(noteOns[0]!.timestamp).toBeCloseTo(now + 50, 1);
    expect(noteOffs[0]!.timestamp).toBeCloseTo(now + 100, 1);
  });

  test('DJ row midiOutputDeviceId routes to named output', () => {
    const outA = makeFakeOutput('out-a');
    const outB = makeFakeOutput('out-b');
    const toast = makeToast();
    const scheduler = createScheduler(
      schedDeps(outA, toast.show, 'A', (id) => {
        if (id === undefined || id === '') return outA;
        if (id === 'out-b') return outB;
        return null;
      }),
    );
    const track = makeDJTrack({
      events: [djEvent(48, 0.1, 0.1, 0.5)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: {
        48: { device: 'global', channel: 1, pitch: 60, midiOutputDeviceId: 'out-b' },
      },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    expect(outA.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(0);
    expect(outB.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90).length).toBeGreaterThan(0);
  });

  test('DJ track defaultMidiOutputDeviceId routes when row omits port override', () => {
    const outA = makeFakeOutput('out-a');
    const outB = makeFakeOutput('out-b');
    const toast = makeToast();
    const scheduler = createScheduler(
      schedDeps(outA, toast.show, 'A', (id) => {
        if (id === undefined || id === '') return outA;
        if (id === 'out-b') return outB;
        return null;
      }),
    );
    const track = makeDJTrack({
      defaultMidiOutputDeviceId: 'out-b',
      events: [djEvent(48, 0.1, 0.1, 0.5)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: {},
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    expect(outB.calls.some((c) => (c.data[0]! & 0xf0) === 0x90)).toBe(true);
  });

  test('velocity floor is 1 even when event.vel rounds to 0', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.0, 0.1, 0.001)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const noteOn = output.calls.find((c) => (c.data[0]! & 0xf0) === 0x90)!;
    expect(noteOn.data[2]).toBe(1);
  });

  test('velocity ceiling is 127 when event.vel is 1.0', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.0, 0.1, 1.0)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const noteOn = output.calls.find((c) => (c.data[0]! & 0xf0) === 0x90)!;
    expect(noteOn.data[2]).toBe(127);
  });

  test('missing outputMap entry falls back to track.midiChannel + event.pitch', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show, 'X'));
    const track = makeDJTrack({
      midiChannel: 1,
      events: [djEvent(48, 0.0, 0.1, 0.8)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: {},
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    /* channel byte = 0 (track channel 1), output pitch = event.pitch (48), velocity = round(0.8 * 127) = 102 */
    expect(noteOns[0]!.data).toEqual([0x90, 48, 102]);
    expect(toast.messages).toEqual(['Playing to X']);
  });

  test('outputMap entry overrides track.midiChannel and event.pitch', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      midiChannel: 1,
      events: [djEvent(48, 0.0, 0.1, 0.8)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 3, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data).toEqual([0x92, 60, 102]);
  });

  test('missing actionMap entry silently skips event', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.0, 0.1, 0.8)],
      actionMap: {},
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(0);
  });

  test('events past lookahead window are deferred', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 5.0, 0.5, 0.8)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(0);
    scheduler.tick(performance.now(), 2450, [], false, [track]);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(1);
  });

  test('events before playhead are skipped', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.5, 0.1, 0.8)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
    });
    scheduler.start(1000, 120, [], false, [track]);
    scheduler.tick(performance.now(), 1000, [], false, [track]);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(0);
  });

  test('outputMap with cc emits control change, not notes', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(80, 0.0, 1.0, 0.5)],
      actionMap: { 80: makeAction({ id: 'xfade_pos', cat: 'mixer', pad: true }) },
      outputMap: { 80: { device: 'mixer', channel: 2, pitch: 80, cc: 16 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    const now = performance.now();
    scheduler.tick(now, 0, [], false, [track]);
    const ccs = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xb0);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(ccs).toHaveLength(1);
    expect(noteOns).toHaveLength(0);
    expect(ccs[0]!.data).toEqual([0xb1, 16, 64]);
  });

  test('CC-out value can be zero', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(80, 0.0, 0.5, 0.0)],
      actionMap: { 80: makeAction({ id: 'ch1_vol', cat: 'mixer', pad: true }) },
      outputMap: { 80: { device: 'mixer', channel: 1, pitch: 81, cc: 7 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const cc = output.calls.find((c) => (c.data[0]! & 0xf0) === 0xb0)!;
    expect(cc.data[2]).toBe(0);
  });
});

describe('createScheduler — DJ mute / solo', () => {
  test('track-level muted DJ track emits zero events', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.1, 0.1, 0.8)],
      actionMap: { 48: makeAction({ id: 'play', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
      muted: true,
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(0);
  });

  test('row-level muted row emits nothing; other rows in same track continue', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.05, 0.1, 0.8), djEvent(49, 0.06, 0.1, 0.8)],
      actionMap: {
        48: makeAction({ id: 'a', cat: 'deck' }),
        49: makeAction({ id: 'b', cat: 'deck' }),
      },
      outputMap: {
        48: { device: 'global', channel: 1, pitch: 60 },
        49: { device: 'global', channel: 1, pitch: 61 },
      },
      mutedRows: [48],
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[1]).toBe(61);
  });

  test('DJ track solo silences channel-roll dispatch', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)])];
    const track = makeDJTrack({
      events: [djEvent(48, 0.1, 0.1, 0.8)],
      actionMap: { 48: makeAction({ id: 'a', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 2, pitch: 72 } },
      soloed: true,
    });
    scheduler.start(0, 120, channels, false, [track]);
    scheduler.tick(performance.now(), 0, channels, false, [track]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[0]).toBe(0x91);
    expect(noteOns[0]!.data[1]).toBe(72);
  });

  test('DJ row solo silences channel-roll dispatch and non-soloed rows', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const channels = [channel(1, [note(0.1, 0.1, 60, 100)])];
    const track = makeDJTrack({
      events: [djEvent(48, 0.1, 0.1, 0.8), djEvent(49, 0.1, 0.1, 0.8)],
      actionMap: {
        48: makeAction({ id: 'a', cat: 'deck' }),
        49: makeAction({ id: 'b', cat: 'deck' }),
      },
      outputMap: {
        48: { device: 'global', channel: 2, pitch: 72 },
        49: { device: 'global', channel: 2, pitch: 73 },
      },
      soloedRows: [48],
    });
    scheduler.start(0, 120, channels, false, [track]);
    scheduler.tick(performance.now(), 0, channels, false, [track]);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.data[1]).toBe(72);
  });
});

describe('createScheduler — DJ pressure-mode dispatch', () => {
  test('emits note envelope and 14 AT messages for well-spaced synthesised curve', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(56, 0.0, 2.0, 0.8)],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    pulseMany(scheduler, 0, 1100, 50, [], [track]);
    const ats = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xd0);
    const noteOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90);
    const noteOffs = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x80);
    expect(noteOns).toHaveLength(1);
    expect(noteOffs).toHaveLength(1);
    expect(ats).toHaveLength(14);
    expect(ats[0]!.data[0]).toBe(0xd0);
  });

  test('empty pressure array emits zero AT messages', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(56, 0.0, 2.0, 0.8, { pressure: [] })],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    pulseMany(scheduler, 0, 1100, 50, [], [track]);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xd0)).toHaveLength(0);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90)).toHaveLength(1);
    expect(output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x80)).toHaveLength(1);
  });

  test('non-empty stored pressure emits one AT per point', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const points: PressurePoint[] = [
      { t: 0.0, v: 0.0 },
      { t: 0.5, v: 1.0 },
      { t: 1.0, v: 0.0 },
    ];
    const track = makeDJTrack({
      events: [djEvent(56, 0.0, 2.0, 0.8, { pressure: points })],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    pulseMany(scheduler, 0, 1100, 50, [], [track]);
    const ats = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xd0);
    expect(ats).toHaveLength(3);
    expect(ats.map((c) => c.data[1])).toEqual([0, 127, 0]);
  });

  test('throttle drops AT messages closer than 10ms apart', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    /* event dur=0.03 → 15ms duration at tempo 120. Points at curve-t 0, 1/3,
       1.0 → abs-times 0, 5, 15ms. With 10ms throttle:
         - point 1 at 0ms emits  (last = 0)
         - point 2 at 5ms → 5 - 0 < 10 → drop
         - point 3 at 15ms → 15 - 0 = 15 >= 10 → emit (last = 15) */
    const points: PressurePoint[] = [
      { t: 0.0, v: 0.2 },
      { t: 1 / 3, v: 0.5 },
      { t: 1.0, v: 0.9 },
    ];
    const track = makeDJTrack({
      events: [djEvent(56, 0.0, 0.03, 0.8, { pressure: points })],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const ats = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xd0);
    expect(ats).toHaveLength(2);
    expect(ats[0]!.data[1]).toBe(Math.round(0.2 * 127));
    expect(ats[1]!.data[1]).toBe(Math.round(0.9 * 127));
  });

  test('perPitchIndex selects pressure shape via synthesizePressure', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    /* Three events on same pitch 56 with perPitchIndex 0, 1, 2 → arch, rise,
       center-peak shapes. First point of each: arch=0.05, rise=0.2, center=0.2.
       Middle point of each (curve-t 0.5): arch=0.85, rise=0.55, center=0.6.
       Test by checking the value at curve-t 0.5 for each event (rounded). */
    const dur = 2.0;
    const tEvent0 = 0.0;
    const tEvent1 = 5.0;
    const tEvent2 = 10.0;
    const track = makeDJTrack({
      events: [
        djEvent(56, tEvent0, dur, 0.8, { perPitchIndex: 0 }),
        djEvent(56, tEvent1, dur, 0.8, { perPitchIndex: 1 }),
        djEvent(56, tEvent2, dur, 0.8, { perPitchIndex: 2 }),
      ],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    pulseMany(scheduler, 0, 7000, 30, [], [track]);
    const ats = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xd0);
    /* 14 AT per event * 3 events = 42 */
    expect(ats).toHaveLength(42);
    /* Middle (idx 7 of 14, curve-t = 7/13 ≈ 0.538):
         arch:  sin(0.538*π)*0.85 ≈ 0.821 → round 104
         rise:  0.2 + 0.538*0.7   ≈ 0.577 → round 73
         center: 0.6 - |0.538-0.5|*0.8 ≈ 0.569 → round 72
       Differ between shapes — confirms perPitchIndex was passed. */
    const arch7 = ats[7]!.data[1]!;
    const rise7 = ats[14 + 7]!.data[1]!;
    const center7 = ats[28 + 7]!.data[1]!;
    expect(arch7).not.toBe(rise7);
    expect(rise7).not.toBe(center7);
    expect(arch7).toBeGreaterThan(rise7);
  });
});

describe('createScheduler — DJ seek and panic', () => {
  test('seek-back rebinds DJ cursor so later events still fire', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(48, 0.05, 0.01, 0.8), djEvent(48, 0.15, 0.01, 0.8, { perPitchIndex: 1 })],
      actionMap: { 48: makeAction({ id: 'a', cat: 'deck' }) },
      outputMap: { 48: { device: 'global', channel: 1, pitch: 60 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const initialOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90).length;
    expect(initialOns).toBe(2);
    scheduler.tick(performance.now(), 30000, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const finalOns = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0x90).length;
    expect(finalOns).toBe(initialOns + 2);
  });

  test('panic emits matching note-off and ANO; does NOT emit channel-pressure zero', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(56, 0.0, 10.0, 0.8)],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    scheduler.tick(performance.now(), 0, [], false, [track]);
    const callsBeforePanic = output.calls.length;
    scheduler.panic();
    const after = output.calls.slice(callsBeforePanic);
    const panicOffs = after.filter((c) => (c.data[0]! & 0xf0) === 0x80);
    const allNotesOffs = after.filter(
      (c) => (c.data[0]! & 0xf0) === 0xb0 && c.data[1] === 0x7b,
    );
    const channelPressureZeros = after.filter(
      (c) => (c.data[0]! & 0xf0) === 0xd0 && c.data[1] === 0x00,
    );
    expect(panicOffs.length).toBeGreaterThanOrEqual(1);
    expect(panicOffs.some((c) => c.data[1] === 36)).toBe(true);
    expect(allNotesOffs).toHaveLength(1);
    expect(allNotesOffs[0]!.data[0]! & 0x0f).toBe(0);
    expect(channelPressureZeros).toHaveLength(0);
  });

  test('panic clears throttle and cursor state so second play starts fresh', () => {
    const output = makeFakeOutput();
    const toast = makeToast();
    const scheduler = createScheduler(schedDeps(output, toast.show));
    const track = makeDJTrack({
      events: [djEvent(56, 0.0, 2.0, 0.8)],
      actionMap: { 56: makeAction({ id: 'hc1', cat: 'deck', pressure: true }) },
      outputMap: { 56: { device: 'deck1', channel: 1, pitch: 36 } },
    });
    scheduler.start(0, 120, [], false, [track]);
    pulseMany(scheduler, 0, 1100, 50, [], [track]);
    const firstSessionAts = output.calls.filter((c) => (c.data[0]! & 0xf0) === 0xd0).length;
    expect(firstSessionAts).toBe(14);
    scheduler.panic();
    const callsAfterFirstPanic = output.calls.length;
    scheduler.start(0, 120, [], false, [track]);
    pulseMany(scheduler, 0, 1100, 50, [], [track]);
    const secondSessionAts = output.calls
      .slice(callsAfterFirstPanic)
      .filter((c) => (c.data[0]! & 0xf0) === 0xd0).length;
    expect(secondSessionAts).toBe(14);
    expect(scheduler.activeNoteCount()).toBe(1);
  });
});
