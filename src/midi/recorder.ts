import { useEffect, useRef } from 'react';
import type { Note } from '../components/piano-roll/notes';
import type { ChannelId } from '../hooks/useChannels';
import { useStage } from '../hooks/useStage';
import { useTransport } from './../hooks/useTransport';
import { useMidiInputs, useMidiRuntime } from './MidiRuntimeProvider';

interface ActiveNoteEntry {
  startedAt: number;
  vel: number;
  channelId: ChannelId;
}

interface LatestRef {
  bpm: number;
  selectedChannelId: ChannelId | null;
  appendNote: (channelId: ChannelId, note: Note) => void;
}

function msToBeats(deltaMs: number, bpm: number): number {
  return (deltaMs / 1000) * (bpm / 60);
}

export function useMidiRecorder(): void {
  const { recording, recordingStartedAt, bpm } = useTransport();
  const { selectedChannelId, appendNote } = useStage();
  const { state: runtimeState } = useMidiRuntime();
  const { status, inputs } = useMidiInputs();
  const inputId = inputs[0]?.id ?? null;

  const activeNotesRef = useRef<Map<number, ActiveNoteEntry>>(new Map());
  const pendingNotesRef = useRef<Array<{ channelId: ChannelId; note: Note }>>([]);
  const rafIdRef = useRef<number | null>(null);
  const latestRef = useRef<LatestRef>({
    bpm,
    selectedChannelId,
    appendNote,
  });
  latestRef.current = { bpm, selectedChannelId, appendNote };

  useEffect(() => {
    if (!recording) return;
    if (recordingStartedAt === null) return;
    if (selectedChannelId === null) return;
    if (status !== 'granted') return;
    if (inputId === null) return;
    if (runtimeState.status !== 'granted') return;

    const access = runtimeState.access;
    const input = access.inputs.get(inputId);
    if (!input) return;

    // Captured at effect setup; remains valid across cleanup even after the
    // reducer clears recordingStartedAt on stop/pause.
    const origin = recordingStartedAt;

    const flushPending = () => {
      const { appendNote: cb } = latestRef.current;
      for (const { channelId, note } of pendingNotesRef.current) {
        cb(channelId, note);
      }
      pendingNotesRef.current = [];
      rafIdRef.current = null;
    };

    const scheduleFlush = () => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(flushPending);
    };

    const finalize = (pitch: number, offTime: number) => {
      const entry = activeNotesRef.current.get(pitch);
      if (!entry) return;
      activeNotesRef.current.delete(pitch);
      const t = msToBeats(entry.startedAt - origin, latestRef.current.bpm);
      const dur = msToBeats(offTime - entry.startedAt, latestRef.current.bpm);
      pendingNotesRef.current.push({
        channelId: entry.channelId,
        note: { t, dur, pitch, vel: entry.vel },
      });
      scheduleFlush();
    };

    const prev = input.onmidimessage;

    const handler = (event: MIDIMessageEvent) => {
      prev?.call(input, event);
      const data = event.data;
      if (!data || data.length < 1) return;
      const status0 = data[0]!;
      const nibble = status0 & 0xf0;
      if (nibble === 0x90) {
        const pitch = data[1] ?? 0;
        const vel = data[2] ?? 0;
        if (vel > 0) {
          const ch = latestRef.current.selectedChannelId;
          if (ch === null) return;
          activeNotesRef.current.set(pitch, {
            startedAt: performance.now(),
            vel,
            channelId: ch,
          });
          return;
        }
        finalize(pitch, performance.now());
        return;
      }
      if (nibble === 0x80) {
        const pitch = data[1] ?? 0;
        finalize(pitch, performance.now());
        return;
      }
    };

    input.onmidimessage = handler;

    return () => {
      const now = performance.now();
      for (const [pitch] of activeNotesRef.current) {
        finalize(pitch, now);
      }
      activeNotesRef.current.clear();
      if (input.onmidimessage === handler) {
        input.onmidimessage = prev;
      }
    };
  }, [recording, recordingStartedAt, selectedChannelId, status, inputId, runtimeState]);
}

export function MidiRecorderRunner(): null {
  useMidiRecorder();
  return null;
}
