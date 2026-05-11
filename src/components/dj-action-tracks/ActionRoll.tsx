/* Lane side of the dj-action-track body — lanes per configured action,
   beat ticks, and per-event note rendering in three modes (trigger /
   velocity-sensitive / pressure-bearing) plus a fallback for actions that
   don't match any of the three predicates (e.g. mixer/loop without pad
   or pressure flags).

   Pressure curves: events with stored `event.pressure` render from that
   array; otherwise the per-event `perPitchIndex` flows into
   `synthesizePressure` (Slice 9). Click an event to set
   `djEventSelection` and open the Inspector's pressure editor.

   NOTE: the dynamic per-note `style={{ background: ... }}` is unavoidable
   here — `devColor()` returns a per-action OKLCH string that has to flow
   through `color-mix(...)`, which CSS variables can't compose at this
   density. The static `box-shadow` colors do come from tokens. */

import type { MouseEvent } from 'react';
import {
  actionMode,
  devColor,
  type ActionMapEntry,
  type PressurePoint,
  type PressureRenderMode,
} from '../../data/dj';
import {
  isDJRowAudible,
  type DJActionTrack,
} from '../../hooks/useDJActionTracks';
import { useStage } from '../../hooks/useStage';
import { rasterizePressure, synthesizePressure } from '../../data/pressure';

const PRESSURE_CELLS = 14;

interface ActionRollProps {
  track: DJActionTrack;
  soloing: boolean;
  totalT: number;
  pxPerBeat: number;
  rowHeight: number;
}

export function ActionRoll({
  track,
  soloing,
  totalT,
  pxPerBeat,
  rowHeight,
}: ActionRollProps) {
  const { djEventSelection, setDJEventSelection, djActionSelection, setDJActionSelection, pressureRenderMode } =
    useStage();
  /* Pitches descending top-to-bottom (high pitch at top, matching the
     channel-track piano-roll convention and the prototype's ActionRollUnit
     row order). */
  const pitchesAsc = Object.keys(track.actionMap)
    .map(Number)
    .sort((a, b) => a - b);
  const pitchCount = pitchesAsc.length;
  const totalH = pitchCount * rowHeight;
  const lanesWidth = totalT * pxPerBeat;

  /* topForPitch maps a pitch to its row's `top` offset in the lanes
     coordinate system. With ascending-sorted pitches, index 0 is the
     lowest pitch (bottom row → top = totalH - rowHeight) and the last
     index is the highest pitch (top row → top = 0). */
  const topForPitch = (pitch: number) => {
    const idx = pitchesAsc.indexOf(pitch);
    if (idx < 0) return -rowHeight; // pushed off-screen; should be filtered before this
    return totalH - (idx + 1) * rowHeight;
  };

  const lanes: JSX.Element[] = pitchesAsc.map((pitch) => {
    const muted = track.mutedRows.includes(pitch);
    const soloed = track.soloedRows.includes(pitch);
    const audible = isDJRowAudible(track, pitch, soloing);
    return (
      <div
        key={`lane-${pitch}`}
        className="mr-djtrack__lane"
        data-row-muted={muted ? 'true' : undefined}
        data-row-soloed={soloed ? 'true' : undefined}
        data-audible={audible ? 'true' : 'false'}
        style={{ top: topForPitch(pitch), height: rowHeight }}
      />
    );
  });

  const ticks: JSX.Element[] = [];
  for (let i = 0; i <= totalT; i++) {
    const major = i % 4 === 0;
    ticks.push(
      <div
        key={`tick-${i}`}
        className={major ? 'mr-djtrack__tick mr-djtrack__tick--bar' : 'mr-djtrack__tick'}
        style={{ left: i * pxPerBeat }}
      />,
    );
  }

  /* Per-pitch event indices, used to vary the pressure-curve shape across
     repeated events on the same row (e === 0 → arch, e === 1 → rising,
     etc — matching the prototype). The same value is fed to
     `synthesizePressure` so editor and lane render the same untouched
     curve. We also need the original event index inside `track.events`
     (NOT the filtered index) so click handlers can set
     `djEventSelection.eventIdx` correctly even when some events are
     filtered out. */
  const perPitchIndex = new Map<number, number>();

  const noteEls: JSX.Element[] = [];
  for (let originalIdx = 0; originalIdx < track.events.length; originalIdx++) {
    const event = track.events[originalIdx];
    if (!Object.prototype.hasOwnProperty.call(track.actionMap, event.pitch)) continue;
    const action = track.actionMap[event.pitch];
    const e = perPitchIndex.get(event.pitch) ?? 0;
    perPitchIndex.set(event.pitch, e + 1);
    const top = topForPitch(event.pitch) + 1;
    const left = event.t * pxPerBeat;
    const noteH = Math.max(5, rowHeight - 2);
    const color = devColor(action.device);
    const mode = actionMode(action);
    const audible = isDJRowAudible(track, event.pitch, soloing);
    const selected =
      djEventSelection !== null &&
      djEventSelection.trackId === track.id &&
      djEventSelection.pitch === event.pitch &&
      djEventSelection.eventIdx === originalIdx;
    const onClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      setDJEventSelection({ trackId: track.id, pitch: event.pitch, eventIdx: originalIdx });
      if (
        !djActionSelection ||
        djActionSelection.trackId !== track.id ||
        djActionSelection.pitch !== event.pitch
      ) {
        setDJActionSelection({ trackId: track.id, pitch: event.pitch });
      }
    };
    noteEls.push(
      renderNote(
        originalIdx,
        event.pitch,
        e,
        mode,
        action,
        color,
        top,
        left,
        noteH,
        event.dur,
        event.vel,
        pxPerBeat,
        audible,
        selected,
        onClick,
        event.pressure,
        pressureRenderMode,
      ),
    );
  }

  return (
    <div className="mr-djtrack__lanes" style={{ width: lanesWidth, height: totalH }}>
      {lanes}
      {ticks}
      {noteEls}
    </div>
  );
}

