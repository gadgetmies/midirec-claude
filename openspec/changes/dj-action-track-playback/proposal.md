## Why

The just-archived `play-channel-notes` slice closed the channel-roll → output loop, but DJ action tracks remain mute. They render in the timeline, the playhead crosses them, each pitch carries an `ActionMapEntry` and (when configured) an `OutputMapping` — yet the scheduler ignores them entirely. To make DJ action tracks audible the scheduler needs to walk `useStage().djActionTracks` alongside `state.channels` and emit MIDI per each row's `outputMap[pitch]`. Surfaced during manual verification of `play-channel-notes`: user noticed DJ tracks have no playback cursor and emit no MIDI.

- The scheduler at `src/midi/scheduler.ts` SHALL use a SINGLE unified dispatch loop that walks every playable source (channel-rolls AND DJ action tracks) in the same iteration. No parallel pipelines. Every MIDI byte emission flows through one internal `emitNoteEvent` helper that handles `output.send` for note-on/note-off, updates `activeNoteOns` and `channelsActivated`, and emits the optional channel-aftertouch curve.
- The `DJActionTrack` data shape gains a new field `midiChannel: number` (range `1..16`) — the track's intrinsic output channel byte. This mirrors how `Channel.id` is a channel-roll's intrinsic channel byte. The default seeded track is `midiChannel: 16` (DJ convention).
- New `DJTrackSnapshot` shape is built by `useMidiScheduler` from `useStage().djActionTracks` and fed into `scheduler.start` / `scheduler.tick` alongside the existing `ChannelSnapshot[]`. Each snapshot carries everything dispatch needs: `midiChannel`, track-level mute/solo, row-level mute/solo, events sorted by `t`, the per-pitch `OutputMapping` overrides, and the per-event `pressure` (or `undefined` to use `synthesizePressure`).
- DJ row audibility composition: a row's events SHALL emit IFF `trackAudible(track, soloing) && !track.mutedRows.includes(pitch) && rowSoloPasses` — matching the `rowAudible` predicate already defined in the `dj-action-tracks` spec's "Row audibility model" requirement. The session-wide `sessionAnySoloed` flag now includes DJ-track and DJ-row solo state, so soloing any DJ entity silences un-soloed channel-rolls (matching the rendered `data-audible="false"` rule).
- For events on an audible row, the scheduler emits MIDI in one of two modes based on the row's `actionMap[event.pitch]`:
  - **note-mode** (`action.pressure !== true`): emit note-on/note-off via the shared `emitNoteEvent` helper. Channel resolution: `channel = outputMap[event.pitch]?.channel ?? track.midiChannel`. Output pitch resolution: `pitch = outputMap[event.pitch]?.pitch ?? event.pitch`. Velocity: `Math.min(127, Math.max(1, Math.round(event.vel * 127)))`. So **without any `outputMap` configuration, DJ events emit by default on `track.midiChannel` with their row's pitch as the MIDI note** — analogous to how a channel-roll note emits on `Channel.id` with `Note.pitch` as the MIDI note.
  - **pressure-mode** (`action.pressure === true`): same envelope dispatch (with the same channel/pitch fallbacks), PLUS a sequence of channel-aftertouch messages `output.send([0xD0 | channelByte, atValue], tsAt)` sampling the event's pressure curve along the event's duration. Source curve: `event.pressure` when defined and non-empty, `[]` when explicitly cleared (no AT messages), or `synthesizePressure(event, perPitchIndex)` when `undefined`. Sample cadence is decided in `design.md`.
- `outputMap[event.pitch]` becomes an OPTIONAL OVERRIDE. When present, both fields (`channel` and `pitch`) override the defaults; when absent, the track-level defaults apply. There is no longer a "configured but not wired" silent-skip state — DJ tracks emit out-of-the-box.
- Events whose `pitch` is NOT a key in `track.actionMap` SHALL still be silently skipped (matches the renderer's filter behavior — these are stale events from earlier action-deletions).
- The `activeNoteOns` map keyed by `(outputId, channelByte, pitch)` absorbs DJ note-ons without schema change — panic-on-stop covers them via the existing flush path. The `channelsActivated` set also absorbs DJ channelBytes without change, so All-Notes-Off fires per activated channel exactly as today.
- Channel-aftertouch messages are stateless from the synth's perspective; panic SHALL NOT emit any explicit AT-reset on stop. (No spec change to the existing panic requirement.)
- DJ tracks share the same single `outputSnapshot` as channel-rolls — `useMidiOutputs().outputs[0]` at play-time. The `OutputMapping.device` field (a `DeviceId` like `'deck1'`/`'global'`) is NOT used for real output routing in this slice; it remains label/color metadata. Per-track real-output routing is a separate backlog entry.
- Seek-back cursor rebinding extends to all sources uniformly: on non-monotonic playhead jumps the scheduler SHALL binary-search each source's events array for the first event whose `t * msPerBeat >= playheadMs`. The cursor key is per-source (`'ch:<id>'` for channel-rolls, `'dj:<id>'` for DJ tracks) and stored in one shared `Map<string, number>`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `midi-playback`: gain new requirements for the unified dispatch loop and DJ-side note/pressure emission. The existing channel-roll requirements ("Scheduler respects mute and solo composition") are MODIFIED to include DJ-track/row solo in the session-wide solo flag.
- `dj-action-tracks`: MODIFIED to add the `midiChannel: number` field (range `1..16`) to `DJActionTrack`. The default seed sets `midiChannel: 16`. No new actions on the hook surface (no setter for `midiChannel` in this slice — the editor is a future entry; the seeded value is the only value today).

## Impact

- `src/midi/scheduler.ts`: scheduler `tick` / `start` / `panic` signatures grow to accept DJ track snapshots. Internal dispatch loop gains a parallel walk over DJ tracks. New per-DJ-track cursor map and new aftertouch sample-emit subroutine. Module grows from ~280 LOC to an estimated ~450 LOC.
- `src/midi/scheduler.test.ts`: new tests for DJ note-mode dispatch, pressure-mode AT-sampling, row mute, row solo, mid-event seek into a pressure region, panic mid-pressure-event, missing `outputMap` entry, missing `actionMap` entry.
- `useMidiScheduler` (the React hook in `src/midi/scheduler.ts`): builds `DJTrackSnapshot[]` from `useStage().djActionTracks` and threads it into `start` / `tick` calls. No new stage hook surface.
- `useStage` / `useDJActionTracks`: no API change. The scheduler reads existing state.
- `useTransport`, `useChannels`, `useMidiRuntime`, `useMidiOutputs`, `useToast`: no changes.
- Performance: DJ track walks add one cursor scan per track per tick (current default: 1 track). Each event in the lookahead window adds up to `ceil(durMs / cadenceMs)` aftertouch sends for pressure-bearing rows (typically 0–10 messages per event in a 100ms window). The Web MIDI API's `output.send` is fire-and-forget; the bottleneck is in-frame work, not bandwidth.
- No data migration. No file format change. No UI change. No CSS change. The user observation that "DJ tracks are mute" simply stops being true after this slice ships.
