/* Lane side of the dj-action-track body — lanes per configured action,
   beat ticks, per-event note rendering (trigger / velocity-sensitive /
   pressure-bearing / fallback), plus CC automation strips for rows whose
   effective MIDI output is Control Change.

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
  djActionRowOrderTopToBottom,
  resolvedDjRowOutputCc,
  type ActionEvent,
  type ActionMapEntry,
  type PressurePoint,
  type PressureRenderMode,
} from '../../data/dj';
import {
  isDJRowAudible,
  type DJActionTrack,
} from '../../hooks/useDJActionTracks';
import { GRID_TICK_THINNING_THRESHOLD_BEATS } from '../../session/layoutHorizon';
import { useStage } from '../../hooks/useStage';
import { rasterizePressure, synthesizePressure } from '../../data/pressure';

const PRESSURE_CELLS = 14;
/** Merge consecutive CC lane events on the same pitch when their start times are closer than this (beats). */
const CC_GROUP_MAX_START_GAP_BEATS = 1;

interface CcMergedGroup {
  pitch: number;
  /** `track.events` index of the chronologically first message in the cluster (click + selection anchor). */
  representativeIdx: number;
  memberIndices: number[];
  t0: number;
  dur: number;
}

interface ActionRollProps {
  track: DJActionTrack;
  soloing: boolean;
  layoutHorizonBeats: number;
  pxPerBeat: number;
  rowHeight: number;
  playheadT?: number;
}

