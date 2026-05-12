## Context

Recording today uses a single `MIDIInput` (`useMidiInputs().inputs[0]`) and routes note-ons by raw MIDI channel nibble into the internal channel with the same id (`channelId = (status & 0x0F) + 1`). Multi-channel record routing and auto-add landed in `2026-05-12-multi-channel-record-routing`, but there is still no way to bind **a specific timeline track** (instrument channel-roll or DJ action track) to **specific hardware inputs and MIDI channels**. The sidebar’s `InputMappingPanel` is DJ **row**–scoped and uses prototype `DeviceId` semantics, not Web MIDI port ids.

## Goals / Non-Goals

**Goals:**

- Timeline selection (instrument track / DJ action track) drives a **left sidebar panel** where the user enables **one or more Web MIDI input devices** and, for each enabled device, picks **one or more MIDI channels (1–16)** to listen to. Channel checklists are independent per device.
- During recording, the recorder subscribes to every `MIDIInput` that appears in **any** configured `inputSources` across the session (union), not only `inputs[0]`.
- When an inbound note event’s `(portId, midiChannelNibble)` matches a track’s configuration, capture targets **that track** (instrument roll on that channel, or DJ track event list — see decisions below).
- Preserve chain-forward `onmidimessage` behavior and hung-note finalize semantics per port.

**Non-Goals:**

- Output routing / per-track playback device (covered by other backlog items).
- CC / pitch-bend capture (separate backlog entry).
- Midi learn / automatic binding from a key press.
- “Omni” per device in v1 — user selects explicit channel numbers only (an “all channels” shortcut can be a follow-up).

## Decisions

1. **Data shape: `TrackInputListenRow`**
   - `{ inputDeviceId: string; channels: ChannelId[] }` where `inputDeviceId` is the Web MIDI `MIDIInput.id` and `channels` is a sorted unique subset of `1..16`.
   - Stored as `inputSources: TrackInputListenRow[]` on each `Channel` (instrument) and each `DJActionTrack`. Empty array means **no explicit sources** for that track (see resolution rule 4).

2. **Panel placement and naming**
   - New `TrackInputMappingPanel` mounted in the sidebar (above or below the permission banner; below is fine). Title e.g. **INPUT TARGET** or **TRACK INPUT**.
   - Renders only when `useStage()` exposes a **timeline track selection**: `{ kind: 'channel'; channelId: ChannelId } | { kind: 'dj'; trackId: DJTrackId } | null`. Selection is set by clicking the instrument **channel header** / **track header** or the DJ **track** header (exact handlers in implementation tasks).
   - Coexists with the existing DJ `InputMappingPanel` (row-level action mapping). Order: track input panel first; row panel below when `djActionSelection` is non-null.

3. **Recorder: which ports get handlers**
   - While `recording === true` and MIDI access is granted, compute `S = union` of `inputDeviceId` from every `inputSources` row on every channel and DJ track where `channels.length > 0`.
   - If `S` is empty, **fallback**: attach only to `inputs[0]` (current behavior) for backward compatibility.
   - If `S` is non-empty, attach to each `access.inputs.get(id)` that exists; ignore missing ids until hotplug adds them.

4. **Matching and routing priority**
   - Parse `portId` from `event.target.id` (or equivalent) and `midiCh = status0 & 0x0F`.
   - **Track-specific match**: `(portId, midiCh)` satisfies a row if `row.inputDeviceId === portId` and `(midiCh + 1) ∈ row.channels`.
   - Collect all `(targetKind, targetId)` — instrument channels and DJ tracks — that contain such a row.
   - If **one** instrument channel `C` matches and no DJ track matches → active-note `channelId` for capture is `C` (not `midiCh + 1`).
   - If **one** DJ track matches and no instrument channel matches → finalize into that DJ track’s `events` (new Stage API).
   - If **both** DJ and instrument match the same message, **prefer instrument channel** if the **current timeline selection** is that channel; else prefer DJ if selection is that DJ track; else first stable ordering (document: instrument before DJ, lower `id` first).
   - If **no** track-specific match → **legacy**: `channelId = midiCh + 1`, `addChannel` if missing (current multi-channel routing).

5. **DJ event append**
   - Introduce `appendDJActionEvent(trackId, event: ActionEvent)` (or merge into existing DJ hook) so recorder can append `{ pitch, t, dur, vel }` aligned with channel-roll note timing. Row targeting within the DJ map is **not** required in v1 — pitch comes from the MIDI message; user trims/moves events in the UI later.

6. **Active-note map key**
   - Extend key to include `portId` (or input id string) so the same pitch on two controllers does not collide: e.g. `` `${portId}:${midiCh}:${pitch}` ``.

## Risks / Trade-offs

- **[Risk]** Overlapping configs cause ambiguous routing → Mitigation: deterministic preference order + timeline selection bias; encourage users to disjoint channel/device sets.
- **[Risk]** Many open ports vs performance → Mitigation: union is typically small; only subscribe while recording.
- **[Trade-off]** Fallback to `inputs[0]` when no config exists keeps demos working without wiring selection first.

## Migration Plan

- Additive state fields default to `inputSources: []`.
- No file format migration until session save/load lands.

## Open Questions

- Whether DJ tracks without `inputSources` should record at all or always require configuration (default: same fallback as channels — legacy global routing won’t target a DJ track unless matched).
