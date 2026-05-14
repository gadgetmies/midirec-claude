## 1. Data model and stage API

- [x] 1.1 Add `midiOutputDeviceId?: string` to `OutputMapping` and extend `normalizeOutputMapping` in `src/data/dj.ts` (omit or canonicalize empty override).
- [x] 1.2 Add `defaultMidiOutputDeviceId: string` to `DJActionTrack` in `src/hooks/useDJActionTracks.ts`; seed demo tracks with `''`; thread through any constructors / snapshots.
- [x] 1.3 Expose `setDJTrackDefaultMidiOutputDevice` from `useDJActionTracks` and `useStage` (`StageState`), mirroring the input-default setter pattern.

## 2. Inspector: track-level output mapping panel

- [x] 2.1 In `Inspector.tsx` Note tab, branch on `selectedTimelineTrack?.kind === 'dj'` when `djActionSelection === null` to render the new track output mapping list (see change `specs/inspector/spec.md`).
- [x] 2.2 Implement per-row editors: MIDI output `<select>` (track default sentinel + enumerated ports), channel, pitch vs. CC visibility using the same effective CC/note rules as `ActionPanel`.
- [x] 2.3 Add styles in `Inspector.css` for the list layout (reuse `.mr-kv`, match shell tokens); ensure `data-mr-dj-selection-region` on the panel root.
- [x] 2.4 Update mutual-exclusion logic so DJ timeline track focus suppresses channel-roll Note panel while the track panel is showing (per spec).

## 3. Playback scheduler

- [x] 3.1 Refactor `src/midi/scheduler.ts` so DJ dispatch resolves the target `MIDIOutput` via row override → track default → global fallback; keep channel-roll path on the existing fallback output.
- [x] 3.2 Extend active-note / panic bookkeeping if keys must include output id so All Notes Off remains correct per device.
- [x] 3.3 Update `useMidiScheduler` to pass a port resolver backed by `useMidiRuntime` + `useMidiOutputs` instead of a single frozen output when mode is `play`.

## 4. Tests and verification

- [x] 4.1 Extend `src/midi/scheduler.test.ts` with cases for different `midiOutputDeviceId` / `defaultMidiOutputDeviceId` combinations (mock multiple outputs).
- [x] 4.2 Add or extend component tests for `Inspector` / Note tab when `selectedTimelineTrack` is DJ and `djActionSelection` is null.
- [x] 4.3 Run the full unit test suite and manually verify `demo=dj` track header selection, mapping persistence, and playback routing.
