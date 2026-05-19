/* Bulk-op helpers for the DJ value editor's Smooth / Flatten / Clear chips.
   All pure functions. The editor calls these to build the `replacements`
   array passed to `stage.replaceDJEventsInRange(...)`. AT-mode bulk ops use
   the existing pressure helpers directly (`smoothPressure` / `flattenPressure`). */

import type { ActionEvent } from '../../data/dj';

export const EDITOR_BULK_BINS = 16;

interface BulkCell {
  tTicks: number;
  vel: number;
}

/** Nearest-neighbour rasterise of CC/PB events in `[rangeStart, rangeEnd]`
 *  into `bins` evenly-spaced bins. Empty range or no events → array of zeros. */
export function rasterizeRowEvents(
  events: readonly ActionEvent[],
  rowPitch: number,
  rangeStart: number,
  rangeEnd: number,
  bins: number = EDITOR_BULK_BINS,
): number[] {
  const out = new Array<number>(bins).fill(0);
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  if (hi <= lo) return out;
  const inRange = events.filter(
    (ev) => ev.pitch === rowPitch && ev.tTicks >= lo && ev.tTicks <= hi,
  );
  if (inRange.length === 0) return out;
  const span = hi - lo;
  const binWidth = span / bins;
  for (let i = 0; i < bins; i++) {
    const binLo = lo + binWidth * i;
    const binHi = i === bins - 1 ? hi + 1 : lo + binWidth * (i + 1);
    const center = (binLo + binHi) / 2;
    let bestVel = 0;
    let bestDist = Infinity;
    let found = false;
    for (const ev of inRange) {
      if (ev.tTicks < binLo || ev.tTicks >= binHi) continue;
      const d = Math.abs(ev.tTicks - center);
      if (d < bestDist) {
        bestDist = d;
        bestVel = ev.vel;
        found = true;
      }
    }
    out[i] = found ? bestVel : 0;
  }
  return out;
}

/** Centered moving-average smoothing across rasterised bins (kernel 3 by
 *  default). Returns 16 evenly-spaced cells across `[rangeStart, rangeEnd]`,
 *  inclusive at both endpoints (tTicks at `rangeStart + (rangeEnd-rangeStart) * i / (bins-1)`). */
export function smoothRangeReplacements(
  events: readonly ActionEvent[],
  rowPitch: number,
  rangeStart: number,
  rangeEnd: number,
  kernel: number = 3,
  bins: number = EDITOR_BULK_BINS,
): BulkCell[] {
  const rast = rasterizeRowEvents(events, rowPitch, rangeStart, rangeEnd, bins);
  const half = Math.floor(kernel / 2);
  const smoothed = new Array<number>(bins);
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx < 0 || idx >= bins) continue;
      sum += rast[idx];
      count += 1;
    }
    smoothed[i] = count > 0 ? sum / count : rast[i];
  }
  return evenlySpaceCells(rangeStart, rangeEnd, bins, smoothed);
}

/** Replace every bin with the rasterised mean — returns 16 cells with
 *  identical `vel`. */
export function flattenRangeReplacements(
  events: readonly ActionEvent[],
  rowPitch: number,
  rangeStart: number,
  rangeEnd: number,
  bins: number = EDITOR_BULK_BINS,
): BulkCell[] {
  const rast = rasterizeRowEvents(events, rowPitch, rangeStart, rangeEnd, bins);
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += rast[i];
  const mean = bins > 0 ? sum / bins : 0;
  const flat = new Array<number>(bins).fill(mean);
  return evenlySpaceCells(rangeStart, rangeEnd, bins, flat);
}

function evenlySpaceCells(
  rangeStart: number,
  rangeEnd: number,
  bins: number,
  vels: readonly number[],
): BulkCell[] {
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  const out: BulkCell[] = new Array(bins);
  const denom = Math.max(1, bins - 1);
  for (let i = 0; i < bins; i++) {
    const tTicks = Math.round(lo + ((hi - lo) * i) / denom);
    out[i] = { tTicks, vel: Math.max(0, Math.min(1, vels[i] ?? 0)) };
  }
  return out;
}
