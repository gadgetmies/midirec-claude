import type { Note } from '../piano-roll/notes';

interface MinimapProps {
  notes: Note[];
  color: string;
  viewT0?: number;
  totalT?: number;
  pxPerBeat?: number;
}

export function Minimap({ notes, color, viewT0 = 0, totalT = 16, pxPerBeat = 88 }: MinimapProps) {
  const viewT1 = viewT0 + totalT;
  const visible = notes.filter((n) => n.t < viewT1 && n.t + n.dur > viewT0);
  const plotW = totalT * pxPerBeat;
  return (
    <div className="mr-track__minimap" style={{ width: plotW }}>
      {visible.map((n, i) => {
        const left = (n.t - viewT0) * pxPerBeat;
        const width = Math.max(1, n.dur * pxPerBeat);
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left,
              width,
              top: 1,
              bottom: 1,
              background: color,
              opacity: 0.5 + n.vel * 0.4,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}
