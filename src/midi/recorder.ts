import { flushSync } from 'react-dom';
import { useEffect, useMemo, useRef } from 'react';
import type { Note } from '../components/piano-roll/notes';
import type { Channel, ChannelId } from '../hooks/useChannels';
import type { ActionEvent, ActionMapEntry } from '../data/dj';
import type { DJActionTrack, DJTrackId } from '../hooks/useDJActionTracks';
import type { TimelineTrackSelection } from '../hooks/useStage';
import { useStage } from '../hooks/useStage';
import { useTransport } from './../hooks/useTransport';
import { useMidiInputs, useMidiRuntime } from './MidiRuntimeProvider';

type DJMatch = { trackId: DJTrackId; actionPitch: number };

type ActiveNoteEntry =
  | { kind: 'channel'; channelId: ChannelId; startedAt: number; vel: number }
  | { kind: 'dj'; trackId: DJTrackId; actionPitch: number; startedAt: number; vel: number };

interface LatestRef {
  bpm: number;
  channels: Channel[];
  djActionTracks: DJActionTrack[];
  selectedTimelineTrack: TimelineTrackSelection | null;
  addChannel: (channelId: ChannelId, name?: string, color?: string) => void;
  appendNote: (channelId: ChannelId, note: Note) => void;
  appendDJActionEvent: (trackId: DJTrackId, event: ActionEvent) => void;
}

function msToBeats(deltaMs: number, bpm: number): number {
  return (deltaMs / 1000) * (bpm / 60);
}

function activeKey(portId: string, midiCh: number, pitch: number): string {
  return `${portId}\0${midiCh}\0${pitch}`;
}

function parseActiveKey(key: string): { portId: string; midiCh: number; pitch: number } {
  const i0 = key.indexOf('\0');
  const i1 = key.indexOf('\0', i0 + 1);
  return {
    portId: key.slice(0, i0),
    midiCh: Number(key.slice(i0 + 1, i1)),
    pitch: Number(key.slice(i1 + 1)),
  };
}

function wireChFromNibble(midiCh: number): ChannelId {
  return (midiCh + 1) as ChannelId;
}

function matchingInstrumentChannels(channels: Channel[], portId: string, midiCh: number): ChannelId[] {
  const w = wireChFromNibble(midiCh);
  const out: ChannelId[] = [];
  for (const ch of channels) {
    for (const row of ch.inputSources) {
      if (row.inputDeviceId === portId && row.channels.includes(w)) {
        out.push(ch.id);
        break;
      }
    }
  }
  return out;
}

function normalizeActionMidiDeviceIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function effectiveMidiInputDeviceIds(track: DJActionTrack, entry: ActionMapEntry): string[] {
  const row = normalizeActionMidiDeviceIds(entry.midiInputDeviceIds);
  if (row.length > 0) return row;
  const d = track.defaultMidiInputDeviceId.trim();
  return d ? [d] : [];
}

function portMatchesActionDevices(ids: string[], portId: string): boolean {
  if (ids.length === 0) return true;
  return ids.includes(portId);
}

function matchingDJActions(
  tracks: DJActionTrack[],
  portId: string,
  midiCh: number,
  midiPitch: number,
): DJMatch[] {
  const w = wireChFromNibble(midiCh);
  const out: DJMatch[] = [];
  for (const t of tracks) {
    for (const [pitchStr, entry] of Object.entries(t.actionMap)) {
      const rowPitch = Number(pitchStr);
      const wantIds = effectiveMidiInputDeviceIds(t, entry);
      const devOk = portMatchesActionDevices(wantIds, portId);
      const ch = (entry.midiInputChannel ?? 1) as ChannelId;
      const note = entry.midiInputNote ?? rowPitch;
      if (devOk && w === ch && midiPitch === note) {
        out.push({ trackId: t.id, actionPitch: rowPitch });
      }
    }
  }
  return out;
}

function pickInstrument(matches: ChannelId[], sel: TimelineTrackSelection | null): ChannelId {
  if (matches.length === 1) return matches[0]!;
  if (sel?.kind === 'channel' && matches.includes(sel.channelId)) return sel.channelId;
  return Math.min(...matches) as ChannelId;
}

function pickDJMatch(matches: DJMatch[], sel: TimelineTrackSelection | null): DJMatch {
  if (matches.length === 1) return matches[0]!;
  if (sel?.kind === 'dj') {
    const sameTrack = matches.filter((m) => m.trackId === sel.trackId);
    if (sameTrack.length === 1) return sameTrack[0]!;
  }
  return [...matches].sort(
    (a, b) => a.trackId.localeCompare(b.trackId) || a.actionPitch - b.actionPitch,
  )[0]!;
}

