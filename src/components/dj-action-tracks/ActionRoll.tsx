/* Lane side of the dj-action-track body — lanes per configured action,
   beat ticks, per-event note rendering (trigger / velocity-sensitive /
   pressure-bearing / fallback), plus CC automation strips for rows whose
   effective MIDI output is Control Change.

   Pressure curves: events with stored `event.pressure` render from that
   array; otherwise the per-event `perPitchIndex` flows into
   `synthesizePressure` (Slice 9). Click an event to set
   `djEventSelection` and open the Inspector's pressure editor.

   Horizontal drag-to-move (timeline-drag-move-items): `.mr-djtrack__note`
   and `.mr-djtrack__cc` participate in a pointer-driven gesture that
   commits a new `tTicks` on pointerup. CC groups shift every member by the
   same delta so internal spacing is preserved.

   NOTE: the dynamic per-note `style={{ background: ... }}` is unavoidable
   here — `devColor()` returns a per-action OKLCH string that has to flow
   through `color-mix(...)`, which CSS variables can't compose at this
   density. The static `box-shadow` colors do come from tokens. */

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  actionMode,
  devColor,
  djActionRowOrderTopToBottom,
  resolvedDjRowOutputCc,
  type ActionMapEntry,
  type PressurePoint,
  type PressureRenderMode,
} from '../../data/dj';
import {
  buildCcMergedGroupsByMemberIndex,
  CC_GROUP_MAX_START_GAP_TICKS,
  isDJRowAudible,
  type CcMergedGroup,
  type DJActionTrack,
} from '../../hooks/useDJActionTracks';
import { GRID_TICK_THINNING_THRESHOLD_TICKS } from '../../session/layoutHorizon';
import { useStage } from '../../hooks/useStage';
import { rasterizePressure, synthesizePressure } from '../../data/pressure';
import { beatsToSessionTicks, sessionTicksToBeats } from '../../midi/sessionTicks';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { quantizeGridToTicks, type QuantizeGrid } from '../../midi/quantizeGrid';

const PRESSURE_CELLS = 14;
const DRAG_THRESHOLD_PX = 3;

interface ActionRollProps {
  track: DJActionTrack;
  soloing: boolean;
  layoutHorizonTicks: number;
  pxPerBeat: number;
  rowHeight: number;
  playheadTicks?: number;
  quantizeOn?: boolean;
  quantizeGrid?: QuantizeGrid;
  snapAbsoluteOn?: boolean;
}

type DragMode = 'pre-click' | 'dragging';

interface EventDragState {
  kind: 'event';
  pointerId: number;
  element: HTMLDivElement;
  px0: number;
  mode: DragMode;
  eventIdx: number;
  pitch: number;
  tick0: number;
}

interface CcGroupDragState {
  kind: 'cc-group';
  pointerId: number;
  element: HTMLDivElement;
  px0: number;
  mode: DragMode;
  pitch: number;
  representativeIdx: number;
  memberIndices: number[];
  memberOriginalTicks: number[];
  earliestTTicks: number;
}

type DragState = EventDragState | CcGroupDragState;

type Preview =
  | { kind: 'event'; eventIdx: number; tTicks: number }
  | { kind: 'cc-group'; pitch: number; memberIndices: Set<number>; deltaTicks: number };

