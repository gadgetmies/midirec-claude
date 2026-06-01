import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useStage } from '../../hooks/useStage';
import { useTransport } from '../../hooks/useTransport';
import {
  KEYS_COLUMN_WIDTH,
  pxPerTickFromPxPerBeat,
} from '../piano-roll/PianoRoll';
import { quantizeGridToTicks } from '../../midi/quantizeGrid';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { flattenPressure, rasterizePressure, smoothPressure, synthesizePressure } from '../../data/pressure';
import type { PressurePoint } from '../../data/dj';
import { devColor, pitchLabel } from '../../data/dj';
import { deriveEditorMode, editorTargetKey, type EditorMode } from './mode';
import {
  cellsBetween,
  clientXToTicks,
  clientYToVel,
  lerpVel,
  snapTickForWrite,
} from './gestures';
import { flattenRangeReplacements, smoothRangeReplacements } from './bulkOps';
import {
  computeATSweepDelete,
  computeATSweepPaint,
  computeCCSweep,
} from './dragSweep';
import './DJValueEditor.css';

export const DJ_VALUE_EDITOR_HEIGHT_KEY = 'mr.dj-value-editor.heightPx';
export const DJ_VALUE_EDITOR_HEIGHT_DEFAULT = 96;
export const DJ_VALUE_EDITOR_HEIGHT_MIN = 48;
export const DJ_VALUE_EDITOR_HEIGHT_MAX = 400;
const RESIZE_DEBOUNCE_MS = 200;

export function clampEditorHeight(n: number): number {
  return Math.max(DJ_VALUE_EDITOR_HEIGHT_MIN, Math.min(DJ_VALUE_EDITOR_HEIGHT_MAX, Math.round(n)));
}

export function readPersistedHeight(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DJ_VALUE_EDITOR_HEIGHT_KEY) : null;
    if (raw === null) return DJ_VALUE_EDITOR_HEIGHT_DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DJ_VALUE_EDITOR_HEIGHT_DEFAULT;
    return clampEditorHeight(n);
  } catch {
    return DJ_VALUE_EDITOR_HEIGHT_DEFAULT;
  }
}

function writePersistedHeight(h: number): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DJ_VALUE_EDITOR_HEIGHT_KEY, String(clampEditorHeight(h)));
  } catch {
    /* ignore quota / disabled storage */
  }
}

export interface DJValueEditorProps {
  /** Ref to the timeline scroll container (`.mr-timeline`). The editor reads
   *  `scrollLeft` from this element to mirror the timeline's horizontal scroll. */
  timelineRef: RefObject<HTMLDivElement | null>;
}

interface SelectedRowData {
  trackId: string;
  pitch: number;
  trackName: string;
  rowLabel: string;
  outputSpec: string;
  actionColor: string;
  /** All events on the selected row in tick order. */
  events: { tTicks: number; durTicks: number; vel: number; eventIdx: number }[];
  /** For AT mode only: the selected event's tick span and rasterised pressure. */
  atSpan?: { startTicks: number; endTicks: number; bins: number[] };
}

