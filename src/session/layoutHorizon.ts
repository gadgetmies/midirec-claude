import type { PianoRollTrack, ParamLane } from '../hooks/useChannels';
import { beatsToSessionTicks, sessionTicksToBeats } from '../midi/sessionTicks';
import { DEFAULT_MIDI_TPQ } from '../midi/timelineTicks';

export const MIN_VISIBLE_BEATS = 16;
export const MIN_VISIBLE_TICKS = MIN_VISIBLE_BEATS * DEFAULT_MIDI_TPQ;

/** Blank grid past the viewport’s right edge — scroll can grow into this before widening again. */
export const SCROLL_EXTENSION_MARGIN_BEATS = 48;
export const SCROLL_EXTENSION_MARGIN_TICKS = SCROLL_EXTENSION_MARGIN_BEATS * DEFAULT_MIDI_TPQ;

/** Past this span along the grid, minor ticks are omitted (majors kept). */
export const GRID_TICK_THINNING_THRESHOLD_BEATS = 512;
export const GRID_TICK_THINNING_THRESHOLD_TICKS = GRID_TICK_THINNING_THRESHOLD_BEATS * DEFAULT_MIDI_TPQ;

export interface LayoutHorizonDJTrack {
  events: ReadonlyArray<{ tTicks: number; durTicks: number }>;
}

export interface SessionHorizonFloorInput {
  rolls: readonly PianoRollTrack[];
  lanes: readonly ParamLane[];
  djTracks: readonly LayoutHorizonDJTrack[];
}

function maxSessionEndTick(inp: SessionHorizonFloorInput): number {
  let maxTick = 0;
  for (const roll of inp.rolls) {
    for (const n of roll.notes) {
      maxTick = Math.max(maxTick, n.tTicks + n.durTicks);
    }
  }
  for (const lane of inp.lanes) {
    for (const p of lane.points) {
      maxTick = Math.max(maxTick, p.tTicks);
    }
  }
  for (const track of inp.djTracks) {
    for (const ev of track.events) {
      maxTick = Math.max(maxTick, ev.tTicks + ev.durTicks);
    }
  }
  return maxTick;
}

/**
 * Minimum MIDI-tick extent so existing session data stays on-strip (whole-beat ceiling).
 * Independent of scrolling / empty canvas — use scroll-driven widening on top.
 */
export function deriveSessionHorizonFloorTicks(inp: SessionHorizonFloorInput, tpq: number = DEFAULT_MIDI_TPQ): number {
  const maxEndTick = maxSessionEndTick(inp);
  const maxBeat = sessionTicksToBeats(maxEndTick, tpq);
  const extentBeats = Math.max(MIN_VISIBLE_BEATS, Math.ceil(maxBeat));
  return beatsToSessionTicks(extentBeats, tpq);
}

/** Whole-beat stripe floor matching {@link deriveSessionHorizonFloorTicks}. */
export function deriveSessionHorizonFloorBeats(inp: SessionHorizonFloorInput): number {
  const tpq = DEFAULT_MIDI_TPQ;
  const ticks = deriveSessionHorizonFloorTicks(inp, tpq);
  return Math.round(sessionTicksToBeats(ticks, tpq));
}

/**
 * Beat-quantized stripe width (as MIDI ticks) from viewport right edge + margin beats.
 * Matches legacy {@link horizonBeatsForViewportRightEdge} rounding, then converts to ticks.
 */
export function horizonStripeExtentTicksForViewport(
  scrollLeft: number,
  clientWidth: number,
  keysColumnPx: number,
  pxPerBeat: number,
  marginBeats: number,
  tpq: number = DEFAULT_MIDI_TPQ,
): number {
  const viewportRightPx = scrollLeft + clientWidth;
  const laneVisibleRightPx = viewportRightPx - keysColumnPx;
  if (laneVisibleRightPx <= 0) {
    return beatsToSessionTicks(MIN_VISIBLE_BEATS, tpq);
  }
  const rightBeat = laneVisibleRightPx / pxPerBeat;
  const extentBeats = Math.max(MIN_VISIBLE_BEATS, Math.ceil(rightBeat + marginBeats));
  return beatsToSessionTicks(extentBeats, tpq);
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
  const ticks = horizonStripeExtentTicksForViewport(
    scrollLeft,
    clientWidth,
    keysColumnPx,
    pxPerBeat,
    marginBeats,
    DEFAULT_MIDI_TPQ,
  );
  return Math.round(sessionTicksToBeats(ticks, DEFAULT_MIDI_TPQ));
}

export function clampTimelineScroll(el: HTMLElement | null | undefined): void {
  if (!el) return;
  if (el.scrollLeft < 0) {
    el.scrollLeft = 0;
  }
}

/**
 * Auto-scroll rule for the playhead: while the transport is playing or recording,
 * keep the playhead in the left half of `.mr-timeline`'s visible viewport.
 *
 * Returns the new `scrollLeft` to assign, or `null` when no update is needed
 * (playhead is already in the left half, or to the left of the viewport — the
 * rule pulls the viewport rightward only).
 */
export function followPlayheadScrollLeft(
  playheadTicks: number,
  pxPerTick: number,
  keysColumnWidth: number,
  scrollLeft: number,
  clientWidth: number,
): number | null {
  const playheadPx = keysColumnWidth + playheadTicks * pxPerTick;
  const halfMark = scrollLeft + clientWidth / 2;
  if (playheadPx <= halfMark) return null;
  return Math.max(0, playheadPx - clientWidth / 2);
}
