import { useMemo, useState, type MouseEvent } from 'react';
import { MSChip } from '../ms-chip/MSChip';
import { DEFAULT_PX_PER_BEAT, KEYS_COLUMN_WIDTH } from '../piano-roll/PianoRoll';
import { laneCCLabel, type CCLane as CCLaneType } from '../../hooks/useChannels';
import { CCMinimap } from './CCMinimap';
import './CCLane.css';

interface CCLaneProps {
  lane: CCLaneType;
  viewT0?: number;
  totalT: number;
  pxPerBeat?: number;
  playheadT?: number;
  audible: boolean;
  onToggleCollapsed: () => void;
  onToggleMuted: () => void;
  onToggleSoloed: () => void;
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
  // An empty CC lane (no recorded events) renders no bars. The previous
  // behavior of returning 64 v=0 bars left visible cap rectangles along the
  // bottom of the plot, which read as "events".
  if (!points.length) return [];
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
  pxPerBeat = DEFAULT_PX_PER_BEAT,
  playheadT = 0,
  audible,
  onToggleCollapsed,
  onToggleMuted,
  onToggleSoloed,
}: CCLaneProps) {
  const [hover, setHover] = useState<{ idx: number; v: number } | null>(null);

  const plotW = totalT * pxPerBeat;

  const bars = useMemo(
    () => resampleBars(lane.points, viewT0, totalT),
    [lane.points, viewT0, totalT],
  );

  const cellW = plotW / RESOLUTION;

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (plotW <= 0 || lane.collapsed || bars.length === 0) return;
    const idx = Math.max(0, Math.min(RESOLUTION - 1, Math.floor((event.nativeEvent.offsetX / plotW) * RESOLUTION)));
    const v = bars[idx]?.v ?? 0;
    setHover({ idx, v });
  };
  const onMouseLeave = () => setHover(null);
  const onHeaderClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onToggleCollapsed();
  };

  const playheadLeft = KEYS_COLUMN_WIDTH + playheadT * pxPerBeat;

  return (
    <div
      className="mr-cc-lane"
      data-muted={lane.muted ? 'true' : 'false'}
      data-soloed={lane.soloed ? 'true' : 'false'}
      data-collapsed={lane.collapsed ? 'true' : 'false'}
      data-audible={audible ? 'true' : 'false'}
    >
      <div className="mr-cc-lane__hdr" onClick={onHeaderClick}>
        <div className="mr-cc-lane__hdr-left">
          <span className="mr-cc-lane__chev">▾</span>
          <span className="mr-cc-lane__name">{lane.name}</span>
          <span className="mr-cc-lane__cc">{laneCCLabel(lane)}</span>
        </div>
        <div className="mr-cc-lane__hdr-spacer" />
        <div className="mr-cc-lane__hdr-right">
          <MSChip muted={lane.muted} soloed={lane.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed} />
        </div>
      </div>
      {lane.collapsed ? (
        <div className="mr-cc-lane__collapsed">
          <div className="mr-cc-lane__keys-spacer" />
          <CCMinimap
            points={lane.points}
            color={lane.color}
            viewT0={viewT0}
            totalT={totalT}
            pxPerBeat={pxPerBeat}
          />
          <div className="mr-playhead" style={{ left: playheadLeft }} />
        </div>
      ) : (
        <div className="mr-cc-lane__body">
          <div className="mr-cc-lane__keys-spacer" />
          <div
            className="mr-cc-lane__plot"
            style={{ width: plotW }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            {plotW > 0 && bars.length > 0 && (
              <svg width={plotW} height="100%" preserveAspectRatio="none" viewBox={`0 0 ${plotW} 72`}>
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
            <div className="mr-playhead" style={{ left: playheadT * pxPerBeat }} />
            {hover && (
              <span
                className="mr-cc-lane__readout"
                style={{ left: hover.idx * cellW + cellW / 2 }}
              >
                {Math.round(hover.v * 127)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
