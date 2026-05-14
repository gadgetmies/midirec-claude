import { useEffect, useRef } from 'react';
import {
  type MidiLearnWireMessage,
  parseMidiLearnMessage,
} from './midiLearn';
import { useMidiRuntime } from './MidiRuntimeProvider';

const DEFAULT_IDLE_MS = 12_000;

export interface UseMidiLearnOptions {
  armed: boolean;
  setArmed: (next: boolean) => void;
  portFilter: (portId: string) => boolean;
  tryCapture: (msg: MidiLearnWireMessage) => boolean;
  idleTimeoutMs?: number;
}

export function useMidiLearn({
  armed,
  setArmed,
  portFilter,
  tryCapture,
  idleTimeoutMs = DEFAULT_IDLE_MS,
}: UseMidiLearnOptions): void {
  const { state } = useMidiRuntime();
  const tryCaptureRef = useRef(tryCapture);
  const portFilterRef = useRef(portFilter);
  const setArmedRef = useRef(setArmed);
  tryCaptureRef.current = tryCapture;
  portFilterRef.current = portFilter;
  setArmedRef.current = setArmed;

  useEffect(() => {
    if (!armed || state.status !== 'granted') return;
    const consumedRef = { current: false };
    const inputs = [...state.access.inputs.values()].filter((i) => portFilterRef.current(i.id));

    const onMidi = (ev: Event) => {
      if (consumedRef.current) return;
      const e = ev as MIDIMessageEvent;
      const input = e.currentTarget as MIDIInput | null;
      if (!input || !e.data) return;
      if (!portFilterRef.current(input.id)) return;
      const msg = parseMidiLearnMessage(input.id, e.data);
      if (!msg) return;
      if (tryCaptureRef.current(msg)) {
        consumedRef.current = true;
        setArmedRef.current(false);
      }
    };

    for (const input of inputs) {
      input.addEventListener('midimessage', onMidi);
    }
    return () => {
      for (const input of inputs) {
        input.removeEventListener('midimessage', onMidi);
      }
    };
  }, [armed, state]);

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(false);
    };
    window.addEventListener('keydown', onKey);
    const tid = window.setTimeout(() => setArmed(false), idleTimeoutMs);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(tid);
    };
  }, [armed, setArmed, idleTimeoutMs]);
}