export function ActionRoll({
  track,
  soloing,
  layoutHorizonBeats,
  pxPerBeat,
  rowHeight,
  playheadT = 0,
}: ActionRollProps) {
  const { djEventSelection, setDJEventSelection, djActionSelection, setDJActionSelection, pressureRenderMode } =
    useStage();
  const rowOrder = djActionRowOrderTopToBottom(track.actionMap);
  const pitchCount = rowOrder.length;
  const totalH = pitchCount * rowHeight;
  const thin = layoutHorizonBeats > GRID_TICK_THINNING_THRESHOLD_BEATS;
  const lanesWidth = layoutHorizonBeats * pxPerBeat;

  const topForPitch = (pitch: number) => {
    const idx = rowOrder.indexOf(pitch);
    if (idx < 0) return -rowHeight; // pushed off-screen; should be filtered before this
    return idx * rowHeight;
  };

  const ccGroupByMemberIdx = buildCcMergedGroupsByMemberIndex(
    track,
    CC_GROUP_MAX_START_GAP_BEATS,
  );

  const lanes: JSX.Element[] = rowOrder.map((pitch) => {
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
  for (let i = 0; i <= layoutHorizonBeats; i++) {
    if (thin && i !== 0 && i !== layoutHorizonBeats && i % 4 !== 0) {
      continue;
    }
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
    const audible = isDJRowAudible(track, event.pitch, soloing);
    const rowCc = resolvedDjRowOutputCc(track.actionMap, track.outputMap, event.pitch);
    if (rowCc !== undefined) {
      const group = ccGroupByMemberIdx.get(originalIdx);
      if (!group || group.representativeIdx !== originalIdx) {
        continue;
      }
      const onClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        setDJEventSelection({
          trackId: track.id,
          pitch: group.pitch,
          eventIdx: group.representativeIdx,
        });
        if (
          !djActionSelection ||
          djActionSelection.trackId !== track.id ||
          djActionSelection.pitch !== group.pitch
        ) {
          setDJActionSelection({ trackId: track.id, pitch: group.pitch });
        }
      };
      const groupSelected =
        djEventSelection !== null &&
        djEventSelection.trackId === track.id &&
        djEventSelection.pitch === group.pitch &&
        group.memberIndices.includes(djEventSelection.eventIdx);
      noteEls.push(
        renderCcAutomation(
          group,
          track,
          action,
          color,
          top,
          noteH,
          pxPerBeat,
          audible,
          groupSelected,
          onClick,
          rowCc,
        ),
      );
      continue;
    }
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
    const selected =
      djEventSelection !== null &&
      djEventSelection.trackId === track.id &&
      djEventSelection.pitch === event.pitch &&
      djEventSelection.eventIdx === originalIdx;
    const mode = actionMode(action);
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
      <div className="mr-playhead" style={{ left: playheadT * pxPerBeat }} />
    </div>
  );
}

function buildCcMergedGroupsByMemberIndex(
  track: DJActionTrack,
  maxStartGapBeats: number,
): Map<number, CcMergedGroup> {
  const out = new Map<number, CcMergedGroup>();
  const byPitch = new Map<number, { idx: number; ev: ActionEvent }[]>();

  for (let i = 0; i < track.events.length; i++) {
    const ev = track.events[i];
    if (!Object.prototype.hasOwnProperty.call(track.actionMap, ev.pitch)) continue;
    if (resolvedDjRowOutputCc(track.actionMap, track.outputMap, ev.pitch) === undefined) continue;
    const list = byPitch.get(ev.pitch) ?? [];
    list.push({ idx: i, ev });
    byPitch.set(ev.pitch, list);
  }

  for (const [pitch, items] of byPitch) {
    items.sort((a, b) => a.ev.t - b.ev.t);
    let cluster: { idx: number; ev: ActionEvent }[] = [];

    const flush = () => {
      if (cluster.length === 0) return;
      const t0 = cluster[0].ev.t;
      const tEnd = Math.max(...cluster.map((x) => x.ev.t + x.ev.dur));
      const dur = Math.max(0, tEnd - t0);
      const memberIndices = cluster.map((c) => c.idx);
      const representativeIdx = cluster[0].idx;
      const group: CcMergedGroup = {
        pitch,
        representativeIdx,
        memberIndices,
        t0,
        dur,
      };
      for (const idx of memberIndices) {
        out.set(idx, group);
      }
      cluster = [];
    };

    for (const item of items) {
      if (cluster.length === 0) {
        cluster.push(item);
      } else {
        const prevStart = cluster[cluster.length - 1].ev.t;
        if (item.ev.t - prevStart < maxStartGapBeats) {
          cluster.push(item);
        } else {
          flush();
          cluster = [item];
        }
      }
    }
    flush();
  }

  return out;
}

function collapseCcMessagesByPixelX(
  group: CcMergedGroup,
  track: DJActionTrack,
  pxPerBeat: number,
): { t: number; dur: number; vel: number }[] {
  const sorted = group.memberIndices
    .map((i) => ({ i, ev: track.events[i]! }))
    .sort((a, b) => a.ev.t - b.ev.t || a.i - b.i);
  const out: { t: number; dur: number; vel: number }[] = [];
  for (const { ev } of sorted) {
    const xPx = Math.round(ev.t * pxPerBeat);
    const prev = out[out.length - 1];
    if (prev !== undefined && Math.round(prev.t * pxPerBeat) === xPx) {
      prev.vel = ev.vel;
      prev.dur = Math.max(prev.dur, ev.dur);
    } else {
      out.push({ t: ev.t, dur: ev.dur, vel: ev.vel });
    }
  }
  return out;
}

function renderCcAutomation(
  group: CcMergedGroup,
  track: DJActionTrack,
  action: ActionMapEntry,
  color: string,
  top: number,
  noteH: number,
  pxPerBeat: number,
  audible: boolean,
  selected: boolean,
  onClick: (e: MouseEvent) => void,
  ccNum: number,
): JSX.Element {
  const messages = collapseCcMessagesByPixelX(group, track, pxPerBeat);
  const w = Math.max(8, group.dur * pxPerBeat);
  const bars = messages.map((m, mi) => {
    const x = (m.t - group.t0) * pxPerBeat;
    const barW = Math.max(2, m.dur * pxPerBeat);
    const fillH = Math.max(2, Math.min(1, m.vel) * (noteH - 4));
    return (
      <rect
        key={mi}
        x={x}
        y={noteH - 2 - fillH}
        width={barW}
        height={fillH}
        className="mr-djtrack__cc__cell"
        shapeRendering="crispEdges"
      />
    );
  });
  const audibleAttr = audible ? 'true' : 'false';
  const selectedAttr = selected ? 'true' : undefined;
  return (
    <div
      key={`cc${group.representativeIdx}`}
      className="mr-djtrack__cc"
      title={`${action.label} · ${action.short} · CC ${ccNum}`}
      data-audible={audibleAttr}
      data-selected={selectedAttr}
      onClick={onClick}
      style={{
        top,
        left: group.t0 * pxPerBeat,
        width: w,
        height: noteH,
        background: `color-mix(in oklab, ${color} 22%, transparent)`,
      }}
    >
      <svg width={w} height={noteH} className="mr-djtrack__cc__svg" preserveAspectRatio="none">
        {bars}
      </svg>
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
