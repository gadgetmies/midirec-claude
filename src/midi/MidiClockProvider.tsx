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
  strictStart: boolean;
}

export type PulseSubscriber = (timestampMs: number) => void;

export interface MidiClockValue extends MidiClockState {
  setSelection: (sel: ClockSourceSelection) => void;
  setStrictStart: (b: boolean) => void;
  onPulse: (callback: PulseSubscriber) => () => void;
}

const DEFAULT_STATE: MidiClockState = {
  present: false,
  bpm: null,
  pulse: 0,
  beat: 0,
  running: false,
  selection: 'auto',
  /* Default true: matches the MIDI 1.0 spec — incoming Start = rewind to 0
     then play. Real-world slave scenarios (e.g. Traktor master + this app as
     slave) require this for downbeat alignment. Users wanting resume-style
     "Start continues from current position" flip it off in the Clk menu. */
  strictStart: true,
};

const PRESENT_TIMEOUT_MS = 500;
const REVERT_TIMEOUT_MS = 2000;
const ACTIVE_MASTER_TIMEOUT_MS = 2000;
/* Cap on per-pulse `deltaMs` passed to applyExternalPulse. Anything longer
   is treated as a gap-recovery pulse: rather than advancing timecodeMs by
   the raw gap (which jolts the scheduler forward), we cap to one steady
   pulse interval (≈20.8 ms at 120 BPM, ≈10.4 ms at 240 BPM). Picked at
   50 ms to allow up to 50 BPM steady-state without artificial capping. */
const MAX_PULSE_DELTA_MS = 50;

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
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const selectionRef = useRef(state.selection);
  selectionRef.current = state.selection;
  const strictStartRef = useRef(state.strictStart);
  strictStartRef.current = state.strictStart;
  const pulseSubscribersRef = useRef<Set<PulseSubscriber>>(new Set());

  const inputsKey = useMemo(() => {
    if (runtimeState.status !== 'granted') return '';
    return runtimeState.inputs.map((d) => d.id).sort().join('|');
  }, [runtimeState]);

  useEffect(() => {
    if (status !== 'granted' || runtimeState.status !== 'granted') return;
    const access = runtimeState.access;
    const detachers: Array<() => void> = [];

    /* Two-stage silence handling, decoupled per the spec:
       - At 500 ms of silence: flip `present` to false (UI dims, smoother is
         considered stale). Source stays external-clock; bpm is preserved.
       - At 2000 ms of silence: auto-revert to internal clock (when in
         auto mode). Device-locked selections stay external indefinitely.
       Brief same-machine MIDI jitter (USB buffering, browser GC, ~100ms
       main-thread blocks) used to trigger spurious reverts that drifted us
       off Traktor's grid — this split absorbs jitter up to 2 seconds. */
    const armPresentTimer = () => {
      if (presentTimerRef.current != null) clearTimeout(presentTimerRef.current);
      presentTimerRef.current = setTimeout(() => {
        setState((prev) => (prev.present ? { ...prev, present: false } : prev));
        presentTimerRef.current = null;
      }, PRESENT_TIMEOUT_MS);

      if (revertTimerRef.current != null) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => {
        if (selectionRef.current === 'auto') {
          transportRef.current.revertToInternalClock();
        }
        revertTimerRef.current = null;
      }, REVERT_TIMEOUT_MS);
    };

    for (const device of runtimeState.inputs) {
      const port = access.inputs.get(device.id);
      if (!port) continue;

      const detach = attachClockReceiver(port, {
        onPulse: (input, timestampMs) => {
          const selection = selectionRef.current;
          if (selection === 'internal') return;
          if (selection !== 'auto' && selection !== input.id) return;
          const inputId = input.id;
          /* Use the OS-level RX timestamp instead of performance.now(). This
             survives JS main-thread blocking (heavy renders, GC pauses, etc.):
             pulses that queue in the event loop still report their original
             arrival time, so the smoother and inter-pulse delta stay accurate
             even when the handler drains in a burst. */
          const now = timestampMs;
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

          // Notify external pulse subscribers (e.g. MidiClockSendProvider's
          // relay path) synchronously — relayed clock to downstream gear
          // must mirror master timing as closely as possible, not wait for
          // our rAF flush. One try/catch per subscriber so a throwing one
          // does not block others or the receiver's own bookkeeping.
          for (const cb of pulseSubscribersRef.current) {
            try {
              cb(now);
            } catch (err) {
              console.error('MidiClockProvider onPulse subscriber threw:', err);
            }
          }

          const sameMasterPrevPulseAt = masterChanged ? undefined : prevPulseAt;
          const rawDelta =
            sameMasterPrevPulseAt != null ? Math.max(0, now - sameMasterPrevPulseAt) : 0;
          /* Cap deltaMs so a gap-recovery pulse (silence + first resumed
             pulse) does not jolt timecodeMs by the entire gap duration. The
             scheduler keys off timecodeMs for note emission — a jolt skips
             notes. With the cap, timecodeMs advances smoothly even when the
             master pulses through a long pause. */
          const deltaMs = Math.min(MAX_PULSE_DELTA_MS, rawDelta);
          const effectiveBpm = bpm ?? transportRef.current.bpm;

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

          transportRef.current.applyExternalPulse(deltaMs, effectiveBpm);

          armPresentTimer();
        },
        onStart: (input) => {
          if (selectionRef.current === 'internal') return;
          if (activeMasterIdRef.current !== input.id) return;
          setState((prev) => (prev.running ? prev : { ...prev, running: true }));
          const t = transportRef.current;
          // Recording is driven by the user's record button, not the master.
          if (t.mode === 'idle') {
            // Strict-Start mode: per MIDI 1.0 spec, Start = rewind to 0 then play.
            // React 18 auto-batches non-event updates, so rewind+play commit
            // atomically — no intermediate render with mode==='idle' && tc>0.
            if (strictStartRef.current) t.rewind();
            t.play();
          }
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
      if (revertTimerRef.current != null) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
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
    if (revertTimerRef.current != null) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    if (newSel === 'internal') {
      transportRef.current.revertToInternalClock();
    }
    // Preserve strictStart across selection changes — it's a receiver-mode
    // preference, not source-bound.
    setState((prev) => ({ ...DEFAULT_STATE, selection: newSel, strictStart: prev.strictStart }));
  }, []);

  const setStrictStart = useCallback((b: boolean) => {
    setState((prev) => (prev.strictStart === b ? prev : { ...prev, strictStart: b }));
  }, []);

  const onPulse = useCallback((cb: PulseSubscriber) => {
    pulseSubscribersRef.current.add(cb);
    return () => {
      pulseSubscribersRef.current.delete(cb);
    };
  }, []);

  const value = useMemo<MidiClockValue>(
    () => ({ ...state, setSelection, setStrictStart, onPulse }),
    [state, setSelection, setStrictStart, onPulse],
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