function resolveConflict(
  inst: ChannelId[],
  dj: DJMatch[],
  sel: TimelineTrackSelection | null,
):
  | { kind: 'channel'; channelId: ChannelId }
  | { kind: 'dj'; trackId: DJTrackId; actionPitch: number } {
  if (sel?.kind === 'channel' && inst.includes(sel.channelId)) {
    return { kind: 'channel', channelId: sel.channelId };
  }
  if (sel?.kind === 'dj') {
    const m = dj.find((x) => x.trackId === sel.trackId);
    if (m) return { kind: 'dj', trackId: m.trackId, actionPitch: m.actionPitch };
  }
  if (inst.length > 0) return { kind: 'channel', channelId: Math.min(...inst) as ChannelId };
  const picked = pickDJMatch(dj, sel);
  return { kind: 'dj', trackId: picked.trackId, actionPitch: picked.actionPitch };
}

function collectUnionDeviceIds(channels: Channel[], djTracks: DJActionTrack[]): string[] {
  const s = new Set<string>();
  for (const c of channels) {
    for (const r of c.inputSources) {
      if (r.channels.length > 0) s.add(r.inputDeviceId);
    }
  }
  for (const t of djTracks) {
    if (t.defaultMidiInputDeviceId) s.add(t.defaultMidiInputDeviceId);
    for (const e of Object.values(t.actionMap)) {
      for (const id of normalizeActionMidiDeviceIds(e.midiInputDeviceIds)) {
        s.add(id);
      }
    }
  }
  return [...s];
}