export function DJValueEditor({ timelineRef }: DJValueEditorProps) {
  const stage = useStage();
  const { quantizeOn, quantizeGrid, snapAbsoluteOn } = useTransport();

  const mode: EditorMode = useMemo(
    () =>
      deriveEditorMode({
        djActionTracks: stage.djActionTracks,
        djActionSelection: stage.djActionSelection,
        djEventSelection: stage.djEventSelection,
      }),
    [stage.djActionTracks, stage.djActionSelection, stage.djEventSelection],
  );

  const [canvasHeight, setCanvasHeight] = useState<number>(() => readPersistedHeight());
  const heightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (heightDebounceRef.current !== null) {
      clearTimeout(heightDebounceRef.current);
    }
    heightDebounceRef.current = setTimeout(() => {
      writePersistedHeight(canvasHeight);
    }, RESIZE_DEBOUNCE_MS);
    return () => {
      if (heightDebounceRef.current !== null) {
        clearTimeout(heightDebounceRef.current);
      }
    };
  }, [canvasHeight]);

  /* Header-strip resize: pointer-drag on the top edge of the header adjusts
     canvasHeight (clamped 48..400). We attach pointer listeners on the
     window once drag begins so motion outside the header still tracks. */
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('.mr-dj-value-editor__close')) return;
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      /* The top 6px of the header strip is the resize-grip hit-zone. */
      if (e.clientY > rect.top + 6) return;
      resizeStateRef.current = { startY: e.clientY, startHeight: canvasHeight };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [canvasHeight],
  );

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = resizeStateRef.current;
    if (!st) return;
    const dy = e.clientY - st.startY;
    /* Dragging UP (negative dy) grows the canvas; dragging DOWN shrinks it. */
    setCanvasHeight(clampEditorHeight(st.startHeight - dy));
  }, []);

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStateRef.current) return;
    resizeStateRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  /* Scroll mirror — read `.mr-timeline`'s scrollLeft on its scroll events,
     rAF-batch, and apply translateX to the canvas inner. We avoid setState
     on every scroll to keep paint cheap. */
  const innerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const scrollLeftRef = useRef(0);

  useLayoutEffect(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    const apply = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const offset = KEYS_COLUMN_WIDTH - scrollLeftRef.current;
      inner.style.transform = `translateX(${offset}px)`;
    };
    const schedule = () => {
      scrollLeftRef.current = tl.scrollLeft;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        apply();
      });
    };
    /* Initialize before first paint so the editor doesn't flash unaligned. */
    scrollLeftRef.current = tl.scrollLeft;
    apply();
    tl.addEventListener('scroll', schedule, { passive: true });
    return () => {
      tl.removeEventListener('scroll', schedule);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [timelineRef, mode.kind]);

  /* Selection-derived data the canvas needs to render: events on the
     selected row, the AT span + rasterised bins, and label strings. We
     compute this only when the mode is non-hidden — if hidden, the
     component returns null below before this work executes. */
  const rowData: SelectedRowData | null = useMemo(() => {
    if (mode.kind === 'hidden') return null;
    const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
    if (!track) return null;
    const action = track.actionMap[mode.pitch];
    if (!action) return null;
    const rowEvents = track.events
      .map((ev, idx) => ({ ev, idx }))
      .filter((x) => x.ev.pitch === mode.pitch)
      .map((x) => ({
        tTicks: x.ev.tTicks,
        durTicks: x.ev.durTicks,
        vel: x.ev.vel,
        eventIdx: x.idx,
      }))
      .sort((a, b) => a.tTicks - b.tTicks);

    const trackName = track.name;
    const rowLabel = action.label || pitchLabel(mode.pitch);
    const actionColor = devColor(action.device);

    if (mode.kind === 'cc') {
      const mapping = track.outputMap[mode.pitch];
      const cc = mapping?.cc;
      return {
        trackId: track.id,
        pitch: mode.pitch,
        trackName,
        rowLabel,
        outputSpec: cc !== undefined ? `CC #${cc}` : 'CC',
        actionColor,
        events: rowEvents,
      };
    }

    if (mode.kind === 'pb') {
      return {
        trackId: track.id,
        pitch: mode.pitch,
        trackName,
        rowLabel,
        outputSpec: 'PB',
        actionColor,
        events: rowEvents,
      };
    }

    /* AT */
    const ev = track.events[mode.eventIdx];
    if (!ev) return null;
    const sameRowEvents = track.events.filter((x) => x.pitch === mode.pitch);
    const atIndexAmongRow = sameRowEvents.indexOf(ev);
    const points =
      ev.pressure === undefined
        ? synthesizePressure(
            { pitch: ev.pitch, tTicks: ev.tTicks, durTicks: ev.durTicks, vel: ev.vel },
            atIndexAmongRow >= 0 ? atIndexAmongRow : 0,
          )
        : ev.pressure;
    const bins = rasterizePressure(points, 16);
    return {
      trackId: track.id,
      pitch: mode.pitch,
      trackName,
      rowLabel,
      outputSpec: `Pressure · event ${atIndexAmongRow + 1}/${sameRowEvents.length}`,
      actionColor,
      events: rowEvents,
      atSpan: { startTicks: ev.tTicks, endTicks: ev.tTicks + ev.durTicks, bins },
    };
  }, [mode, stage.djActionTracks]);

  const onClose = useCallback(() => {
    if (mode.kind === 'at') {
      stage.setDJEventSelection(null);
    } else if (mode.kind === 'cc' || mode.kind === 'pb') {
      stage.setDJActionSelection(null);
    }
  }, [mode.kind, stage]);

  /* Shift-anchor: the (t, v) of the last left-click. Used by shift+click
     interpolation. Clears whenever the editor target identity changes. */
  const shiftAnchorRef = useRef<{ t: number; v: number } | null>(null);
  const currentTargetKey = editorTargetKey(mode);
  const lastTargetKeyRef = useRef<string>(currentTargetKey);
  if (lastTargetKeyRef.current !== currentTargetKey) {
    shiftAnchorRef.current = null;
    lastTargetKeyRef.current = currentTargetKey;
  }

  /* Drag state — set in pointerdown, advanced in pointermove, cleared in
     pointerup. `prevTick` / `prevVel` are the previous frame's snapped sample,
     used by sweepWrite/sweepDelete to define the inclusive range swept this
     frame (see decision 5 in the change's design.md). */
  const dragStateRef = useRef<
    | {
        kind: 'paint' | 'delete';
        prevTick: number;
        prevVel: number;
      }
    | null
  >(null);

  /* AT-mode write: convert (snappedTick, vel) into a PressurePoint and write
     to event.pressure, replacing any existing point at (approximately) the
     same t. Materialises synthesizePressure on first edit when pressure is
     undefined so the user's first paint doesn't wipe the synthetic curve. */
  const writeATPoint = useCallback(
    (snappedTick: number, vel: number) => {
      if (mode.kind !== 'at') return;
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      if (!track) return;
      const ev = track.events[mode.eventIdx];
      if (!ev) return;
      const inSpan = snappedTick >= ev.tTicks && snappedTick <= ev.tTicks + ev.durTicks;
      if (!inSpan) return;
      const durTicks = Math.max(1, ev.durTicks);
      const tRel = Math.max(0, Math.min(1, (snappedTick - ev.tTicks) / durTicks));
      const sameRowEvents = track.events.filter((x) => x.pitch === mode.pitch);
      const atIndexAmongRow = Math.max(0, sameRowEvents.indexOf(ev));
      const basePoints: PressurePoint[] =
        ev.pressure === undefined
          ? synthesizePressure(
              { pitch: ev.pitch, tTicks: ev.tTicks, durTicks: ev.durTicks, vel: ev.vel },
              atIndexAmongRow,
            )
          : ev.pressure;
      const TOL = 0.001;
      const filtered = basePoints.filter((p) => Math.abs(p.t - tRel) > TOL);
      const nextPoints: PressurePoint[] = [...filtered, { t: tRel, v: vel }].sort(
        (a, b) => a.t - b.t,
      );
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, nextPoints);
    },
    [mode, stage],
  );

  const deleteATPoint = useCallback(
    (snappedTick: number) => {
      if (mode.kind !== 'at') return;
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      if (!track) return;
      const ev = track.events[mode.eventIdx];
      if (!ev) return;
      const inSpan = snappedTick >= ev.tTicks && snappedTick <= ev.tTicks + ev.durTicks;
      if (!inSpan) return;
      if (ev.pressure === undefined) return; // nothing to delete from synthetic curve
      const durTicks = Math.max(1, ev.durTicks);
      const tRel = Math.max(0, Math.min(1, (snappedTick - ev.tTicks) / durTicks));
      const TOL = 0.001;
      const filtered = ev.pressure.filter((p) => Math.abs(p.t - tRel) > TOL);
      if (filtered.length === ev.pressure.length) return;
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, filtered);
    },
    [mode, stage],
  );

  /* Returns the raw cursor tick + vel + canvasContent rectangle, given a
     pointer event over `.mr-dj-value-editor__canvas-clip`. */
  const canvasClipRef = useRef<HTMLDivElement>(null);
  const measureCursor = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): { rawTicks: number; vel: number } | null => {
      const clip = canvasClipRef.current;
      if (!clip) return null;
      const rect = clip.getBoundingClientRect();
      const pxPerTick = pxPerTickFromPxPerBeat(stage.pxPerBeat);
      const scrollLeft = timelineRef.current?.scrollLeft ?? 0;
      const rawTicks = clientXToTicks({
        clientX: e.clientX,
        canvasContentLeft: rect.left,
        scrollLeft,
        keysColumnWidth: KEYS_COLUMN_WIDTH,
        pxPerTick,
      });
      const vel = clientYToVel(e.clientY, rect.top, rect.height);
      return { rawTicks, vel };
    },
    [timelineRef, stage.pxPerBeat],
  );

  /* Common: turn raw ticks into the snapped write tick honoring transport
     state and (in AT mode) the event-span degraded-snap rule. */
  const snapForMode = useCallback(
    (rawTicks: number): number => {
      if (mode.kind === 'at') {
        const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
        const ev = track?.events[mode.eventIdx];
        if (ev) {
          const gridTicks = quantizeGridToTicks(quantizeGrid, DEFAULT_MIDI_TPQ);
          /* When the event is shorter than the active grid, snap would jump
             outside the span; degrade gracefully to the exact pointer tick. */
          if (quantizeOn && ev.durTicks < gridTicks) {
            return Math.max(ev.tTicks, Math.min(ev.tTicks + ev.durTicks, Math.round(rawTicks)));
          }
        }
      }
      const snapped = snapTickForWrite({
        rawTicks,
        quantizeOn,
        quantizeGrid,
        snapAbsoluteOn,
      });
      return Math.max(0, snapped);
    },
    [mode, stage.djActionTracks, quantizeOn, quantizeGrid, snapAbsoluteOn],
  );

  const writeAt = useCallback(
    (snappedTick: number, vel: number) => {
      if (mode.kind === 'cc' || mode.kind === 'pb') {
        stage.upsertDJEvent(mode.trackId, mode.pitch, snappedTick, vel);
      } else if (mode.kind === 'at') {
        writeATPoint(snappedTick, vel);
      }
    },
    [mode, stage, writeATPoint],
  );

  const deleteAt = useCallback(
    (snappedTick: number) => {
      if (mode.kind === 'cc' || mode.kind === 'pb') {
        stage.removeDJEventAtTick(mode.trackId, mode.pitch, snappedTick);
      } else if (mode.kind === 'at') {
        deleteATPoint(snappedTick);
      }
    },
    [mode, stage, deleteATPoint],
  );

  /* Range-sweep helpers used by drag (decision 5 in design.md): the swept
     range `[min(prev.t, cur.t), max(prev.t, cur.t)]` replaces every event in
     that interval. Paint re-inserts the two endpoint values; delete re-inserts
     nothing. Pure math lives in `./dragSweep`; these wrappers do the stage
     dispatch. Boolean return: true = advance the drag's previous-sample
     reference; false = no-op (e.g. AT out-of-span). */
  const sweepWriteAT = useCallback(
    (prev: { t: number; v: number }, cur: { t: number; v: number }): boolean => {
      if (mode.kind !== 'at') return false;
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      if (!track) return false;
      const ev = track.events[mode.eventIdx];
      if (!ev) return false;
      const sameRowEvents = track.events.filter((x) => x.pitch === mode.pitch);
      const atIndexAmongRow = Math.max(0, sameRowEvents.indexOf(ev));
      const basePoints: PressurePoint[] =
        ev.pressure === undefined
          ? synthesizePressure(
              { pitch: ev.pitch, tTicks: ev.tTicks, durTicks: ev.durTicks, vel: ev.vel },
              atIndexAmongRow,
            )
          : ev.pressure;
      const next = computeATSweepPaint({
        basePoints,
        evTTicks: ev.tTicks,
        evDurTicks: ev.durTicks,
        prev,
        cur,
      });
      if (next === null) return false;
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, next);
      return true;
    },
    [mode, stage],
  );

  const sweepDeleteAT = useCallback(
    (prev: { t: number }, cur: { t: number }): boolean => {
      if (mode.kind !== 'at') return false;
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      if (!track) return false;
      const ev = track.events[mode.eventIdx];
      if (!ev) return false;
      if (ev.pressure === undefined) return false; // nothing to delete from synthetic curve
      const next = computeATSweepDelete({
        basePoints: ev.pressure,
        evTTicks: ev.tTicks,
        evDurTicks: ev.durTicks,
        prev,
        cur,
      });
      if (next === null) return false;
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, next);
      return true;
    },
    [mode, stage],
  );

  const sweepWrite = useCallback(
    (prev: { t: number; v: number }, cur: { t: number; v: number }): boolean => {
      if (mode.kind === 'cc' || mode.kind === 'pb') {
        const { lo, hi, replacements } = computeCCSweep(prev, cur);
        stage.replaceDJEventsInRange(mode.trackId, mode.pitch, lo, hi, replacements);
        return true;
      }
      if (mode.kind === 'at') return sweepWriteAT(prev, cur);
      return false;
    },
    [mode, stage, sweepWriteAT],
  );

  const sweepDelete = useCallback(
    (prev: { t: number }, cur: { t: number }): boolean => {
      if (mode.kind === 'cc' || mode.kind === 'pb') {
        const lo = Math.min(prev.t, cur.t);
        const hi = Math.max(prev.t, cur.t);
        stage.replaceDJEventsInRange(mode.trackId, mode.pitch, lo, hi, []);
        return true;
      }
      if (mode.kind === 'at') return sweepDeleteAT(prev, cur);
      return false;
    },
    [mode, stage, sweepDeleteAT],
  );

  /* Shift+click interpolation: write interp cells across the grid in
     `[min(anchor, endpoint), max(anchor, endpoint)]`, then sweep any
     pre-existing events strictly inside that range that don't fall on a
     written cell. CC/PB only — AT mode falls back to a single-click write. */
  const performInterpolate = useCallback(
    (anchor: { t: number; v: number }, endpoint: { t: number; v: number }) => {
      if (mode.kind === 'at') {
        writeATPoint(endpoint.t, endpoint.v);
        return;
      }
      if (mode.kind !== 'cc' && mode.kind !== 'pb') return;
      const gridTicks = quantizeOn ? quantizeGridToTicks(quantizeGrid, DEFAULT_MIDI_TPQ) : 0;
      const cells = cellsBetween(anchor.t, endpoint.t, gridTicks);
      const lo = Math.min(anchor.t, endpoint.t);
      const hi = Math.max(anchor.t, endpoint.t);
      const replacements: { tTicks: number; vel: number }[] =
        cells.length === 0
          ? [
              { tTicks: anchor.t, vel: anchor.v },
              { tTicks: endpoint.t, vel: endpoint.v },
            ]
          : cells.map((t) => ({
              tTicks: t,
              vel: Math.max(0, Math.min(1, lerpVel(anchor.t, anchor.v, endpoint.t, endpoint.v, t))),
            }));
      stage.replaceDJEventsInRange(mode.trackId, mode.pitch, lo, hi, replacements);
    },
    [mode, stage, quantizeOn, quantizeGrid, writeATPoint],
  );

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const cur = measureCursor(e);
      if (!cur) return;
      const snapped = snapForMode(cur.rawTicks);

      if (e.button === 2) {
        e.preventDefault();
        deleteAt(snapped);
        dragStateRef.current = { kind: 'delete', prevTick: snapped, prevVel: cur.vel };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return;

      const anchor = shiftAnchorRef.current;
      if (e.shiftKey && anchor !== null) {
        performInterpolate(anchor, { t: snapped, v: cur.vel });
        shiftAnchorRef.current = { t: snapped, v: cur.vel };
        return;
      }

      writeAt(snapped, cur.vel);
      shiftAnchorRef.current = { t: snapped, v: cur.vel };
      dragStateRef.current = { kind: 'paint', prevTick: snapped, prevVel: cur.vel };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [measureCursor, snapForMode, deleteAt, writeAt, performInterpolate],
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = dragStateRef.current;
      if (!st) return;
      const cur = measureCursor(e);
      if (!cur) return;
      const snapped = snapForMode(cur.rawTicks);
      const prev = { t: st.prevTick, v: st.prevVel };
      const next = { t: snapped, v: cur.vel };
      if (st.kind === 'paint') {
        /* Sweep the range [min(prev.t, next.t), max(...)]: every event in the
           interval is wiped and the two endpoint values are re-inserted. When
           prev.t === next.t the range degenerates to a single-cell latest-wins
           rewrite. */
        const ok = sweepWrite(prev, next);
        if (ok) {
          if (mode.kind === 'cc' || mode.kind === 'pb') {
            shiftAnchorRef.current = next;
          }
          st.prevTick = next.t;
          st.prevVel = next.v;
        }
      } else if (st.kind === 'delete') {
        const ok = sweepDelete(prev, next);
        if (ok) {
          st.prevTick = next.t;
          st.prevVel = next.v;
        }
      }
    },
    [measureCursor, snapForMode, sweepWrite, sweepDelete, mode.kind],
  );

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStateRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  const onCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    /* Suppress the native context menu on the editor canvas; right-click is
     * used for delete. */
    e.preventDefault();
  }, []);

  /* Bulk-op range:
     - CC/PB: the timeline's currently-visible tick window
       [scrollLeftTick, scrollLeftTick + viewportTicks]
     - AT: the event's full span. */
  const computeBulkRange = useCallback((): { start: number; end: number } | null => {
    if (mode.kind === 'cc' || mode.kind === 'pb') {
      const tl = timelineRef.current;
      if (!tl) return null;
      const pxPerTick = pxPerTickFromPxPerBeat(stage.pxPerBeat);
      if (pxPerTick <= 0) return null;
      const scrollLeft = tl.scrollLeft;
      const clientWidth = tl.clientWidth;
      const visibleLeftPx = Math.max(0, scrollLeft - KEYS_COLUMN_WIDTH);
      const visibleRightPx = Math.max(visibleLeftPx, visibleLeftPx + clientWidth - KEYS_COLUMN_WIDTH);
      const start = Math.max(0, Math.floor(visibleLeftPx / pxPerTick));
      const end = Math.max(start, Math.ceil(visibleRightPx / pxPerTick));
      return { start, end };
    }
    if (mode.kind === 'at') {
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      const ev = track?.events[mode.eventIdx];
      if (!ev) return null;
      return { start: ev.tTicks, end: ev.tTicks + ev.durTicks };
    }
    return null;
  }, [mode, stage.djActionTracks, stage.pxPerBeat, timelineRef]);

  const performBulkSmooth = useCallback(() => {
    const range = computeBulkRange();
    if (!range) return;
    if (mode.kind === 'cc' || mode.kind === 'pb') {
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      if (!track) return;
      const replacements = smoothRangeReplacements(track.events, mode.pitch, range.start, range.end);
      stage.replaceDJEventsInRange(mode.trackId, mode.pitch, range.start, range.end, replacements);
    } else if (mode.kind === 'at') {
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      const ev = track?.events[mode.eventIdx];
      if (!track || !ev) return;
      const sameRowEvents = track.events.filter((x) => x.pitch === mode.pitch);
      const atIndexAmongRow = Math.max(0, sameRowEvents.indexOf(ev));
      const basePoints =
        ev.pressure === undefined
          ? synthesizePressure(
              { pitch: ev.pitch, tTicks: ev.tTicks, durTicks: ev.durTicks, vel: ev.vel },
              atIndexAmongRow,
            )
          : ev.pressure;
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, smoothPressure(basePoints));
    }
  }, [computeBulkRange, mode, stage]);

  const performBulkFlatten = useCallback(() => {
    const range = computeBulkRange();
    if (!range) return;
    if (mode.kind === 'cc' || mode.kind === 'pb') {
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      if (!track) return;
      const replacements = flattenRangeReplacements(track.events, mode.pitch, range.start, range.end);
      stage.replaceDJEventsInRange(mode.trackId, mode.pitch, range.start, range.end, replacements);
    } else if (mode.kind === 'at') {
      const track = stage.djActionTracks.find((t) => t.id === mode.trackId);
      const ev = track?.events[mode.eventIdx];
      if (!track || !ev) return;
      const sameRowEvents = track.events.filter((x) => x.pitch === mode.pitch);
      const atIndexAmongRow = Math.max(0, sameRowEvents.indexOf(ev));
      const basePoints =
        ev.pressure === undefined
          ? synthesizePressure(
              { pitch: ev.pitch, tTicks: ev.tTicks, durTicks: ev.durTicks, vel: ev.vel },
              atIndexAmongRow,
            )
          : ev.pressure;
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, flattenPressure(basePoints));
    }
  }, [computeBulkRange, mode, stage]);

  const performBulkClear = useCallback(() => {
    const range = computeBulkRange();
    if (!range) return;
    if (mode.kind === 'cc' || mode.kind === 'pb') {
      stage.replaceDJEventsInRange(mode.trackId, mode.pitch, range.start, range.end, []);
    } else if (mode.kind === 'at') {
      stage.setEventPressure(mode.trackId, mode.pitch, mode.eventIdx, []);
    }
  }, [computeBulkRange, mode, stage]);

  if (mode.kind === 'hidden' || !rowData) return null;

  const totalHeight = canvasHeight + 24;
  const rootStyle: CSSProperties = {
    height: totalHeight,
    ['--action-color' as string]: rowData.actionColor,
  };

  const pxPerTick = pxPerTickFromPxPerBeat(stage.pxPerBeat);
  const gridTicks = quantizeGridToTicks(quantizeGrid, DEFAULT_MIDI_TPQ);
  /* Render the full session strip; the clip + translate handles visibility. */
  const sessionTicks = Math.max(stage.sessionHorizonFloorTicks, 1);
  const contentWidthPx = sessionTicks * pxPerTick;

  return (
    <div className="mr-dj-value-editor" style={rootStyle} data-mode={mode.kind}>
      <div
        className="mr-dj-value-editor__hdr"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="mr-dj-value-editor__hdr-label">
          <span className="mr-dj-value-editor__swatch" aria-hidden="true" />
          <span>{rowData.trackName}</span>
          <span>·</span>
          <span>{rowData.rowLabel}</span>
          <span>·</span>
          <span className="mr-dj-value-editor__kind">{rowData.outputSpec}</span>
        </div>
        <button
          type="button"
          className="mr-dj-value-editor__close"
          aria-label="Close value editor"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ✕
        </button>
      </div>
      <div className="mr-dj-value-editor__body">
        <div className="mr-dj-value-editor__sidebar-spacer" aria-hidden="true" />
        <div
          ref={canvasClipRef}
          className="mr-dj-value-editor__canvas-clip"
          data-canvas-clip="true"
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onContextMenu={onCanvasContextMenu}
        >
          <div
            ref={innerRef}
            className="mr-dj-value-editor__canvas-content"
            style={{
              width: contentWidthPx,
              height: canvasHeight,
              position: 'absolute',
              left: 0,
              top: 0,
            }}
          >
            <svg
              width={contentWidthPx}
              height={canvasHeight}
              viewBox={`0 0 ${contentWidthPx} ${canvasHeight}`}
              preserveAspectRatio="none"
            >
              {/* Quantize grid lines */}
              {gridTicks > 0 &&
                renderGridLines(sessionTicks, gridTicks, pxPerTick, canvasHeight)}

              {/* PB center line */}
              {mode.kind === 'pb' && (
                <line
                  className="mr-dj-value-editor__center-line"
                  x1={0}
                  x2={contentWidthPx}
                  y1={canvasHeight / 2}
                  y2={canvasHeight / 2}
                />
              )}

              {/* CC / PB bars */}
              {(mode.kind === 'cc' || mode.kind === 'pb') &&
                rowData.events.map((ev) => {
                  const x = ev.tTicks * pxPerTick;
                  const barH = Math.max(0, Math.min(1, ev.vel)) * canvasHeight;
                  const y = canvasHeight - barH;
                  return (
                    <rect
                      key={`ev-${ev.eventIdx}`}
                      className="mr-dj-value-editor__bar"
                      x={x - 1}
                      width={2}
                      y={y}
                      height={barH}
                    />
                  );
                })}

              {/* AT rasterised bins */}
              {mode.kind === 'at' &&
                rowData.atSpan &&
                renderATBins(rowData.atSpan, pxPerTick, canvasHeight)}

              {/* AT window-mask overlay */}
              {mode.kind === 'at' && rowData.atSpan && (
                <>
                  {rowData.atSpan.startTicks > 0 && (
                    <rect
                      className="mr-dj-value-editor__window-mask"
                      x={0}
                      width={rowData.atSpan.startTicks * pxPerTick}
                      y={0}
                      height={canvasHeight}
                    />
                  )}
                  {rowData.atSpan.endTicks < sessionTicks && (
                    <rect
                      className="mr-dj-value-editor__window-mask"
                      x={rowData.atSpan.endTicks * pxPerTick}
                      width={Math.max(0, (sessionTicks - rowData.atSpan.endTicks) * pxPerTick)}
                      y={0}
                      height={canvasHeight}
                    />
                  )}
                </>
              )}
            </svg>
          </div>
        </div>
        <div className="mr-dj-value-editor__sidekick">
          <div
            className="mr-dj-value-editor__legend"
            title={mode.kind === 'pb' ? 'Pitch-bend offset from center (14-bit)' : 'Wire value (7-bit)'}
          >
            {mode.kind === 'pb' ? (
              <>
                <span>+8191</span>
                <span>0</span>
                <span>−8192</span>
              </>
            ) : (
              <>
                <span>127</span>
                <span>64</span>
                <span>0</span>
              </>
            )}
          </div>
          <div className="mr-dj-value-editor__bulk">
            <button type="button" data-op="smooth" onClick={performBulkSmooth}>Smooth</button>
            <button type="button" data-op="flatten" onClick={performBulkFlatten}>Flatten</button>
            <button type="button" data-op="clear" onClick={performBulkClear}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderGridLines(
  sessionTicks: number,
  gridTicks: number,
  pxPerTick: number,
  height: number,
) {
  const lines: JSX.Element[] = [];
  for (let t = gridTicks; t <= sessionTicks; t += gridTicks) {
    const x = t * pxPerTick;
    lines.push(
      <line
        key={`g-${t}`}
        className="mr-dj-value-editor__grid-line"
        x1={x}
        x2={x}
        y1={0}
        y2={height}
      />,
    );
  }
  return lines;
}

function renderATBins(
  atSpan: { startTicks: number; endTicks: number; bins: number[] },
  pxPerTick: number,
  height: number,
) {
  const spanTicks = Math.max(1, atSpan.endTicks - atSpan.startTicks);
  const binWidthTicks = spanTicks / atSpan.bins.length;
  return atSpan.bins.map((v, i) => {
    const x = (atSpan.startTicks + i * binWidthTicks) * pxPerTick;
    const w = Math.max(0.5, binWidthTicks * pxPerTick - 1);
    const barH = Math.max(0, Math.min(1, v)) * height;
    const y = height - barH;
    return (
      <rect
        key={`at-${i}`}
        className="mr-dj-value-editor__bar"
        x={x}
        width={w}
        y={y}
        height={barH}
      />
    );
  });
}
