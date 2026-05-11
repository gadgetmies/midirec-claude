/* Pure helpers for the per-event pressure curve. Owned by Slice 9 (Pressure
   editor). The synthesis matches what `ActionRoll.tsx` produced before this
   slice — `(perPitchIndex % 3)` picks one of three shapes (arch / rise /
   center-peak). Until an event's pressure is touched by the editor, both
   the lane body and the editor synthesise from this same helper.

   Everything here is deterministic and side-effect-free — no Date, no
   Math.random, no DOM. Unit-tested in pressure.test.ts. */

import type { ActionEvent, PressurePoint } from './dj';

export const PRESSURE_CELLS = 14;
export const EDITOR_BINS = 16;

/* Produce the deterministic 14-point synthesised aftertouch curve for an
   event. Shape varies by `perPitchIndex` (0 = arch, 1 = rise, 2+ =
   center-peak) so repeated hits on the same row read as expressively
   different. ActionRoll passes the event's per-pitch index; callers that
   don't know it (e.g. unit tests) get the "arch" shape by default. */
export function synthesizePressure(
  _event: ActionEvent,
  perPitchIndex: number = 0,
): PressurePoint[] {
  const out: PressurePoint[] = new Array(PRESSURE_CELLS);
  const shape = ((perPitchIndex % 3) + 3) % 3;
  for (let i = 0; i < PRESSURE_CELLS; i++) {
    const u = i / (PRESSURE_CELLS - 1);
    let v: number;
    if (shape === 0) {
      v = Math.sin(u * Math.PI) * 0.85;
    } else if (shape === 1) {
      v = 0.2 + u * 0.7;
    } else {
      v = 0.6 - Math.abs(u - 0.5) * 0.8;
    }
    v = Math.min(1, Math.max(0.05, v));
    out[i] = { t: u, v };
  }
  return out;
}

/* Resample `points` to a fixed-length bin array using nearest-neighbour
   sampling at bin centers. Empty input → all zeroes. */
export function rasterizePressure(
  points: PressurePoint[],
  bins: number = EDITOR_BINS,
): number[] {
  const out: number[] = new Array(bins);
  if (points.length === 0) {
    for (let i = 0; i < bins; i++) out[i] = 0;
    return out;
  }
  for (let i = 0; i < bins; i++) {
    const target = (i + 0.5) / bins;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let pi = 0; pi < points.length; pi++) {
      const d = Math.abs(points[pi].t - target);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = pi;
      }
    }
    out[i] = points[bestIdx].v;
  }
  return out;
}

/* Summary statistics for the editor's readout. Stats run on the rasterised
   bins so they're stable regardless of stored-point density. */
export function summarizePressure(
  points: PressurePoint[],
  bins: number = EDITOR_BINS,
): { count: number; peak: number; avg: number } {
  if (points.length === 0) return { count: 0, peak: 0, avg: 0 };
  const rast = rasterizePressure(points, bins);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < bins; i++) {
    if (rast[i] > peak) peak = rast[i];
    sum += rast[i];
  }
  return { count: points.length, peak, avg: sum / bins };
}

/* Centered moving-average smoothing across the rasterised bins. Re-samples
   the input to `EDITOR_BINS` and returns 16 evenly-spaced points. Each
   click reduces the variance further — non-idempotent, matches the
   prototype. */
export function smoothPressure(
  points: PressurePoint[],
  kernel: number = 3,
): PressurePoint[] {
  if (points.length === 0) return [];
  const rast = rasterizePressure(points, EDITOR_BINS);
  const half = Math.floor(kernel / 2);
  const smoothed: number[] = new Array(EDITOR_BINS);
  for (let i = 0; i < EDITOR_BINS; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx < 0 || idx >= EDITOR_BINS) continue;
      sum += rast[idx];
      count += 1;
    }
    smoothed[i] = count > 0 ? sum / count : rast[i];
  }
  const out: PressurePoint[] = new Array(EDITOR_BINS);
  for (let i = 0; i < EDITOR_BINS; i++) {
    out[i] = { t: i / (EDITOR_BINS - 1), v: smoothed[i] };
  }
  return out;
}

/* Replace every bin with the rasterised mean. Returns 16 evenly-spaced
   points all sharing the same `v`. */
export function flattenPressure(points: PressurePoint[]): PressurePoint[] {
  if (points.length === 0) return [];
  const rast = rasterizePressure(points, EDITOR_BINS);
  let sum = 0;
  for (let i = 0; i < EDITOR_BINS; i++) sum += rast[i];
  const mean = sum / EDITOR_BINS;
  const out: PressurePoint[] = new Array(EDITOR_BINS);
  for (let i = 0; i < EDITOR_BINS; i++) {
    out[i] = { t: i / (EDITOR_BINS - 1), v: mean };
  }
  return out;
}

/* Fresh empty array on every call so callers can rely on reference
   inequality (matches Slice 9 spec scenario). */
export function clearPressure(): PressurePoint[] {
  return [];
}
