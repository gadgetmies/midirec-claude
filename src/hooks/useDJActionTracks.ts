/* useDJActionTracks — slow-changing config state for DJ action tracks.

   NOT a MIDI capture or playback surface. See design/real-time-correctness.md:
   capture/playback timing belongs to the audio engine (Slice 10), not to React
   state. This hook only holds the track's user-configured shape — name, color,
   action map, routing, M/S flags, per-row M/S, plus optional synthetic timeline
   events when the session sets `djDemoMessages` (`demo=dj` without
   `demo=dj-empty`). Per-message MIDI events SHALL NOT flow through `setState`
   here. */

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_ACTION_MAP,
  DJ_DEVICES,
  defaultMixerOutputCc,
  normalizeActionMapEntry,
  normalizeOutputMapping,
  resolvedDjRowOutputCc,
  type ActionEvent,
  type ActionMapEntry,
  type OutputMapping,
  type PressurePoint,
} from '../data/dj';
import { beatsToSessionTicks } from '../midi/sessionTicks';
import { DEFAULT_MIDI_TPQ } from '../midi/timelineTicks';
import type { ChannelId } from './useChannels';

export type DJTrackId = string;

/* Snapshot of a CC merged cluster at the start of an edit session, used by
   `applySetDJEventDurTicks` to scale member offsets from a stable origin
   instead of from the (already-mutated) current state. Round-tripping a
   cluster span back to `spanTicks` restores members exactly only when the
   same baseline is threaded through every commit in the session. */
export interface ClusterResizeBaseline {
  /** Per-member-index baseline `tTicks` at session start. Keys are event
      indices in `track.events`. */
  memberTTicks: ReadonlyMap<number, number>;
  /** Cluster span at session start: `max(member.tTicks + member.durTicks) - t0Ticks`. */
  spanTicks: number;
  /** Trailing member's event index at session start. The same member remains
      trailing across the session even if scaling would otherwise change it. */
  trailingIdx: number;
  /** Trailing member's `durTicks` at session start. */
  trailingDurTicks: number;
}

// TODO(routing-ui-slice): expand the routing shape with pitch ranges and CC
// selectors when the routing-configuration UI is built. For Slice 7a the
// channel list is the only field we commit to.
export interface DJTrackRouting {
  channels: ChannelId[];
}

export interface DJActionTrack {
  id: DJTrackId;
  name: string;
  color: string;
  /* MIDI channel the track emits on by default (1..16). Each event with no
     `outputMap[pitch]` override emits on this channel with the row's pitch
     as the output pitch. Per-row `outputMap` entries override both channel
     and pitch when present. Mirrors the channel-roll's `Channel.id` as the
     intrinsic routing identifier — a DJ track is conceptually a channel
     that also carries pressure curves. */
  midiChannel: number;
  actionMap: Record<number, ActionMapEntry>;
  /* Per-pitch output mapping. Keyed by the input pitch (i.e. the same key
     that drives actionMap). Entries are OPTIONAL OVERRIDES — when present,
     `mapping.channel` and `mapping.pitch` override the track's defaults
     (track.midiChannel and event.pitch respectively). When absent, the
     event emits on `track.midiChannel` with `event.pitch` as the output
     pitch. */
  outputMap: Record<number, OutputMapping>;
  events: ActionEvent[];
  inputRouting: DJTrackRouting;
  outputRouting: DJTrackRouting;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
  mutedRows: number[];
  soloedRows: number[];
  /** Web MIDI port id used when an action omits `midiInputDeviceIds`. Empty = first available port at record time. */
  defaultMidiInputDeviceId: string;
  /** Web MIDI output port id for playback when a row omits `outputMap[pitch].midiOutputDeviceId`. Empty = session primary output. */
  defaultMidiOutputDeviceId: string;
}

export interface UseDJActionTracksReturn {
  djActionTracks: DJActionTrack[];
  toggleDJTrackCollapsed: (id: DJTrackId) => void;
  toggleDJTrackMuted: (id: DJTrackId) => void;
  toggleDJTrackSoloed: (id: DJTrackId) => void;
  toggleDJTrackRowMuted: (id: DJTrackId, pitch: number) => void;
  toggleDJTrackRowSoloed: (id: DJTrackId, pitch: number) => void;
  setActionEntry: (id: DJTrackId, pitch: number, entry: ActionMapEntry) => void;
  deleteActionEntry: (id: DJTrackId, pitch: number) => void;
  setOutputMapping: (id: DJTrackId, pitch: number, mapping: OutputMapping) => void;
  deleteOutputMapping: (id: DJTrackId, pitch: number) => void;
  setEventPressure: (id: DJTrackId, pitch: number, eventIdx: number, points: PressurePoint[]) => void;
  clearEventPressure: (id: DJTrackId, pitch: number, eventIdx: number) => void;
  setDJEventTTicks: (id: DJTrackId, pitch: number, eventIdx: number, nextTTicks: number) => void;
  setDJEventDurTicks: (
    id: DJTrackId,
    pitch: number,
    eventIdx: number,
    nextDurTicks: number,
    baseline?: ClusterResizeBaseline,
  ) => void;
  setDJTrackDefaultMidiInputDevice: (id: DJTrackId, inputDeviceId: string) => void;
  setDJTrackDefaultMidiOutputDevice: (id: DJTrackId, outputDeviceId: string) => void;
  appendDJActionEvent: (id: DJTrackId, event: ActionEvent) => void;
  upsertDJEvent: (id: DJTrackId, pitch: number, tTicks: number, vel: number) => void;
  removeDJEventAtTick: (id: DJTrackId, pitch: number, tTicks: number) => void;
  replaceDJEventsInRange: (
    id: DJTrackId,
    pitch: number,
    rangeStart: number,
    rangeEnd: number,
    replacements: readonly { tTicks: number; vel: number }[],
  ) => void;
  /** Only `useTimelineStorage` may call this — see app-shell spec. Replaces the
      DJ action tracks slice from a deserialised TimelinePayload. */
  hydrate: (djActionTracks: DJActionTrack[]) => void;
}