interface PointerHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export function ActionRoll({
  track,
  soloing,
  layoutHorizonTicks,
  pxPerBeat,
  rowHeight,
  playheadTicks = 0,
  quantizeOn = false,
  quantizeGrid = '1/16',
  snapAbsoluteOn = false,
}: ActionRollProps) {
  const {
    djEventSelection,
    setDJEventSelection,
    djActionSelection,
    setDJActionSelection,
    pressureRenderMode,
    setDJEventTTicks,
  } = useStage();
  const tpq = DEFAULT_MIDI_TPQ;
  const pxPerTick = pxPerBeat / tpq;
  const rowOrder = djActionRowOrderTopToBottom(track.actionMap);
  const pitchCount = rowOrder.length;
  const totalH = pitchCount * rowHeight;
  const thin = layoutHorizonTicks > GRID_TICK_THINNING_THRESHOLD_TICKS;
  const lanesWidth = layoutHorizonTicks * pxPerTick;

  const topForPitch = (pitch: number) => {
    const idx = rowOrder.indexOf(pitch);
    if (idx < 0) return -rowHeight; // pushed off-screen; should be filtered before this
    return idx * rowHeight;
  };

  const ccGroupByMemberIdx = buildCcMergedGroupsByMemberIndex(track, CC_GROUP_MAX_START_GAP_TICKS);

  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const snapDelta = useCallback(
    (deltaTicksRaw: number): number => {
      if (!quantizeOn) return deltaTicksRaw;
      const snap = quantizeGridToTicks(quantizeGrid, tpq);
      return Math.round(deltaTicksRaw / snap) * snap;
    },
    [quantizeOn, quantizeGrid, tpq],
  );

  const computeEventFinalTick = useCallback(
    (tick0: number, deltaPx: number): number => {
      const deltaTicksRaw = Math.round(deltaPx / pxPerTick);
      if (quantizeOn && snapAbsoluteOn) {
        const snap = quantizeGridToTicks(quantizeGrid, tpq);
        return Math.max(0, Math.round((tick0 + deltaTicksRaw) / snap) * snap);
      }
      const deltaTicks = snapDelta(deltaTicksRaw);
      return Math.max(0, tick0 + deltaTicks);
    },
    [pxPerTick, quantizeOn, snapAbsoluteOn, quantizeGrid, tpq, snapDelta],
  );

  const computeGroupDelta = useCallback(
    (earliestTTicks: number, deltaPx: number): number => {
      const deltaTicksRaw = Math.round(deltaPx / pxPerTick);
      if (quantizeOn && snapAbsoluteOn) {
        const snap = quantizeGridToTicks(quantizeGrid, tpq);
        const earliestFinal = Math.max(
          0,
          Math.round((earliestTTicks + deltaTicksRaw) / snap) * snap,
        );
        return earliestFinal - earliestTTicks;
      }
      const snapped = snapDelta(deltaTicksRaw);
      return Math.max(snapped, -earliestTTicks);
    },
    [pxPerTick, quantizeOn, snapAbsoluteOn, quantizeGrid, tpq, snapDelta],
  );

  const releasePointer = useCallback((drag: DragState) => {
    if (drag.element.hasPointerCapture(drag.pointerId)) {
      drag.element.releasePointerCapture(drag.pointerId);
    }
  }, []);

  const fireEventClick = useCallback(
    (pitch: number, eventIdx: number) => {
      setDJEventSelection({ trackId: track.id, pitch, eventIdx });
      if (
        !djActionSelection ||
        djActionSelection.trackId !== track.id ||
        djActionSelection.pitch !== pitch
      ) {
        setDJActionSelection({ trackId: track.id, pitch });
      }
    },
    [djActionSelection, setDJActionSelection, setDJEventSelection, track.id],
  );

  const buildEventHandlers = useCallback(
    (eventIdx: number, pitch: number, tick0: number): PointerHandlers => ({
      onPointerDown: (e) => {
        e.stopPropagation();
        const element = e.currentTarget;
        element.setPointerCapture(e.pointerId);
        dragRef.current = {
          kind: 'event',
          pointerId: e.pointerId,
          element,
          px0: e.clientX,
          mode: 'pre-click',
          eventIdx,
          pitch,
          tick0,
        };
      },
      onPointerMove: (e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId || drag.kind !== 'event') return;
        const deltaPx = e.clientX - drag.px0;
        if (drag.mode === 'pre-click') {
          if (Math.abs(deltaPx) < DRAG_THRESHOLD_PX) return;
          drag.mode = 'dragging';
        }
        const finalTick = computeEventFinalTick(drag.tick0, deltaPx);
        setPreview({ kind: 'event', eventIdx: drag.eventIdx, tTicks: finalTick });
      },
      onPointerUp: (e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId || drag.kind !== 'event') return;
        if (drag.mode === 'pre-click') {
          fireEventClick(drag.pitch, drag.eventIdx);
        } else {
          const deltaPx = e.clientX - drag.px0;
          const finalTick = computeEventFinalTick(drag.tick0, deltaPx);
          setDJEventTTicks(track.id, drag.pitch, drag.eventIdx, finalTick);
        }
        releasePointer(drag);
        dragRef.current = null;
        setPreview(null);
      },
      onPointerCancel: (e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId || drag.kind !== 'event') return;
        releasePointer(drag);
        dragRef.current = null;
        setPreview(null);
      },
    }),
    [computeEventFinalTick, fireEventClick, releasePointer, setDJEventTTicks, track.id],
  );

  const buildCcGroupHandlers = useCallback(
    (group: CcMergedGroup): PointerHandlers => {
      const memberOriginalTicks = group.memberIndices.map(
        (idx) => track.events[idx]!.tTicks,
      );
      const earliestTTicks = memberOriginalTicks.reduce(
        (a, b) => Math.min(a, b),
        memberOriginalTicks[0]!,
      );
      return {
        onPointerDown: (e) => {
          e.stopPropagation();
          const element = e.currentTarget;
          element.setPointerCapture(e.pointerId);
          dragRef.current = {
            kind: 'cc-group',
            pointerId: e.pointerId,
            element,
            px0: e.clientX,
            mode: 'pre-click',
            pitch: group.pitch,
            representativeIdx: group.representativeIdx,
            memberIndices: group.memberIndices.slice(),
            memberOriginalTicks,
            earliestTTicks,
          };
        },
        onPointerMove: (e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId || drag.kind !== 'cc-group') return;
          const deltaPx = e.clientX - drag.px0;
          if (drag.mode === 'pre-click') {
            if (Math.abs(deltaPx) < DRAG_THRESHOLD_PX) return;
            drag.mode = 'dragging';
          }
          const groupDeltaTicks = computeGroupDelta(drag.earliestTTicks, deltaPx);
          setPreview({
            kind: 'cc-group',
            pitch: drag.pitch,
            memberIndices: new Set(drag.memberIndices),
            deltaTicks: groupDeltaTicks,
          });
        },
        onPointerUp: (e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId || drag.kind !== 'cc-group') return;
          if (drag.mode === 'pre-click') {
            fireEventClick(drag.pitch, drag.representativeIdx);
          } else {
            const deltaPx = e.clientX - drag.px0;
            const groupDeltaTicks = computeGroupDelta(drag.earliestTTicks, deltaPx);
            for (let m = 0; m < drag.memberIndices.length; m++) {
              const memberIdx = drag.memberIndices[m]!;
              const memberOriginal = drag.memberOriginalTicks[m]!;
              setDJEventTTicks(
                track.id,
                drag.pitch,
                memberIdx,
                Math.max(0, memberOriginal + groupDeltaTicks),
              );
            }
          }
          releasePointer(drag);
          dragRef.current = null;
          setPreview(null);
        },
        onPointerCancel: (e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId || drag.kind !== 'cc-group') return;
          releasePointer(drag);
          dragRef.current = null;
          setPreview(null);
        },
      };
    },
    [computeGroupDelta, fireEventClick, releasePointer, setDJEventTTicks, track.events, track.id],
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
  for (let tTicks = 0; tTicks <= layoutHorizonTicks; tTicks += tpq) {
    const beatIdx = tTicks / tpq;
    if (thin && beatIdx !== 0 && tTicks !== layoutHorizonTicks && beatIdx % 4 !== 0) {
      continue;
    }
    const major = beatIdx % 4 === 0;
    ticks.push(
      <div
        key={`tick-${tTicks}`}
        className={major ? 'mr-djtrack__tick mr-djtrack__tick--bar' : 'mr-djtrack__tick'}
        style={{ left: tTicks * pxPerTick }}
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
    const noteH = Math.max(5, rowHeight - 2);
    const color = devColor(action.device);
    const audible = isDJRowAudible(track, event.pitch, soloing);
    const rowCc = resolvedDjRowOutputCc(track.actionMap, track.outputMap, event.pitch);
    if (rowCc !== undefined) {
      const group = ccGroupByMemberIdx.get(originalIdx);
      if (!group || group.representativeIdx !== originalIdx) {
        continue;
      }
      const handlers = buildCcGroupHandlers(group);
      const groupSelected =
        djEventSelection !== null &&
        djEventSelection.trackId === track.id &&
        djEventSelection.pitch === group.pitch &&
        group.memberIndices.includes(djEventSelection.eventIdx);
      const previewDelta =
        preview && preview.kind === 'cc-group' && preview.pitch === group.pitch
          ? preview.deltaTicks
          : 0;
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
          handlers,
          rowCc,
          previewDelta,
        ),
      );
      continue;
    }
    const handlers = buildEventHandlers(originalIdx, event.pitch, event.tTicks);
    const selected =
      djEventSelection !== null &&
      djEventSelection.trackId === track.id &&
      djEventSelection.pitch === event.pitch &&
      djEventSelection.eventIdx === originalIdx;
    const mode = actionMode(action);
    const renderTick =
      preview && preview.kind === 'event' && preview.eventIdx === originalIdx
        ? preview.tTicks
        : event.tTicks;
    const left = renderTick * pxPerTick;
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
        sessionTicksToBeats(event.durTicks),
        event.vel,
        pxPerBeat,
        audible,
        selected,
        handlers,
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
      <div className="mr-playhead" style={{ left: playheadTicks * pxPerTick }} />
    </div>
  );
}

