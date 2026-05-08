export interface Note {
  t: number;
  dur: number;
  pitch: number;
  vel: number;
}

export interface Marquee {
  t0: number;
  t1: number;
  p0: number;
  p1: number;
}

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function isBlackKey(pitch: number): boolean {
  return BLACK_KEYS.has(((pitch % 12) + 12) % 12);
}

export function pitchLabel(pitch: number): string {
  const name = NOTE_NAMES[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}

export function makeNotes(count: number, seed: number): Note[] {
  let s = seed;
  const rand = (n: number): number => {
    s = (s * 9301 + 49297) % 233280;
    return (s / 233280) * n;
  };
  const notes: Note[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const dur = 0.25 + rand(1.5);
    const pitch = 48 + Math.floor(rand(28));
    const vel = 0.45 + rand(0.55);
    notes.push({ t, dur, pitch, vel });
    t += rand(0.7) + 0.15;
  }
  return notes;
}

export function notesInMarquee(notes: Note[], m: Marquee): number[] {
  const t0 = Math.min(m.t0, m.t1);
  const t1 = Math.max(m.t0, m.t1);
  const p0 = Math.min(m.p0, m.p1);
  const p1 = Math.max(m.p0, m.p1);
  const out: number[] = [];
  notes.forEach((n, i) => {
    const noteEnd = n.t + n.dur;
    if (noteEnd > t0 && n.t < t1 && n.pitch >= p0 && n.pitch <= p1) {
      out.push(i);
    }
  });
  return out;
}
