import { describe, expect, it } from 'vitest';
import {
  MIN_VISIBLE_BEATS,
  SCROLL_EXTENSION_MARGIN_BEATS,
  clampTimelineScroll,
  deriveSessionHorizonFloorBeats,
  deriveSessionHorizonFloorTicks,
  followPlayheadScrollLeft,
  horizonBeatsForViewportRightEdge,
  horizonStripeExtentTicksForViewport,
  MIN_VISIBLE_TICKS,
} from './layoutHorizon';
import type { ChannelId, PianoRollTrack, ParamLane } from '../hooks/useChannels';
import { beatsToSessionTicks } from '../midi/sessionTicks';

const ch1 = 1 as ChannelId;

describe('deriveSessionHorizonFloorBeats', () => {
  it('uses minimum when session is empty', () => {
    const rolls: PianoRollTrack[] = [
      { channelId: ch1, notes: [], muted: false, soloed: false, collapsed: false },
    ];
    expect(deriveSessionHorizonFloorBeats({ rolls, lanes: [], djTracks: [] })).toBe(MIN_VISIBLE_BEATS);
  });

  it('matches last note end without tail padding', () => {
    const rolls: PianoRollTrack[] = [
      {
        channelId: ch1,
        notes: [{ tTicks: 0, durTicks: beatsToSessionTicks(32), pitch: 60, vel: 0.5 }],
        muted: false,
        soloed: false,
        collapsed: false,
      },
    ];
    expect(deriveSessionHorizonFloorBeats({ rolls, lanes: [], djTracks: [] })).toBe(32);
  });

  it('includes param lane point times', () => {
    const rolls: PianoRollTrack[] = [
      { channelId: ch1, notes: [], muted: false, soloed: false, collapsed: false },
    ];
    const lanes: ParamLane[] = [
      {
        channelId: ch1,
        kind: 'cc',
        cc: 1,
        name: 'X',
        color: 'red',
        points: [{ tTicks: beatsToSessionTicks(100), v: 0.5 }],
        muted: false,
        soloed: false,
        collapsed: false,
      },
    ];
    expect(deriveSessionHorizonFloorBeats({ rolls, lanes, djTracks: [] })).toBe(100);
  });
});

describe('deriveSessionHorizonFloorTicks', () => {
  it('equals beat floor converted to ticks', () => {
    const rolls: PianoRollTrack[] = [
      {
        channelId: ch1,
        notes: [{ tTicks: 0, durTicks: beatsToSessionTicks(32), pitch: 60, vel: 0.5 }],
        muted: false,
        soloed: false,
        collapsed: false,
      },
    ];
    const inp = { rolls, lanes: [], djTracks: [] };
    expect(deriveSessionHorizonFloorTicks(inp)).toBe(beatsToSessionTicks(32));
    expect(deriveSessionHorizonFloorBeats(inp)).toBe(32);
  });
});

describe('horizonStripeExtentTicksForViewport', () => {
  it('matches min visible beats as ticks when lane is hidden', () => {
    expect(horizonStripeExtentTicksForViewport(0, 40, 56, 88, SCROLL_EXTENSION_MARGIN_BEATS)).toBe(
      MIN_VISIBLE_TICKS,
    );
  });
});

describe('horizonBeatsForViewportRightEdge', () => {
  it('returns min when lane area not yet visible', () => {
    expect(
      horizonBeatsForViewportRightEdge(0, 40, 56, 88, SCROLL_EXTENSION_MARGIN_BEATS),
    ).toBe(MIN_VISIBLE_BEATS);
  });

  it('extends for scroll position and margin', () => {
    const pxPerBeat = 88;
    const keys = 56;
    const clientWidth = 800;
    const scrollLeft = 200;
    const rightLanePx = scrollLeft + clientWidth - keys;
    const rightBeat = rightLanePx / pxPerBeat;
    expect(
      horizonBeatsForViewportRightEdge(scrollLeft, clientWidth, keys, pxPerBeat, 4),
    ).toBe(Math.max(MIN_VISIBLE_BEATS, Math.ceil(rightBeat + 4)));
  });
});

describe('clampTimelineScroll', () => {
  it('forces scrollLeft non-negative when set below zero', () => {
    const el = { scrollLeft: -200 };
    clampTimelineScroll(el as unknown as HTMLElement);
    expect(el.scrollLeft).toBe(0);
  });
});

describe('followPlayheadScrollLeft', () => {
  const keys = 56;

  it('returns null when playhead is in the left half of the viewport', () => {
    // playheadPx = 56 + 100*4 = 456; halfMark = 0 + 1000/2 = 500; 456 <= 500
    expect(followPlayheadScrollLeft(100, 4, keys, 0, 1000)).toBeNull();
  });

  it('returns null when playhead is exactly at the half-viewport mark', () => {
    // playheadPx = 56 + 111*4 = 500; halfMark = 500; 500 <= 500 → null
    expect(followPlayheadScrollLeft(111, 4, keys, 0, 1000)).toBeNull();
  });

  it('returns expected scrollLeft when playhead is past the half-viewport mark', () => {
    // playheadPx = 56 + 200*4 = 856; halfMark = 0 + 500 = 500; 856 > 500
    // target = 856 - 500 = 356
    expect(followPlayheadScrollLeft(200, 4, keys, 0, 1000)).toBe(356);
  });

  it('respects nonzero scrollLeft when computing the half mark', () => {
    // playheadPx = 56 + 150*4 = 656; halfMark = 200 + 400 = 600; 656 > 600
    // target = 656 - 800/2 = 256
    expect(followPlayheadScrollLeft(150, 4, keys, 200, 800)).toBe(256);
  });

  it('returns null when playhead is to the left of the viewport (asymmetric rule)', () => {
    // playheadPx = 56 + 50*4 = 256; halfMark = 2000 + 500 = 2500; 256 <= 2500 → null
    expect(followPlayheadScrollLeft(50, 4, keys, 2000, 1000)).toBeNull();
  });

  it('handles small viewport correctly', () => {
    // playheadPx = 56 + 50*4 = 256; halfMark = 0 + 150 = 150; 256 > 150
    // target = 256 - 150 = 106
    expect(followPlayheadScrollLeft(50, 4, keys, 0, 300)).toBe(106);
  });

  it('handles fractional pxPerTick without losing precision', () => {
    // pxPerTick = 0.05; playheadTicks = 4000; playheadPx = 56 + 200 = 256;
    // halfMark = 0 + 150 = 150; 256 > 150; target = 256 - 150 = 106
    expect(followPlayheadScrollLeft(4000, 0.05, keys, 0, 300)).toBeCloseTo(106, 9);
  });

  it('never returns a negative scrollLeft', () => {
    // Force the unclamped subtraction to be negative by an enormous clientWidth.
    // playheadPx = 56 + 1*1 = 57; halfMark = 0 + 5000 = 5000; 57 <= 5000 → null
    expect(followPlayheadScrollLeft(1, 1, keys, 0, 10000)).toBeNull();
    // Construct a case where playhead crosses half mark but target would be < 0 if not clamped:
    // playheadPx = 0 + 1*1 = 1; halfMark = 0 + 5/2 = 2.5; 1 <= 2.5 → null (so target never < 0 in valid cases)
    expect(followPlayheadScrollLeft(1, 1, 0, 0, 5)).toBeNull();
  });
});
