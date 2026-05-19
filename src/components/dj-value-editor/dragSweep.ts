/* Range-sweep helpers for DJValueEditor drag — pure functions extracted for
   unit testability. The editor wires these to pointer events and dispatches
   the resulting payloads to `stage.replaceDJEventsInRange` (CC/PB) or
   `stage.setEventPressure` (AT). See decision 5 in the change's design.md. */

import type { PressurePoint } from '../../data/dj';

export interface DragSample {
  /** Snapped (or rounded) tick. */
  t: number;
  /** Cursor-derived value in `[0, 1]`. */
  v: number;
}

export interface CCSweepResult {
  lo: number;
  hi: number;
  replacements: { tTicks: number; vel: number }[];
}

/** CC/PB sweep: build the inclusive `[lo, hi]` range and the endpoint
 *  replacements payload to pass to `replaceDJEventsInRange`. When the two
 *  samples land on the same tick the range degenerates and a single
 *  replacement (the latest sample) is returned — avoiding a duplicate event
 *  at the same tick that two replacements would produce. */
export function computeCCSweep(prev: DragSample, cur: DragSample): CCSweepResult {
  const lo = Math.min(prev.t, cur.t);
  const hi = Math.max(prev.t, cur.t);
  const replacements =
    prev.t === cur.t
      ? [{ tTicks: cur.t, vel: cur.v }]
      : [
          { tTicks: prev.t, vel: prev.v },
          { tTicks: cur.t, vel: cur.v },
        ];
  return { lo, hi, replacements };
}

/** AT sweep paint: compute the next `event.pressure` array after a drag
 *  frame that sweeps the swept range and re-inserts the two endpoints.
 *  Returns `null` to signal a no-op (both endpoints out-of-span or other
 *  bail conditions). */
export function computeATSweepPaint(args: {
  basePoints: readonly PressurePoint[];
  evTTicks: number;
  evDurTicks: number;
  prev: DragSample;
  cur: DragSample;
  /** Tolerance for "same t" filtering — matches the editor's existing TOL. */
  tolerance?: number;
}): PressurePoint[] | null {
  const { basePoints, evTTicks, evDurTicks, prev, cur } = args;
  const TOL = args.tolerance ?? 0.001;
  const inSpan = (t: number): boolean => t >= evTTicks && t <= evTTicks + evDurTicks;
  if (!inSpan(prev.t) || !inSpan(cur.t)) return null;
  const durTicks = Math.max(1, evDurTicks);
  const tRelPrev = clamp01((prev.t - evTTicks) / durTicks);
  const tRelCur = clamp01((cur.t - evTTicks) / durTicks);
  const loRel = Math.min(tRelPrev, tRelCur);
  const hiRel = Math.max(tRelPrev, tRelCur);
  const filtered = basePoints.filter((p) => p.t < loRel - TOL || p.t > hiRel + TOL);
  const replacements: PressurePoint[] =
    tRelPrev === tRelCur
      ? [{ t: tRelCur, v: clamp01(cur.v) }]
      : [
          { t: tRelPrev, v: clamp01(prev.v) },
          { t: tRelCur, v: clamp01(cur.v) },
        ];
  return [...filtered, ...replacements].sort((a, b) => a.t - b.t);
}

/** AT sweep delete: compute the next `event.pressure` array after a drag
 *  frame that deletes every point in the swept range. Returns `null` for
 *  out-of-span or no-change. */
export function computeATSweepDelete(args: {
  basePoints: readonly PressurePoint[];
  evTTicks: number;
  evDurTicks: number;
  prev: { t: number };
  cur: { t: number };
  tolerance?: number;
}): PressurePoint[] | null {
  const { basePoints, evTTicks, evDurTicks, prev, cur } = args;
  const TOL = args.tolerance ?? 0.001;
  const inSpan = (t: number): boolean => t >= evTTicks && t <= evTTicks + evDurTicks;
  if (!inSpan(prev.t) || !inSpan(cur.t)) return null;
  const durTicks = Math.max(1, evDurTicks);
  const tRelPrev = clamp01((prev.t - evTTicks) / durTicks);
  const tRelCur = clamp01((cur.t - evTTicks) / durTicks);
  const loRel = Math.min(tRelPrev, tRelCur);
  const hiRel = Math.max(tRelPrev, tRelCur);
  const filtered = basePoints.filter((p) => p.t < loRel - TOL || p.t > hiRel + TOL);
  if (filtered.length === basePoints.length) return null;
  return filtered;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
