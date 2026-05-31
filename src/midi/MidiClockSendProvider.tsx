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
import { useTransport } from '../hooks/useTransport';
import { useMidiClock } from './MidiClockProvider';
import { useMidiOutputs, useMidiRuntime } from './MidiRuntimeProvider';
import { DEFAULT_MIDI_TPQ } from './timelineTicks';
import {
  createInternalScheduler,
  emitCC,
  emitClock,
  emitContinue,
  emitNoteOff,
  emitNoteOn,
  emitStart,
  emitStop,
  emitSyncBundle,
  ticksToSppBeats,
  type ClockOutput,
  type InternalScheduler,
} from './clockSender';

export type GridAlignmentMessage =
  | { kind: 'note'; channel: number; note: number; velocity: number }
  | { kind: 'cc'; channel: number; cc: number; value: number };

export type GridAlignmentBoundary = 'bar' | 'phrase' | 'manual';

export interface GridAlignmentConfig {
  enabled: boolean;
  outputId: string | null;
  message: GridAlignmentMessage;
  boundary: GridAlignmentBoundary;
  phraseBars: number;
}

export interface MidiClockSendState {
  enabled: boolean;
  selectedOutputIds: ReadonlySet<string>;
  txPulse: number;
  txPulseByOutputId: ReadonlyMap<string, number>;
  gridAlignment: GridAlignmentConfig;
}

export interface MidiClockSendValue extends MidiClockSendState {
  setEnabled(enabled: boolean): void;
  toggleOutput(id: string): void;
  setSelectedOutputs(ids: string[]): void;
  sync(): void;
  setGridAlignment(patch: Partial<GridAlignmentConfig>): void;
  fireGridAlignment(): void;
}

const DEFAULT_GRID_ALIGNMENT: GridAlignmentConfig = {
  enabled: false,
  outputId: null,
  message: { kind: 'note', channel: 1, note: 60, velocity: 127 },
  boundary: 'bar',
  phraseBars: 8,
};

const DEFAULT_STATE: MidiClockSendState = {
  enabled: false,
  selectedOutputIds: new Set<string>(),
  txPulse: 0,
  txPulseByOutputId: new Map<string, number>(),
  gridAlignment: DEFAULT_GRID_ALIGNMENT,
};

type Action =
  | { type: 'setEnabled'; enabled: boolean }
  | { type: 'toggleOutput'; id: string }
  | { type: 'setSelectedOutputs'; ids: string[] }
  | { type: 'TX_PULSE'; outputIds: string[] }
  | { type: 'setGridAlignment'; patch: Partial<GridAlignmentConfig> };

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function clampMessage(m: GridAlignmentMessage): GridAlignmentMessage {
  if (m.kind === 'note') {
    return {
      kind: 'note',
      channel: clampInt(m.channel, 1, 16),
      note: clampInt(m.note, 0, 127),
      velocity: clampInt(m.velocity, 0, 127),
    };
  }
  return {
    kind: 'cc',
    channel: clampInt(m.channel, 1, 16),
    cc: clampInt(m.cc, 0, 127),
    value: clampInt(m.value, 0, 127),
  };
}

function reducer(state: MidiClockSendState, action: Action): MidiClockSendState {
  switch (action.type) {
    case 'setEnabled':
      return state.enabled === action.enabled ? state : { ...state, enabled: action.enabled };
    case 'toggleOutput': {
      const next = new Set(state.selectedOutputIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedOutputIds: next };
    }
    case 'setSelectedOutputs':
      return { ...state, selectedOutputIds: new Set(action.ids) };
    case 'TX_PULSE': {
      const nextMap = new Map(state.txPulseByOutputId);
      for (const id of action.outputIds) {
        nextMap.set(id, (nextMap.get(id) ?? 0) + 1);
      }
      return { ...state, txPulse: state.txPulse + 1, txPulseByOutputId: nextMap };
    }
    case 'setGridAlignment': {
      const patch = action.patch;
      const merged: GridAlignmentConfig = { ...state.gridAlignment };
      if (typeof patch.enabled === 'boolean') merged.enabled = patch.enabled;
      if (patch.outputId !== undefined) merged.outputId = patch.outputId;
      if (patch.message !== undefined) merged.message = clampMessage(patch.message);
      if (patch.boundary !== undefined) merged.boundary = patch.boundary;
      if (patch.phraseBars !== undefined) merged.phraseBars = clampInt(patch.phraseBars, 1, 32);
      return { ...state, gridAlignment: merged };
    }
    default:
      return state;
  }
}

