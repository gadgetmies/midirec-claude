import {
  DEFAULT_PX_PER_BEAT,
  KEYS_COLUMN_WIDTH,
  pxPerTickFromPxPerBeat,
} from '../piano-roll/PianoRoll';
import { GRID_TICK_THINNING_THRESHOLD_TICKS } from '../../session/layoutHorizon';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import './Ruler.css';

const BEATS_PER_BAR = 4;
const BEATS_PER_PHRASE = 16;

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
    if (thin && beatIdx !== 0 && tTicks !== layoutHorizonTicks && beatIdx % BEATS_PER_BAR !== 0) {
      continue;
    }
    const major = beatIdx % BEATS_PER_BAR === 0;
    const phrase = beatIdx % BEATS_PER_PHRASE === 0;
    const left = KEYS_COLUMN_WIDTH + tTicks * pxPerTick;
    const tickClass = major
      ? phrase
        ? 'mr-ruler__tick mr-ruler__tick--major mr-ruler__tick--phrase'
        : 'mr-ruler__tick mr-ruler__tick--major'
      : 'mr-ruler__tick';
    els.push(
      <div
        key={`t${tTicks}`}
        className={tickClass}
        style={{ left }}
      />,
    );
    if (major && tTicks < layoutHorizonTicks) {
      const barsPerPhrase = BEATS_PER_PHRASE / BEATS_PER_BAR;
      const phraseNum = 1 + Math.floor(beatIdx / BEATS_PER_PHRASE);
      const bar = (Math.floor(beatIdx / BEATS_PER_BAR) % barsPerPhrase) + 1;
      const beat = (beatIdx % BEATS_PER_BAR) + 1;
      els.push(
        <div key={`l${tTicks}`} className="mr-ruler__lbl" style={{ left }}>
          {phraseNum}.{bar}.{beat}
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