/* Demo seed (`demo=dj` or `demo=dj-empty`): same deck + mixer strips and
   action maps; synthetic events only when `includeMessages` is true. */

const DEMO_DECK1_PITCHES = [48, 56, 57, 58, 59, 89, 76] as const;
const DEMO_DECK2_PITCHES = [65, 69, 70, 78, 79, 90, 77] as const;
const DEMO_MIXER_PITCHES = [80, 81, 82, 83, 84, 85, 86, 87, 88] as const;

function sliceActionMap(pitches: readonly number[]): Record<number, ActionMapEntry> {
  const m: Record<number, ActionMapEntry> = {};
  for (const p of pitches) {
    const entry = DEFAULT_ACTION_MAP[p];
    if (entry) m[p] = entry;
  }
  return m;
}

/** Demo mixer strip: incoming routing is CC (same numbers as default playback CC). */
function mixerDemoActionMap(pitches: readonly number[]): Record<number, ActionMapEntry> {
  const m = sliceActionMap(pitches);
  const out: Record<number, ActionMapEntry> = {};
  for (const [ps, entry] of Object.entries(m)) {
    const pitch = Number(ps);
    const cc = defaultMixerOutputCc(entry.id);
    out[pitch] =
      cc === undefined
        ? normalizeActionMapEntry(entry)
        : normalizeActionMapEntry({
            ...entry,
            midiInputKind: 'cc',
            midiInputCc: cc,
          });
  }
  return out;
}

function mixerDefaultOutputMap(
  actionMap: Record<number, ActionMapEntry>,
  trackMidiChannel: number,
): Record<number, OutputMapping> {
  const out: Record<number, OutputMapping> = {};
  for (const [ps, entry] of Object.entries(actionMap)) {
    const cc = defaultMixerOutputCc(entry.id);
    if (cc === undefined) continue;
    const pitch = Number(ps);
    out[pitch] = normalizeOutputMapping({
      device: entry.device,
      channel: trackMidiChannel,
      pitch,
      cc,
    });
  }
  return out;
}

const SESSION_TPQ = DEFAULT_MIDI_TPQ;

function djEvFromBeats(pitch: number, tBeats: number, durBeats: number, vel: number): ActionEvent {
  return {
    pitch,
    tTicks: beatsToSessionTicks(tBeats, SESSION_TPQ),
    durTicks: Math.max(1, beatsToSessionTicks(durBeats, SESSION_TPQ)),
    vel,
  };
}

const SEEDED_EVENTS_DECK1: ActionEvent[] = [
  djEvFromBeats(48, 0.0, 0.1, 1.0),
  djEvFromBeats(48, 8.0, 0.1, 1.0),
  djEvFromBeats(56, 1.5, 1.5, 0.85),
  djEvFromBeats(56, 5.0, 2.0, 0.7),
  djEvFromBeats(57, 2.0, 0.4, 0.55),
  djEvFromBeats(57, 4.5, 0.4, 0.85),
  djEvFromBeats(58, 3.5, 0.35, 0.6),
  djEvFromBeats(58, 7.25, 0.35, 0.9),
  djEvFromBeats(59, 6.0, 0.35, 0.75),
  djEvFromBeats(59, 9.5, 0.35, 0.5),
  djEvFromBeats(89, 0.75, 0.12, 0.35),
  djEvFromBeats(89, 3.75, 0.12, 0.55),
  djEvFromBeats(89, 9.25, 0.12, 0.8),
  djEvFromBeats(76, 1.0, 0.15, 0.2),
  djEvFromBeats(76, 4.0, 0.15, 0.5),
  djEvFromBeats(76, 10.0, 0.15, 0.85),
];

const SEEDED_EVENTS_DECK2: ActionEvent[] = [
  djEvFromBeats(65, 0.5, 0.1, 1.0),
  djEvFromBeats(65, 9.0, 0.1, 1.0),
  djEvFromBeats(69, 2.0, 1.2, 0.8),
  djEvFromBeats(69, 6.5, 1.5, 0.72),
  djEvFromBeats(70, 1.25, 0.35, 0.6),
  djEvFromBeats(70, 5.5, 0.35, 0.88),
  djEvFromBeats(78, 3.0, 0.35, 0.7),
  djEvFromBeats(78, 8.0, 0.35, 0.92),
  djEvFromBeats(79, 4.25, 0.35, 0.55),
  djEvFromBeats(79, 11.0, 0.35, 0.78),
  djEvFromBeats(90, 1.75, 0.12, 0.4),
  djEvFromBeats(90, 6.25, 0.12, 0.6),
  djEvFromBeats(90, 10.25, 0.12, 0.88),
  djEvFromBeats(77, 2.5, 0.15, 0.35),
  djEvFromBeats(77, 7.0, 0.15, 0.65),
  djEvFromBeats(77, 10.5, 0.15, 0.95),
];

