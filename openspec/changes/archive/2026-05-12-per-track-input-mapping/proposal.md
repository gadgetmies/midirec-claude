## Why

Channel recording today routes every note by raw MIDI channel byte into the matching internal channel, using only the first enumerated input. Users with several controllers or split setups need to say **which physical inputs and which MIDI channels** feed **which timeline track** (instrument channel-roll or DJ action track). Without per-track, per-device channel filters, two keyboards both on MIDI ch1 cannot be targeted separately.

## What Changes

- **Timeline selection drives the left mapping panel**: Selecting an instrument track (channel header / roll) or a DJ action track surfaces a **single** sidebar panel for configuring that target’s MIDI input sources.
- **Per-track input sources**: For the selected target, the user chooses **one or more Web-MIDI input devices** and, **per device**, a set of **MIDI channels (1–16)** to listen to during recording. Selection is **device-scoped** (channels chosen for device A are independent of device B).
- **Recorder routing**: Incoming note events match `(port id, MIDI channel nibble)` against the **selected track’s** configured sources. Events that match are captured into that track; non-matching events continue to use existing multi-channel routing rules where applicable (or are dropped when no track claims them—see design).
- **Sidebar UX**: Replace or supersede the old global “rule list” concept with this panel; the panel is contextual on `selectedTrack` (or equivalent) and lists devices with expandable channel pickers.

## Capabilities

### New Capabilities

- `track-input-mapping`: Defines the per-track/per-target shape for `inputSources` (set of `{ inputDeviceId, channels: ChannelId[] }`), sidebar panel presentation, empty and multi-select behavior, and how selection in the timeline shows or hides the panel.

### Modified Capabilities

- `midi-recording`: Recorder attaches listeners as needed for all `MIDIInput` ports referenced by configured sources (not only `inputs[0]`); dispatch matches events against the active track’s source set when recording “through” a selected track (exact lifecycle in `design.md`).
- `channels`: `Channel` or nested roll state carries the input-source list for instrument tracks; stage exposes setters (toggle device membership, toggle channel per device).
- `dj-action-tracks`: DJ tracks carry the same input-source shape alongside or replacing the narrow `inputRouting.channels` list where appropriate; alignment with real `MIDIInput.id` instead of only abstract `ChannelId` lists.
- `sidebar`: Sidebar includes the contextual **Input mapping** (or renamed) panel bound to timeline selection; panel body renders device rows + per-device channel multi-select.

## Impact

- `src/midi/recorder.ts` — multi-input subscriptions; match logic vs per-track sources.
- `src/hooks/useStage.ts` / `useChannels.ts` — state + actions for input sources on channels and DJ tracks.
- `src/components/sidebar/Sidebar.tsx` + new or refactored panel component(s).
- `openspec/specs/*` — deltas above; new `track-input-mapping/spec.md`.
- Possible migration from `DJTrackRouting.channels`-only to full device+channel rows for DJ input.