function renderNote(
  globalIndex: number,
  pitch: number,
  perPitchIndex: number,
  mode: ReturnType<typeof actionMode>,
  action: ActionMapEntry,
  color: string,
  top: number,
  left: number,
  noteH: number,
  dur: number,
  vel: number,
  pxPerBeat: number,
  audible: boolean,
  selected: boolean,
  onClick: (e: MouseEvent) => void,
  storedPressure: PressurePoint[] | undefined,
  pressureRenderMode: PressureRenderMode,
): JSX.Element {
  const titleText = `${action.label} · ${action.short}`;
  const audibleAttr = audible ? 'true' : 'false';
  const selectedAttr = selected ? 'true' : undefined;

  if (mode === 'trigger') {
    const w = 6;
    return (
      <div
        key={`n${globalIndex}`}
        className="mr-djtrack__note mr-djtrack__note--trigger"
        title={titleText}
        data-audible={audibleAttr}
        data-selected={selectedAttr}
        onClick={onClick}
        style={{
          top,
          left,
          width: w,
          height: noteH,
          background: color,
          boxShadow: `0 0 6px color-mix(in oklab, ${color} 60%, transparent)`,
        }}
      />
    );
  }

  if (mode === 'velocity-sensitive') {
    const w = Math.max(3, dur * pxPerBeat);
    const opacityPct = Math.round(40 + vel * 50);
    const tickOpacity = 0.4 + vel * 0.5;
    return (
      <div
        key={`n${globalIndex}`}
        className="mr-djtrack__note mr-djtrack__note--velocity"
        title={titleText}
        data-audible={audibleAttr}
        data-selected={selectedAttr}
        onClick={onClick}
        style={{
          top,
          left,
          width: w,
          height: noteH,
          background: `color-mix(in oklab, ${color} ${opacityPct}%, transparent)`,
        }}
      >
        <span
          className="mr-djtrack__note__veltick"
          style={{ opacity: tickOpacity }}
        />
      </div>
    );
  }

  if (mode === 'pressure-bearing') {
    /* Width derived from the deterministic seed (matching the prototype's
       `80 + (seed % 40)`). When stored pressure exists, the curve is
       sourced from it (rasterised to PRESSURE_CELLS bins); otherwise the
       synthesised curve from src/data/pressure.ts is used — same logic
       feeds the Inspector editor so the two visuals stay in lockstep. */
    const seed = (pitch * 13 + 7) % 100;
    const w = Math.max(60, 80 + (seed % 40));
    const cellW = w / PRESSURE_CELLS;
    let pressureValues: number[];
    if (storedPressure === undefined) {
      const synth = synthesizePressure({ pitch, t: 0, dur, vel }, perPitchIndex);
      pressureValues = synth.map((p) => p.v);
    } else if (storedPressure.length === 0) {
      pressureValues = new Array(PRESSURE_CELLS).fill(0);
    } else {
      pressureValues = rasterizePressure(storedPressure, PRESSURE_CELLS);
    }
    const innerBars: JSX.Element[] = [];
    for (let pi = 0; pi < PRESSURE_CELLS; pi++) {
      const pVal = Math.min(1, Math.max(0.05, pressureValues[pi]));
      const barH = pVal * (noteH * 0.55);
      innerBars.push(
        <rect
          key={pi}
          x={pi * cellW + cellW * 0.25}
          y={noteH - barH - 1}
          width={Math.max(1, cellW * 0.5)}
          height={barH}
          className="mr-djtrack__note__pcell"
          shapeRendering="crispEdges"
        />,
      );
    }
    return (
      <div
        key={`n${globalIndex}`}
        className="mr-djtrack__note mr-djtrack__note--pressure"
        title={titleText}
        data-audible={audibleAttr}
        data-selected={selectedAttr}
        data-pressure-mode={pressureRenderMode}
        onClick={onClick}
        style={{
          top,
          left,
          width: w,
          height: noteH,
          background: `color-mix(in oklab, ${color} 85%, transparent)`,
        }}
      >
        <svg
          width={w}
          height={noteH}
          className="mr-djtrack__note__svg"
          preserveAspectRatio="none"
        >
          {innerBars}
        </svg>
        {w > 30 && <span className="mr-djtrack__note__at">AT</span>}
      </div>
    );
  }

  /* fallback — variable-width bar by `dur`, fixed 85% opacity, no
     velocity tick. Used by mixer/loop/fx actions that have no `pad` and
     no `pressure` flags but also aren't trigger-category. */
  const w = Math.max(3, dur * pxPerBeat);
  return (
    <div
      key={`n${globalIndex}`}
      className="mr-djtrack__note mr-djtrack__note--fallback"
      title={titleText}
      data-audible={audibleAttr}
      data-selected={selectedAttr}
      onClick={onClick}
      style={{
        top,
        left,
        width: w,
        height: noteH,
        background: `color-mix(in oklab, ${color} 85%, transparent)`,
      }}
    />
  );
}