const SEEDED_EVENTS_MIXER: ActionEvent[] = [
  djEvFromBeats(80, 0.0, 2.5, 0.4),
  djEvFromBeats(80, 5.0, 2.0, 0.55),
  djEvFromBeats(80, 9.0, 2.5, 0.72),
  djEvFromBeats(81, 1.0, 0.5, 0.6),
  djEvFromBeats(81, 6.0, 0.6, 0.85),
  djEvFromBeats(82, 1.5, 0.5, 0.55),
  djEvFromBeats(82, 8.0, 0.55, 0.9),
  djEvFromBeats(83, 3.0, 0.4, 0.5),
  djEvFromBeats(84, 3.5, 0.4, 0.62),
  djEvFromBeats(85, 4.0, 0.4, 0.45),
  djEvFromBeats(86, 5.5, 0.4, 0.58),
  djEvFromBeats(87, 6.0, 0.4, 0.7),
  djEvFromBeats(88, 6.5, 0.4, 0.52),
];

const AUTOMATION_CC_STEP_DUR = 1 / 128;

const SEEDED_EVENTS_AUTOMATION_DECK1: ActionEvent[] = [
  djEvFromBeats(89, 0, 0.1, 11 / 127),
  djEvFromBeats(76, 1, 0.1, 1),
];

const SEEDED_EVENTS_AUTOMATION_DECK2: ActionEvent[] = [
  djEvFromBeats(90, 0, 0.1, 11 / 127),
  djEvFromBeats(77, 1, 0.1, 1),
  djEvFromBeats(65, 3, 0.1, 1),
];

function buildAutomationMixerEvents(): ActionEvent[] {
  const out: ActionEvent[] = [];
  for (let v = 0; v <= 127; v++) {
    const t = 4 + (v / 127) * (20 - 4);
    out.push(djEvFromBeats(81, t, AUTOMATION_CC_STEP_DUR, v / 127));
  }
  for (let v = 127; v >= 0; v--) {
    const t = 68 - (v / 127) * (68 - 34);
    out.push(djEvFromBeats(82, t, AUTOMATION_CC_STEP_DUR, v / 127));
  }
  out.push(djEvFromBeats(88, 4, AUTOMATION_CC_STEP_DUR, 0));
  for (let v = 0; v <= 63; v++) {
    const t = 26 + (v / 63) * (34 - 26);
    out.push(djEvFromBeats(88, t, AUTOMATION_CC_STEP_DUR, v / 127));
  }
  for (let v = 63; v >= 0; v--) {
    const t = 34 - (v / 63) * (34 - 26);
    out.push(djEvFromBeats(85, t, AUTOMATION_CC_STEP_DUR, v / 127));
  }
  out.sort((a, b) => (a.tTicks !== b.tTicks ? a.tTicks - b.tTicks : a.pitch - b.pitch));
  return out;
}

const SEEDED_EVENTS_AUTOMATION_MIXER: ActionEvent[] = buildAutomationMixerEvents();

function pickDemoEventSets(
  includeMessages: boolean,
  automationDemo: boolean,
): { deck1: ActionEvent[]; deck2: ActionEvent[]; mixer: ActionEvent[] } {
  if (!includeMessages) {
    return { deck1: [], deck2: [], mixer: [] };
  }
  if (automationDemo) {
    return {
      deck1: SEEDED_EVENTS_AUTOMATION_DECK1,
      deck2: SEEDED_EVENTS_AUTOMATION_DECK2,
      mixer: SEEDED_EVENTS_AUTOMATION_MIXER,
    };
  }
  return {
    deck1: SEEDED_EVENTS_DECK1,
    deck2: SEEDED_EVENTS_DECK2,
    mixer: SEEDED_EVENTS_MIXER,
  };
}

