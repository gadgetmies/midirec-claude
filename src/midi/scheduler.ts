import { useEffect, useRef } from 'react';
import type { Note } from '../components/piano-roll/notes';
import { useStage } from '../hooks/useStage';
import { useTransport } from '../hooks/useTransport';
import { useToast } from '../components/toast/Toast';
import { useMidiOutputs, useMidiRuntime } from './MidiRuntimeProvider';

export interface ChannelSnapshot {
  id: number;
  muted: boolean;
  soloed: boolean;
  rollMuted: boolean;
  rollSoloed: boolean;
  notes: Note[];
}

export interface SchedulerOutput {
  id: string;
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

export interface SchedulerDeps {
  output: SchedulerOutput | null;
  outputName: string | undefined;
  toast: (message: string) => void;
  lookaheadMs?: number;
}

interface ActiveNoteOn {
  channelByte: number;
  pitch: number;
}

const DEFAULT_LOOKAHEAD_MS = 100;
const SEEK_BACK_EPSILON_MS = 17;

function binarySearchFirstAtOrAfterT(notes: Note[], targetT: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid]!.t < targetT) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface Scheduler {
  start(playheadMs: number, bpm: number, channels: ChannelSnapshot[], soloing?: boolean): void;
  tick(
    now: number,
    playheadMs: number,
    channels: ChannelSnapshot[],
    soloing?: boolean,
  ): void;
  panic(): void;
  isRunning(): boolean;
  activeNoteCount(): number;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const lookaheadMs = deps.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
  let running = false;
  let tempoSnapshot = 0;
  let lastPlayheadMs = 0;
  const cursors = new Map<number, number>();
  const activeNoteOns = new Map<string, ActiveNoteOn>();
  const channelsActivated = new Map<string, number>();

  function noteOnKey(channelByte: number, pitch: number): string {
    const outputId = deps.output?.id ?? '';
    return `${outputId}|${channelByte}|${pitch}`;
  }

  function channelActKey(channelByte: number): string {
    const outputId = deps.output?.id ?? '';
    return `${outputId}|${channelByte}`;
  }

  function rebindCursors(channels: ChannelSnapshot[], playheadMs: number): void {
    if (tempoSnapshot <= 0) return;
    const msPerBeat = 60000 / tempoSnapshot;
    const targetT = playheadMs / msPerBeat;
    for (const ch of channels) {
      cursors.set(ch.id, binarySearchFirstAtOrAfterT(ch.notes, targetT));
    }
  }

  function start(
    playheadMs: number,
    bpm: number,
    channels: ChannelSnapshot[],
    _soloing: boolean = false,
  ): void {
    running = true;
    tempoSnapshot = bpm;
    lastPlayheadMs = playheadMs;
    cursors.clear();
    activeNoteOns.clear();
    channelsActivated.clear();
    rebindCursors(channels, playheadMs);
    if (!deps.output) {
      deps.toast('No output device available');
    } else {
      const name = deps.outputName ?? '(unnamed device)';
      deps.toast(`Playing to ${name}`);
    }
  }

  function tick(
    now: number,
    playheadMs: number,
    channels: ChannelSnapshot[],
    soloing: boolean = false,
  ): void {
    if (!running) return;
    if (playheadMs < lastPlayheadMs - SEEK_BACK_EPSILON_MS) {
      rebindCursors(channels, playheadMs);
    }
    if (!deps.output || tempoSnapshot <= 0) {
      lastPlayheadMs = playheadMs;
      return;
    }
    const msPerBeat = 60000 / tempoSnapshot;
    const lookaheadEndMs = playheadMs + lookaheadMs;
    const anySoloed = soloing || channels.some((c) => c.soloed || c.rollSoloed);
    for (const ch of channels) {
      const audible =
        !ch.muted && !ch.rollMuted && (!anySoloed || ch.soloed || ch.rollSoloed);
      let cursor = cursors.get(ch.id);
      if (cursor === undefined) {
        cursor = binarySearchFirstAtOrAfterT(ch.notes, playheadMs / msPerBeat);
      }
      while (cursor < ch.notes.length && ch.notes[cursor]!.t * msPerBeat < playheadMs) {
        cursor++;
      }
      if (audible) {
        while (cursor < ch.notes.length) {
          const note = ch.notes[cursor]!;
          const startMs = note.t * msPerBeat;
          if (startMs >= lookaheadEndMs) break;
          const channelByte = (ch.id - 1) & 0x0f;
          const offsetOnMs = startMs - playheadMs;
          const offsetOffMs = (note.t + note.dur) * msPerBeat - playheadMs;
          const nowFloor = typeof performance !== 'undefined' ? performance.now() : now;
          const tsOn = Math.max(nowFloor, now + offsetOnMs);
          const tsOff = Math.max(nowFloor, now + offsetOffMs);
          deps.output.send([0x90 | channelByte, note.pitch, note.vel], tsOn);
          deps.output.send([0x80 | channelByte, note.pitch, 0], tsOff);
          activeNoteOns.set(noteOnKey(channelByte, note.pitch), {
            channelByte,
            pitch: note.pitch,
          });
          channelsActivated.set(channelActKey(channelByte), channelByte);
          cursor++;
        }
      } else {
        while (cursor < ch.notes.length && ch.notes[cursor]!.t * msPerBeat < lookaheadEndMs) {
          cursor++;
        }
      }
      cursors.set(ch.id, cursor);
    }
    lastPlayheadMs = playheadMs;
  }

  function panic(): void {
    if (!running) {
      activeNoteOns.clear();
      channelsActivated.clear();
      cursors.clear();
      return;
    }
    running = false;
    if (deps.output) {
      for (const [, entry] of activeNoteOns) {
        deps.output.send([0x80 | entry.channelByte, entry.pitch, 0]);
      }
      for (const [, channelByte] of channelsActivated) {
        deps.output.send([0xb0 | channelByte, 0x7b, 0x00]);
      }
    }
    activeNoteOns.clear();
    channelsActivated.clear();
    cursors.clear();
    tempoSnapshot = 0;
    lastPlayheadMs = 0;
  }

  return {
    start,
    tick,
    panic,
    isRunning: () => running,
    activeNoteCount: () => activeNoteOns.size,
  };
}