export function useMidiRecorder(): void {
  const { recording, recordingStartedAt, bpm } = useTransport();
  const {
    channels,
    djActionTracks,
    selectedTimelineTrack,
    addChannel,
    appendNote,
    appendDJActionEvent,
  } = useStage();
  const { state: runtimeState } = useMidiRuntime();
  const { status, inputs } = useMidiInputs();

  const deviceUnionKey = useMemo(() => collectUnionDeviceIds(channels, djActionTracks).sort().join('|'), [channels, djActionTracks]);

  const activeNotesRef = useRef<Map<string, ActiveNoteEntry>>(new Map());
  const pendingNotesRef = useRef<Array<{ channelId: ChannelId; note: Note }>>([]);
  const pendingDJRef = useRef<Array<{ trackId: DJTrackId; event: ActionEvent }>>([]);
  const rafIdRef = useRef<number | null>(null);
  const latestRef = useRef<LatestRef>({
    bpm,
    channels,
    djActionTracks,
    selectedTimelineTrack,
    addChannel,
    appendNote,
    appendDJActionEvent,
  });
  latestRef.current = {
    bpm,
    channels,
    djActionTracks,
    selectedTimelineTrack,
    addChannel,
    appendNote,
    appendDJActionEvent,
  };

  const fallbackInputId = inputs[0]?.id ?? null;

  useEffect(() => {
    if (!recording) return;
    if (recordingStartedAt === null) return;
    if (status !== 'granted') return;
    if (runtimeState.status !== 'granted') return;

    const access = runtimeState.access;
    const unionIds = collectUnionDeviceIds(channels, djActionTracks);
    const targetPortIds = unionIds.length > 0 ? unionIds : fallbackInputId ? [fallbackInputId] : [];

    if (targetPortIds.length === 0) return;

    const portList: MIDIInput[] = [];
    for (const id of targetPortIds) {
      const inp = access.inputs.get(id);
      if (inp) portList.push(inp);
    }
    if (portList.length === 0) return;

    const origin = recordingStartedAt;

    const flushPending = () => {
      const { appendNote: noteCb, appendDJActionEvent: djCb } = latestRef.current;
      for (const { channelId, note } of pendingNotesRef.current) {
        noteCb(channelId, note);
      }
      for (const { trackId, event } of pendingDJRef.current) {
        djCb(trackId, event);
      }
      pendingNotesRef.current = [];
      pendingDJRef.current = [];
      rafIdRef.current = null;
    };

    const scheduleFlush = () => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(flushPending);
    };

    const pushFinalized = (portId: string, midiCh: number, pitch: number, offTime: number) => {
      const key = activeKey(portId, midiCh, pitch);
      const entry = activeNotesRef.current.get(key);
      if (!entry) return;
      activeNotesRef.current.delete(key);
      const { bpm: b } = latestRef.current;
      const t = msToBeats(entry.startedAt - origin, b);
      const dur = msToBeats(offTime - entry.startedAt, b);
      if (entry.kind === 'channel') {
        pendingNotesRef.current.push({
          channelId: entry.channelId,
          note: { t, dur, pitch, vel: entry.vel },
        });
      } else {
        pendingDJRef.current.push({
          trackId: entry.trackId,
          event: {
            pitch: entry.actionPitch,
            t,
            dur,
            vel: Math.min(1, entry.vel / 127),
          },
        });
      }
      scheduleFlush();
    };

    const ensureChannelRow = (channelId: ChannelId) => {
      if (latestRef.current.channels.some((c) => c.id === channelId)) return;
      flushSync(() => {
        latestRef.current.addChannel(channelId);
      });
    };

    const openNoteOn = (portId: string, midiCh: number, pitch: number, vel: number) => {
      const {
        channels: chs,
        djActionTracks: djs,
        selectedTimelineTrack: sel,
      } = latestRef.current;
      const inst = matchingInstrumentChannels(chs, portId, midiCh);
      const dj = matchingDJActions(djs, portId, midiCh, pitch);
      const wireCh = wireChFromNibble(midiCh);
      const key = activeKey(portId, midiCh, pitch);
      const now = performance.now();

      if (inst.length === 0 && dj.length === 0) {
        ensureChannelRow(wireCh);
        activeNotesRef.current.set(key, {
          kind: 'channel',
          channelId: wireCh,
          startedAt: now,
          vel,
        });
        return;
      }

      if (inst.length >= 1 && dj.length === 0) {
        const channelId = pickInstrument(inst, sel);
        ensureChannelRow(channelId);
        activeNotesRef.current.set(key, { kind: 'channel', channelId, startedAt: now, vel });
        return;
      }

      if (dj.length >= 1 && inst.length === 0) {
        const match = pickDJMatch(dj, sel);
        activeNotesRef.current.set(key, {
          kind: 'dj',
          trackId: match.trackId,
          actionPitch: match.actionPitch,
          startedAt: now,
          vel,
        });
        return;
      }

      const resolved = resolveConflict(inst, dj, sel);
      if (resolved.kind === 'channel') {
        ensureChannelRow(resolved.channelId);
        activeNotesRef.current.set(key, {
          kind: 'channel',
          channelId: resolved.channelId,
          startedAt: now,
          vel,
        });
      } else {
        activeNotesRef.current.set(key, {
          kind: 'dj',
          trackId: resolved.trackId,
          actionPitch: resolved.actionPitch,
          startedAt: now,
          vel,
        });
      }
    };

    const attach: Array<{
      input: MIDIInput;
      prev: typeof MIDIInput.prototype.onmidimessage;
      handler: (event: MIDIMessageEvent) => void;
    }> = [];

    for (const input of portList) {
      const prev = input.onmidimessage;
      const portId = input.id;

      const handler = (event: MIDIMessageEvent) => {
        prev?.call(input, event);
        const data = event.data;
        if (!data || data.length < 1) return;
        const status0 = data[0]!;
        const nibble = status0 & 0xf0;
        const midiCh = status0 & 0x0f;

        if (nibble === 0x90) {
          const pitch = data[1] ?? 0;
          const vel = data[2] ?? 0;
          if (vel > 0) {
            openNoteOn(portId, midiCh, pitch, vel);
            return;
          }
          pushFinalized(portId, midiCh, pitch, performance.now());
          return;
        }
        if (nibble === 0x80) {
          const pitch = data[1] ?? 0;
          pushFinalized(portId, midiCh, pitch, performance.now());
          return;
        }
      };

      input.onmidimessage = handler;
      attach.push({ input, prev, handler });
    }

    return () => {
      const now = performance.now();
      for (const key of [...activeNotesRef.current.keys()]) {
        const { portId, midiCh, pitch } = parseActiveKey(key);
        pushFinalized(portId, midiCh, pitch, now);
      }
      activeNotesRef.current.clear();
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      flushPending();
      for (const { input, prev, handler } of attach) {
        if (input.onmidimessage === handler) {
          input.onmidimessage = prev;
        }
      }
    };
  }, [
    recording,
    recordingStartedAt,
    status,
    runtimeState,
    channels,
    djActionTracks,
    deviceUnionKey,
    fallbackInputId,
  ]);
}

export function MidiRecorderRunner(): null {
  useMidiRecorder();
  return null;
}