function seedDefault(includeMessages: boolean, automationDemo: boolean): DJActionTrack[] {
  const emptyRoute = { channels: [] as ChannelId[] };
  const { deck1, deck2, mixer } = pickDemoEventSets(includeMessages, automationDemo);
  const mixerAm = mixerDemoActionMap(DEMO_MIXER_PITCHES);
  const tracks: DJActionTrack[] = [
    {
      id: 'dj-deck1',
      name: 'Deck 1',
      color: DJ_DEVICES.deck1.color,
      midiChannel: 1,
      actionMap: sliceActionMap(DEMO_DECK1_PITCHES),
      outputMap: {},
      events: deck1,
      inputRouting: emptyRoute,
      outputRouting: emptyRoute,
      collapsed: false,
      muted: false,
      soloed: false,
      mutedRows: [],
      soloedRows: [],
      defaultMidiInputDeviceId: '',
      defaultMidiOutputDeviceId: '',
    },
    {
      id: 'dj-deck2',
      name: 'Deck 2',
      color: DJ_DEVICES.deck2.color,
      midiChannel: 1,
      actionMap: sliceActionMap(DEMO_DECK2_PITCHES),
      outputMap: {},
      events: deck2,
      inputRouting: emptyRoute,
      outputRouting: emptyRoute,
      collapsed: false,
      muted: false,
      soloed: false,
      mutedRows: [],
      soloedRows: [],
      defaultMidiInputDeviceId: '',
      defaultMidiOutputDeviceId: '',
    },
    {
      id: 'dj-mixer',
      name: 'Mixer',
      color: DJ_DEVICES.mixer.color,
      midiChannel: 1,
      actionMap: mixerAm,
      outputMap: mixerDefaultOutputMap(mixerAm, 1),
      events: mixer,
      inputRouting: emptyRoute,
      outputRouting: emptyRoute,
      collapsed: false,
      muted: false,
      soloed: false,
      mutedRows: [],
      soloedRows: [],
      defaultMidiInputDeviceId: '',
      defaultMidiOutputDeviceId: '',
    },
  ];
  return tracks.slice().sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

/** @internal Initial DJ demo tracks for tests (`demo=dj` seed). */
export function buildDjDemoSeedTracks(
  includeMessages: boolean,
  automationDemo = false,
): DJActionTrack[] {
  return seedDefault(includeMessages, automationDemo);
}

export function useDJActionTracks(
  djDemo: boolean = false,
  djDemoMessages: boolean = true,
  djAutomationDemo: boolean = false,
): UseDJActionTracksReturn {
  const initial = useMemo(
    () => (djDemo ? seedDefault(djDemoMessages, djAutomationDemo) : []),
    [djDemo, djDemoMessages, djAutomationDemo],
  );
  const [djActionTracks, setDJActionTracks] = useState<DJActionTrack[]>(initial);

  const flip = useCallback(
    (id: DJTrackId, field: 'collapsed' | 'muted' | 'soloed') => {
      setDJActionTracks((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], [field]: !next[idx][field] };
        return next;
      });
    },
    [],
  );

  /* Per-row toggle: flip the pitch's membership in `field` (mutedRows or
     soloedRows). No-op if the trackId is unknown OR the pitch is not a key
     in that track's actionMap. The no-op preserves referential identity
     so callers can rely on `===` checks across renders. */
  const flipRow = useCallback(
    (id: DJTrackId, field: 'mutedRows' | 'soloedRows', pitch: number) => {
      setDJActionTracks((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const track = prev[idx];
        if (!Object.prototype.hasOwnProperty.call(track.actionMap, pitch)) return prev;
        const current = track[field];
        const has = current.includes(pitch);
        const updated = has ? current.filter((p) => p !== pitch) : [...current, pitch];
        const next = prev.slice();
        next[idx] = { ...track, [field]: updated };
        return next;
      });
    },
    [],
  );

  const toggleDJTrackCollapsed = useCallback((id: DJTrackId) => flip(id, 'collapsed'), [flip]);
  const toggleDJTrackMuted = useCallback((id: DJTrackId) => flip(id, 'muted'), [flip]);
  const toggleDJTrackSoloed = useCallback((id: DJTrackId) => flip(id, 'soloed'), [flip]);
  const toggleDJTrackRowMuted = useCallback(
    (id: DJTrackId, pitch: number) => flipRow(id, 'mutedRows', pitch),
    [flipRow],
  );
  const toggleDJTrackRowSoloed = useCallback(
    (id: DJTrackId, pitch: number) => flipRow(id, 'soloedRows', pitch),
    [flipRow],
  );

  const setActionEntry = useCallback(
    (id: DJTrackId, pitch: number, entry: ActionMapEntry) => {
      setDJActionTracks((prev) => applySetActionEntry(prev, id, pitch, entry));
    },
    [],
  );

  const deleteActionEntry = useCallback((id: DJTrackId, pitch: number) => {
    setDJActionTracks((prev) => applyDeleteActionEntry(prev, id, pitch));
  }, []);

  const setOutputMapping = useCallback(
    (id: DJTrackId, pitch: number, mapping: OutputMapping) => {
      setDJActionTracks((prev) => applySetOutputMapping(prev, id, pitch, mapping));
    },
    [],
  );

  const deleteOutputMapping = useCallback((id: DJTrackId, pitch: number) => {
    setDJActionTracks((prev) => applyDeleteOutputMapping(prev, id, pitch));
  }, []);

  const setEventPressure = useCallback(
    (id: DJTrackId, pitch: number, eventIdx: number, points: PressurePoint[]) => {
      setDJActionTracks((prev) => applySetEventPressure(prev, id, pitch, eventIdx, points));
    },
    [],
  );

  const clearEventPressure = useCallback(
    (id: DJTrackId, pitch: number, eventIdx: number) => {
      setDJActionTracks((prev) => applySetEventPressure(prev, id, pitch, eventIdx, []));
    },
    [],
  );

  const setDJEventTTicks = useCallback(
    (id: DJTrackId, pitch: number, eventIdx: number, nextTTicks: number) => {
      setDJActionTracks((prev) => applySetDJEventTTicks(prev, id, pitch, eventIdx, nextTTicks));
    },
    [],
  );

  const setDJEventDurTicks = useCallback(
    (
      id: DJTrackId,
      pitch: number,
      eventIdx: number,
      nextDurTicks: number,
      baseline?: ClusterResizeBaseline,
    ) => {
      setDJActionTracks((prev) =>
        applySetDJEventDurTicks(prev, id, pitch, eventIdx, nextDurTicks, baseline),
      );
    },
    [],
  );

  const setDJTrackDefaultMidiInputDevice = useCallback((id: DJTrackId, inputDeviceId: string) => {
    setDJActionTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx]!, defaultMidiInputDeviceId: inputDeviceId };
      return next;
    });
  }, []);

  const setDJTrackDefaultMidiOutputDevice = useCallback((id: DJTrackId, outputDeviceId: string) => {
    setDJActionTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx]!, defaultMidiOutputDeviceId: outputDeviceId };
      return next;
    });
  }, []);

  const appendDJActionEvent = useCallback((id: DJTrackId, event: ActionEvent) => {
    setDJActionTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const track = prev[idx];
      const next = prev.slice();
      next[idx] = { ...track, events: [...track.events, event] };
      return next;
    });
  }, []);

  const upsertDJEvent = useCallback(
    (id: DJTrackId, pitch: number, tTicks: number, vel: number) => {
      setDJActionTracks((prev) => applyUpsertDJEvent(prev, id, pitch, tTicks, vel));
    },
    [],
  );

  const removeDJEventAtTick = useCallback((id: DJTrackId, pitch: number, tTicks: number) => {
    setDJActionTracks((prev) => applyRemoveDJEventAtTick(prev, id, pitch, tTicks));
  }, []);

  const replaceDJEventsInRange = useCallback(
    (
      id: DJTrackId,
      pitch: number,
      rangeStart: number,
      rangeEnd: number,
      replacements: readonly { tTicks: number; vel: number }[],
    ) => {
      setDJActionTracks((prev) =>
        applyReplaceDJEventsInRange(prev, id, pitch, rangeStart, rangeEnd, replacements),
      );
    },
    [],
  );

  // Only `useTimelineStorage` may dispatch this — see app-shell spec.
  const hydrate = useCallback((next: DJActionTrack[]) => {
    setDJActionTracks(next);
  }, []);

  return {
    djActionTracks,
    toggleDJTrackCollapsed,
    toggleDJTrackMuted,
    toggleDJTrackSoloed,
    toggleDJTrackRowMuted,
    toggleDJTrackRowSoloed,
    setActionEntry,
    deleteActionEntry,
    setOutputMapping,
    deleteOutputMapping,
    setEventPressure,
    clearEventPressure,
    setDJEventTTicks,
    setDJEventDurTicks,
    setDJTrackDefaultMidiInputDevice,
    setDJTrackDefaultMidiOutputDevice,
    appendDJActionEvent,
    upsertDJEvent,
    removeDJEventAtTick,
    replaceDJEventsInRange,
    hydrate,
  };
}

