/* Wheel + keyboard zoom for the timeline. Pure DOM glue around the helpers
   in `src/session/timelineZoom.ts`; no MIDI / no audio.

   The returned `zoomIn` / `zoomOut` / `fit` callbacks are stable across
   renders so they can be wired to Toolstrip buttons without re-binding. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';
import { useStage } from '../../hooks/useStage';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { KEYS_COLUMN_WIDTH, pxPerTickFromPxPerBeat } from '../piano-roll/PianoRoll';
import {
  KEYBOARD_ZOOM_STEP,
  WHEEL_ZOOM_FACTOR_PER_LINE,
  clampPxPerBeat,
  fitPxPerBeat,
  normalizeWheelDeltaToLines,
  zoomAroundAnchor,
} from '../../session/timelineZoom';

export interface TimelineZoomGesturesInput {
  timelineRef: RefObject<HTMLDivElement>;
  /** Live `layoutHorizonTicks` (used by fit-session). */
  layoutHorizonTicks: number;
  /** Live `playheadTicks` (used by keyboard `+`/`-` to compute anchor). */
  playheadTicks: number;
}

export interface TimelineZoomGesturesValue {
  /** Discrete zoom in, anchored on the playhead (or viewport center). */
  zoomIn: () => void;
  /** Discrete zoom out, anchored on the playhead (or viewport center). */
  zoomOut: () => void;
  /** Fit the session horizon to the viewport, reset scrollLeft to 0. */
  fit: () => void;
}

/* `wheel` events default to passive in modern browsers — we MUST attach via
   addEventListener with { passive: false } to call preventDefault. React's
   onWheel prop can't express that, so we use a manual effect. */
export function useTimelineZoomGestures(
  input: TimelineZoomGesturesInput,
): TimelineZoomGesturesValue {
  const stage = useStage();
  const { timelineRef, layoutHorizonTicks, playheadTicks } = input;

  /* Capture the latest state in refs so the wheel/keydown listeners — bound
     once for the lifetime of the timeline element — always read live values
     without churning event listeners on every render. */
  const stateRef = useRef({
    pxPerBeat: stage.pxPerBeat,
    layoutHorizonTicks,
    playheadTicks,
  });
  stateRef.current = {
    pxPerBeat: stage.pxPerBeat,
    layoutHorizonTicks,
    playheadTicks,
  };

  const setPxPerBeat = stage.setPxPerBeat;

  /* Apply a multiplicative zoom step, anchored at `anchorPx` in viewport
     coordinates (relative to the timeline element's left edge). React MUST
     commit the new inner-div width before we assign `scrollLeft`; otherwise
     the browser clamps `scrollLeft` against the OLD `scrollWidth` and the
     content visibly "blinks" leftward when zooming in. `flushSync` forces
     the commit synchronously inside the same wheel/keydown handler tick. */
  const applyZoom = useCallback(
    (factor: number, anchorPx: number) => {
      const el = timelineRef.current;
      if (!el) return;
      const prev = stateRef.current.pxPerBeat;
      const next = clampPxPerBeat(prev * factor);
      if (next === prev) return;
      const { nextScrollLeft } = zoomAroundAnchor(
        prev,
        next,
        anchorPx,
        el.scrollLeft,
        KEYS_COLUMN_WIDTH,
      );
      flushSync(() => {
        setPxPerBeat(next);
      });
      el.scrollLeft = nextScrollLeft;
    },
    [setPxPerBeat, timelineRef],
  );

  const computePlayheadAnchorPx = useCallback((): number => {
    const el = timelineRef.current;
    if (!el) return 0;
    const { pxPerBeat, playheadTicks: ticks } = stateRef.current;
    const pxPerTick = pxPerTickFromPxPerBeat(pxPerBeat);
    const playheadXInContent = KEYS_COLUMN_WIDTH + ticks * pxPerTick;
    const playheadX = playheadXInContent - el.scrollLeft;
    if (playheadX >= 0 && playheadX <= el.clientWidth) {
      return Math.max(playheadX, KEYS_COLUMN_WIDTH);
    }
    return Math.max(el.clientWidth / 2, KEYS_COLUMN_WIDTH);
  }, [timelineRef]);

  const zoomIn = useCallback(() => {
    applyZoom(KEYBOARD_ZOOM_STEP, computePlayheadAnchorPx());
  }, [applyZoom, computePlayheadAnchorPx]);

  const zoomOut = useCallback(() => {
    applyZoom(1 / KEYBOARD_ZOOM_STEP, computePlayheadAnchorPx());
  }, [applyZoom, computePlayheadAnchorPx]);

  const fit = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;
    const { layoutHorizonTicks: horizon } = stateRef.current;
    const next = fitPxPerBeat(horizon, el.clientWidth, KEYS_COLUMN_WIDTH, DEFAULT_MIDI_TPQ);
    flushSync(() => {
      setPxPerBeat(next);
    });
    el.scrollLeft = 0;
  }, [setPxPerBeat, timelineRef]);

  /* Wheel listener. Attached with { passive: false } so we can call
     preventDefault when the modifier is present. Non-modifier wheels fall
     through to native scroll without preventDefault. */
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchorPx = Math.max(event.clientX - rect.left, KEYS_COLUMN_WIDTH);
      const prev = stateRef.current.pxPerBeat;
      const lines = normalizeWheelDeltaToLines(event);
      const next = clampPxPerBeat(prev * Math.exp(-lines * WHEEL_ZOOM_FACTOR_PER_LINE));
      if (next === prev) return;
      const { nextScrollLeft } = zoomAroundAnchor(
        prev,
        next,
        anchorPx,
        el.scrollLeft,
        KEYS_COLUMN_WIDTH,
      );
      flushSync(() => {
        setPxPerBeat(next);
      });
      el.scrollLeft = nextScrollLeft;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPxPerBeat, timelineRef]);

  /* Keyboard listener. Bails inside editable elements and on modifier-laden
     combinations (Cmd+0 etc. belong to other shortcuts). */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((target as HTMLElement).isContentEditable) return;
        if (target.closest('[contenteditable="true"]')) return;
      }
      switch (event.key) {
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          fit();
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, fit]);

  return { zoomIn, zoomOut, fit };
}

/* Lets sibling chrome (Toolstrip buttons) call the same zoom handlers that
   AppShell wires to the wheel + keyboard listeners. AppShell wraps the
   timeline tree in <TimelineZoomGesturesContext.Provider value={...}>. */
export const TimelineZoomGesturesContext = createContext<TimelineZoomGesturesValue | null>(null);

export function useTimelineZoomGesturesContext(): TimelineZoomGesturesValue | null {
  return useContext(TimelineZoomGesturesContext);
}

