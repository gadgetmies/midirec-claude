import { useEffect, useRef } from 'react';
import type { Note } from '../components/piano-roll/notes';
import type { ActionMapEntry, OutputMapping, PressurePoint } from '../data/dj';
import { synthesizePressure } from '../data/pressure';
import type { DJTrackId, DJActionTrack } from '../hooks/useDJActionTracks';
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

export interface DJEventSnapshot {
  pitch: number;
  t: number;
  dur: number;
  vel: number;
  pressure?: PressurePoint[];
  perPitchIndex: number;
}

export interface DJTrackSnapshot {
  id: DJTrackId;
  midiChannel: number;
  muted: boolean;
  soloed: boolean;
  mutedRows: number[];
  soloedRows: number[];
  actionMap: Record<number, ActionMapEntry>;
  outputMap: Record<number, OutputMapping>;
  events: DJEventSnapshot[];
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
const AT_MIN_GAP_MS = 10;
const PRESSURE_AT_STATUS = 0xd0;

interface NoteLikeEvent {
  t: number;
  dur: number;
}

type ChannelPlayableSource = {
  kind: 'channel';
  cursorKey: string;
  events: Note[];
  channel: ChannelSnapshot;
};

type DJPlayableSource = {
  kind: 'dj';
  cursorKey: string;
  events: DJEventSnapshot[];
  track: DJTrackSnapshot;
};

type PlayableSource = ChannelPlayableSource | DJPlayableSource;

interface ResolvedEmit {
  channelByte: number;
  pitch: number;
  vel: number;
  pressure?: PressurePoint[];
}

function binarySearchFirstAtOrAfterT(items: NoteLikeEvent[], targetT: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid]!.t < targetT) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function computeSessionAnySoloed(
  channels: ChannelSnapshot[],
  djTracks: DJTrackSnapshot[],
  soloing: boolean,
): boolean {
  if (soloing) return true;
  for (const c of channels) {
    if (c.soloed || c.rollSoloed) return true;
  }
  for (const t of djTracks) {
    if (t.soloed || t.soloedRows.length > 0) return true;
  }
  return false;
}

function isChannelAudible(c: ChannelSnapshot, sessionAnySoloed: boolean): boolean {
  if (c.muted || c.rollMuted) return false;
  if (!sessionAnySoloed) return true;
  return c.soloed || c.rollSoloed;
}

function isDJTrackAudible(track: DJTrackSnapshot, sessionAnySoloed: boolean): boolean {
  if (track.muted) return false;
  if (!sessionAnySoloed) return true;
  return track.soloed || track.soloedRows.length > 0;
}

function isDJRowAudible(
  track: DJTrackSnapshot,
  pitch: number,
  sessionAnySoloed: boolean,
): boolean {
  if (track.mutedRows.includes(pitch)) return false;
  if (!isDJTrackAudible(track, sessionAnySoloed)) return false;
  if (!sessionAnySoloed) return true;
  if (track.soloedRows.includes(pitch)) return true;
  if (track.soloed && track.soloedRows.length === 0) return true;
  return false;
}

function resolveChannelEmit(
  source: ChannelPlayableSource,
  note: Note,
  sessionAnySoloed: boolean,
): ResolvedEmit | null {
  if (!isChannelAudible(source.channel, sessionAnySoloed)) return null;
  return {
    channelByte: (source.channel.id - 1) & 0x0f,
    pitch: note.pitch,
    vel: note.vel,
  };
}

function resolveDJEmit(
  source: DJPlayableSource,
  event: DJEventSnapshot,
  sessionAnySoloed: boolean,
): ResolvedEmit | null {
  const action = source.track.actionMap[event.pitch];
  if (!action) return null;
  if (!isDJRowAudible(source.track, event.pitch, sessionAnySoloed)) return null;
  const mapping = source.track.outputMap[event.pitch];
  const channel = mapping?.channel ?? source.track.midiChannel;
  const channelByte = (channel - 1) & 0x0f;
  const outputPitch = mapping?.pitch ?? event.pitch;
  const vel = Math.min(127, Math.max(1, Math.round(event.vel * 127)));
  const pressurePoints =
    action.pressure === true
      ? event.pressure === undefined
        ? synthesizePressure(
            { pitch: event.pitch, t: event.t, dur: event.dur, vel: event.vel },
            event.perPitchIndex,
          )
        : event.pressure
      : undefined;
  return {
    channelByte,
    pitch: outputPitch,
    vel,
    pressure: pressurePoints,
  };
}

