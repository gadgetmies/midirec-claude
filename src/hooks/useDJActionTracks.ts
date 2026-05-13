/* useDJActionTracks — slow-changing config state for DJ action tracks.

   NOT a MIDI capture or playback surface. See design/real-time-correctness.md:
   capture/playback timing belongs to the audio engine (Slice 10), not to React
   state. This hook only holds the track's user-configured shape — name, color,
   action map, routing, M/S flags, per-row M/S, plus a synthetic events array
   for visual demo. Per-message MIDI events SHALL NOT flow through `setState`
   here. */

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_ACTION_MAP,
  DJ_DEVICES,
  type ActionEvent,
  type ActionMapEntry,
  type OutputMapping,
  type PressurePoint,
} from '../data/dj';
import type { ChannelId } from './useChannels';

export type DJTrackId = string;

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
  setDJTrackDefaultMidiInputDevice: (id: DJTrackId, inputDeviceId: string) => void;
  appendDJActionEvent: (id: DJTrackId, event: ActionEvent) => void;
}

/* The track's `actionMap` is the set of actions CONFIGURED on this track —
   not the full catalog of available actions. `DEFAULT_ACTION_MAP` (from
   src/data/dj.ts) is the picker source for the future routing UI; users
   add entries from there into a track's actionMap.

   Default seed: 6 actions spanning 3 devices, chosen to exercise all three
   render modes plus the fallback. The keys column shows each action's
   `short` (PLAY, CUE, HC1, HC2, ON, X◀) — never `label` — so the row
   identity fits in the 56px keys width without truncation. The full
   `label` appears as a browser tooltip via `title`.
   - 48 Play / Pause (PLAY) → trigger (transport, no pad, no pressure)
   - 49 Cue          (CUE)  → trigger (cue, no pad, no pressure)
   - 56 Hot Cue 1    (HC1)  → pressure-bearing (pressure: true)
   - 57 Hot Cue 2    (HC2)  → velocity-sensitive (pad: true, no pressure)
   - 60 FX 1 On      (ON)   → fallback (fx, no pad, no pressure)
   - 71 Crossfade ◀  (X◀)  → fallback (mixer, no pad, no pressure)

   Synthetic events are deterministic, scoped to musical bars 1–4, and
   density-tuned to make the rendering modes visible without crowding. The
   audio engine (Slice 10) does not consume this field; routing-derived
   events from channel-track notes will replace it in a later slice. */
const SEEDED_PITCHES = [48, 49, 56, 57, 60, 71];

const SEEDED_EVENTS: ActionEvent[] = [
  // 48 Play / Pause — trigger blips at bar 1 and bar 3.
  { pitch: 48, t: 0.0, dur: 0.1, vel: 1.0 },
  { pitch: 48, t: 8.0, dur: 0.1, vel: 1.0 },
  // 49 Cue — trigger hits before each Play.
  { pitch: 49, t: 7.5, dur: 0.1, vel: 0.9 },
  { pitch: 49, t: 11.5, dur: 0.1, vel: 0.9 },
  // 56 Hot Cue 1 (HC1) — pressure-bearing, two longer events with rich curves.
  { pitch: 56, t: 1.5, dur: 1.5, vel: 0.85 },
  { pitch: 56, t: 5.0, dur: 2.0, vel: 0.7 },
  // 57 Hot Cue 2 (HC2) — velocity-sensitive pad, four hits with varied velocity.
  { pitch: 57, t: 2.0, dur: 0.4, vel: 0.55 },
  { pitch: 57, t: 4.5, dur: 0.4, vel: 0.85 },
  { pitch: 57, t: 7.0, dur: 0.4, vel: 0.7 },
  { pitch: 57, t: 10.5, dur: 0.4, vel: 0.95 },
  // 60 FX 1 On (ON) — fallback bars showing on/off states.
  { pitch: 60, t: 3.0, dur: 1.5, vel: 0.8 },
  { pitch: 60, t: 9.0, dur: 2.0, vel: 0.8 },
  // 71 Crossfade ◀ (X◀) — fallback, longer fade-style bar.
  { pitch: 71, t: 6.0, dur: 3.0, vel: 0.8 },
];

function seedDefault(): DJActionTrack[] {
  const seededActionMap: Record<number, ActionMapEntry> = {};
  for (const p of SEEDED_PITCHES) {
    const entry = DEFAULT_ACTION_MAP[p];
    if (entry) seededActionMap[p] = entry;
  }
  return [
    {
      id: 'dj1',
      name: 'DJ',
      color: DJ_DEVICES.global.color,
      midiChannel: 16,
      actionMap: seededActionMap,
      outputMap: {},
      events: SEEDED_EVENTS,
      inputRouting: { channels: [] },
      outputRouting: { channels: [] },
      collapsed: false,
      muted: false,
      soloed: false,
      mutedRows: [],
      soloedRows: [],
      defaultMidiInputDeviceId: '',
    },
  ];
}

export function useDJActionTracks(djDemo: boolean = false): UseDJActionTracksReturn {
  const initial = useMemo(() => (djDemo ? seedDefault() : []), [djDemo]);
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

  const setDJTrackDefaultMidiInputDevice = useCallback((id: DJTrackId, inputDeviceId: string) => {
    setDJActionTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx]!, defaultMidiInputDeviceId: inputDeviceId };
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
    setDJTrackDefaultMidiInputDevice,
    appendDJActionEvent,
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
  const nextActionMap = { ...track.actionMap, [pitch]: entry };
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
  const nextOutputMap = { ...track.outputMap, [pitch]: mapping };
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
