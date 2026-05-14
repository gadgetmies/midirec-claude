## Why

Configuring DJ action input (channel, note, or CC) and per-row output (channel, pitch, CC) by typing numbers is slow and error-prone. A MIDI learn control lets users press or twist a physical control once and capture the correct channel and address, which is expected in music software and matches how people work with hardware.

## What Changes

- Add a **MIDI learn** control to the sidebar **Map Note** form: after the user has chosen which **MIDI input port(s)** apply (`MIDI in · devices`), and **before** the **MIDI in · channel** and **MIDI in · note** / **CC** fields (and any related grid grouping).
- Add a **MIDI learn** control to the Inspector **Output mapping** panel for the selected DJ action row: after the **Device** (`DJ_DEVICES`) select, and **before** the **Channel** row and the **Pitch** / **CC#** rows.
- Implement shared behavior: arm learn mode, listen on Web MIDI inputs, map the next relevant message into the correct persisted fields (`setActionEntry` / `setOutputMapping` per context), then exit learn mode; include clear active/cancel UX and safe handling when MIDI access is missing or no message arrives.

## Capabilities

### New Capabilities

- `midi-learn`: Shared semantics for arming MIDI learn, consuming the next eligible inbound MIDI message, mapping it to channel and note or CC (and channel-only cases where applicable), timeouts/cancellation, and integration with existing Web MIDI runtime.

### Modified Capabilities

- `dj-map-editor`: Extend Map Note form requirements so DOM order and behavior include the learn control in the position above; learn SHALL update the row’s incoming MIDI fields consistently with manual edits (auto-save via `setActionEntry`).
- `inspector`: Extend Output mapping panel requirements so DOM order includes the learn control after Device and before Channel/Pitch/CC#; learn SHALL persist via existing `setOutputMapping` merge rules.

## Impact

- **UI**: `src/components/sidebar/InputMappingPanel.tsx` (Map Note form), Inspector output-mapping JSX/CSS (e.g. `src/components/inspector/Inspector.tsx` and related styles).
- **State**: Existing stage actions `setActionEntry`, `setOutputMapping`; possible small additions for learn-armed state (local component state vs shared hook).
- **MIDI**: `MidiRuntimeProvider` / input listeners — ensure learn does not break recording or performance routing; may reuse or extend existing message dispatch.
- **Tests / specs**: New `specs/midi-learn/spec.md`; delta updates under `specs/dj-map-editor/spec.md` and `specs/inspector/spec.md` per OpenSpec layout for this change.
