import type { CCPoint } from '../../hooks/useChannels';

interface CCMinimapProps {
  points: CCPoint[];
  color: string;
  viewT0?: number;
  totalT?: number;
  pxPerBeat?: number;
}

export function CCMinimap({ points, color, viewT0 = 0, totalT = 16, pxPerBeat = 88 }: CCMinimapProps) {
  const viewT1 = viewT0 + totalT;
  const visible = points.filter((p) => p.t >= viewT0 && p.t < viewT1);
  const plotW = totalT * pxPerBeat;
  return (
    <div className="mr-cc-lane__minimap" style={{ width: plotW }}>
      {visible.map((p, i) => {
        const left = (p.t - viewT0) * pxPerBeat;
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
