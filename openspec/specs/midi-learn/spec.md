# midi-learn Specification

## Purpose
TBD - created by archiving change midi-learn-mapping. Update Purpose after archive.
## Requirements
### Requirement: MIDI learn arms and disarms on user action

The product SHALL provide MIDI learn as an explicit mode per surface: the user arms learn (e.g. via a **Learn** control), the implementation listens for eligible inbound MIDI, applies at most one capture per arming, then disarms. While armed, the control SHALL expose an unmistakable active state (visual and `aria-pressed="true"` on the triggering control). The user SHALL be able to cancel armed state without capturing (second toggle, dedicated cancel, Escape, or equivalent). If no qualifying message arrives within a reasonable idle window while armed, the implementation SHOULD auto-cancel learn mode without persisting changes.

#### Scenario: Arm then cancel leaves mapping unchanged

- **WHEN** the user arms MIDI learn on a mapping surface and cancels before any qualifying MIDI message
- **THEN** no call to `setActionEntry` or `setOutputMapping` SHALL occur solely from learn
- **AND** learn mode SHALL end in unarmed state

#### Scenario: Armed state is exposed to assistive tech

- **WHEN** MIDI learn is armed
- **THEN** the Learn control SHALL expose `aria-pressed="true"` until disarmed

### Requirement: Learn applies one inbound message to input mapping fields

While Map Note Input learn is armed, on the first **qualifying** `MIDIMessageEvent` from an **eligible** `MIDIInput` (per that row’s port selection and track-default rules), the implementation SHALL call `useStage().setActionEntry(trackId, pitch, mergedEntry)` exactly once to update:

- `midiInputChannel` to the wire channel as **1..16** (derived from the status byte’s channel nibble **+ 1**),
- and fields consistent with the current **MIDI in · type** (`midiInputKind`): **note** number from note-on (**excluding** velocity `0` interpreted as note-off), **CC** number from Control Change, **aftertouch** / **pitch bend** per the shape already supported by `ActionMapEntry` and `mergeMidiInputKind`.

The message SHALL be ignored for capture if it is not of a kind that matches the current `midiInputKind` profile (e.g. CC message while the form is in **note** mode). After a successful capture, learn SHALL disarm.

#### Scenario: Note learn commits channel and note from note-on

- **WHEN** Map Note learn is armed for a row whose MIDI in type is **note**, and the next qualifying message is a note-on on wire channel `2` (nibble `1`) for note `60` with velocity `100`
- **THEN** `setActionEntry` SHALL be called once with `midiInputChannel: 2` and `midiInputNote: 60` merged into the entry
- **AND** learn SHALL disarm

#### Scenario: Note-off is not learned as a note

- **WHEN** Map Note learn is armed in **note** mode and the next message is a note-on with velocity `0`
- **THEN** that message SHALL NOT complete learn by itself
- **AND** learn MAY remain armed until a qualifying message or cancel

### Requirement: Learn applies one inbound message to output mapping numbers

While row-level **Output** learn is armed (Inspector), on the first qualifying `MIDIMessageEvent` from any **granted** input (output learn listens to hardware; port filter MAY be all inputs), the implementation SHALL call `useStage().setOutputMapping(trackId, pitch, mergedMapping)` exactly once to update:

- `channel` to **1..16** from the message channel,
- `pitch` when the message is **note-on** (velocity not `0`) **and** the panel is in a note-output mode,
- `cc` when the message is **Control Change** **and** the panel exposes or expects CC output for that row,

merging into the current mapping and retaining the existing virtual **`device`** key from the Device select. After capture, learn SHALL disarm.

#### Scenario: Output note learn sets channel and pitch

- **WHEN** Output learn is armed for a row in note-output mode and the next qualifying message is note-on on channel `5` for note `48` with non-zero velocity
- **THEN** `setOutputMapping` SHALL be called once with `channel: 5` and `pitch: 48` merged with the current `device`
- **AND** learn SHALL disarm

#### Scenario: Output CC learn sets channel and cc

- **WHEN** Output learn is armed for a row where CC output is active and the next qualifying message is Control Change on channel `3` with controller `7`
- **THEN** `setOutputMapping` SHALL be called once with `channel: 3` and `cc: 7` merged with the current `device`
- **AND** learn SHALL disarm

### Requirement: Learn controls are placed after device and before channel and addresses

The **Map Note** panel SHALL render its Learn control in DOM order **after** the **MIDI in · devices** section (Web MIDI port toggles) **and before** the **MIDI in · channel** field and the **MIDI in · note** / **CC** inputs (the grid group that contains those fields). The Inspector **Output** row-level panel SHALL render its Learn control **after** the **Device** `.mr-kv` row **and before** the **Channel** `.mr-kv` row and any **Pitch** or **CC#** rows.

#### Scenario: Map Note DOM order includes learn between devices and channel

- **WHEN** the Map Note form is rendered with at least one MIDI input available
- **THEN** the Learn control’s block SHALL appear after the MIDI input device toggles
- **AND** the **MIDI in · ch** section SHALL appear after the Learn control’s block

#### Scenario: Inspector row Output DOM order includes learn between device and channel

- **WHEN** the row-level Output mapping panel is rendered for a valid `djActionSelection`
- **THEN** the Learn control’s row SHALL appear after the **Device** row
- **AND** the **Channel** row SHALL appear after the Learn control’s row