/* Pure: replace or insert `entry` at `pitch` on the track with the given
   id. Returns the same array reference if the id is unknown so callers can
   rely on `===` for change detection. */
export function applySetActionEntry(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  entry: ActionMapEntry,
): DJActionTrack[] {
  const idx = tracks.findIndex((t) => t.id === id);
  if (idx < 0) return tracks;
  const track = tracks[idx];
  const nextActionMap = { ...track.actionMap, [pitch]: normalizeActionMapEntry(entry) };
  const next = tracks.slice();
  next[idx] = { ...track, actionMap: nextActionMap };
  return next;
}

/* Pure: remove the pitch key from the named track's actionMap AND prune
   it from mutedRows/soloedRows + outputMap if present. No-op (returns the
   input reference) for unknown ids or already-absent pitches. */
export function applyDeleteActionEntry(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
): DJActionTrack[] {
  const idx = tracks.findIndex((t) => t.id === id);
  if (idx < 0) return tracks;
  const track = tracks[idx];
  if (!Object.prototype.hasOwnProperty.call(track.actionMap, pitch)) return tracks;
  const nextActionMap = { ...track.actionMap };
  delete nextActionMap[pitch];
  const nextOutputMap = Object.prototype.hasOwnProperty.call(track.outputMap, pitch)
    ? (() => {
        const m = { ...track.outputMap };
        delete m[pitch];
        return m;
      })()
    : track.outputMap;
  const nextMutedRows = track.mutedRows.includes(pitch)
    ? track.mutedRows.filter((p) => p !== pitch)
    : track.mutedRows;
  const nextSoloedRows = track.soloedRows.includes(pitch)
    ? track.soloedRows.filter((p) => p !== pitch)
    : track.soloedRows;
  const next = tracks.slice();
  next[idx] = {
    ...track,
    actionMap: nextActionMap,
    outputMap: nextOutputMap,
    mutedRows: nextMutedRows,
    soloedRows: nextSoloedRows,
  };
  return next;
}

/* Pure: write `mapping` to the named track's outputMap[pitch]. Returns
   the input reference for unknown ids. The pitch MAY be absent from
   actionMap (output without an input binding is a valid state, e.g.
   when the user pre-configures output before adding the action). */
export function applySetOutputMapping(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  mapping: OutputMapping,
): DJActionTrack[] {
  const idx = tracks.findIndex((t) => t.id === id);
  if (idx < 0) return tracks;
  const track = tracks[idx];
  const nextOutputMap = { ...track.outputMap, [pitch]: normalizeOutputMapping(mapping) };
  const next = tracks.slice();
  next[idx] = { ...track, outputMap: nextOutputMap };
  return next;
}

/* Pure: remove the pitch key from the named track's outputMap. Returns
   the input reference for unknown ids or already-absent pitches. */
export function applyDeleteOutputMapping(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
): DJActionTrack[] {
  const idx = tracks.findIndex((t) => t.id === id);
  if (idx < 0) return tracks;
  const track = tracks[idx];
  if (!Object.prototype.hasOwnProperty.call(track.outputMap, pitch)) return tracks;
  const nextOutputMap = { ...track.outputMap };
  delete nextOutputMap[pitch];
  const next = tracks.slice();
  next[idx] = { ...track, outputMap: nextOutputMap };
  return next;
}

/* Pure: write `points` to `track.events[eventIdx].pressure` when the event
   exists AND its pitch matches the supplied pitch. No-op (returns the
   input reference) for unknown track ids, out-of-range eventIdx, or pitch
   mismatches — same conventions as the other apply* helpers. */
