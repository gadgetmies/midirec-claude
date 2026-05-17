import { DEFAULT_MIDI_TPQ, beatsToMidiTicks } from './timelineTicks';

export { DEFAULT_MIDI_TPQ };

/** MIDI ticks from session zero ↔ fractional quarter-note beats (display / scheduling bridge). */
export function sessionTicksToBeats(ticks: number, tpq: number = DEFAULT_MIDI_TPQ): number {
  if (!Number.isFinite(ticks)) return 0;
  return ticks / tpq;
}

export function beatsToSessionTicks(beats: number, tpq: number = DEFAULT_MIDI_TPQ): number {
  return beatsToMidiTicks(beats, tpq);
}

/** Quantized session playhead from transport clock (same rounding as beat-scheduling bridges). */
export function playheadTicksFromTimecodeMs(timecodeMs: number, bpm: number, tpq: number = DEFAULT_MIDI_TPQ): number {
  const beats = (timecodeMs / 1000) * (bpm / 60);
  return beatsToSessionTicks(beats, tpq);
}

export function timecodeMsFromPlayheadTicks(playheadTicks: number, bpm: number, tpq: number = DEFAULT_MIDI_TPQ): number {
  const beats = sessionTicksToBeats(playheadTicks, tpq);
  return (beats / (bpm / 60)) * 1000;
}
