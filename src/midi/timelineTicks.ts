/** Session beat positions map to MIDI ticks as quarter-note units × TPQ (PPQ). */
export const DEFAULT_MIDI_TPQ = 480;

export function beatsToMidiTicks(beats: number, tpq: number = DEFAULT_MIDI_TPQ): number {
  if (!Number.isFinite(beats)) return 0;
  return Math.max(0, Math.round(beats * tpq));
}

/** Map stored event velocity to 0..127 (accepts 0..1 normalised or already-MIDI values). */
export function toMidi7FromNormVel(vel: number): number {
  if (!Number.isFinite(vel)) return 0;
  if (vel > 1 + 1e-6) return Math.max(0, Math.min(127, Math.round(vel)));
  return Math.max(0, Math.min(127, Math.round(vel * 127)));
}
