## 1. Data model and defaults

- [x] 1.1 Extend `OutputMapping` in `src/data/dj.ts` with optional `cc?: number` (document semantics; clamp `0..127` in stage setters).
- [x] 1.2 Extend `ActionMapEntry` with optional `midiInputCc?: number` (same clamping on write).
- [x] 1.3 Add default CC numbers for mixer template actions (`xfade_pos`, channel volumes, EQ bands) either in `DEFAULT_ACTION_MAP` companion metadata or seed/migration helpers per `design.md`.

## 2. Recorder (input CC)

- [x] 2.1 Extend `matchingDJActions` (or parallel `matchingDJCc`) in `src/midi/recorder.ts` to match inbound CC against `midiInputCc` + channel + port scope; exclude rows with `midiInputCc` from the note-only path.
- [x] 2.2 Implement CC-to-`ActionEvent` conversion (velocity from CC value, beat timing) with deterministic pairing rules; add focused tests.

## 3. Scheduler (output CC)

- [x] 3.1 Branch `resolveDJEmit` / dispatch in `src/midi/scheduler.ts`: when `outputMap[pitch]?.cc != null`, emit `0xB0|ch, cc, value` at event start (`value` from `vel`, allow `0`); do not enqueue `activeNoteOns` for these events.
- [x] 3.2 Keep unified loop invariant from `midi-playback` delta (same-output helper family); extend `scheduler.test.ts` for CC vs note paths and velocity edge cases.

## 4. UI

- [x] 4.1 `InputMappingPanel`: add **`MIDI in · CC`** control wired to `midiInputCc`; clear omits field; preserve through `setActionEntry` merges per spec.
- [x] 4.2 `Inspector` `ActionPanel`: add **`CC#`** output row wired to `outputMap[pitch].cc`; clamp `0..127`; merge with `setOutputMapping`; show for mixer/CC-backed rows per design.

## 5. Hooks and persistence

- [x] 5.1 Ensure `setOutputMapping` / `setActionEntry` in `useDJActionTracks` persist new fields; session load tolerates old data without `cc` / `midiInputCc`.

## 6. Verification

- [x] 6.1 Update or add unit tests covering recorder + scheduler + hook reducers for CC paths.
- [ ] 6.2 Manual smoke: mixer row plays CC to IAC/virtual monitor; Map Note + Inspector round-trip values.
