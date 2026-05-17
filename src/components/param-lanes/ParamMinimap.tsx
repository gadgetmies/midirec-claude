import type { CCPoint } from '../../hooks/useChannels';

interface ParamMinimapProps {
  points: CCPoint[];
  color: string;
  viewT0Ticks?: number;
  layoutHorizonTicks: number;
  pxPerTick: number;
}

export function ParamMinimap({
  points,
  color,
  viewT0Ticks = 0,
  layoutHorizonTicks,
  pxPerTick,
}: ParamMinimapProps) {
  const viewT1Ticks = viewT0Ticks + layoutHorizonTicks;
  const visible = points.filter((p) => p.tTicks >= viewT0Ticks && p.tTicks < viewT1Ticks);
  const plotW = layoutHorizonTicks * pxPerTick;
  return (
    <div className="mr-param-lane__minimap" style={{ width: plotW }}>
      {visible.map((p, i) => {
        const left = (p.tTicks - viewT0Ticks) * pxPerTick;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left,
              width: 1.5,
              top: 1,
              bottom: 1,
              background: color,
              opacity: 0.5 + p.v * 0.4,
            }}
          />
        );
      })}
    </div>
  );
}