export function applySetEventPressure(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  eventIdx: number,
  points: PressurePoint[],
): DJActionTrack[] {
  const trackIdx = tracks.findIndex((t) => t.id === id);
  if (trackIdx < 0) return tracks;
  const track = tracks[trackIdx];
  if (eventIdx < 0 || eventIdx >= track.events.length) return tracks;
  const event = track.events[eventIdx];
  if (event.pitch !== pitch) return tracks;
  const nextEvent: ActionEvent = { ...event, pressure: points };
  const nextEvents = track.events.slice();
  nextEvents[eventIdx] = nextEvent;
  const next = tracks.slice();
  next[trackIdx] = { ...track, events: nextEvents };
  return next;
}

/* Pure: upsert a single event on `(id, pitch)` keyed by `tTicks`.
   - If an existing event on the row has `tTicks === target`, replace its
     `vel` (preserving its `durTicks` and `pressure`).
   - Otherwise append a new event `{ pitch, tTicks, durTicks: 0, vel }`.

   No-op (returns the input reference) for unknown track ids. */
export function applyUpsertDJEvent(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  tTicks: number,
  vel: number,
): DJActionTrack[] {
  const trackIdx = tracks.findIndex((t) => t.id === id);
  if (trackIdx < 0) return tracks;
  const track = tracks[trackIdx];
  const clampedTicks = Math.max(0, Math.round(tTicks));
  const clampedVel = Math.max(0, Math.min(1, vel));
  const existingIdx = track.events.findIndex(
    (ev) => ev.pitch === pitch && ev.tTicks === clampedTicks,
  );
  const nextEvents = track.events.slice();
  if (existingIdx >= 0) {
    const existing = nextEvents[existingIdx];
    if (existing.vel === clampedVel) return tracks;
    nextEvents[existingIdx] = { ...existing, vel: clampedVel };
  } else {
    nextEvents.push({ pitch, tTicks: clampedTicks, durTicks: 0, vel: clampedVel });
  }
  const next = tracks.slice();
  next[trackIdx] = { ...track, events: nextEvents };
  return next;
}

/* Pure: remove every event on `(id, pitch)` whose `tTicks === target`.
   Right-click delete in the value editor uses this to clear a single cell.
   No-op for unknown track ids or when the row has no event at `target`. */
export function applyRemoveDJEventAtTick(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  tTicks: number,
): DJActionTrack[] {
  const trackIdx = tracks.findIndex((t) => t.id === id);
  if (trackIdx < 0) return tracks;
  const track = tracks[trackIdx];
  const target = Math.round(tTicks);
  const filtered = track.events.filter((ev) => !(ev.pitch === pitch && ev.tTicks === target));
  if (filtered.length === track.events.length) return tracks;
  const next = tracks.slice();
  next[trackIdx] = { ...track, events: filtered };
  return next;
}

/* Pure: replace every event on `(id, pitch)` with `tTicks` in the inclusive
   range `[rangeStart, rangeEnd]` with the given `replacements`. Events on
   other pitches or outside the range are left untouched. `replacements` are
   appended as new ActionEvent rows with `durTicks: 0`. Used by:
   - Shift-click interpolation (write interp cells + clear off-grid in range)
   - Bulk-op chips Smooth / Flatten (replace in-range with 16 cells)
   - Bulk-op chip Clear (empty replacements)

   No-op for unknown track ids; rangeStart > rangeEnd is normalized. */
export function applyReplaceDJEventsInRange(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  rangeStart: number,
  rangeEnd: number,
  replacements: readonly { tTicks: number; vel: number }[],
): DJActionTrack[] {
  const trackIdx = tracks.findIndex((t) => t.id === id);
  if (trackIdx < 0) return tracks;
  const track = tracks[trackIdx];
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  const filtered = track.events.filter(
    (ev) => !(ev.pitch === pitch && ev.tTicks >= lo && ev.tTicks <= hi),
  );
  const appended = replacements.map((r) => ({
    pitch,
    tTicks: Math.max(0, Math.round(r.tTicks)),
    durTicks: 0,
    vel: Math.max(0, Math.min(1, r.vel)),
  }));
  /* Avoid producing a new reference when nothing changed (empty range with
     no events to remove and no replacements to insert). */
  if (filtered.length === track.events.length && appended.length === 0) {
    return tracks;
  }
  const next = tracks.slice();
  next[trackIdx] = { ...track, events: [...filtered, ...appended] };
  return next;
}

/** Merge consecutive CC lane events on the same pitch when their starts are within this many beats. */
export const CC_GROUP_MAX_START_GAP_BEATS = 1;
export const CC_GROUP_MAX_START_GAP_TICKS = beatsToSessionTicks(
  CC_GROUP_MAX_START_GAP_BEATS,
  DEFAULT_MIDI_TPQ,
);

export interface CcMergedGroup {
  pitch: number;
  /** `track.events` index of the chronologically first message in the cluster (click + selection anchor). */
  representativeIdx: number;
  memberIndices: number[];
  t0: number;
  dur: number;
}

/* Group consecutive CC-output events per pitch into merged clusters whose
   `tTicks` starts are within `maxStartGapTicks`. Returned map is keyed by
   each member's original `track.events` index so callers can look up cluster
   membership without re-scanning. */
