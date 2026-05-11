import { describe, expect, test } from 'vitest';
import {
  isDJRowAudible,
  isDJTrackAudible,
  anyDJTrackSoloed,
  applySetActionEntry,
  applyDeleteActionEntry,
  applySetOutputMapping,
  applyDeleteOutputMapping,
  applySetEventPressure,
  type DJActionTrack,
} from './useDJActionTracks';
import {
  DEFAULT_ACTION_MAP,
  type ActionMapEntry,
  type OutputMapping,
} from '../data/dj';

const baseTrack = (over: Partial<DJActionTrack> = {}): DJActionTrack => ({
  id: 'dj1',
  name: 'DJ',
  color: 'oklch(70% 0.04 80)',
  actionMap: {
    48: DEFAULT_ACTION_MAP[48],
    56: DEFAULT_ACTION_MAP[56],
    57: DEFAULT_ACTION_MAP[57],
  },
  outputMap: {},
  events: [],
  inputRouting: { channels: [] },
  outputRouting: { channels: [] },
  collapsed: false,
  muted: false,
  soloed: false,
  mutedRows: [],
  soloedRows: [],
  ...over,
});

describe('isDJRowAudible', () => {
  test('audible when no solo and no mute', () => {
    expect(isDJRowAudible(baseTrack(), 48, false)).toBe(true);
  });

  test('inaudible when row is muted, regardless of solo state', () => {
    const t = baseTrack({ mutedRows: [48] });
    expect(isDJRowAudible(t, 48, false)).toBe(false);
    expect(isDJRowAudible(t, 48, true)).toBe(false);
  });

  test('row solo overrides session-wide solo dimming for the soloed row', () => {
    const t = baseTrack({ soloedRows: [56] });
    expect(isDJRowAudible(t, 56, true)).toBe(true);
  });

  test('row that is not soloed is inaudible under session-wide solo', () => {
    const t = baseTrack({ soloedRows: [56] });
    expect(isDJRowAudible(t, 48, true)).toBe(false);
  });

  test('track-level solo with no row solo audibilizes every row in track', () => {
    const t = baseTrack({ soloed: true, soloedRows: [] });
    expect(isDJRowAudible(t, 48, true)).toBe(true);
    expect(isDJRowAudible(t, 56, true)).toBe(true);
    expect(isDJRowAudible(t, 57, true)).toBe(true);
  });

  test('track-level solo combined with row-level solo only audibilizes the soloed row', () => {
    /* Once a row is soloed inside a soloed track, the track-solo branch no
       longer applies — only the explicitly-soloed row is audible. */
    const t = baseTrack({ soloed: true, soloedRows: [56] });
    expect(isDJRowAudible(t, 56, true)).toBe(true);
    expect(isDJRowAudible(t, 48, true)).toBe(false);
    expect(isDJRowAudible(t, 57, true)).toBe(false);
  });

  test('mute beats solo within the same row', () => {
    /* Soloing AND muting the same row → still inaudible. Mute wins. */
    const t = baseTrack({ soloedRows: [48], mutedRows: [48] });
    expect(isDJRowAudible(t, 48, true)).toBe(false);
  });
});

describe('isDJTrackAudible', () => {
  test('audible when no session-wide solo', () => {
    expect(isDJTrackAudible(baseTrack(), false)).toBe(true);
  });

  test('inaudible under session-wide solo when track is not contributing', () => {
    expect(isDJTrackAudible(baseTrack(), true)).toBe(false);
  });

  test('audible under session-wide solo when track itself is soloed', () => {
    expect(isDJTrackAudible(baseTrack({ soloed: true }), true)).toBe(true);
  });

  test('audible under session-wide solo when a row inside the track is soloed', () => {
    expect(isDJTrackAudible(baseTrack({ soloedRows: [56] }), true)).toBe(true);
  });
});

