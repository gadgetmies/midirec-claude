## 1. Scheduler module — DJ snapshot type and signature extension

- [x] 1.1 Add `DJEventSnapshot` interface in `src/midi/scheduler.ts` (a structural subset of `ActionEvent` sufficient for dispatch: `pitch`, `t`, `dur`, `vel`, `pressure?`, plus a precomputed `perPitchIndex: number`).
- [x] 1.2 Add `DJTrackSnapshot` interface: `id: DJTrackId`, `muted: boolean`, `soloed: boolean`, `mutedRows: number[]`, `soloedRows: number[]`, `actionMap: Record<number, ActionMapEntry>`, `outputMap: Record<number, OutputMapping>`, `events: DJEventSnapshot[]` (events MUST be sorted by `t` ascending — assert in dev).
- [x] 1.3 Extend `Scheduler.start(playheadMs, bpm, channels, soloing, djTracks)` and `Scheduler.tick(now, playheadMs, channels, soloing, djTracks)` signatures to accept `DJTrackSnapshot[]`. Default to `[]` for backward call sites under `useMidiScheduler` until step 4 wires real data.
- [x] 1.4 Add `djCursors: Map<DJTrackId, number>` and `atLastEmitMsByChannel: Map<number, number>` (last AT timestamp per channelByte) to `createScheduler`'s closure state. Clear both in `start()` and `panic()`.
- [x] 1.5 Add `AT_MIN_GAP_MS = 10` and `PRESSURE_AT_STATUS = 0xD0` named constants at the top of the module.

## 2. Scheduler module — DJ audibility predicates

- [x] 2.1 Add a pure helper `computeSessionAnySoloed(channels, djTracks, soloing): boolean` matching the spec predicate (`soloing || channels.some(c => c.soloed || c.rollSoloed) || djTracks.some(t => t.soloed || t.soloedRows.length > 0)`). Replace the inline `anySoloed` computation in `tick` with a call to this helper.
- [x] 2.2 Add a pure helper `isDJTrackAudible(track, sessionAnySoloed): boolean` returning `!track.muted && (!sessionAnySoloed || track.soloed || track.soloedRows.length > 0)`.
- [x] 2.3 Add a pure helper `isDJRowAudible(track, pitch, sessionAnySoloed): boolean` matching the spec predicate:
  ```ts
  !track.mutedRows.includes(pitch)
    && isDJTrackAudible(track, sessionAnySoloed)
    && (!sessionAnySoloed
        || track.soloedRows.includes(pitch)
        || (track.soloed && track.soloedRows.length === 0))
  ```

## 3. Scheduler module — DJ dispatch loop in `tick`

- [x] 3.1 In `scheduler.tick`, AFTER the existing channel-roll dispatch loop completes, add a new loop over `djTracks`. For each track, fetch its cursor (initialize via binary-search at `playheadMs / msPerBeat` if absent), advance the cursor past any past-due events.
- [x] 3.2 For each event within the lookahead window `[playheadMs, playheadMs + lookaheadMs)`: resolve `action = track.actionMap[event.pitch]` and `mapping = track.outputMap[event.pitch]`; if either is undefined, skip silently and advance the cursor.
- [x] 3.3 Compute `channelByte = (mapping.channel - 1) & 0x0F`.
- [x] 3.4 If the row is not row-audible (per `isDJRowAudible`), advance the cursor without dispatch — but advance, do not pause (matches the channel-roll non-audible advance).
- [x] 3.5 **Note envelope dispatch** (every dispatched event, regardless of mode): compute `vel = clamp(Math.round(event.vel * 127), 1, 127)`, `tsOn = max(performance.now(), now + (event.t * msPerBeat - playheadMs))`, `tsOff = max(performance.now(), now + ((event.t + event.dur) * msPerBeat - playheadMs))`. Call `output.send([0x90 | channelByte, mapping.pitch, vel], tsOn)` and `output.send([0x80 | channelByte, mapping.pitch, 0], tsOff)`. Insert into `activeNoteOns` and `channelsActivated`.
- [x] 3.6 **Pressure-mode dispatch addendum** (only when `action.pressure === true`): determine the source pressure curve — `event.pressure` when defined and non-empty, `[]` when explicitly empty (emit zero AT), `synthesizePressure(event, event.perPitchIndex)` when `undefined`. Import `synthesizePressure` from `src/data/pressure.ts`.
- [x] 3.7 For each pressure point in the curve, compute `tsAt = event.t * msPerBeat + point.t * event.dur * msPerBeat`. If `tsAt` falls in `[playheadMs, playheadMs + lookaheadMs)`: check the throttle (`atLastEmitMsByChannel.get(channelByte) ?? -Infinity` — if the candidate `tsAt` is less than the last AT + `AT_MIN_GAP_MS`, drop the point). Otherwise compute `atValue = clamp(Math.round(point.v * 127), 0, 127)`, call `output.send([PRESSURE_AT_STATUS | channelByte, atValue], max(performance.now(), now + (tsAt - playheadMs)))`, and update `atLastEmitMsByChannel.set(channelByte, tsAt)`.
- [x] 3.8 Advance the cursor past the event.

## 4. `useMidiScheduler` hook — DJ snapshot builder

