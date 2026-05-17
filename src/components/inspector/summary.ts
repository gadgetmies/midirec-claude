import { pitchLabel, type Note } from '../piano-roll/notes';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { beatsToSessionTicks, sessionTicksToBeats } from '../../midi/sessionTicks';

export interface TimeSignature {
  num: number;
  den: number;
}

const DEFAULT_SIG: TimeSignature = { num: 4, den: 4 };

/** Mirrors `formatBBT`'s fractional-beat quantization; must stay in sync. */
export const FORMAT_BBT_SUBDIVS_PER_BEAT = 4;

export function formatBBT(t: number, sig: TimeSignature = DEFAULT_SIG): string {
  const bar = Math.floor(t / sig.num) + 1;
  const beat = Math.floor(t % sig.num) + 1;
  const sixteenth =
    Math.floor((t % 1) * FORMAT_BBT_SUBDIVS_PER_BEAT) + 1;
  const barStr = bar.toString().padStart(2, '0');
  return `${barStr}.${beat}.${sixteenth}`;
}

/**
 * Inverse of {@link formatBBT}: parses `bar.beat.subdiv` → fractional quarter-note beats
 * measured from timeline zero (`formatBBT` input space). Parsed beats map to **`tTicks`**
 * via {@link beatsToSessionTicks}: **nearest** MIDI tick (`Math.round(beats * TPQ)`), which
 * is the authoritative rounding boundary for tuplet/grid drift.
 */
export function parsePhraseBarBeatToFractionalBeats(
  raw: string,
  sig: TimeSignature = DEFAULT_SIG,
):
  | { ok: true; beats: number }
  | { ok: false } {
  const s = raw.trim();
  const parts = s.split('.').map((p) => p.trim());
  if (parts.length !== 3 || parts.some((x) => x === '')) return { ok: false };
  const bi = /^[0-9]+$/.test(parts[0]!) ? parseInt(parts[0]!, 10) : NaN;
  const bet = /^[0-9]+$/.test(parts[1]!) ? parseInt(parts[1]!, 10) : NaN;
  const sub = /^[0-9]+$/.test(parts[2]!) ? parseInt(parts[2]!, 10) : NaN;
  if (
    ![bi, bet, sub].every((n) => Number.isFinite(n) && n >= 1) ||
    bi < 1 ||
    bet > sig.num ||
    bet < 1 ||
    sub > FORMAT_BBT_SUBDIVS_PER_BEAT
  )
    return { ok: false };
  const beats =
    (bi - 1) * sig.num +
    (bet - 1) +
    (sub - 1) / FORMAT_BBT_SUBDIVS_PER_BEAT;
  return { ok: true, beats };
}

export function parsePhraseBarBeatToTicks(
  raw: string,
  sig: TimeSignature = DEFAULT_SIG,
  tpq: number = DEFAULT_MIDI_TPQ,
): number | null {
  const p = parsePhraseBarBeatToFractionalBeats(raw, sig);
  if (!p.ok) return null;
  return beatsToSessionTicks(p.beats, tpq);
}

/** Canonical Inspector display string for **`tTicks`**, aligned with **`formatBBT`**. */
export function canonicalPhraseBarBeatFromTicks(
  tTicks: number,
  tpq: number = DEFAULT_MIDI_TPQ,
  sig: TimeSignature = DEFAULT_SIG,
): string {
  return formatBBT(sessionTicksToBeats(tTicks, tpq), sig);
}

export function formatPitch(midi: number): string {
  return pitchLabel(midi);
}

export interface InspectorSummary {
  count: number;
  range: { t0: number; t1: number };
  pitches: number[];
  velocity: { mean: number; mixed: boolean };
  length: { uniform: number | null; range: [number, number] };
  channelLabel: string;
}

const VEL_EPSILON = 1 / 127;
const DUR_EPSILON = 0.001;

export function summarizeSelection(
  notes: Note[],
  indexes: number[],
  channelLabel: string,
): InspectorSummary {
  const selected = indexes.map((i) => notes[i]).filter((n): n is Note => n !== undefined);
  if (selected.length === 0) {
    return {
      count: 0,
      range: { t0: 0, t1: 0 },
      pitches: [],
      velocity: { mean: 0, mixed: false },
      length: { uniform: null, range: [0, 0] },
      channelLabel,
    };
  }

  let t0 = Infinity;
  let t1 = -Infinity;
  let velSum = 0;
  let velMin = Infinity;
  let velMax = -Infinity;
  let durMin = Infinity;
  let durMax = -Infinity;
  const pitchSet = new Set<number>();

  for (const n of selected) {
    const tBeats = sessionTicksToBeats(n.tTicks);
    const endBeats = sessionTicksToBeats(n.tTicks + n.durTicks);
    if (tBeats < t0) t0 = tBeats;
    if (endBeats > t1) t1 = endBeats;
    velSum += n.vel;
    if (n.vel < velMin) velMin = n.vel;
    if (n.vel > velMax) velMax = n.vel;
    const durBeats = sessionTicksToBeats(n.durTicks);
    if (durBeats < durMin) durMin = durBeats;
    if (durBeats > durMax) durMax = durBeats;
    pitchSet.add(n.pitch);
  }

  const mean = velSum / selected.length;
  const mixed = velMax - velMin > VEL_EPSILON;
  const uniformLen = durMax - durMin <= DUR_EPSILON ? sessionTicksToBeats(selected[0].durTicks) : null;
  const pitches = Array.from(pitchSet).sort((a, b) => a - b);

  return {
    count: selected.length,
    range: { t0, t1 },
    pitches,
    velocity: { mean, mixed },
    length: { uniform: uniformLen, range: [durMin, durMax] },
    channelLabel,
  };
}
