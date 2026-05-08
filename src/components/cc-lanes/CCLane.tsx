import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { MSChip } from '../ms-chip/MSChip';
import type { CCLane as CCLaneType } from '../../hooks/useCCLanes';

interface CCLaneProps {
  lane: CCLaneType;
  viewT0?: number;
  totalT: number;
  onToggleMuted?: () => void;
  onToggleSoloed?: () => void;
  paint?: number[];
  interp?: { a: number | null; b: number | null };
}

const RESOLUTION = 64;
const TRACK_H = 56;
const TOP = 8;
const BAR_W = 1.5;

interface Bar {
  v: number;
}

function resampleBars(points: CCLaneType['points'], viewT0: number, totalT: number): Bar[] {
  if (!points.length) {
    return Array.from({ length: RESOLUTION }, () => ({ v: 0 }));
  }
  const cellT = totalT / RESOLUTION;
  const out: Bar[] = [];
  for (let i = 0; i < RESOLUTION; i++) {
    const tCenter = viewT0 + (i + 0.5) * cellT;
    let best = points[0];
    let bestD = Math.abs(points[0].t - tCenter);
    for (let j = 1; j < points.length; j++) {
      const d = Math.abs(points[j].t - tCenter);
      if (d < bestD) {
        best = points[j];
        bestD = d;
      }
    }
    out.push({ v: best.v });
  }
  return out;
}

export function CCLane({
  lane,
  viewT0 = 0,
  totalT,
  onToggleMuted,
  onToggleSoloed,
}: CCLaneProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotW, setPlotW] = useState(0);
  const [hover, setHover] = useState<{ idx: number; v: number } | null>(null);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    setPlotW(el.clientWidth);
  }, []);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setPlotW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = useMemo(
    () => resampleBars(lane.points, viewT0, totalT),
    [lane.points, viewT0, totalT],
  );

  const cellW = plotW / RESOLUTION;

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (plotW <= 0) return;
    const idx = Math.max(0, Math.min(RESOLUTION - 1, Math.floor((event.nativeEvent.offsetX / plotW) * RESOLUTION)));
    const v = bars[idx]?.v ?? 0;
    setHover({ idx, v });
  };
  const onMouseLeave = () => setHover(null);

  return (
    <div className="mr-cc-lane" data-muted={lane.muted ? 'true' : 'false'} data-soloed={lane.soloed ? 'true' : 'false'}>
      <div className="mr-cc-lane__hdr">
        <span className="mr-cc-lane__name">{lane.name}</span>
        <span className="mr-cc-lane__cc">CC {lane.cc}</span>
      </div>
      <div
        ref={plotRef}
        className="mr-cc-lane__plot"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {plotW > 0 && (
          <svg width="100%" height="72" preserveAspectRatio="none" viewBox={`0 0 ${plotW} 72`}>
            {bars.map((b, i) => {
              const h = b.v * TRACK_H;
              const x = i * cellW + (cellW - BAR_W) / 2;
              const y = TOP + (TRACK_H - h);
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={BAR_W}
                    height={h}
                    fill={lane.color}
                    fillOpacity={0.78}
                    shapeRendering="crispEdges"
                  />
                  <rect
                    x={x - 0.5}
                    y={y - 0.5}
                    width={BAR_W + 1}
                    height={2}
                    fill={lane.color}
                    opacity={1}
                    shapeRendering="crispEdges"
                  />
                </g>
              );
            })}
            {hover && (() => {
              const cellX = hover.idx * cellW;
              const tickX = cellX + (cellW - BAR_W) / 2;
              const h = hover.v * TRACK_H;
              const y = TOP + (TRACK_H - h);
              return (
                <g>
                  <rect
                    x={cellX}
                    y={TOP}
                    width={cellW}
                    height={TRACK_H}
                    fill="var(--mr-accent)"
                    opacity={0.1}
                    shapeRendering="crispEdges"
                  />
                  <rect
                    x={tickX}
                    y={y}
                    width={BAR_W}
                    height={h}
                    fill="var(--mr-accent)"
                    opacity={0.7}
                    shapeRendering="crispEdges"
                  />
                </g>
              );
            })()}
          </svg>
        )}
        {hover && (
          <span
            className="mr-cc-lane__readout"
            style={{ left: hover.idx * cellW + cellW / 2 }}
          >
            {Math.round(hover.v * 127)}
          </span>
        )}
      </div>
      <div className="mr-cc-lane__ms">
        <MSChip muted={lane.muted} soloed={lane.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed} />
      </div>
    </div>
  );
}
