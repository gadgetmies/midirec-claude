import { describe, expect, it } from 'vitest';
import {
  MIN_VISIBLE_BEATS,
  SCROLL_EXTENSION_MARGIN_BEATS,
  clampTimelineScroll,
  deriveSessionHorizonFloorBeats,
  deriveSessionHorizonFloorTicks,
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