describe('anyDJTrackSoloed', () => {
  test('false when no track has track-solo or row-solo', () => {
    expect(anyDJTrackSoloed([baseTrack()])).toBe(false);
  });

  test('true when any track has track-solo', () => {
    expect(anyDJTrackSoloed([baseTrack(), baseTrack({ id: 'dj2', soloed: true })])).toBe(true);
  });

  test('true when any track has any row-solo', () => {
    expect(anyDJTrackSoloed([baseTrack({ soloedRows: [48] })])).toBe(true);
  });
});

describe('applySetActionEntry', () => {
  const synthEntry: ActionMapEntry = {
    id: 'fx2_on',
    cat: 'fx',
    label: 'FX 2 On',
    short: 'ON',
    device: 'fx2',
    trigger: 'toggle',
  };

  test('adds a new pitch key and grows the map by 1', () => {
    const before = baseTrack();
    const tracks = [before];
    const beforeSize = Object.keys(before.actionMap).length;
    const next = applySetActionEntry(tracks, 'dj1', 63, synthEntry);
    expect(next).not.toBe(tracks);
    expect(Object.keys(next[0].actionMap).length).toBe(beforeSize + 1);
    expect(next[0].actionMap[63]).toBe(synthEntry);
  });

  test('replaces an existing pitch key without changing map size', () => {
    const before = baseTrack();
    const tracks = [before];
    const beforeSize = Object.keys(before.actionMap).length;
    const next = applySetActionEntry(tracks, 'dj1', 48, synthEntry);
    expect(Object.keys(next[0].actionMap).length).toBe(beforeSize);
    expect(next[0].actionMap[48]).toBe(synthEntry);
  });

  test('is a no-op (same reference) for unknown track id', () => {
    const tracks = [baseTrack()];
    const next = applySetActionEntry(tracks, 'nonexistent', 48, synthEntry);
    expect(next).toBe(tracks);
  });

  test('does not mutate the input array or track', () => {
    const before = baseTrack();
    const tracks = [before];
    applySetActionEntry(tracks, 'dj1', 63, synthEntry);
    expect(before.actionMap[63]).toBeUndefined();
    expect(tracks[0]).toBe(before);
  });
});

describe('applyDeleteActionEntry', () => {
  test('removes the pitch key and shrinks the map by 1', () => {
    const before = baseTrack();
    const beforeSize = Object.keys(before.actionMap).length;
    const next = applyDeleteActionEntry([before], 'dj1', 48);
    expect(Object.keys(next[0].actionMap).length).toBe(beforeSize - 1);
    expect(next[0].actionMap[48]).toBeUndefined();
  });

  test('prunes the pitch from mutedRows and soloedRows', () => {
    const before = baseTrack({ mutedRows: [48, 56], soloedRows: [48, 57] });
    const next = applyDeleteActionEntry([before], 'dj1', 48);
    expect(next[0].mutedRows).toEqual([56]);
    expect(next[0].soloedRows).toEqual([57]);
  });

  test('preserves mutedRows/soloedRows reference when pitch is not present', () => {
    const mutedRows = [56];
    const soloedRows = [57];
    const before = baseTrack({ mutedRows, soloedRows });
    const next = applyDeleteActionEntry([before], 'dj1', 48);
    expect(next[0].mutedRows).toBe(mutedRows);
    expect(next[0].soloedRows).toBe(soloedRows);
  });

  test('is a no-op (same reference) for unknown track id', () => {
    const tracks = [baseTrack()];
    const next = applyDeleteActionEntry(tracks, 'nonexistent', 48);
    expect(next).toBe(tracks);
  });

  test('is a no-op (same reference) when the pitch is already absent', () => {
    const tracks = [baseTrack()];
    const next = applyDeleteActionEntry(tracks, 'dj1', 99);
    expect(next).toBe(tracks);
  });

  test('also prunes the pitch from outputMap when deleting the actionMap entry', () => {
    const before = baseTrack({
      outputMap: { 48: { device: 'deck2', channel: 3, pitch: 60 } },
    });
    const next = applyDeleteActionEntry([before], 'dj1', 48);
    expect(next[0].outputMap[48]).toBeUndefined();
    expect(Object.keys(next[0].outputMap).length).toBe(0);
  });
});

