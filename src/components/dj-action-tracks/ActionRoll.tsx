/* Lane side of the dj-action-track body — lanes per configured action,
   beat ticks, and per-event note rendering in three modes (trigger /
   velocity-sensitive / pressure-bearing) plus a fallback for actions that
   don't match any of the three predicates (e.g. mixer/loop without pad
   or pressure flags).

   Pressure curves are synthesized at render time from a deterministic
   seed (pitch-based) per the prototype's pattern in
   design_handoff_midi_recorder/prototype/dj.jsx ActionRollUnit ~440-460.
   The real pressure data model is owned by Slice 9's Pressure Editor.

   NOTE: the dynamic per-note `style={{ background: ... }}` is unavoidable
   here — `devColor()` returns a per-action OKLCH string that has to flow
   through `color-mix(...)`, which CSS variables can't compose at this
   density. The static `box-shadow` colors do come from tokens. */

import { actionMode, devColor, type ActionMapEntry } from '../../data/dj';
import {
  isDJRowAudible,
  type DJActionTrack,
} from '../../hooks/useDJActionTracks';

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
     etc — matching the prototype). */
  const perPitchIndex = new Map<number, number>();

  const noteEls: JSX.Element[] = track.events
    .filter((event) => Object.prototype.hasOwnProperty.call(track.actionMap, event.pitch))
    .map((event, globalIndex) => {
      const action = track.actionMap[event.pitch];
      const e = perPitchIndex.get(event.pitch) ?? 0;
      perPitchIndex.set(event.pitch, e + 1);
      const top = topForPitch(event.pitch) + 1;
      const left = event.t * pxPerBeat;
      const noteH = Math.max(5, rowHeight - 2);
      const color = devColor(action.device);
      const mode = actionMode(action);
      const audible = isDJRowAudible(track, event.pitch, soloing);
      return renderNote(globalIndex, event.pitch, e, mode, action, color, top, left, noteH, event.dur, event.vel, pxPerBeat, audible);
    });

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
): JSX.Element {
  const titleText = `${action.label} · ${action.short}`;
  const audibleAttr = audible ? 'true' : 'false';

  if (mode === 'trigger') {
    const w = 6;
    return (
      <div
        key={`n${globalIndex}`}
        className="mr-djtrack__note mr-djtrack__note--trigger"
        title={titleText}
        data-audible={audibleAttr}
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
       `80 + (seed % 40)`). Pressure curve shape varies by per-pitch event
       index — arch, rise, or center-peak. */
    const seed = (pitch * 13 + 7) % 100;
    const w = Math.max(60, 80 + (seed % 40));
    const cellW = w / PRESSURE_CELLS;
    const innerBars: JSX.Element[] = [];
    for (let pi = 0; pi < PRESSURE_CELLS; pi++) {
      const u = pi / (PRESSURE_CELLS - 1);
      let pVal: number;
      if (perPitchIndex === 0) {
        pVal = Math.sin(u * Math.PI) * 0.85;
      } else if (perPitchIndex === 1) {
        pVal = 0.2 + u * 0.7;
      } else {
        pVal = 0.6 - Math.abs(u - 0.5) * 0.8;
      }
      pVal = Math.min(1, Math.max(0.05, pVal));
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
