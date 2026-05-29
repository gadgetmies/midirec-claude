import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTransport } from '../hooks/useTransport';
import { useMidiInputs, useMidiRuntime } from './MidiRuntimeProvider';
import { attachClockReceiver, BpmSmoother } from './clockReceiver';

/** 'auto' = first-wins; 'internal' = ignore all clock; otherwise the MIDIInput id to lock to. */
export type ClockSourceSelection = 'auto' | 'internal' | string;

export interface MidiClockState {
  present: boolean;
  bpm: number | null;
  pulse: number;
  beat: number;
  running: boolean;
  selection: ClockSourceSelection;
}

export interface MidiClockValue extends MidiClockState {
  setSelection: (sel: ClockSourceSelection) => void;
}

const DEFAULT_STATE: MidiClockState = {
  present: false,
  bpm: null,
  pulse: 0,
  beat: 0,
  running: false,
  selection: 'auto',
};

const PRESENT_TIMEOUT_MS = 500;
const ACTIVE_MASTER_TIMEOUT_MS = 2000;

const MidiClockContext = createContext<MidiClockValue | null>(null);

interface MidiClockProviderProps {
  children: ReactNode;
}

export function MidiClockProvider({ children }: MidiClockProviderProps) {
  const { status } = useMidiInputs();
  const { state: runtimeState } = useMidiRuntime();
  const transport = useTransport();
  const [state, setState] = useState<MidiClockState>(DEFAULT_STATE);

  const activeMasterIdRef = useRef<string | null>(null);
  const lastPulseAtByIdRef = useRef<Map<string, number>>(new Map());
  const smootherRef = useRef(new BpmSmoother());
  const presentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const selectionRef = useRef(state.selection);
  selectionRef.current = state.selection;

  const inputsKey = useMemo(() => {
    if (runtimeState.status !== 'granted') return '';
    return runtimeState.inputs.map((d) => d.id).sort().join('|');
  }, [runtimeState]);

  useEffect(() => {
    if (status !== 'granted' || runtimeState.status !== 'granted') return;
    const access = runtimeState.access;
    const detachers: Array<() => void> = [];

    const armPresentTimer = () => {
      if (presentTimerRef.current != null) clearTimeout(presentTimerRef.current);
      presentTimerRef.current = setTimeout(() => {
        setState((prev) => (prev.present ? { ...prev, present: false } : prev));
        // Only auto-revert in auto mode. Device-locked selections stay
        // external-clock with bpm frozen until the user picks Internal.
        if (selectionRef.current === 'auto') {
          transportRef.current.revertToInternalClock();
        }
        presentTimerRef.current = null;
      }, PRESENT_TIMEOUT_MS);
    };

    for (const device of runtimeState.inputs) {
      const port = access.inputs.get(device.id);
      if (!port) continue;

      const detach = attachClockReceiver(port, {
        onPulse: (input) => {
          const selection = selectionRef.current;
          if (selection === 'internal') return;
          if (selection !== 'auto' && selection !== input.id) return;
          const inputId = input.id;
          const now = performance.now();
          const prevActive = activeMasterIdRef.current;
          const prevPulseAt = lastPulseAtByIdRef.current.get(inputId);

          let masterChanged = false;
          if (prevActive === null) {
            activeMasterIdRef.current = inputId;
            smootherRef.current.reset();
          } else if (prevActive !== inputId) {
            const prevActivePulseAt = lastPulseAtByIdRef.current.get(prevActive) ?? 0;
            if (now - prevActivePulseAt < ACTIVE_MASTER_TIMEOUT_MS) {
              // Active master still healthy — ignore other inputs entirely.
              return;
            }
            activeMasterIdRef.current = inputId;
            smootherRef.current.reset();
            masterChanged = true;
          }

          lastPulseAtByIdRef.current.set(inputId, now);
          smootherRef.current.pulse(now);
          const bpm = smootherRef.current.bpm();

          setState((prev) => {
            const basePulse = masterChanged ? 0 : prev.pulse;
            const baseBpm = masterChanged ? null : prev.bpm;
            const nextPulse = basePulse + 1;
            return {
              ...prev,
              present: true,
              pulse: nextPulse,
              beat: Math.floor(nextPulse / 24),
              bpm: bpm ?? baseBpm,
              running: masterChanged ? false : prev.running,
            };
          });

          // Dispatch into transport: flip source to external-clock, mirror bpm,
          // and advance the playhead by the raw inter-pulse interval (immediate,
          // no smoother delay). The reducer guards mode === 'idle' itself.
          const sameMasterPrevPulseAt = masterChanged ? undefined : prevPulseAt;
          const deltaMs = sameMasterPrevPulseAt != null ? Math.max(0, now - sameMasterPrevPulseAt) : 0;
          const effectiveBpm = bpm ?? transportRef.current.bpm;
          transportRef.current.applyExternalPulse(deltaMs, effectiveBpm);

          armPresentTimer();
        },
        onStart: (input) => {
          if (selectionRef.current === 'internal') return;
          if (activeMasterIdRef.current !== input.id) return;
          setState((prev) => (prev.running ? prev : { ...prev, running: true }));
          const t = transportRef.current;
          // Recording is driven by the user's record button, not the master.
          if (t.mode === 'idle') t.play();
        },
        onContinue: (input) => {
          if (selectionRef.current === 'internal') return;
          if (activeMasterIdRef.current !== input.id) return;
          setState((prev) => (prev.running ? prev : { ...prev, running: true }));
          const t = transportRef.current;
          if (t.mode === 'idle') t.play();
        },
        onStop: (input) => {
          if (selectionRef.current === 'internal') return;
          if (activeMasterIdRef.current !== input.id) return;
          setState((prev) => (prev.running ? { ...prev, running: false } : prev));
          const t = transportRef.current;
          if (t.mode === 'play') t.pause();
        },
      });
      detachers.push(detach);
    }

    return () => {
      for (const d of detachers) d();
      if (presentTimerRef.current != null) {
        clearTimeout(presentTimerRef.current);
        presentTimerRef.current = null;
      }
    };
  }, [status, runtimeState, inputsKey]);

  const setSelection = useCallback((newSel: ClockSourceSelection) => {
    if (selectionRef.current === newSel) return;
    // Reset all receiver state for a fresh window.
    smootherRef.current.reset();
    activeMasterIdRef.current = null;
    lastPulseAtByIdRef.current.clear();
    if (presentTimerRef.current != null) {
      clearTimeout(presentTimerRef.current);
      presentTimerRef.current = null;
    }
    if (newSel === 'internal') {
      transportRef.current.revertToInternalClock();
    }
    setState({ ...DEFAULT_STATE, selection: newSel });
  }, []);

  const value = useMemo<MidiClockValue>(
    () => ({ ...state, setSelection }),
    [state, setSelection],
  );

  return <MidiClockContext.Provider value={value}>{children}</MidiClockContext.Provider>;
}

export function useMidiClock(): MidiClockValue {
  const ctx = useContext(MidiClockContext);
  if (!ctx) {
    throw new Error('useMidiClock must be used inside <MidiClockProvider>');
  }
  return ctx;
}