export function buildCcMergedGroupsByMemberIndex(
  track: DJActionTrack,
  maxStartGapTicks: number = CC_GROUP_MAX_START_GAP_TICKS,
): Map<number, CcMergedGroup> {
  const out = new Map<number, CcMergedGroup>();
  const byPitch = new Map<number, { idx: number; ev: ActionEvent }[]>();

  for (let i = 0; i < track.events.length; i++) {
    const ev = track.events[i];
    if (!Object.prototype.hasOwnProperty.call(track.actionMap, ev.pitch)) continue;
    if (resolvedDjRowOutputCc(track.actionMap, track.outputMap, ev.pitch) === undefined) continue;
    const list = byPitch.get(ev.pitch) ?? [];
    list.push({ idx: i, ev });
    byPitch.set(ev.pitch, list);
  }

  for (const [pitch, items] of byPitch) {
    items.sort((a, b) => a.ev.tTicks - b.ev.tTicks);
    let cluster: { idx: number; ev: ActionEvent }[] = [];

    const flush = () => {
      if (cluster.length === 0) return;
      const t0Ticks = cluster[0].ev.tTicks;
      const tEndTicks = Math.max(...cluster.map((x) => x.ev.tTicks + x.ev.durTicks));
      const memberIndices = cluster.map((c) => c.idx);
      const representativeIdx = cluster[0].idx;
      const group: CcMergedGroup = {
        pitch,
        representativeIdx,
        memberIndices,
        t0: t0Ticks / DEFAULT_MIDI_TPQ,
        dur: Math.max(0, (tEndTicks - t0Ticks) / DEFAULT_MIDI_TPQ),
      };
      for (const idx of memberIndices) {
        out.set(idx, group);
      }
      cluster = [];
    };

    for (const item of items) {
      if (cluster.length === 0) {
        cluster.push(item);
      } else {
        const prevStart = cluster[cluster.length - 1].ev.tTicks;
        if (item.ev.tTicks - prevStart < maxStartGapTicks) {
          cluster.push(item);
        } else {
          flush();
          cluster = [item];
        }
      }
    }
    flush();
  }

  return out;
}

/* Pure: update the start tick of the DJ event at `(id, pitch, eventIdx)` to
   `nextTTicks` (clamped to >= 0). When the referenced event belongs to a
   merged CC cluster (same row + within the start-gap threshold), every
   member of that cluster SHALL be shifted by the same `deltaTicks` so the
   strip moves as a unit. No-op (returns the input reference) for unknown
   track ids, out-of-range eventIdx, or pitch mismatches.

   Pressure samples are stored normalized to [0,1] of the event's duration
   (`PressurePoint.t` in `src/data/dj.ts`), so they survive `tTicks` shifts
   without re-mapping; no per-sample translation is needed. */
export function applySetDJEventTTicks(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  eventIdx: number,
  nextTTicks: number,
): DJActionTrack[] {
  const trackIdx = tracks.findIndex((t) => t.id === id);
  if (trackIdx < 0) return tracks;
  const track = tracks[trackIdx];
  if (eventIdx < 0 || eventIdx >= track.events.length) return tracks;
  const event = track.events[eventIdx];
  if (event.pitch !== pitch) return tracks;
  const clamped = Math.max(0, Math.round(nextTTicks));
  const deltaTicks = clamped - event.tTicks;
  if (deltaTicks === 0) return tracks;

  const ccGroups = buildCcMergedGroupsByMemberIndex(track);
  const group = ccGroups.get(eventIdx);
  const memberSet =
    group && group.representativeIdx === eventIdx ? new Set(group.memberIndices) : null;

  const nextEvents = track.events.slice();
  if (memberSet) {
    for (const idx of memberSet) {
      const member = nextEvents[idx];
      nextEvents[idx] = { ...member, tTicks: Math.max(0, member.tTicks + deltaTicks) };
    }
  } else {
    nextEvents[eventIdx] = { ...event, tTicks: clamped };
  }

  const next = tracks.slice();
  next[trackIdx] = { ...track, events: nextEvents };
  return next;
}

/* Pure: update the duration tick of the DJ event at `(id, pitch, eventIdx)`
   to `nextDurTicks` (clamped to >= 1).

   Single event (non-clustered, or a cluster member that is NOT the cluster
   representative): set only the referenced event's `durTicks`. Pressure
   samples are normalized [0,1] of duration (see `src/data/dj.ts`) and
   therefore survive `durTicks` changes without re-mapping.

   Cluster representative (CC merged group with ≥ 2 members): treat
   `nextDurTicks` as the new total span. Pin `t0Ticks = representative.tTicks`,
   scale each member's offset from t0Ticks by (newSpan/oldSpan) and recompute
   the trailing member's `durTicks` so the cluster ends exactly at
   `t0Ticks + newSpanTicks`. Non-trailing members keep their `durTicks`.

   No-op (returns the input reference) for unknown track ids, out-of-range
   eventIdx, pitch mismatches, or when the computed change is zero. */
