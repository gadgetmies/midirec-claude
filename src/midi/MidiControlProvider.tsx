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
import { useToast } from '../components/toast/Toast';
import { useTransport, type TransportValue } from '../hooks/useTransport';
import { useControlMapStore } from '../hooks/useControlMapStore';
import { useMidiClockSend, type MidiClockSendValue } from './MidiClockSendProvider';
import { useMidiInputs, useMidiRuntime } from './MidiRuntimeProvider';
import {
  applyControlMessage,
  parseControlMessage,
  sourceDataFromMessage,
  sourceKindFromMessage,
  TARGET_REGISTRY,
  type ControlSource,
  type ControlSurface,
  type TakeoverEntry,
  type TargetKey,
} from './controlMap';

export interface MidiControlValue {
  /** Whether Ableton-style map mode is active. */
  mapMode: boolean;
  enterMapMode(): void;
  exitMapMode(): void;
  toggleMapMode(): void;
  /** The target currently armed for learning, or `null`. */
  armedTarget: TargetKey | null;
  /** Arm a target (or `null` to disarm) for the next qualifying message. */
  arm(target: TargetKey | null): void;
}

const MidiControlContext = createContext<MidiControlValue | null>(null);

/** Build the dispatch surface the registry acts on, composing transport actions
    with the clock-send toggle. `onExternalBpm` is invoked when a `setBpm` is
    attempted while slaved to an external clock (so the receiver can show a hint).
    The feedback runner reuses this for its read-only state selectors. */
export function buildControlSurface(
  transport: TransportValue,
  clockSend: MidiClockSendValue,
  opts: { onExternalBpm?: () => void } = {},
): ControlSurface {
  return {
    playing: transport.playing,
    recording: transport.recording,
    looping: transport.looping,
    metronomeOn: transport.metronomeOn,
    quantizeOn: transport.quantizeOn,
    snapAbsoluteOn: transport.snapAbsoluteOn,
    clockSendEnabled: clockSend.enabled,
    quantizeGrid: transport.quantizeGrid,
    clockSource: transport.clockSource,
    bpm: transport.bpm,
    recordingStartedAt: transport.recordingStartedAt,
    play: transport.play,
    pause: transport.pause,
    record: transport.record,
    rewind: transport.rewind,
    cue: transport.cue,
    phraseForward: transport.phraseForward,
    phraseBack: transport.phraseBack,
    toggleLoop: transport.toggleLoop,
    toggleMetronome: transport.toggleMetronome,
    toggleQuantize: transport.toggleQuantize,
    toggleSnapAbsolute: transport.toggleSnapAbsolute,
    toggleClockSend: () => clockSend.setEnabled(!clockSend.enabled),
    setBpm: (bpm: number) => {
      if (transport.clockSource !== 'internal') {
        opts.onExternalBpm?.();
        return;
      }
      transport.setBpm(bpm);
    },
    setQuantizeGrid: transport.setQuantizeGrid,
    setClockSource: transport.setClockSource,
  };
}

