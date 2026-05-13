## Why

DJ mixer controls (EQ bands, channel volumes, crossfader) behave as continuous parameters on hardware and in MIDI they are almost always expressed as Control Change messages—not note on/off pairs. Today those actions are modeled as velocity-sensitive “pad” row notes for both playback and input binding, which does not match real mixers or typical controller output. We need CC on the wire for playback and a way to configure CC numbers in the mapping UI so sessions interoperate with external gear.

## What Changes

- Playback for mixer-category continuous actions (default template: crossfader, Ch 1/2 volume, Ch 1/2 EQ high/mid/low) SHALL emit **MIDI Control Change** (status `0xB0 | channel`, CC number, value 0–127) derived from the recorded event’s level (velocity), instead of note-on/note-off on an output “pitch.”
- Per-row **output mapping** SHALL carry an explicit **CC number** (and continue to carry device + MIDI channel) for those actions so users can target the correct controller parameter.
- The **Map Note** sidebar panel (input binding for each DJ action row) SHALL allow mapping **incoming CC** messages (MIDI channel + CC number), in addition to the existing note-based binding, so overdubs and live control from fader-style hardware match playback.
- Record path: when an action row is configured for incoming CC, incoming CC SHALL be matched to that row during recording (same port/channel scoping rules as note binding today).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `dj-action-tracks`: Extend `ActionMapEntry` / `OutputMapping` (and related persistence) so a row can specify **incoming CC** and **outgoing CC**; document mixer template actions as CC-backed for playback where applicable.
- `dj-map-editor`: Extend the Map Note form requirements to include MIDI input CC fields (alongside “MIDI in · ch” / “MIDI in · note”) and scenarios for binding and display when CC mode is used.
- `inspector`: Extend the DJ Output mapping panel requirements so the third output field can represent **CC number** (with label/scenario updates; optional coexistence or replacement of the current “Pitch” row for CC-only actions—implementation detail in design).
- `midi-playback`: Add requirements for DJ track dispatch when the resolved action is CC-based (emit `controlchange` bytes instead of `emitNoteEvent` note pair; clarify interaction with panic / active-note accounting).
- `midi-recording`: Extend DJ action matching so note-based and CC-based bindings both resolve to the same `appendDJActionEvent` path with consistent event shape.

## Impact

- **Code**: `src/data/dj.ts` types and defaults; `src/midi/scheduler.ts` DJ emit path; `src/midi/recorder.ts` message parsing and DJ matching; `src/components/sidebar/InputMappingPanel.tsx`; `src/components/inspector/Inspector.tsx` DJ output section; `src/hooks/useDJActionTracks.ts` / `useStage` mapping setters; unit tests in scheduler/recorder/hooks.
- **Persistence**: Session/project shape for `actionMap` / `outputMap` gains new optional fields; migration defaults for existing sessions.
- **Specs**: Delta specs under this change for the five modified capabilities above; no new top-level capability folders.