function beatsPerBarFromSig(sig: string): number {
  const num = Number.parseInt(sig.split('/')[0] ?? '4', 10);
  return Number.isFinite(num) && num > 0 ? num : 4;
}

const MidiClockSendContext = createContext<MidiClockSendValue | null>(null);

interface MidiClockSendProviderProps {
  children: ReactNode;
}

export function MidiClockSendProvider({ children }: MidiClockSendProviderProps) {
  const { state: runtimeState } = useMidiRuntime();
  const { outputs, status: outputsStatus } = useMidiOutputs();
  const transport = useTransport();
  const midiClock = useMidiClock();

  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  /* Refs to read latest values from inside scheduler/subscriber callbacks
     without re-creating those callbacks on every render. */
  const stateRef = useRef(state);
  stateRef.current = state;
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const accessRef = useRef<MIDIAccess | null>(
    runtimeState.status === 'granted' ? runtimeState.access : null,
  );
  accessRef.current = runtimeState.status === 'granted' ? runtimeState.access : null;
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;

  /* Resolve current selected+connected outputs as ClockOutputs (raw send()
     callable). MIDIOutput already satisfies ClockOutput. */
  const resolveActiveOutputs = useCallback((): ClockOutput[] => {
    const access = accessRef.current;
    if (!access) return [];
    const ids = stateRef.current.selectedOutputIds;
    const result: ClockOutput[] = [];
    for (const id of ids) {
      const port = access.outputs.get(id);
      if (port) result.push(port as unknown as ClockOutput);
    }
    return result;
  }, []);

  /* Resolve a single output by id (used by Grid Alignment). */
  const resolveOutputById = useCallback((id: string | null): ClockOutput | null => {
    if (!id) return null;
    const access = accessRef.current;
    if (!access) return null;
    const port = access.outputs.get(id);
    return port ? (port as unknown as ClockOutput) : null;
  }, []);

  /* rAF-coalesced TX pulse bump. Multiple bumps within one frame collapse
     into a single dispatch — keeps React re-renders ≤ 60 Hz even at 49.6
     pulses/sec/output. */
  const pendingBumpRef = useRef(false);
  const pendingPerOutRef = useRef<Set<string>>(new Set());
  const bumpTxPulse = useCallback(() => {
    /* Snapshot the active outputs now so per-port counters bump only on
       outputs that actually received a byte this batch. */
    const outs = resolveActiveOutputs();
    for (const o of outs) pendingPerOutRef.current.add(o.id);
    if (pendingBumpRef.current) return;
    pendingBumpRef.current = true;
    const fn =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);
    fn(() => {
      const ids = Array.from(pendingPerOutRef.current);
      pendingPerOutRef.current.clear();
      pendingBumpRef.current = false;
      dispatch({ type: 'TX_PULSE', outputIds: ids });
    });
  }, [resolveActiveOutputs]);

  /* ──────────────────────────────────────────────────────────────────────
     Internal scheduler effect: 24-PPQ emission driven by transport.bpm.
     Active only when enabled, clockSource === 'internal', and runtime granted.
     ────────────────────────────────────────────────────────────────────── */
  const schedulerRef = useRef<InternalScheduler | null>(null);
  useEffect(() => {
    const active =
      state.enabled &&
      transport.clockSource === 'internal' &&
      runtimeState.status === 'granted';
    if (!active) {
      if (schedulerRef.current) {
        schedulerRef.current.stop();
        schedulerRef.current = null;
      }
      return;
    }
    const sched = createInternalScheduler({
      getBpm: () => transportRef.current.bpm,
      getOutputs: () => resolveActiveOutputs(),
      onPulse: () => bumpTxPulse(),
    });
    schedulerRef.current = sched;
    sched.start();
    return () => {
      sched.stop();
      if (schedulerRef.current === sched) schedulerRef.current = null;
    };
  }, [state.enabled, transport.clockSource, runtimeState.status, resolveActiveOutputs, bumpTxPulse]);

  /* ──────────────────────────────────────────────────────────────────────
     External-relay effect: subscribe to MidiClockProvider's onPulse and
     forward each accepted incoming 0xF8 to every selected output 1:1.
     Active only when enabled and clockSource === 'external-clock'.
     ────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const active = state.enabled && transport.clockSource === 'external-clock';
    if (!active) return;
    const unsub = midiClock.onPulse(() => {
      const outs = resolveActiveOutputs();
      if (outs.length === 0) return;
      emitClock(outs, 0);
      bumpTxPulse();
    });
    return unsub;
  }, [state.enabled, transport.clockSource, midiClock, resolveActiveOutputs, bumpTxPulse]);

  /* ──────────────────────────────────────────────────────────────────────
     Transport-message effect: on mode transitions, emit Start/Continue/Stop.
     Skips record-mode transitions per spec.
     ────────────────────────────────────────────────────────────────────── */
  const prevModeRef = useRef(transport.mode);
  useEffect(() => {
    const prev = prevModeRef.current;
    const curr = transport.mode;
    prevModeRef.current = curr;
    if (!state.enabled) return;
    const outs = resolveActiveOutputs();
    if (outs.length === 0) return;
    if (prev === 'idle' && curr === 'play') {
      if (transportRef.current.timecodeMs === 0) emitStart(outs);
      else emitContinue(outs);
    } else if (prev === 'play' && curr === 'idle') {
      emitStop(outs);
    }
    /* record↔any transitions: no transport message per spec. */
  }, [transport.mode, state.enabled, resolveActiveOutputs]);

  /* ──────────────────────────────────────────────────────────────────────
     Grid Alignment — automatic firing.
     Internal mode: watch transport.playheadTicks; fire when crossing boundary.
     External mode: subscribe to onPulse; count pulses; fire on divisor; reset
     on incoming Start.
     ────────────────────────────────────────────────────────────────────── */
  const prevTicksRef = useRef(transport.playheadTicks);
  const pulseCounterRef = useRef(0);

  /* Reset pulse counter on incoming 0xFA Start. */
  useEffect(() => {
    const unsub = midiClock.onStart(() => {
      pulseCounterRef.current = 0;
    });
    return unsub;
  }, [midiClock]);

  /* Internal-mode boundary detection via playheadTicks watcher. */
  useEffect(() => {
    const prev = prevTicksRef.current;
    const curr = transport.playheadTicks;
    prevTicksRef.current = curr;
    const grid = state.gridAlignment;
    if (!grid.enabled || grid.boundary === 'manual') return;
    if (transport.mode !== 'play') return;
    if (transport.clockSource !== 'internal') return;
    const beatsPerBar = beatsPerBarFromSig(transport.sig);
    const barTicks = DEFAULT_MIDI_TPQ * beatsPerBar;
    const boundaryTicks =
      grid.boundary === 'bar' ? barTicks : barTicks * grid.phraseBars;
    if (boundaryTicks <= 0) return;
    /* Find the smallest boundary > prev; fire if curr crossed it. */
    const nextBoundary = (Math.floor(prev / boundaryTicks) + 1) * boundaryTicks;
    if (curr >= nextBoundary && prev < nextBoundary) {
      fireGridAlignmentInternal();
    }
    /* fireGridAlignmentInternal is defined below; the closure binding is
       resolved at call time (no ESLint warning for this file). */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transport.playheadTicks,
    transport.mode,
    transport.sig,
    transport.clockSource,
    state.gridAlignment,
  ]);

  /* External-mode pulse-count boundary detection. */
  useEffect(() => {
    const grid = state.gridAlignment;
    if (!grid.enabled || grid.boundary === 'manual') return;
    if (transport.clockSource !== 'external-clock') return;
    const beatsPerBar = beatsPerBarFromSig(transport.sig);
    const divisor =
      grid.boundary === 'bar'
        ? 24 * beatsPerBar
        : 24 * beatsPerBar * grid.phraseBars;
    if (divisor <= 0) return;
    const unsub = midiClock.onPulse(() => {
      pulseCounterRef.current += 1;
      if (transportRef.current.mode !== 'play') return;
      if (pulseCounterRef.current % divisor === 0) {
        fireGridAlignmentInternal();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.gridAlignment,
    transport.clockSource,
    transport.sig,
    midiClock,
  ]);

  /* Internal helper for both auto and manual fire. Reads current state /
     access from refs so it doesn't churn callbacks. */
  function fireGridAlignmentInternal(): void {
    const grid = stateRef.current.gridAlignment;
    const out = resolveOutputById(grid.outputId);
    if (!out) return;
    const m = grid.message;
    if (m.kind === 'note') {
      emitNoteOn([out], m.channel, m.note, m.velocity, 0);
      setTimeout(() => {
        const stillThere = resolveOutputById(grid.outputId);
        if (stillThere) emitNoteOff([stillThere], m.channel, m.note, 0);
      }, 50);
    } else {
      emitCC([out], m.channel, m.cc, m.value, 0);
    }
  }

  /* ──────────────────────────────────────────────────────────────────────
     Public actions
     ────────────────────────────────────────────────────────────────────── */

  const setEnabled = useCallback(
    (enabled: boolean) => {
      /* Clamp: when MIDI access not granted, ignore enable requests. */
      if (enabled && outputsStatus !== 'granted') return;
      const wasEnabled = stateRef.current.enabled;
      /* Per spec: when setEnabled(true) is called mid-play, emit one
         Start (timecode 0) or Continue (timecode>0) before resuming clock. */
      if (enabled && !wasEnabled && transportRef.current.mode === 'play') {
        const outs = resolveActiveOutputs();
        if (outs.length > 0) {
          if (transportRef.current.timecodeMs === 0) emitStart(outs);
          else emitContinue(outs);
        }
      }
      dispatch({ type: 'setEnabled', enabled });
    },
    [outputsStatus, resolveActiveOutputs],
  );

  const toggleOutput = useCallback((id: string) => {
    dispatch({ type: 'toggleOutput', id });
  }, []);

  const setSelectedOutputs = useCallback((ids: string[]) => {
    dispatch({ type: 'setSelectedOutputs', ids });
  }, []);

  const sync = useCallback(() => {
    if (!stateRef.current.enabled) return;
    const outs = resolveActiveOutputs();
    if (outs.length === 0) return;
    const t = transportRef.current;
    emitSyncBundle(outs, t.playheadTicks, DEFAULT_MIDI_TPQ, 0);
    /* Per spec: txPulse SHALL NOT advance from sync(). The internal
       scheduler SHALL NOT pause — we don't touch it. */
  }, [resolveActiveOutputs]);

  const setGridAlignment = useCallback((patch: Partial<GridAlignmentConfig>) => {
    dispatch({ type: 'setGridAlignment', patch });
  }, []);

  const fireGridAlignment = useCallback(() => {
    fireGridAlignmentInternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reference for SPP-test sanity / dev — silence unused. */
  void ticksToSppBeats;

  const value = useMemo<MidiClockSendValue>(
    () => ({
      enabled: state.enabled,
      selectedOutputIds: state.selectedOutputIds,
      txPulse: state.txPulse,
      txPulseByOutputId: state.txPulseByOutputId,
      gridAlignment: state.gridAlignment,
      setEnabled,
      toggleOutput,
      setSelectedOutputs,
      sync,
      setGridAlignment,
      fireGridAlignment,
    }),
    [state, setEnabled, toggleOutput, setSelectedOutputs, sync, setGridAlignment, fireGridAlignment],
  );

  return (
    <MidiClockSendContext.Provider value={value}>{children}</MidiClockSendContext.Provider>
  );
}

export function useMidiClockSend(): MidiClockSendValue {
  const ctx = useContext(MidiClockSendContext);
  if (!ctx) {
    throw new Error('useMidiClockSend must be used inside <MidiClockSendProvider>');
  }
  return ctx;
}