export function applySetDJEventDurTicks(
  tracks: DJActionTrack[],
  id: DJTrackId,
  pitch: number,
  eventIdx: number,
  nextDurTicks: number,
  baseline?: ClusterResizeBaseline,
): DJActionTrack[] {
  const trackIdx = tracks.findIndex((t) => t.id === id);
  if (trackIdx < 0) return tracks;
  const track = tracks[trackIdx];
  if (eventIdx < 0 || eventIdx >= track.events.length) return tracks;
  const event = track.events[eventIdx];
  if (event.pitch !== pitch) return tracks;

  const ccGroups = buildCcMergedGroupsByMemberIndex(track);
  const group = ccGroups.get(eventIdx);
  const isRepresentative = group && group.representativeIdx === eventIdx;

  if (!isRepresentative) {
    const clamped = Math.max(1, Math.round(nextDurTicks));
    if (clamped === event.durTicks) return tracks;
    const nextEvents = track.events.slice();
    nextEvents[eventIdx] = { ...event, durTicks: clamped };
    const next = tracks.slice();
    next[trackIdx] = { ...track, events: nextEvents };
    return next;
  }

  // Cluster representative branch.
  const t0Ticks = event.tTicks;
  const newSpanTicks = Math.max(1, Math.round(nextDurTicks));

  /* Baseline-relative scaling: scale offsets from the captured originals so
     successive commits never accumulate rounding error. The session owner
     (the Inspector) holds the baseline across all commits until selection
     changes; that's what makes shrink-then-restore exact. When the baseline's
     member set matches the current cluster we use this path. */
  const baselineMembersValid =
    baseline !== undefined &&
    baseline.memberTTicks.size === group.memberIndices.length &&
    group.memberIndices.every((idx) => baseline.memberTTicks.has(idx));

  if (baselineMembersValid && baseline) {
    const baselineSpan = Math.max(1, baseline.spanTicks);
    const scale = newSpanTicks / baselineSpan;
    const trailingIdx = group.memberIndices.includes(baseline.trailingIdx)
      ? baseline.trailingIdx
      : group.memberIndices[group.memberIndices.length - 1];

    const projected = new Map<number, { tTicks: number; durTicks: number }>();
    for (const idx of group.memberIndices) {
      const ev = track.events[idx];
      const baseT = baseline.memberTTicks.get(idx)!;
      const offset = Math.round((baseT - t0Ticks) * scale);
      const newTTicks = t0Ticks + offset;
      const newDurTicks =
        idx === trailingIdx ? Math.max(1, t0Ticks + newSpanTicks - newTTicks) : ev.durTicks;
      projected.set(idx, { tTicks: newTTicks, durTicks: newDurTicks });
    }

    // No-op when every member's current state already matches the projection.
    let alreadyMatches = true;
    for (const idx of group.memberIndices) {
      const ev = track.events[idx];
      const p = projected.get(idx)!;
      if (ev.tTicks !== p.tTicks || ev.durTicks !== p.durTicks) {
        alreadyMatches = false;
        break;
      }
    }
    if (alreadyMatches) return tracks;

    const nextEvents = track.events.slice();
    for (const idx of group.memberIndices) {
      const ev = track.events[idx];
      const p = projected.get(idx)!;
      nextEvents[idx] = { ...ev, tTicks: p.tTicks, durTicks: p.durTicks };
    }
    const next = tracks.slice();
    next[trackIdx] = { ...track, events: nextEvents };
    return next;
  }

  // Fallback: scale from current state (legacy behavior — may drift across
  // round-trips; callers should pass a baseline to avoid it).
  const members = group.memberIndices.map((idx) => ({ idx, ev: track.events[idx] }));
  let trailingIdx = members[0].idx;
  let oldEndTicks = members[0].ev.tTicks + members[0].ev.durTicks;
  for (const m of members) {
    const end = m.ev.tTicks + m.ev.durTicks;
    if (end > oldEndTicks) {
      oldEndTicks = end;
      trailingIdx = m.idx;
    }
  }
  const oldSpanTicks = oldEndTicks - t0Ticks;
  if (newSpanTicks === oldSpanTicks) return tracks;
  const scale = oldSpanTicks > 0 ? newSpanTicks / oldSpanTicks : 1;

  const nextEvents = track.events.slice();
  for (const m of members) {
    const offset =
      oldSpanTicks > 0 ? Math.round((m.ev.tTicks - t0Ticks) * scale) : m.ev.tTicks - t0Ticks;
    const newTTicks = t0Ticks + offset;
    const newDurTicks =
      m.idx === trailingIdx ? Math.max(1, t0Ticks + newSpanTicks - newTTicks) : m.ev.durTicks;
    nextEvents[m.idx] = { ...m.ev, tTicks: newTTicks, durTicks: newDurTicks };
  }

  const next = tracks.slice();
  next[trackIdx] = { ...track, events: nextEvents };
  return next;
}

/* True iff any dj-action-track has the track-level solo OR any per-row
   solo set. Both contribute to the session-wide `soloing` flag — see
   design/real-time-correctness.md is unaffected (this is config state). */
export function anyDJTrackSoloed(djActionTracks: DJActionTrack[]): boolean {
  return djActionTracks.some((t) => t.soloed || t.soloedRows.length > 0);
}

/* Track-level audibility — used by AppShell to set `data-audible` on the
   dj-action-track wrapper. Returns true iff there's no session-wide solo,
   OR this track contributes to the solo (track-level OR a row inside it). */
export function isDJTrackAudible(track: DJActionTrack, anySoloed: boolean): boolean {
  if (!anySoloed) return true;
  return track.soloed || track.soloedRows.length > 0;
}

/* Row-level audibility — used by ActionRoll to set `data-audible` on each
   `.mr-djtrack__lane`. Predicate from openspec/changes/dj-action-body/specs.

   Cases (assuming the row is not muted):
   - No session-wide solo: audible.
   - Row is soloed: audible.
   - Track is soloed AND no rows in this track are soloed: audible (the
     track's solo bubbles down to all its rows).
   - Otherwise: silent. */
export function isDJRowAudible(
  track: DJActionTrack,
  pitch: number,
  soloing: boolean,
): boolean {
  if (track.mutedRows.includes(pitch)) return false;
  if (!soloing) return true;
  if (track.soloedRows.includes(pitch)) return true;
  if (track.soloed && track.soloedRows.length === 0) return true;
  return false;
}
