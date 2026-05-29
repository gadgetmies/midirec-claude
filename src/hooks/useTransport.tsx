import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import type { QuantizeGrid } from '../midi/quantizeGrid';
import { DEFAULT_MIDI_TPQ } from '../midi/timelineTicks';

export type { QuantizeGrid };

const TICKS_PER_PULSE = DEFAULT_MIDI_TPQ / 24;

export type TransportMode = 'idle' | 'play' | 'record';

export type ClockSource = 'internal' | 'external-clock' | 'external-mtc';

export interface TransportState {
  mode: TransportMode;
  playing: boolean;
  recording: boolean;
  looping: boolean;
  metronomeOn: boolean;
  quantizeOn: boolean;
  quantizeGrid: QuantizeGrid;
  snapAbsoluteOn: boolean;
  timecodeMs: number;
  /** Playhead position in session ticks. In external-clock mode this advances
      by `TICKS_PER_PULSE` per incoming `applyExternalPulse` so it stays
      monotonic across smoother bpm jitter — the visible playhead must not
      regress when the rounded bpm dips between pulses. */
  playheadTicks: number;
  bar: string;
  bpm: number;
  sig: string;
  clockSource: ClockSource;
  recordingStartedAt: number | null;
}

export interface TransportActions {
  play(): void;
  pause(): void;
  stop(): void;
  record(): void;
  toggleLoop(): void;
  toggleMetronome(): void;
  toggleQuantize(): void;
  toggleSnapAbsolute(): void;
  setQuantizeGrid(grid: QuantizeGrid): void;
  seek(ms: number): void;
  /** Only `MidiClockProvider` may call this — see midi-clock spec. Flips
      `clockSource` to `'external-clock'`, mirrors the incoming BPM, and
      advances `timecodeMs` by `deltaMs` when `mode !== 'idle'`. */
  applyExternalPulse(deltaMs: number, bpm: number): void;
  /** Only `MidiClockProvider` may call this — see midi-clock spec. Flips
      `clockSource` back to `'internal'` and restores `bpm` to the user-set
      value (`userBpm`). */
  revertToInternalClock(): void;
}

export type TransportValue = TransportState & TransportActions;

type Action =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'record' }
  | { type: 'toggleLoop' }
  | { type: 'toggleMetronome' }
  | { type: 'toggleQuantize' }
  | { type: 'toggleSnapAbsolute' }
  | { type: 'setQuantizeGrid'; grid: QuantizeGrid }
  | { type: 'seek'; ms: number }
  | { type: 'tick'; deltaMs: number }
  // Only `MidiClockProvider` may dispatch these — see midi-clock spec.
  | { type: 'applyExternalPulse'; deltaMs: number; bpm: number }
  | { type: 'revertToInternalClock' };

interface InternalState {
  mode: TransportMode;
  looping: boolean;
  metronomeOn: boolean;
  quantizeOn: boolean;
  quantizeGrid: QuantizeGrid;
  snapAbsoluteOn: boolean;
  timecodeMs: number;
  playheadTicks: number;
  /** The current effective BPM (mirrors external master when slaved). */
  bpm: number;
  /** The user-set BPM, restored when reverting to internal clock. */
  userBpm: number;
  sig: string;
  clockSource: ClockSource;
  recordingStartedAt: number | null;
}

const initialState: InternalState = {
  mode: 'idle',
  looping: false,
  metronomeOn: true,
  quantizeOn: true,
  quantizeGrid: '1/16',
  snapAbsoluteOn: false,
  timecodeMs: 0,
  playheadTicks: 0,
  bpm: 124,
  userBpm: 124,
  sig: '4/4',
  clockSource: 'internal',
  recordingStartedAt: null,
};

function ticksFromMsAtBpm(ms: number, bpm: number): number {
  return (ms / 1000) * (bpm / 60) * DEFAULT_MIDI_TPQ;
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'play':
      return { ...state, mode: 'play', recordingStartedAt: null };
    case 'pause':
      return { ...state, mode: 'idle', recordingStartedAt: null };
    case 'stop':
      return { ...state, mode: 'idle', timecodeMs: 0, playheadTicks: 0, recordingStartedAt: null };
    case 'record':
      return {
        ...state,
        mode: 'record',
        timecodeMs: state.mode === 'idle' ? 0 : state.timecodeMs,
        playheadTicks: state.mode === 'idle' ? 0 : state.playheadTicks,
        recordingStartedAt: state.mode === 'record' ? state.recordingStartedAt : performance.now(),
      };
    case 'toggleLoop':
      return { ...state, looping: !state.looping };
    case 'toggleMetronome':
      return { ...state, metronomeOn: !state.metronomeOn };
    case 'toggleQuantize':
      return { ...state, quantizeOn: !state.quantizeOn };
    case 'toggleSnapAbsolute':
      return { ...state, snapAbsoluteOn: !state.snapAbsoluteOn };
    case 'setQuantizeGrid':
      return state.quantizeGrid === action.grid ? state : { ...state, quantizeGrid: action.grid };
    case 'seek': {
      const ms = Math.max(0, action.ms);
      return { ...state, timecodeMs: ms, playheadTicks: ticksFromMsAtBpm(ms, state.bpm) };
    }
    case 'tick':
      if (state.mode === 'idle') return state;
      // When slaved to external clock, the rAF tick is gated off — but if a
      // stray tick gets through (e.g., during a source-flip frame), no-op.
      if (state.clockSource === 'external-clock') return state;
      return {
        ...state,
        timecodeMs: state.timecodeMs + action.deltaMs,
        playheadTicks: state.playheadTicks + ticksFromMsAtBpm(action.deltaMs, state.bpm),
      };
    case 'applyExternalPulse': {
      // Source flips to external-clock atomically with the per-pulse advance —
      // combined action keeps the visible source / bpm / timecode commit in one frame.
      // `playheadTicks` advances by a constant `TICKS_PER_PULSE` independent of
      // the smoothed bpm reading so the visible playhead doesn't wobble when
      // the rounded bpm bounces between neighbouring integers.
      const advance = state.mode !== 'idle' ? Math.max(0, action.deltaMs) : 0;
      const tickAdvance = state.mode !== 'idle' ? TICKS_PER_PULSE : 0;
      return {
        ...state,
        clockSource: 'external-clock',
        bpm: action.bpm,
        timecodeMs: state.timecodeMs + advance,
        playheadTicks: state.playheadTicks + tickAdvance,
      };
    }
    case 'revertToInternalClock': {
      if (state.clockSource === 'internal') return state;
      return { ...state, clockSource: 'internal', bpm: state.userBpm };
    }
    default:
      return state;
  }
}

