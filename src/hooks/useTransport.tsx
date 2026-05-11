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

export type TransportMode = 'idle' | 'play' | 'record';

export type QuantizeGrid = '1/4' | '1/8' | '1/16' | '1/32';

export type ClockSource = 'internal' | 'external-clock' | 'external-mtc';

export interface TransportState {
  mode: TransportMode;
  playing: boolean;
  recording: boolean;
  looping: boolean;
  metronomeOn: boolean;
  quantizeOn: boolean;
  quantizeGrid: QuantizeGrid;
  timecodeMs: number;
  bar: string;
  bpm: number;
  sig: string;
  clockSource: ClockSource;
}

export interface TransportActions {
  play(): void;
  pause(): void;
  stop(): void;
  record(): void;
  toggleLoop(): void;
  toggleMetronome(): void;
  toggleQuantize(): void;
  seek(ms: number): void;
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
  | { type: 'seek'; ms: number }
  | { type: 'tick'; deltaMs: number };

interface InternalState {
  mode: TransportMode;
  looping: boolean;
  metronomeOn: boolean;
  quantizeOn: boolean;
  quantizeGrid: QuantizeGrid;
  timecodeMs: number;
  bpm: number;
  sig: string;
  clockSource: ClockSource;
}

const initialState: InternalState = {
  mode: 'idle',
  looping: false,
  metronomeOn: true,
  quantizeOn: true,
  quantizeGrid: '1/16',
  timecodeMs: 0,
  bpm: 124,
  sig: '4/4',
  clockSource: 'internal',
};

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'play':
      return { ...state, mode: 'play' };
    case 'pause':
      return { ...state, mode: 'idle' };
    case 'stop':
      return { ...state, mode: 'idle', timecodeMs: 0 };
    case 'record':
      return {
        ...state,
        mode: 'record',
        timecodeMs: state.mode === 'idle' ? 0 : state.timecodeMs,
      };
    case 'toggleLoop':
      return { ...state, looping: !state.looping };
    case 'toggleMetronome':
      return { ...state, metronomeOn: !state.metronomeOn };
    case 'toggleQuantize':
      return { ...state, quantizeOn: !state.quantizeOn };
    case 'seek':
      return { ...state, timecodeMs: Math.max(0, action.ms) };
    case 'tick':
      if (state.mode === 'idle') return state;
      return { ...state, timecodeMs: state.timecodeMs + action.deltaMs };
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
    if (state.mode === 'idle') {
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
  }, [state.mode]);

  const play = useCallback(() => dispatch({ type: 'play' }), []);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const record = useCallback(() => dispatch({ type: 'record' }), []);
  const toggleLoop = useCallback(() => dispatch({ type: 'toggleLoop' }), []);
  const toggleMetronome = useCallback(() => dispatch({ type: 'toggleMetronome' }), []);
  const toggleQuantize = useCallback(() => dispatch({ type: 'toggleQuantize' }), []);
  const seek = useCallback((ms: number) => dispatch({ type: 'seek', ms }), []);

  const value = useMemo<TransportValue>(
    () => ({
      mode: state.mode,
      playing: state.mode === 'play' || state.mode === 'record',
      recording: state.mode === 'record',
      looping: state.looping,
      metronomeOn: state.metronomeOn,
      quantizeOn: state.quantizeOn,
      quantizeGrid: state.quantizeGrid,
      timecodeMs: state.timecodeMs,
      bar: bbsFromMs(state.timecodeMs, state.bpm, state.sig),
      bpm: state.bpm,
      sig: state.sig,
      clockSource: state.clockSource,
      play,
      pause,
      stop,
      record,
      toggleLoop,
      toggleMetronome,
      toggleQuantize,
      seek,
    }),
    [state, play, pause, stop, record, toggleLoop, toggleMetronome, toggleQuantize, seek],
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