function collapseCcMessagesByPixelX(
  group: CcMergedGroup,
  track: DJActionTrack,
  pxPerBeat: number,
): { t: number; dur: number; vel: number }[] {
  const sorted = group.memberIndices
    .map((i) => ({ i, ev: track.events[i]! }))
    .sort((a, b) => a.ev.tTicks - b.ev.tTicks || a.i - b.i);
  const out: { t: number; dur: number; vel: number }[] = [];
  for (const { ev } of sorted) {
    const xPx = Math.round(sessionTicksToBeats(ev.tTicks) * pxPerBeat);
    const prev = out[out.length - 1];
    if (prev !== undefined && Math.round(prev.t * pxPerBeat) === xPx) {
      prev.vel = ev.vel;
      prev.dur = Math.max(prev.dur, sessionTicksToBeats(ev.durTicks));
    } else {
      out.push({
        t: sessionTicksToBeats(ev.tTicks),
        dur: sessionTicksToBeats(ev.durTicks),
        vel: ev.vel,
      });
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
  handlers: PointerHandlers,
  ccNum: number,
  previewDeltaTicks: number,
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
  const deltaBeats = previewDeltaTicks / DEFAULT_MIDI_TPQ;
  return (
    <div
      key={`cc${group.representativeIdx}`}
      className="mr-djtrack__cc"
      title={`${action.label} · ${action.short} · CC ${ccNum}`}
      data-audible={audibleAttr}
      data-selected={selectedAttr}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      style={{
        top,
        left: (group.t0 + deltaBeats) * pxPerBeat,
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
  handlers: PointerHandlers,
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
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
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
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
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
      const synth = synthesizePressure(
        { pitch, tTicks: 0, durTicks: beatsToSessionTicks(dur), vel },
        perPitchIndex,
      );
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
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
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
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
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