export function MidiControlProvider({ children }: { children: ReactNode }) {
  const transport = useTransport();
  const clockSend = useMidiClockSend();
  const store = useControlMapStore();
  const toast = useToast();
  const { state: runtimeState } = useMidiRuntime();
  const { inputs } = useMidiInputs();

  const [mapMode, setMapMode] = useState(false);
  const [armedTarget, setArmedTarget] = useState<TargetKey | null>(null);

  // Build the dispatch surface. It is rebuilt every render but read through a
  // ref inside the (stable) message handler so it always sees fresh values.
  const surface = useMemo<ControlSurface>(
    () =>
      buildControlSurface(transport, clockSend, {
        onExternalBpm: () =>
          toast.show('BPM unchanged · external clock owns the tempo', { kind: 'info' }),
      }),
    [transport, clockSend, toast],
  );

  /* Refs read from inside the stable onmidimessage handler. */
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const stateRef = useRef(store.state);
  stateRef.current = store.state;
  const mapModeRef = useRef(mapMode);
  mapModeRef.current = mapMode;
  const armedRef = useRef(armedTarget);
  armedRef.current = armedTarget;
  const assignRef = useRef(store.assign);
  assignRef.current = store.assign;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const takeoverRef = useRef(new Map<TargetKey, TakeoverEntry>());

  const learn = useCallback((source: ControlSource) => {
    const armed = armedRef.current;
    if (!armed) return;
    const alsoBoundTo = assignRef.current(armed, source);
    if (alsoBoundTo.length > 0) {
      // Not an error — one control can drive several actions. Let the user know.
      const others = alsoBoundTo.map((t) => TARGET_REGISTRY[t].label).join(', ');
      toastRef.current.show(
        `${TARGET_REGISTRY[armed].label} also triggers: ${others}`,
        { kind: 'info' },
      );
    }
    setArmedTarget(null);
  }, []);

  /* Always-on listener: attach to every granted input whenever the app is
     open (unlike the recorder, which only listens while recording). Re-runs on
     hotplug so new ports get a handler. */
  useEffect(() => {
    if (runtimeState.status !== 'granted') return;
    const access = runtimeState.access;
    const attached: Array<{ input: MIDIInput; handler: (event: MIDIMessageEvent) => void }> = [];

    for (const input of access.inputs.values()) {
      const portId = input.id;
      const handler = (event: MIDIMessageEvent) => {
        const data = event.data;
        if (!data) return;
        const parsed = parseControlMessage(portId, data);
        if (!parsed) return;

        // Honor the listened-input filter: when set, ignore other ports.
        const listen = stateRef.current.listenInputIds;
        if (listen && listen.length > 0 && !listen.includes(portId)) return;

        // In map mode, an *armed* target captures the next qualifying press
        // (learn / remap). With nothing armed, mapped controls stay live so
        // they remain effective while map mode is open.
        if (mapModeRef.current && armedRef.current) {
          if (parsed.edge === 'press' && parsed.value > 0) {
            const source: ControlSource = {
              kind: sourceKindFromMessage(parsed.wire),
              portId,
              channel: parsed.wire.channel1to16,
              data: sourceDataFromMessage(parsed.wire),
            };
            learn(source);
          }
          return;
        }

        applyControlMessage(parsed, stateRef.current, surfaceRef.current, takeoverRef.current);
      };
      // Use addEventListener rather than the single `onmidimessage` slot: the
      // recorder and clock receiver also attach to inputs and chain through that
      // slot, and that chain gets corrupted on hotplug re-attach (the cleanup
      // guard fails once another handler is layered on top), which left this
      // handler registered twice — toggles then flipped twice and cancelled out.
      // An independent listener is added once and removed cleanly.
      input.addEventListener('midimessage', handler);
      attached.push({ input, handler });
    }

    return () => {
      for (const { input, handler } of attached) {
        input.removeEventListener('midimessage', handler);
      }
    };
    // `inputs` is included so a hotplug (new/removed ports) re-attaches.
  }, [runtimeState, inputs, learn]);

  const enterMapMode = useCallback(() => {
    // Entering map mode stops any active recording first.
    if (transport.recording) transport.pause();
    setMapMode(true);
  }, [transport]);

  const exitMapMode = useCallback(() => {
    setMapMode(false);
    setArmedTarget(null);
  }, []);

  const toggleMapMode = useCallback(() => {
    if (mapModeRef.current) {
      setMapMode(false);
      setArmedTarget(null);
    } else {
      if (transport.recording) transport.pause();
      setMapMode(true);
    }
  }, [transport]);

  const arm = useCallback((target: TargetKey | null) => setArmedTarget(target), []);

  const value = useMemo<MidiControlValue>(
    () => ({ mapMode, enterMapMode, exitMapMode, toggleMapMode, armedTarget, arm }),
    [mapMode, enterMapMode, exitMapMode, toggleMapMode, armedTarget, arm],
  );

  return <MidiControlContext.Provider value={value}>{children}</MidiControlContext.Provider>;
}

export function useMidiControl(): MidiControlValue {
  const ctx = useContext(MidiControlContext);
  if (!ctx) {
    throw new Error('useMidiControl must be used inside <MidiControlProvider>');
  }
  return ctx;
}

/** Like `useMidiControl`, but returns `null` outside a provider instead of
    throwing. The map-editor UI pieces render harmlessly (no badges / map mode
    off) when mounted without the provider — e.g. in focused component tests. */
export function useOptionalMidiControl(): MidiControlValue | null {
  return useContext(MidiControlContext);
}
