import { useEffect, useRef, useState } from 'react';
import { useMidiInputs, useMidiRuntime } from '../midi/MidiRuntimeProvider';

export interface MidiInput {
  id: string;
  name: string;
  channel: number | 'omni' | number[];
}

export interface StatusbarValue {
  lastInput: MidiInput | null;
  active: boolean;
}

const ACTIVITY_DECAY_MS = 120;

const CLOCK_PULSE = 0xf8;
const ACTIVE_SENSING = 0xfe;

function isVisibleMessage(data: Uint8Array | null | undefined): boolean {
  if (!data || data.length === 0) return false;
  const status = data[0] ?? 0;
  return status !== CLOCK_PULSE && status !== ACTIVE_SENSING;
}

function channelFromStatus(status: number): number | null {
  if (status >= 0x80 && status <= 0xef) {
    return (status & 0x0f) + 1;
  }
  return null;
}

export function useStatusbar(): StatusbarValue {
  const { state: runtimeState } = useMidiRuntime();
  const { inputs } = useMidiInputs();
  const [active, setActive] = useState(false);
  const [lastInput, setLastInput] = useState<MidiInput | null>(null);
  const decayTimerRef = useRef<number | null>(null);

  const access = runtimeState.status === 'granted' ? runtimeState.access : null;

  useEffect(() => {
    if (!access) return;
    const handlers: Array<{ port: MIDIInput; fn: (event: Event) => void }> = [];

    for (const port of access.inputs.values()) {
      const fn = (event: Event) => {
        const msg = event as MIDIMessageEvent;
        if (!isVisibleMessage(msg.data)) return;
        const status = msg.data?.[0] ?? 0;
        const ch = channelFromStatus(status);
        setActive(true);
        setLastInput((prev) => ({
          id: port.id,
          name: port.name && port.name.length > 0 ? port.name : '(unnamed device)',
          channel: ch !== null ? ch : prev?.channel ?? 'omni',
        }));
        if (decayTimerRef.current != null) {
          window.clearTimeout(decayTimerRef.current);
        }
        decayTimerRef.current = window.setTimeout(() => {
          setActive(false);
          decayTimerRef.current = null;
        }, ACTIVITY_DECAY_MS);
      };
      port.addEventListener('midimessage', fn);
      handlers.push({ port, fn });
    }

    return () => {
      for (const { port, fn } of handlers) {
        port.removeEventListener('midimessage', fn);
      }
      if (decayTimerRef.current != null) {
        window.clearTimeout(decayTimerRef.current);
        decayTimerRef.current = null;
      }
    };
    // `inputs` is included so the effect re-runs on hotplug, picking up newly
    // connected ports; `access` keys to the granted MIDIAccess (changes only
    // when permission is re-requested after a deny).
  }, [access, inputs]);

  useEffect(() => {
    if (inputs.length === 0) {
      setActive(false);
      setLastInput(null);
    }
  }, [inputs.length]);

  return { active, lastInput };
}

export function formatChannel(channel: MidiInput['channel']): string {
  if (channel === 'omni') return 'CH·OMNI';
  if (typeof channel === 'number') return `CH·${channel}`;
  if (channel.length === 0) return 'CH·—';
  if (channel.length === 1) return `CH·${channel[0]}`;
  const sorted = [...channel].sort((a, b) => a - b);
  const isContiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  if (isContiguous) return `CH·${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `CH·${sorted.join(',')}`;
}
