import {
  DEFAULT_PX_PER_BEAT,
  KEYS_COLUMN_WIDTH,
} from '../piano-roll/PianoRoll';
import { GRID_TICK_THINNING_THRESHOLD_BEATS } from '../../session/layoutHorizon';
import './Ruler.css';

interface RulerProps {
  layoutHorizonBeats: number;
  pxPerBeat?: number;
}

export function Ruler({
  layoutHorizonBeats,
  pxPerBeat = DEFAULT_PX_PER_BEAT,
}: RulerProps) {
  const thin = layoutHorizonBeats > GRID_TICK_THINNING_THRESHOLD_BEATS;
  const lanesWidth = layoutHorizonBeats * pxPerBeat;
  const width = KEYS_COLUMN_WIDTH + lanesWidth;
  const els: JSX.Element[] = [];
  for (let i = 0; i <= layoutHorizonBeats; i++) {
    if (thin && i !== 0 && i !== layoutHorizonBeats && i % 4 !== 0) {
      continue;
    }
    const major = i % 4 === 0;
    const left = KEYS_COLUMN_WIDTH + i * pxPerBeat;
    els.push(
      <div
        key={`t${i}`}
        className={major ? 'mr-ruler__tick mr-ruler__tick--major' : 'mr-ruler__tick'}
        style={{ left }}
      />,
    );
    if (major && i < layoutHorizonBeats) {
      const bar = 1 + Math.floor(i / 4);
      const beat = (i % 4) + 1;
      els.push(
        <div key={`l${i}`} className="mr-ruler__lbl" style={{ left }}>
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
