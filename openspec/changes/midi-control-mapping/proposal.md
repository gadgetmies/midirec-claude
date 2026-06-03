## Why

The app's transport and settings (play, record, BPM, cue, loop, quantize,
snap, clock, metronome, …) can only be driven from the on-screen UI today.
Performers using a hardware controller need hands-free, mappable control of
those actions from incoming MIDI, configured through a familiar Ableton-style
mapping mode.

## What Changes

- Add an always-on MIDI control receiver that maps incoming note / CC /
  channel-pressure / pitch-bend messages to existing transport & settings
  actions: play, pause, record, rewind, cue, loop, metronome, quantize on/off,
  quantize grid, snap, clock source, clock send, and BPM.
- Add a new **phrase-jump** transport action (forward/back by a configurable
  bars-per-phrase, default 8).
- Add an **Ableton-style MIDI map mode**: a Titlebar toggle (+ keyboard
  shortcut) that overlays in-place mapping badges on every mappable control,
  with a docked Mappings list (Sidebar dock) and a docked advanced-config panel
  (Inspector dock). Click-to-arm, then move a MIDI control to learn it.
- Support **advanced per-mapping configuration**: trigger edge (press/release),
  button mode (toggle/momentary), velocity/value threshold, continuous BPM with
  absolute range + relative-encoder mode + soft-takeover, and enum stepping
  (cycle vs select) for grid/clock-source.
- Store mappings in a **global, app-wide, versioned store**, independent of the
  session `TimelinePayload`; loaded at app start and surviving session new/load.
- Add **MIDI feedback output**: mapped toggle/enum states emit MIDI to the
  source controller to drive LEDs, with an initial sync.
- **Consume** mapped messages — a message matching an active mapping fires its
  action and is skipped by the recorder, never landing in a take.
- Add **JSON import/export** of the mapping set, wired into the existing Export
  dialog.

## Capabilities

### New Capabilities

- `midi-control-mapping`: The control-mapping engine — data model and target
  registry, always-on input listener/receiver, advanced-rule application
  (edge/threshold/button-mode/continuous/enum), the global versioned mapping
  store with JSON import/export, the new phrase-jump action, and MIDI feedback
  output.
- `midi-map-editor`: The Ableton-style map mode UI — map-mode toggle, in-place
  overlay badges on mappable controls, the docked Mappings list and
  advanced-config panel, and the arm → learn → configure → clear flow including
  one-source-to-many-targets binding (a single event can drive several actions).

### Modified Capabilities

- `transport-titlebar`: Adds the map-mode toggle (+ keyboard shortcut) and the
  hooks for overlay mapping badges on the transport/settings controls.
- `midi-recording`: The recorder skips incoming messages that match an active
  control mapping (consumption), so mapped controls are not captured.
- `export-dialog`: Adds export and import of the control mapping set as JSON
  alongside existing exports.

## Impact

- **New code:** `src/midi/controlMap.ts`, `src/midi/MidiControlProvider.tsx`
  (`useMidiControl`), `src/midi/controlFeedback.ts` (+ provider),
  `src/hooks/useControlMapStore.tsx`, `src/components/midi-map/`
  (`MapModeOverlay`, `MappingsPanel`, `MappingConfig`, toggle + CSS).
- **Modified code:** `src/midi/recorder.ts` (skip-on-match), Titlebar (toggle +
  badges), `ExportDialog` (mapping import/export), `App.tsx` provider tree, new
  global persistence key in the storage layer, `useTransport` (phrase-jump
  action + a way for `setBpm` to update internal BPM).
- **Persistence:** new versioned store key, separate from `TimelinePayload`.
- **Dependencies:** none new; reuses Web MIDI access (`MidiRuntime`),
  `midiLearn` parsing, and existing dock zones (Sidebar, Inspector).
