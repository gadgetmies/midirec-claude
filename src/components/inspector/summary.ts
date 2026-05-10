import { pitchLabel, type Note } from '../piano-roll/notes';

export interface TimeSignature {
  num: number;
  den: number;
}

const DEFAULT_SIG: TimeSignature = { num: 4, den: 4 };

export function formatBBT(t: number, sig: TimeSignature = DEFAULT_SIG): string {
  const bar = Math.floor(t / sig.num) + 1;
  const beat = Math.floor(t % sig.num) + 1;
  const sixteenth = Math.floor((t % 1) * 4) + 1;
  const barStr = bar.toString().padStart(2, '0');
  return `${barStr}.${beat}.${sixteenth}`;
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
    if (n.t < t0) t0 = n.t;
    const end = n.t + n.dur;
    if (end > t1) t1 = end;
    velSum += n.vel;
    if (n.vel < velMin) velMin = n.vel;
    if (n.vel > velMax) velMax = n.vel;
    if (n.dur < durMin) durMin = n.dur;
    if (n.dur > durMax) durMax = n.dur;
    pitchSet.add(n.pitch);
  }

  const mean = velSum / selected.length;
  const mixed = velMax - velMin > VEL_EPSILON;
  const uniformLen = durMax - durMin <= DUR_EPSILON ? selected[0].dur : null;
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