export interface Scheduler {
  start(
    playheadMs: number,
    bpm: number,
    channels: ChannelSnapshot[],
    soloing?: boolean,
    djTracks?: DJTrackSnapshot[],
  ): void;
  tick(
    now: number,
    playheadMs: number,
    channels: ChannelSnapshot[],
    soloing?: boolean,
    djTracks?: DJTrackSnapshot[],
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
  const cursors = new Map<string, number>();
  const activeNoteOns = new Map<string, ActiveNoteOn>();
  const channelsActivated = new Map<string, number>();
  const atLastEmitMsByChannel = new Map<number, number>();

  function noteOnKey(channelByte: number, pitch: number): string {
    const outputId = deps.output?.id ?? '';
    return `${outputId}|${channelByte}|${pitch}`;
  }

  function channelActKey(channelByte: number): string {
    const outputId = deps.output?.id ?? '';
    return `${outputId}|${channelByte}`;
  }

  function buildSources(
    channels: ChannelSnapshot[],
    djTracks: DJTrackSnapshot[],
  ): PlayableSource[] {
    const sources: PlayableSource[] = [];
    for (const c of channels) {
      sources.push({ kind: 'channel', cursorKey: `ch:${c.id}`, events: c.notes, channel: c });
    }
    for (const t of djTracks) {
      sources.push({ kind: 'dj', cursorKey: `dj:${t.id}`, events: t.events, track: t });
    }
    return sources;
  }

  function rebindCursors(sources: PlayableSource[], playheadMs: number): void {
    if (tempoSnapshot <= 0) return;
    const msPerBeat = 60000 / tempoSnapshot;
    const targetT = playheadMs / msPerBeat;
    for (const source of sources) {
      cursors.set(source.cursorKey, binarySearchFirstAtOrAfterT(source.events, targetT));
    }
  }

  function emitNoteEvent(
    channelByte: number,
    pitch: number,
    vel: number,
    eventStartPlayheadMs: number,
    eventEndPlayheadMs: number,
    now: number,
    playheadMs: number,
    pressure: PressurePoint[] | undefined,
  ): void {
    if (!deps.output) return;
    const nowFloor = typeof performance !== 'undefined' ? performance.now() : now;
    const tsOn = Math.max(nowFloor, now + (eventStartPlayheadMs - playheadMs));
    const tsOff = Math.max(nowFloor, now + (eventEndPlayheadMs - playheadMs));
    deps.output.send([0x90 | channelByte, pitch, vel], tsOn);
    deps.output.send([0x80 | channelByte, pitch, 0], tsOff);
    activeNoteOns.set(noteOnKey(channelByte, pitch), { channelByte, pitch });
    channelsActivated.set(channelActKey(channelByte), channelByte);
    if (pressure && pressure.length > 0) {
      const eventDurMs = eventEndPlayheadMs - eventStartPlayheadMs;
      for (const point of pressure) {
        const tsAtRel = eventStartPlayheadMs + point.t * eventDurMs;
        const lastAt = atLastEmitMsByChannel.get(channelByte);
        if (lastAt !== undefined && tsAtRel - lastAt < AT_MIN_GAP_MS) continue;
        const atValue = Math.min(127, Math.max(0, Math.round(point.v * 127)));
        const tsAt = Math.max(nowFloor, now + (tsAtRel - playheadMs));
        deps.output.send([PRESSURE_AT_STATUS | channelByte, atValue], tsAt);
        atLastEmitMsByChannel.set(channelByte, tsAtRel);
      }
    }
  }

  function start(
    playheadMs: number,
    bpm: number,
    channels: ChannelSnapshot[],
    _soloing: boolean = false,
    djTracks: DJTrackSnapshot[] = [],
  ): void {
    running = true;
    tempoSnapshot = bpm;
    lastPlayheadMs = playheadMs;
    cursors.clear();
    activeNoteOns.clear();
    channelsActivated.clear();
    atLastEmitMsByChannel.clear();
    rebindCursors(buildSources(channels, djTracks), playheadMs);
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
    djTracks: DJTrackSnapshot[] = [],
  ): void {
    if (!running) return;
    const sources = buildSources(channels, djTracks);
    if (playheadMs < lastPlayheadMs - SEEK_BACK_EPSILON_MS) {
      rebindCursors(sources, playheadMs);
    }
    if (!deps.output || tempoSnapshot <= 0) {
      lastPlayheadMs = playheadMs;
      return;
    }
    const msPerBeat = 60000 / tempoSnapshot;
    const lookaheadEndMs = playheadMs + lookaheadMs;
    const sessionAnySoloed = computeSessionAnySoloed(channels, djTracks, soloing);

    for (const source of sources) {
      let cursor = cursors.get(source.cursorKey);
      if (cursor === undefined) {
        cursor = binarySearchFirstAtOrAfterT(source.events, playheadMs / msPerBeat);
      }
      while (cursor < source.events.length && source.events[cursor]!.t * msPerBeat < playheadMs) {
        cursor++;
      }
      while (cursor < source.events.length) {
        const event = source.events[cursor]!;
        const startMs = event.t * msPerBeat;
        if (startMs >= lookaheadEndMs) break;
        const emit =
          source.kind === 'channel'
            ? resolveChannelEmit(source, event as Note, sessionAnySoloed)
            : resolveDJEmit(source, event as DJEventSnapshot, sessionAnySoloed);
        if (emit) {
          const endMs = (event.t + event.dur) * msPerBeat;
          emitNoteEvent(
            emit.channelByte,
            emit.pitch,
            emit.vel,
            startMs,
            endMs,
            now,
            playheadMs,
            emit.pressure,
          );
        }
        cursor++;
      }
      cursors.set(source.cursorKey, cursor);
    }
    lastPlayheadMs = playheadMs;
  }

  function panic(): void {
    if (!running) {
      activeNoteOns.clear();
      channelsActivated.clear();
      cursors.clear();
      atLastEmitMsByChannel.clear();
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
    atLastEmitMsByChannel.clear();
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
  djTracks: DJTrackSnapshot[];
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

function buildDJTrackSnapshots(djActionTracks: DJActionTrack[]): DJTrackSnapshot[] {
  return djActionTracks.map((track) => {
    const counts = new Map<number, number>();
    const events: DJEventSnapshot[] = track.events.map((event) => {
      const idx = counts.get(event.pitch) ?? 0;
      counts.set(event.pitch, idx + 1);
      return {
        pitch: event.pitch,
        t: event.t,
        dur: event.dur,
        vel: event.vel,
        pressure: event.pressure,
        perPitchIndex: idx,
      };
    });
    events.sort((a, b) => a.t - b.t);
    return {
      id: track.id,
      midiChannel: track.midiChannel,
      muted: track.muted,
      soloed: track.soloed,
      mutedRows: track.mutedRows,
      soloedRows: track.soloedRows,
      actionMap: track.actionMap,
      outputMap: track.outputMap,
      events,
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
    djTracks: buildDJTrackSnapshots(stage.djActionTracks),
    soloing: stage.soloing,
  });
  latestRef.current = {
    timecodeMs,
    bpm,
    channels: buildChannelSnapshots(stage.channels, stage.rolls),
    djTracks: buildDJTrackSnapshots(stage.djActionTracks),
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
    scheduler.start(snap.timecodeMs, snap.bpm, snap.channels, snap.soloing, snap.djTracks);

    let rafId: number | null = null;
    const tickLoop = (now: number) => {
      const cur = latestRef.current;
      scheduler.tick(now, cur.timecodeMs, cur.channels, cur.soloing, cur.djTracks);
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
