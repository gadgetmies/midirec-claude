import { isBlackKey, pitchLabel } from './notes';

interface PianoKeysProps {
  rowHeight: number;
  lo?: number;
  hi?: number;
}

export function PianoKeys({ rowHeight, lo = 48, hi = 76 }: PianoKeysProps) {
  const range = hi - lo;
  const height = range * rowHeight;
  const keys: JSX.Element[] = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = height - (idx + 1) * rowHeight;
    const black = isBlackKey(p);
    const label = p % 12 === 0 ? pitchLabel(p) : '';
    keys.push(
      <div
        key={p}
        className="mr-key"
        data-black={black ? 'true' : undefined}
        style={{ top, height: rowHeight }}
      >
        {label}
      </div>,
    );
  }
  return (
    <div className="mr-keys" style={{ height }}>
      {keys}
    </div>
  );
}
