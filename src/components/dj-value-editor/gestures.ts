/* DJValueEditor gesture math — pure helpers extracted for unit testability.
   The component layer wires these to pointer events and stage mutators.

   Snap model: ABSOLUTE for write ticks. The user is choosing a grid cell;
   there's no prior position to preserve an offset from. This deliberately
   differs from ActionRoll drag-to-move (which uses delta-snap to preserve
   off-grid offsets). See `dj-action-cc-value-editor/design.md` decision 4. */

import { quantizeGridToTicks, type QuantizeGrid } from '../../midi/quantizeGrid';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';

export interface SnapTickArgs {
  /** Pointer's tick under the cursor (post-scroll, pre-snap). May be negative
   *  when the cursor sits to the left of tick 0; callers SHOULD clamp before
   *  writing. */
  rawTicks: number;
  quantizeOn: boolean;
  quantizeGrid: QuantizeGrid;
  snapAbsoluteOn: boolean;
  tpq?: number;
}

/** The tick to write at given the cursor's raw position and the transport's
 *  quantize state. When `quantizeOn === false`, returns `rawTicks` rounded to
 *  the nearest integer. When `quantizeOn === true`, snaps to a grid cell:
 *  - `snapAbsoluteOn === true`: NEAREST cell (round to grid)
 *  - `snapAbsoluteOn === false`: FLOOR to cell (the cell the cursor is in) */
export function snapTickForWrite(args: SnapTickArgs): number {
  const tpq = args.tpq ?? DEFAULT_MIDI_TPQ;
  const raw = args.rawTicks;
  if (!args.quantizeOn) return Math.round(raw);
  const grid = quantizeGridToTicks(args.quantizeGrid, tpq);
  if (grid <= 0) return Math.round(raw);
  if (args.snapAbsoluteOn) {
    return Math.round(raw / grid) * grid;
  }
  return Math.floor(raw / grid) * grid;
}

/** Convert a clientY position on the canvas to a `vel` value in `[0, 1]`.
 *  Canvas top maps to `vel === 1`, canvas bottom to `vel === 0`. Vertical
 *  position is NEVER snapped. */
export function clientYToVel(clientY: number, canvasTop: number, canvasHeight: number): number {
  if (canvasHeight <= 0) return 0;
  const v = 1 - (clientY - canvasTop) / canvasHeight;
  return Math.max(0, Math.min(1, v));
}

/** Compute the grid cells in the inclusive range `[min(t0, t1), max(t0, t1)]`
 *  at the active grid size. When `gridTicks <= 0` returns the endpoints only.
 *  When `t0 === t1` returns a single tick. The cells are absolute ticks
 *  (multiples of `gridTicks`); endpoints that are not on a cell get rounded
 *  inward to the nearest contained cell. */
export function cellsBetween(t0: number, t1: number, gridTicks: number): number[] {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  if (gridTicks <= 0) {
    return lo === hi ? [Math.round(lo)] : [Math.round(lo), Math.round(hi)];
  }
  const firstCell = Math.ceil(lo / gridTicks) * gridTicks;
  const lastCell = Math.floor(hi / gridTicks) * gridTicks;
  if (firstCell > lastCell) return [];
  const out: number[] = [];
  for (let t = firstCell; t <= lastCell; t += gridTicks) {
    out.push(t);
  }
  return out;
}

/** Linearly interpolate between two `(t, v)` anchors. When `t0 === t1`,
 *  returns `v1` (latest value wins). */
export function lerpVel(t0: number, v0: number, t1: number, v1: number, t: number): number {
  if (t0 === t1) return v1;
  const f = (t - t0) / (t1 - t0);
  return v0 + (v1 - v0) * f;
}

/** Convert a canvas pointer x into a tick relative to the editor's content.
 *  `canvasContentLeft` is the canvas-clip's left edge in viewport-x; the
 *  inner content is translated by `KEYS_COLUMN_WIDTH - scrollLeft` so we
 *  subtract that offset before dividing by `pxPerTick`. */
export interface ClientXToTickArgs {
  clientX: number;
  canvasContentLeft: number;
  scrollLeft: number;
  keysColumnWidth: number;
  pxPerTick: number;
}
export function clientXToTicks(args: ClientXToTickArgs): number {
  if (args.pxPerTick <= 0) return 0;
  const xInContent = args.clientX - args.canvasContentLeft + args.scrollLeft - args.keysColumnWidth;
  return xInContent / args.pxPerTick;
}