- [x] 4.1 Add a pure helper `buildDJTrackSnapshots(djActionTracks): DJTrackSnapshot[]` next to `buildChannelSnapshots`. For each track: copy the fields directly except `events`, which becomes `DJEventSnapshot[]` augmented with a precomputed `perPitchIndex` (count of preceding events on the same track with the same `pitch`).
- [x] 4.2 Update `latestRef` to also carry `djTracks: DJTrackSnapshot[]`. Build on every render alongside the existing `channels` rebuild.
- [x] 4.3 Update `scheduler.start(...)` and `scheduler.tick(...)` call sites inside `useMidiScheduler` to pass `latestRef.current.djTracks`.
- [x] 4.4 Verify with `yarn typecheck`.

## 5. Cursor rebind — DJ track cursor in seek-back path

- [x] 5.1 Extend `rebindCursors(channels, playheadMs)` to also accept `djTracks: DJTrackSnapshot[]` and rebind each track's cursor by binary-search for the first event with `t * msPerBeat >= playheadMs`. Use the same `binarySearchFirstAtOrAfterT` helper (it's generic over arrays with a `t: number` field — confirm or extend type signature).
- [x] 5.2 Update both call sites of `rebindCursors` (in `start` and in `tick` for the seek-back branch) to pass djTracks.
- [x] 5.3 In `start`, after `cursors.clear()`, also call `djCursors.clear()` before the rebind pass.

## 6. Panic flush — clear DJ state

- [x] 6.1 In `scheduler.panic()`, after the existing `activeNoteOns` and `channelsActivated` flush, ALSO clear `djCursors` and `atLastEmitMsByChannel`. (No AT-zero emit per design Decision 9 — defer until manual verification surfaces a stuck-AT issue.)
- [x] 6.2 Confirm via `scheduler.test.ts`-style test that consecutive `start` → events emitted → `panic` → `start` again works with empty maps on the second start (no leftover throttle state).

## 7. Tests — `scheduler.test.ts`

- [x] 7.1 Add a `makeDJTrack(...)` test fixture builder that returns a `DJTrackSnapshot` with configurable `events`, `actionMap`, `outputMap`, mute/solo state.
- [x] 7.2 Test: note-mode event emits correct note-on (status byte, channelByte from `mapping.channel - 1`, `mapping.pitch`, scaled velocity) and matching note-off at correct timestamps.
- [x] 7.3 Test: pressure-mode event emits note envelope PLUS 14 AT messages (when curve has 14 well-spaced points).
- [x] 7.4 Test: pressure-mode event with `event.pressure === []` emits note envelope and ZERO AT messages.
- [x] 7.5 Test: pressure-mode event with three points crammed into 20ms emits AT for first and third but drops the second per throttle.
- [x] 7.6 Test: track-level muted DJ track emits zero events.
- [x] 7.7 Test: row-level muted row emits zero events; other rows in same track continue.
- [x] 7.8 Test: DJ track solo with no row solo dispatches all rows; channel-roll dispatch goes silent.
- [x] 7.9 Test: DJ row solo dispatches only the soloed row; channel-roll dispatch goes silent; other rows in same track go silent.
- [x] 7.10 Test: missing `outputMap` entry silently skips event with no toast, no console output.
- [x] 7.11 Test: missing `actionMap` entry silently skips event.
- [x] 7.12 Test: seek-back rebinds DJ cursor via binary-search; subsequent tick dispatches from the new position.
- [x] 7.13 Test: panic mid-pressure-event emits matching note-off (via `activeNoteOns`) and All-Notes-Off on the dispatched channelByte; does NOT emit `0xD0 | channelByte, 0x00`.
- [x] 7.14 Test: panic clears `djCursors` and `atLastEmitMsByChannel` such that subsequent `start` begins with empty maps.
- [x] 7.15 Test: events past the lookahead window are deferred; cursor does not advance for them.
- [x] 7.16 Test: events before the playhead are skipped; cursor advances past them.
- [x] 7.17 Test: `perPitchIndex` for the Nth event on a pitch passes `N` to `synthesizePressure` — verify by spying or by snapshotting the resulting AT values for the three known shapes.

## 8. Manual verification

- [x] 8.1 With the default seeded DJ track and an output device connected, press play → DJ note-mode events on `'transport'`/`'cue'`/`'hotcue'` rows emit note-on/note-off on the channel/pitch from `outputMap` (assumes the user has populated `outputMap` for the seeded actions; if `outputMap` is empty, manually call `setOutputMapping('dj1', 48, { device: 'global', channel: 16, pitch: 60 })` from the console first).
- [x] 8.2 With a pressure-bearing row mapped, press play → channel aftertouch (`0xD0`) streams along the event duration; the controlled synth's modulation responds.
- [x] 8.3 Mute the DJ track mid-playback → its events stop emitting within one frame; channel rolls unaffected.
- [x] 8.4 Solo one DJ row → only that row's events fire; the track's other rows are silent; all channel rolls are silent.
- [x] 8.5 Press stop mid-event → matching note-off + All-Notes-Off fire immediately; no stuck AT (confirm via the synth's modulation indicator falling to zero or staying at the last sent value without a click).
- [x] 8.6 Seek backward during play → DJ track resumes from the new playhead; no orphan note-ons left running.

## 9. Code quality + sign-off

- [x] 9.1 `yarn typecheck` clean.
- [x] 9.2 `yarn test` clean (new scheduler tests pass; existing channel-roll tests still pass unchanged).
- [x] 9.3 `openspec validate dj-action-track-playback --strict` clean.
- [x] 9.4 Update BACKLOG.md: move "DJ action track playback" entry from `## Open` to `## Done` with the archive change name and a short summary of what shipped and what stayed deferred (CC# emission, per-track output routing).
