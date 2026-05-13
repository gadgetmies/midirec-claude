import type { PianoRollTrack, ParamLane } from '../hooks/useChannels';

export const MIN_VISIBLE_BEATS = 16;

/** Blank grid past the viewport’s right edge, in beats — scroll can grow into this before widening again. */
export const SCROLL_EXTENSION_MARGIN_BEATS = 48;

/** Past this many beats along the grid, minor ticks are omitted (majors kept). */
export const GRID_TICK_THINNING_THRESHOLD_BEATS = 512;

export interface LayoutHorizonDJTrack {
  events: ReadonlyArray<{ t: number; dur: number }>;
}

export interface SessionHorizonFloorInput {
  rolls: readonly PianoRollTrack[];
  lanes: readonly ParamLane[];
  djTracks: readonly LayoutHorizonDJTrack[];
}

/**
 * Minimum beats needed so existing session data stays on-strip.
 * Independent of scrolling / empty canvas — use scroll-driven widening on top.
 */
export function deriveSessionHorizonFloorBeats(inp: SessionHorizonFloorInput): number {
  let maxBeat = 0;
  for (const roll of inp.rolls) {
    for (const n of roll.notes) {
      maxBeat = Math.max(maxBeat, n.t + n.dur);
    }
  }
  for (const lane of inp.lanes) {
    for (const p of lane.points) {
      maxBeat = Math.max(maxBeat, p.t);
    }
  }
  for (const track of inp.djTracks) {
    for (const ev of track.events) {
      maxBeat = Math.max(maxBeat, ev.t + ev.dur);
    }
  }
  const extent = Math.ceil(maxBeat);
  return Math.max(MIN_VISIBLE_BEATS, extent);
}

/**
 * Beat index at the viewport’s right edge in lane coordinates, plus margin,
 * so the inner timeline can be widened before the user hits scroll max.
 */
export function horizonBeatsForViewportRightEdge(
  scrollLeft: number,
  clientWidth: number,
  keysColumnPx: number,
  pxPerBeat: number,
  marginBeats: number,
): number {
  const viewportRightPx = scrollLeft + clientWidth;
  const laneVisibleRightPx = viewportRightPx - keysColumnPx;
  if (laneVisibleRightPx <= 0) {
    return MIN_VISIBLE_BEATS;
  }
  const rightBeat = laneVisibleRightPx / pxPerBeat;
  return Math.max(MIN_VISIBLE_BEATS, Math.ceil(rightBeat + marginBeats));
}

export function clampTimelineScroll(el: HTMLElement | null | undefined): void {
  if (!el) return;
  if (el.scrollLeft < 0) {
    el.scrollLeft = 0;
  }
}