export function bbsFromMs(timecodeMs: number, bpm: number, sig: string): string {
  const [numStr, denStr] = sig.split('/');
  const beatsPerBar = Number.parseInt(numStr ?? '4', 10) || 4;
  const denominator = Number.parseInt(denStr ?? '4', 10) || 4;
  const beatMs = 60000 / bpm;
  const sixteenthsPerBeat = 16 / denominator;
  const totalBeats = timecodeMs / beatMs;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beatInBar = Math.floor(totalBeats % beatsPerBar) + 1;
  const sixteenthInBeat = Math.floor((totalBeats % 1) * sixteenthsPerBeat) + 1;
  return `${bar}.${beatInBar}.${sixteenthInBeat}`;
}

const TransportContext = createContext<TransportValue | null>(null);

export function TransportProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef(state.mode);

  modeRef.current = state.mode;

  useEffect(() => {
    // rAF only drives the playhead in internal-clock mode. When slaved to
    // external clock, the MidiClockProvider dispatches `applyExternalPulse`
    // on each incoming 0xF8 instead.
    if (state.mode === 'idle' || state.clockSource === 'external-clock') {
      lastFrameRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (now: number) => {
      const last = lastFrameRef.current;
      lastFrameRef.current = now;
      if (last != null) {
        const deltaMs = now - last;
        dispatch({ type: 'tick', deltaMs });
      }
      if (modeRef.current !== 'idle') {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameRef.current = null;
    };
  }, [state.mode, state.clockSource]);

  const play = useCallback(() => dispatch({ type: 'play' }), []);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const record = useCallback(() => dispatch({ type: 'record' }), []);
  const toggleLoop = useCallback(() => dispatch({ type: 'toggleLoop' }), []);
  const toggleMetronome = useCallback(() => dispatch({ type: 'toggleMetronome' }), []);
  const toggleQuantize = useCallback(() => dispatch({ type: 'toggleQuantize' }), []);
  const toggleSnapAbsolute = useCallback(() => dispatch({ type: 'toggleSnapAbsolute' }), []);
  const setQuantizeGrid = useCallback(
    (grid: QuantizeGrid) => dispatch({ type: 'setQuantizeGrid', grid }),
    [],
  );
  const seek = useCallback((ms: number) => dispatch({ type: 'seek', ms }), []);
  const applyExternalPulse = useCallback(
    (deltaMs: number, bpm: number) =>
      dispatch({ type: 'applyExternalPulse', deltaMs, bpm }),
    [],
  );
  const revertToInternalClock = useCallback(
    () => dispatch({ type: 'revertToInternalClock' }),
    [],
  );

  const value = useMemo<TransportValue>(
    () => ({
      mode: state.mode,
      playing: state.mode === 'play' || state.mode === 'record',
      recording: state.mode === 'record',
      looping: state.looping,
      metronomeOn: state.metronomeOn,
      quantizeOn: state.quantizeOn,
      quantizeGrid: state.quantizeGrid,
      snapAbsoluteOn: state.snapAbsoluteOn,
      timecodeMs: state.timecodeMs,
      playheadTicks: state.playheadTicks,
      bar: bbsFromMs(state.timecodeMs, state.bpm, state.sig),
      bpm: state.bpm,
      sig: state.sig,
      clockSource: state.clockSource,
      recordingStartedAt: state.recordingStartedAt,
      play,
      pause,
      stop,
      record,
      toggleLoop,
      toggleMetronome,
      toggleQuantize,
      toggleSnapAbsolute,
      setQuantizeGrid,
      seek,
      applyExternalPulse,
      revertToInternalClock,
    }),
    [
      state,
      play,
      pause,
      stop,
      record,
      toggleLoop,
      toggleMetronome,
      toggleQuantize,
      toggleSnapAbsolute,
      setQuantizeGrid,
      seek,
      applyExternalPulse,
      revertToInternalClock,
    ],
  );

  return <TransportContext.Provider value={value}>{children}</TransportContext.Provider>;
}

export function useTransport(): TransportValue {
  const ctx = useContext(TransportContext);
  if (!ctx) {
    throw new Error('useTransport must be used inside <TransportProvider>');
  }
  return ctx;
}
