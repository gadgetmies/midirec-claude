import { describe, expect, test } from 'vitest';
import type { ActionEvent } from '../data/dj';
import {
  applyRemoveDJEventAtTick,
  applyReplaceDJEventsInRange,
  applyUpsertDJEvent,
  type DJActionTrack,
} from './useDJActionTracks';

function makeTrack(events: ActionEvent[] = []): DJActionTrack {
  return {
    id: 'dj1',
    name: 'DJ',
    color: 'oklch(70% 0.1 240)',
    midiChannel: 16,
    actionMap: {},
    outputMap: {},
    events,
    inputRouting: { channels: [] },
    outputRouting: { channels: [] },
    collapsed: false,
    muted: false,
    soloed: false,
    mutedRows: [],
    soloedRows: [],
    defaultMidiInputDeviceId: '',
    defaultMidiOutputDeviceId: '',
  };
}

const ev = (pitch: number, tTicks: number, vel: number, durTicks = 0): ActionEvent => ({
  pitch,
  tTicks,
  durTicks,
  vel,
});

describe('applyUpsertDJEvent', () => {
  test('appends a new event when no match exists', () => {
    const tracks = [makeTrack([])];
    const next = applyUpsertDJEvent(tracks, 'dj1', 80, 120, 0.5);
    expect(next[0].events).toEqual([ev(80, 120, 0.5)]);
  });

  test('replaces vel when tick + pitch match', () => {
    const tracks = [makeTrack([ev(80, 120, 0.3)])];
    const next = applyUpsertDJEvent(tracks, 'dj1', 80, 120, 0.8);
    expect(next[0].events).toHaveLength(1);
    expect(next[0].events[0].vel).toBe(0.8);
  });

  test('different pitch at same tick produces a new event', () => {
    const tracks = [makeTrack([ev(80, 120, 0.3)])];
    const next = applyUpsertDJEvent(tracks, 'dj1', 81, 120, 0.8);
    expect(next[0].events).toHaveLength(2);
    expect(next[0].events.some((x) => x.pitch === 81 && x.vel === 0.8)).toBe(true);
  });

  test('different tick produces a new event', () => {
    const tracks = [makeTrack([ev(80, 120, 0.3)])];
    const next = applyUpsertDJEvent(tracks, 'dj1', 80, 240, 0.8);
    expect(next[0].events).toHaveLength(2);
  });

  test('vel is clamped to [0, 1]', () => {
    const tracks = [makeTrack([])];
    const a = applyUpsertDJEvent(tracks, 'dj1', 80, 120, -0.5);
    const b = applyUpsertDJEvent(tracks, 'dj1', 80, 120, 5);
    expect(a[0].events[0].vel).toBe(0);
    expect(b[0].events[0].vel).toBe(1);
  });

  test('unchanged value returns the same reference (no-op)', () => {
    const tracks = [makeTrack([ev(80, 120, 0.5)])];
    expect(applyUpsertDJEvent(tracks, 'dj1', 80, 120, 0.5)).toBe(tracks);
  });

  test('unknown track id is a no-op', () => {
    const tracks = [makeTrack([])];
    expect(applyUpsertDJEvent(tracks, 'no-such', 80, 120, 0.5)).toBe(tracks);
  });
});

describe('applyRemoveDJEventAtTick', () => {
  test('removes the event at the matching tick + pitch', () => {
    const tracks = [makeTrack([ev(80, 120, 0.3), ev(80, 240, 0.5)])];
    const next = applyRemoveDJEventAtTick(tracks, 'dj1', 80, 120);
    expect(next[0].events).toEqual([ev(80, 240, 0.5)]);
  });

  test('different pitch at same tick is preserved', () => {
    const tracks = [makeTrack([ev(80, 120, 0.3), ev(81, 120, 0.5)])];
    const next = applyRemoveDJEventAtTick(tracks, 'dj1', 80, 120);
    expect(next[0].events).toEqual([ev(81, 120, 0.5)]);
  });

  test('no event at tick is a no-op', () => {
    const tracks = [makeTrack([ev(80, 120, 0.3)])];
    expect(applyRemoveDJEventAtTick(tracks, 'dj1', 80, 240)).toBe(tracks);
  });
});

describe('applyReplaceDJEventsInRange', () => {
  test('replaces in-range events with new cells', () => {
    const tracks = [
      makeTrack([
        ev(80, 100, 0.1),
        ev(80, 200, 0.2),
        ev(80, 300, 0.3),
        ev(80, 400, 0.4),
        ev(80, 500, 0.5),
      ]),
    ];
    const next = applyReplaceDJEventsInRange(tracks, 'dj1', 80, 200, 400, [
      { tTicks: 200, vel: 0.9 },
      { tTicks: 300, vel: 0.9 },
      { tTicks: 400, vel: 0.9 },
    ]);
    const out = next[0].events;
    expect(out).toHaveLength(5);
    const at100 = out.find((x) => x.tTicks === 100)!;
    const at500 = out.find((x) => x.tTicks === 500)!;
    expect(at100.vel).toBe(0.1);
    expect(at500.vel).toBe(0.5);
    expect(out.filter((x) => x.tTicks >= 200 && x.tTicks <= 400 && x.vel === 0.9)).toHaveLength(3);
  });

  test('does not touch other pitches in the range', () => {
    const tracks = [
      makeTrack([
        ev(80, 200, 0.2),
        ev(81, 200, 0.7),
        ev(80, 300, 0.3),
      ]),
    ];
    const next = applyReplaceDJEventsInRange(tracks, 'dj1', 80, 200, 300, []);
    expect(next[0].events.some((x) => x.pitch === 81 && x.tTicks === 200 && x.vel === 0.7)).toBe(true);
    expect(next[0].events.some((x) => x.pitch === 80)).toBe(false);
  });

  test('clear semantics: empty replacements removes every in-range event', () => {
    const tracks = [
      makeTrack([ev(80, 100, 0.5), ev(80, 500, 0.5), ev(80, 1000, 0.5)]),
    ];
    const next = applyReplaceDJEventsInRange(tracks, 'dj1', 80, 0, 800, []);
    expect(next[0].events).toEqual([ev(80, 1000, 0.5)]);
  });

  test('off-grid in-range events are removed (shift-interp use case)', () => {
    const tracks = [
      makeTrack([ev(80, 145, 0.1), ev(80, 263, 0.2), ev(80, 999, 0.9)]),
    ];
    const next = applyReplaceDJEventsInRange(tracks, 'dj1', 80, 120, 360, [
      { tTicks: 120, vel: 0.0 },
      { tTicks: 240, vel: 0.5 },
      { tTicks: 360, vel: 1.0 },
    ]);
    const out = next[0].events.filter((x) => x.pitch === 80).sort((a, b) => a.tTicks - b.tTicks);
    expect(out.map((x) => x.tTicks)).toEqual([120, 240, 360, 999]);
  });

  test('reversed range (start > end) is normalized', () => {
    const tracks = [makeTrack([ev(80, 200, 0.2), ev(80, 400, 0.4)])];
    const next = applyReplaceDJEventsInRange(tracks, 'dj1', 80, 500, 100, []);
    expect(next[0].events).toEqual([]);
  });

  test('no changes returns same reference', () => {
    const tracks = [makeTrack([ev(80, 1000, 0.5)])];
    expect(applyReplaceDJEventsInRange(tracks, 'dj1', 80, 100, 500, [])).toBe(tracks);
  });
});
