## 1. Data model + target registry (`src/midi/controlMap.ts`)

- [x] 1.1 Write `controlMap.test.ts` covering source matching (port-specific vs `anyPort`) and the `matchesActiveMapping` predicate
- [x] 1.2 Define types (`TargetKind`, `TargetKey`, `ControlSource`, `ControlMapping`, `ControlMapState`) and per-kind defaults
- [x] 1.3 Build the static target registry (`key`, `label`, `kind`, `dispatch`, `stateSelector`) for all targets incl. `phraseForward`/`phraseBack`
- [x] 1.4 Implement source matching + `matchesActiveMapping(message, state)` (System Real-Time bytes never match); make 1.1 pass
- [x] 1.5 Write + implement advanced-rule helpers with tests: edge/threshold, button mode (toggle/momentary), continuous absolute scaling, soft-takeover, relative-encoder decode (common encodings), enum cycle/select, phrase-bar math
- [x] 1.6 Write + implement conflict resolution (reassign source from one target to another)

## 2. Global mapping store (`src/hooks/useControlMapStore.tsx`)

- [x] 2.1 Write store tests (fake-indexeddb): persistence round-trip, empty-by-default, survives session load
- [x] 2.2 Implement the store with its own versioned persistence key, loaded at app start, independent of `TimelinePayload`
- [x] 2.3 Write + implement JSON export (serialize `ControlMapState`) and import (validate `version`, migrate, replace); add a version-migration test
- [x] 2.4 Implement absent-port retention (imported/stored mappings load inactive until ports appear)

## 3. Transport additions (`src/hooks/useTransport`)

- [x] 3.1 Write `useTransport` tests for phrase-jump (forward by N bars snapped to bar; back clamps at 0) and `setBpm` honoring `clockSource`
- [x] 3.2 Add phrase-jump actions (configurable bars-per-phrase) computing seek from `bpm`/`sig`
- [x] 3.3 Add the internal-clock-only BPM set path (no-op + hint while slaved to external clock)

## 4. Control receiver (`src/midi/MidiControlProvider.tsx`, `useMidiControl`)

- [x] 4.1 Write receiver tests: synthetic `MIDIInput` events dispatch the correct registry action; map-mode suppresses triggers; learn captures source
- [x] 4.2 Implement the always-on listener attaching to all granted inputs, parsing via `midiLearn`
- [x] 4.3 Wire match → advanced-rule application → registry `dispatch` for live (non-map) mode
- [x] 4.4 Implement map-mode behavior: suppress triggers/recording, arm a target, capture next qualifying message, reassign-on-conflict with toast

## 5. Recorder consumption (`src/midi/recorder.ts`)

- [x] 5.1 Add a recorder test asserting messages matching an active mapping are skipped and unmapped messages still capture
- [x] 5.2 Consult `matchesActiveMapping` before routing/capturing and skip matches

## 6. Feedback output (`src/midi/controlFeedback.ts` + provider)

- [x] 6.1 Write feedback tests: emit on state change, initial sync on load, silent skip when port missing
- [x] 6.2 Implement the state-watcher off registry `stateSelector`, emitting note/CC via `MidiRuntime` outputs (independent of `clockSender`)

## 7. Map editor UI (`src/components/midi-map/`)

- [x] 7.1 Add the map-mode toggle + keyboard shortcut in the Titlebar; expose badge anchors on mappable transport/settings controls
- [x] 7.2 Implement `MapModeOverlay` rendering in-place badges (current source / "unmapped")
- [x] 7.3 Implement `MappingsPanel` in the Sidebar dock (grouped by target kind; row selects/arms; dock restores on exit)
- [x] 7.4 Implement `MappingConfig` in the Inspector dock showing only kind-relevant advanced fields; edits persist to the store
- [x] 7.5 Wire arm → learn → configure → clear/relearn flow; add styles following `.mr-` + `data-*` + `tokens.css` conventions

## 8. Export dialog wiring (`src/components/dialog/ExportDialog`)

- [x] 8.1 Add export of the mapping set as JSON alongside existing exports
- [x] 8.2 Add import via file picker (validate/migrate/replace; reject invalid with a message, leaving mappings unchanged)

## 9. Provider wiring (`src/App.tsx`)

- [x] 9.1 Mount `MidiControlProvider` and the feedback provider in the tree (access to `useTransport`, `MidiRuntime`, `useControlMapStore`); load the store at start

## 10. Verification

- [x] 10.1 Run the full test suite; confirm new specs' scenarios are covered
- [ ] 10.2 Manual smoke: map play/record/loop/BPM/grid/phrase, verify trigger + consumption + LED feedback + import/export round-trip _(requires physical MIDI hardware — automated integration tests cover the trigger / consumption / feedback / import-export equivalents)_
