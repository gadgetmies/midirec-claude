## ADDED Requirements

### Requirement: Map Note form exposes MIDI learn for incoming MIDI

The `InputMappingPanel` Map Note form (`src/components/sidebar/InputMappingPanel.tsx`) SHALL expose a MIDI learn control that complies with the **midi-learn** capability: it SHALL arm and disarm per user action, capture at most one qualifying inbound message into `ActionMapEntry` fields via `setActionEntry`, and SHALL place the control **after** the **MIDI in · devices** section and **before** the **MIDI in · channel** field and the **MIDI in · note** / **CC** field group.

#### Scenario: Learn control is present on an open Map Note form

- **WHEN** `djActionSelection` references a track and pitch with a resolved `actionMap` entry and at least one `MIDIInput` exists
- **THEN** the Sidebar SHALL contain a button or control in the Map Note form whose accessible name includes `Learn` (case-insensitive match)
- **AND** that control SHALL appear after the MIDI input device toggle list in DOM order
- **AND** the **MIDI in · ch** label SHALL appear after that control in DOM order
