import {
  DEFAULT_PX_PER_BEAT,
  KEYS_COLUMN_WIDTH,
  pxPerTickFromPxPerBeat,
} from '../piano-roll/PianoRoll';
import { GRID_TICK_THINNING_THRESHOLD_TICKS } from '../../session/layoutHorizon';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import './Ruler.css';

interface RulerProps {
  layoutHorizonTicks: number;
  pxPerBeat?: number;
}

export function Ruler({
  layoutHorizonTicks,
  pxPerBeat = DEFAULT_PX_PER_BEAT,
}: RulerProps) {
  const tpq = DEFAULT_MIDI_TPQ;
  const pxPerTick = pxPerTickFromPxPerBeat(pxPerBeat, tpq);
  const thin = layoutHorizonTicks > GRID_TICK_THINNING_THRESHOLD_TICKS;
  const lanesWidth = layoutHorizonTicks * pxPerTick;
  const width = KEYS_COLUMN_WIDTH + lanesWidth;
  const els: JSX.Element[] = [];
  for (let tTicks = 0; tTicks <= layoutHorizonTicks; tTicks += tpq) {
    const beatIdx = tTicks / tpq;
    if (thin && beatIdx !== 0 && tTicks !== layoutHorizonTicks && beatIdx % 4 !== 0) {
      continue;
    }
    const major = beatIdx % 4 === 0;
    const left = KEYS_COLUMN_WIDTH + tTicks * pxPerTick;
    els.push(
      <div
        key={`t${tTicks}`}
        className={major ? 'mr-ruler__tick mr-ruler__tick--major' : 'mr-ruler__tick'}
        style={{ left }}
      />,
    );
    if (major && tTicks < layoutHorizonTicks) {
      const bar = 1 + Math.floor(beatIdx / 4);
      const beat = (beatIdx % 4) + 1;
      els.push(
        <div key={`l${tTicks}`} className="mr-ruler__lbl" style={{ left }}>
          {bar}.{beat}
        </div>,
      );
    }
  }
  return (
    <div className="mr-ruler" style={{ width }}>
      <div className="mr-ruler__keys-spacer" />
      {els}
    </div>
  );
}