describe('applySetOutputMapping', () => {
  const mapping: OutputMapping = { device: 'deck2', channel: 5, pitch: 64 };

  test('adds a new entry on a pitch that had no output mapping', () => {
    const before = baseTrack();
    const next = applySetOutputMapping([before], 'dj1', 48, mapping);
    expect(next[0].outputMap[48]).toBe(mapping);
  });

  test('replaces an existing mapping on the same pitch', () => {
    const before = baseTrack({
      outputMap: { 48: { device: 'global', channel: 1, pitch: 1 } },
    });
    const next = applySetOutputMapping([before], 'dj1', 48, mapping);
    expect(next[0].outputMap[48]).toBe(mapping);
    expect(Object.keys(next[0].outputMap).length).toBe(1);
  });

  test('is a no-op (same reference) for unknown track id', () => {
    const tracks = [baseTrack()];
    const next = applySetOutputMapping(tracks, 'nonexistent', 48, mapping);
    expect(next).toBe(tracks);
  });
});

describe('applyDeleteOutputMapping', () => {
  test('removes the pitch key from outputMap', () => {
    const before = baseTrack({
      outputMap: {
        48: { device: 'deck1', channel: 1, pitch: 48 },
        56: { device: 'deck2', channel: 2, pitch: 64 },
      },
    });
    const next = applyDeleteOutputMapping([before], 'dj1', 48);
    expect(next[0].outputMap[48]).toBeUndefined();
    expect(next[0].outputMap[56]).toEqual({ device: 'deck2', channel: 2, pitch: 64 });
  });

  test('is a no-op (same reference) for unknown track id', () => {
    const tracks = [baseTrack()];
    const next = applyDeleteOutputMapping(tracks, 'nonexistent', 48);
    expect(next).toBe(tracks);
  });

  test('is a no-op (same reference) when the pitch is already absent', () => {
    const tracks = [baseTrack()];
    const next = applyDeleteOutputMapping(tracks, 'dj1', 99);
    expect(next).toBe(tracks);
  });
});

describe('applySetEventPressure', () => {
  test('writes the points array to events[eventIdx].pressure', () => {
    const before = baseTrack({
      events: [
        { pitch: 56, t: 1, dur: 1, vel: 0.8 },
        { pitch: 56, t: 3, dur: 1, vel: 0.7 },
      ],
    });
    const points = [
      { t: 0, v: 0.5 },
      { t: 1, v: 0.9 },
    ];
    const next = applySetEventPressure([before], 'dj1', 56, 1, points);
    expect(next[0].events[1].pressure).toEqual(points);
    /* Untouched event keeps its original pressure (undefined). */
    expect(next[0].events[0].pressure).toBeUndefined();
  });

  test('empty array materialises an explicit Clear', () => {
    const before = baseTrack({
      events: [{ pitch: 56, t: 1, dur: 1, vel: 0.8 }],
    });
    const next = applySetEventPressure([before], 'dj1', 56, 0, []);
    expect(next[0].events[0].pressure).toEqual([]);
  });

  test('is a no-op (same reference) for unknown track id', () => {
    const tracks = [baseTrack({ events: [{ pitch: 56, t: 0, dur: 1, vel: 1 }] })];
    const next = applySetEventPressure(tracks, 'nonexistent', 56, 0, []);
    expect(next).toBe(tracks);
  });

  test('is a no-op (same reference) for out-of-range eventIdx', () => {
    const tracks = [baseTrack({ events: [{ pitch: 56, t: 0, dur: 1, vel: 1 }] })];
    const next = applySetEventPressure(tracks, 'dj1', 56, 99, []);
    expect(next).toBe(tracks);
  });

  test('is a no-op (same reference) when pitch does not match event', () => {
    const tracks = [baseTrack({ events: [{ pitch: 56, t: 0, dur: 1, vel: 1 }] })];
    const next = applySetEventPressure(tracks, 'dj1', 48, 0, []);
    expect(next).toBe(tracks);
  });
});
