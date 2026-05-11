import { describe, expect, test } from 'vitest';
import {
  isDJRowAudible,
  isDJTrackAudible,
  anyDJTrackSoloed,
  type DJActionTrack,
} from './useDJActionTracks';
import { DEFAULT_ACTION_MAP } from '../data/dj';

const baseTrack = (over: Partial<DJActionTrack> = {}): DJActionTrack => ({
  id: 'dj1',
  name: 'DJ',
  color: 'oklch(70% 0.04 80)',
  actionMap: {
    48: DEFAULT_ACTION_MAP[48],
    56: DEFAULT_ACTION_MAP[56],
    57: DEFAULT_ACTION_MAP[57],
  },
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
