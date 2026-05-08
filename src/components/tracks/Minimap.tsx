import type { Note } from '../piano-roll/notes';

interface MinimapProps {
  notes: Note[];
  color: string;
  viewT0?: number;
  totalT?: number;
}

export function Minimap({ notes, color, viewT0 = 0, totalT = 16 }: MinimapProps) {
  const viewT1 = viewT0 + totalT;
  const visible = notes.filter((n) => n.t < viewT1 && n.t + n.dur > viewT0);
  return (
    <div className="mr-track__minimap">
      {visible.map((n, i) => {
        const left = ((n.t - viewT0) / totalT) * 100;
        const width = (n.dur / totalT) * 100;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `max(1px, ${width}%)`,
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