interface LatestRef {
  timecodeMs: number;
  bpm: number;
  channels: ChannelSnapshot[];
  soloing: boolean;
}

function buildChannelSnapshots(
  channels: ReturnType<typeof useStage>['channels'],
  rolls: ReturnType<typeof useStage>['rolls'],
): ChannelSnapshot[] {
  return channels.map((c) => {
    const roll = rolls.find((r) => r.channelId === c.id);
    return {
      id: c.id,
      muted: c.muted,
      soloed: c.soloed,
      rollMuted: roll?.muted ?? false,
      rollSoloed: roll?.soloed ?? false,
      notes: roll?.notes ?? [],
    };
  });
}

export function useMidiScheduler(): void {
  const { mode, timecodeMs, bpm } = useTransport();
  const stage = useStage();
  const { state: runtimeState } = useMidiRuntime();
  const { outputs } = useMidiOutputs();
  const toast = useToast();

  const latestRef = useRef<LatestRef>({
    timecodeMs,
    bpm,
    channels: buildChannelSnapshots(stage.channels, stage.rolls),
    soloing: stage.soloing,
  });
  latestRef.current = {
    timecodeMs,
    bpm,
    channels: buildChannelSnapshots(stage.channels, stage.rolls),
    soloing: stage.soloing,
  };

  useEffect(() => {
    if (mode !== 'play') return;

    const outputSnapshot = outputs[0];
    const midiOutput =
      outputSnapshot && runtimeState.status === 'granted'
        ? runtimeState.access.outputs.get(outputSnapshot.id) ?? null
        : null;

    const scheduler = createScheduler({
      output: midiOutput as SchedulerOutput | null,
      outputName: outputSnapshot?.name,
      toast: (msg) => toast.show(msg),
    });

    const snap = latestRef.current;
    scheduler.start(snap.timecodeMs, snap.bpm, snap.channels, snap.soloing);

    let rafId: number | null = null;
    const tickLoop = (now: number) => {
      const cur = latestRef.current;
      scheduler.tick(now, cur.timecodeMs, cur.channels, cur.soloing);
      rafId = requestAnimationFrame(tickLoop);
    };
    rafId = requestAnimationFrame(tickLoop);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      scheduler.panic();
    };
  }, [mode]);
}

export function MidiSchedulerRunner(): null {
  useMidiScheduler();
  return null;
}
