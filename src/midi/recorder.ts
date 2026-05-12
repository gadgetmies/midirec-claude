import { flushSync } from 'react-dom';
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
  channels: { id: ChannelId }[];
  addChannel: (channelId: ChannelId, name?: string, color?: string) => void;
  appendNote: (channelId: ChannelId, note: Note) => void;
}

function msToBeats(deltaMs: number, bpm: number): number {
  return (deltaMs / 1000) * (bpm / 60);
}

function activeKey(midiCh: number, pitch: number): string {
  return `${midiCh}:${pitch}`;
}

function parseActiveKey(key: string): { midiCh: number; pitch: number } {
  const sep = key.indexOf(':');
  return { midiCh: Number(key.slice(0, sep)), pitch: Number(key.slice(sep + 1)) };
}

export function useMidiRecorder(): void {
  const { recording, recordingStartedAt, bpm } = useTransport();
  const { channels, addChannel, appendNote } = useStage();
  const { state: runtimeState } = useMidiRuntime();
  const { status, inputs } = useMidiInputs();
  const inputId = inputs[0]?.id ?? null;

  const activeNotesRef = useRef<Map<string, ActiveNoteEntry>>(new Map());
  const pendingNotesRef = useRef<Array<{ channelId: ChannelId; note: Note }>>([]);
  const rafIdRef = useRef<number | null>(null);
  const latestRef = useRef<LatestRef>({
    bpm,
    channels,
    addChannel,
    appendNote,
  });
  latestRef.current = { bpm, channels, addChannel, appendNote };

  useEffect(() => {
    if (!recording) return;
    if (recordingStartedAt === null) return;
    if (status !== 'granted') return;
    if (inputId === null) return;
    if (runtimeState.status !== 'granted') return;

    const access = runtimeState.access;
    const input = access.inputs.get(inputId);
    if (!input) return;

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

    const finalize = (midiCh: number, pitch: number, offTime: number) => {
      const entry = activeNotesRef.current.get(activeKey(midiCh, pitch));
      if (!entry) return;
      activeNotesRef.current.delete(activeKey(midiCh, pitch));
      const t = msToBeats(entry.startedAt - origin, latestRef.current.bpm);
      const dur = msToBeats(offTime - entry.startedAt, latestRef.current.bpm);
      pendingNotesRef.current.push({
        channelId: entry.channelId,
        note: { t, dur, pitch, vel: entry.vel },
      });
      scheduleFlush();
    };

    const ensureChannelRow = (channelId: ChannelId) => {
      if (latestRef.current.channels.some((c) => c.id === channelId)) return;
      flushSync(() => {
        latestRef.current.addChannel(channelId);
      });
    };

    const prev = input.onmidimessage;

    const handler = (event: MIDIMessageEvent) => {
      prev?.call(input, event);
      const data = event.data;
      if (!data || data.length < 1) return;
      const status0 = data[0]!;
      const nibble = status0 & 0xf0;
      const midiCh = status0 & 0x0f;
      const channelId = (midiCh + 1) as ChannelId;

      if (nibble === 0x90) {
        const pitch = data[1] ?? 0;
        const vel = data[2] ?? 0;
        if (vel > 0) {
          ensureChannelRow(channelId);
          activeNotesRef.current.set(activeKey(midiCh, pitch), {
            startedAt: performance.now(),
            vel,
            channelId,
          });
          return;
        }
        finalize(midiCh, pitch, performance.now());
        return;
      }
      if (nibble === 0x80) {
        const pitch = data[1] ?? 0;
        finalize(midiCh, pitch, performance.now());
        return;
      }
    };

    input.onmidimessage = handler;

    return () => {
      const now = performance.now();
      for (const key of [...activeNotesRef.current.keys()]) {
        const { midiCh, pitch } = parseActiveKey(key);
        finalize(midiCh, pitch, now);
      }
      activeNotesRef.current.clear();
      if (input.onmidimessage === handler) {
        input.onmidimessage = prev;
      }
    };
  }, [recording, recordingStartedAt, status, inputId, runtimeState]);
}

export function MidiRecorderRunner(): null {
  useMidiRecorder();
  return null;
}
