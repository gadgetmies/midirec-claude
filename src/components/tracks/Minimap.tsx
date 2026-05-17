import type { Note } from '../piano-roll/notes';

interface MinimapProps {
  notes: Note[];
  color: string;
  viewT0Ticks?: number;
  layoutHorizonTicks: number;
  pxPerTick: number;
}

export function Minimap({
  notes,
  color,
  viewT0Ticks = 0,
  layoutHorizonTicks,
  pxPerTick,
}: MinimapProps) {
  const viewT1Ticks = viewT0Ticks + layoutHorizonTicks;
  const visible = notes.filter((n) => {
    const end = n.tTicks + n.durTicks;
    return n.tTicks < viewT1Ticks && end > viewT0Ticks;
  });
  const plotW = layoutHorizonTicks * pxPerTick;
  return (
    <div className="mr-track__minimap" style={{ width: plotW }}>
      {visible.map((n, i) => {
        const left = (n.tTicks - viewT0Ticks) * pxPerTick;
        const width = Math.max(1, n.durTicks * pxPerTick);
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
