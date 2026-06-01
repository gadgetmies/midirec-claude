import {
  DEFAULT_PX_PER_BEAT,
  KEYS_COLUMN_WIDTH,
  pxPerTickFromPxPerBeat,
} from '../piano-roll/PianoRoll';
import { GRID_TICK_THINNING_THRESHOLD_TICKS } from '../../session/layoutHorizon';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { chooseRulerSubdivision } from '../../session/timelineZoom';
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
  const subdivision = chooseRulerSubdivision(pxPerBeat, tpq);
  const tickStep = subdivision.ticksPerLine;
  const labelStep = subdivision.labelEvery;
  const ticksPerBar = tpq * BEATS_PER_BAR;
  const ticksPerPhrase = tpq * BEATS_PER_PHRASE;
  const thin = layoutHorizonTicks > GRID_TICK_THINNING_THRESHOLD_TICKS;
  const lanesWidth = layoutHorizonTicks * pxPerTick;
  const width = KEYS_COLUMN_WIDTH + lanesWidth;
  const els: JSX.Element[] = [];
  for (let tTicks = 0; tTicks <= layoutHorizonTicks; tTicks += tickStep) {
    /* When `thin` is set, the timeline is wide enough that even at beat
       density we drop minor ticks to keep the strip readable. The bar/phrase
       majors always survive, regardless of subdivision. */
    if (thin && tTicks !== 0 && tTicks !== layoutHorizonTicks && tTicks % ticksPerBar !== 0) {
      continue;
    }
    /* `--major` / `--phrase` modifiers track integer beats on the bar/phrase
       grid, never sub-beat ticks. */
    const onBeat = tTicks % tpq === 0;
    const major = onBeat && tTicks % ticksPerBar === 0;
    const phrase = onBeat && tTicks % ticksPerPhrase === 0;
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
    /* Labels only ever render on the integer-beat label cadence, never on
       sub-beat ticks, and never on the rightmost edge tick. */
    const onLabelCadence = tTicks % labelStep === 0;
    if (onLabelCadence && tTicks < layoutHorizonTicks) {
      const beatIdx = tTicks / tpq;
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
