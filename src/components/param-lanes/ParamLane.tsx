import { useMemo, useState, type MouseEvent } from 'react';
import { ChevDownIcon } from '../icons/transport';
import { MSChip } from '../ms-chip/MSChip';
import type { CCPoint } from '../../hooks/useChannels';
import { laneCCLabel, type ParamLane as ParamLaneType } from '../../hooks/useChannels';
import { DEFAULT_PX_PER_BEAT, KEYS_COLUMN_WIDTH } from '../piano-roll/PianoRoll';
import { ParamMinimap } from './ParamMinimap';
import './ParamLane.css';

interface ParamLaneProps {
  lane: ParamLaneType;
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

const TRACK_H = 56;
const TOP = 8;
const BAR_W = 1.5;

function sortedPoints(points: CCPoint[]): CCPoint[] {
  return [...points].sort((a, b) => a.t - b.t || a.v - b.v);
}

/** MIDI-style held value: last point at or before `t` (otherwise 0). */
function heldValue(pointsSorted: CCPoint[], t: number): number {
  let v = 0;
  for (const p of pointsSorted) {
    if (p.t > t) break;
    v = p.v;
  }
  return v;
}

export function ParamLane({
  lane,
  viewT0 = 0,
  totalT,
  pxPerBeat = DEFAULT_PX_PER_BEAT,
  playheadT = 0,
  audible,
  onToggleCollapsed,
  onToggleMuted,
  onToggleSoloed,
}: ParamLaneProps) {
  const [hover, setHover] = useState<{ px: number; v: number } | null>(null);

  const plotW = totalT * pxPerBeat;
  const viewT1 = viewT0 + totalT;

  const pointsSorted = useMemo(() => sortedPoints(lane.points), [lane.points]);

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (plotW <= 0 || lane.collapsed || pointsSorted.length === 0) return;
    const offsetX = event.nativeEvent.offsetX;
    const t = viewT0 + offsetX / pxPerBeat;
    const v = heldValue(pointsSorted, t);
    setHover({ px: offsetX, v });
  };
  const onMouseLeave = () => setHover(null);
  const onHeaderClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onToggleCollapsed();
  };

  const playheadLeft = KEYS_COLUMN_WIDTH + playheadT * pxPerBeat;

  return (
    <div
      className="mr-param-lane"
      data-muted={lane.muted ? 'true' : 'false'}
      data-soloed={lane.soloed ? 'true' : 'false'}
      data-collapsed={lane.collapsed ? 'true' : 'false'}
      data-audible={audible ? 'true' : 'false'}
    >
      <div className="mr-param-lane__hdr" onClick={onHeaderClick}>
        <div className="mr-param-lane__hdr-left">
          <span className="mr-param-lane__chev">
            <ChevDownIcon />
          </span>
          <span className="mr-param-lane__name">{lane.name}</span>
          <span className="mr-param-lane__cc">{laneCCLabel(lane)}</span>
        </div>
        <div className="mr-param-lane__hdr-spacer" />
        <div className="mr-param-lane__hdr-right">
          <MSChip muted={lane.muted} soloed={lane.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed} />
        </div>
      </div>
      {lane.collapsed ? (
        <div className="mr-param-lane__collapsed">
          <div className="mr-param-lane__keys-spacer" />
          <ParamMinimap
            points={lane.points}
            color={lane.color}
            viewT0={viewT0}
            totalT={totalT}
            pxPerBeat={pxPerBeat}
          />
          <div className="mr-playhead" style={{ left: playheadLeft }} />
        </div>
      ) : (
        <div className="mr-param-lane__body">
          <div className="mr-param-lane__keys-spacer" />
          <div
            className="mr-param-lane__plot"
            style={{ width: plotW }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            {plotW > 0 && pointsSorted.length > 0 && (
              <svg width={plotW} height="100%" preserveAspectRatio="none" viewBox={`0 0 ${plotW} 72`}>
                {pointsSorted.map((p, i) => {
                  if (p.t < viewT0 || p.t > viewT1) return null;
                  const xMid = (p.t - viewT0) * pxPerBeat;
                  const x = xMid - BAR_W / 2;
                  const h = p.v * TRACK_H;
                  const y = TOP + (TRACK_H - h);
                  return (
                    <g key={`${p.t}-${i}`}>
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
                {hover && (
                  <g shapeRendering="crispEdges">
                    <rect
                      x={Math.max(0, hover.px - 10)}
                      y={TOP}
                      width={20}
                      height={TRACK_H}
                      fill="var(--mr-accent)"
                      opacity={0.1}
                    />
                    {(() => {
                      const v = hover.v;
                      const h = v * TRACK_H;
                      const y = TOP + (TRACK_H - h);
                      const tickX = hover.px - BAR_W / 2;
                      return (
                        <>
                          <line
                            x1={hover.px}
                            y1={TOP}
                            x2={hover.px}
                            y2={TOP + TRACK_H}
                            stroke="var(--mr-accent)"
                            strokeOpacity={0.45}
                            strokeWidth={1}
                          />
                          <rect
                            x={tickX}
                            y={y}
                            width={BAR_W}
                            height={h}
                            fill="var(--mr-accent)"
                            opacity={0.7}
                          />
                        </>
                      );
                    })()}
                  </g>
                )}
              </svg>
            )}
            <div className="mr-playhead" style={{ left: playheadT * pxPerBeat }} />
            {hover && (
              <span className="mr-param-lane__readout" style={{ left: hover.px, transform: 'translateX(-50%)' }}>
                {Math.round(hover.v * 127)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
