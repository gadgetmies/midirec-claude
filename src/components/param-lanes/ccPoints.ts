import { beatsToSessionTicks, sessionTicksToBeats } from '../../midi/sessionTicks';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';

export interface CCPoint {
  tTicks: number;
  v: number;
}

export function ccModWheel(totalTBeats: number): CCPoint[] {
  const tpq = DEFAULT_MIDI_TPQ;
  const arr: CCPoint[] = [];
  let v = 0.5;
  const stepTicks = beatsToSessionTicks(0.5, tpq);
  const endTicks = beatsToSessionTicks(totalTBeats, tpq);
  for (let tTicks = 0; tTicks <= endTicks; tTicks += stepTicks) {
    v = Math.max(0.1, Math.min(1, v + Math.sin(sessionTicksToBeats(tTicks, tpq) * 1.3) * 0.18));
    arr.push({ tTicks, v });
  }
  return arr;
}

export function ccPitchBend(totalTBeats: number): CCPoint[] {
  const tpq = DEFAULT_MIDI_TPQ;
  const arr: CCPoint[] = [];
  const stepTicks = beatsToSessionTicks(1, tpq);
  const endTicks = beatsToSessionTicks(totalTBeats, tpq);
  for (let tTicks = 0; tTicks <= endTicks; tTicks += stepTicks) {
    arr.push({
      tTicks,
      v: 0.3 + 0.5 * Math.abs(Math.sin(sessionTicksToBeats(tTicks, tpq) * 0.6)),
    });
  }
  return arr;
}
