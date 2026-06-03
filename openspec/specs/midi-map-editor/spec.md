# midi-map-editor Specification

## Purpose
TBD - created by archiving change midi-control-mapping. Update Purpose after archive.
## Requirements
### Requirement: Map mode lifecycle

The app SHALL provide a MIDI map mode that can be toggled on and off. While map
mode is active, mapped controls SHALL remain effective (incoming messages still
fire their mapped actions) so the performer can verify a mapping immediately;
only when a target is **armed** SHALL the next qualifying message be captured
for that target instead of triggering its action. Entering map mode SHALL stop
any active recording first, and incoming MIDI SHALL NOT be recorded while map
mode is active. Exiting map mode SHALL clear any armed target.

#### Scenario: Mapped controls stay effective in map mode

- **WHEN** map mode is active, no target is armed, and a mapped message arrives
- **THEN** the target's action fires

#### Scenario: Armed target captures instead of triggering

- **WHEN** map mode is active, a target is armed, and a qualifying message arrives
- **THEN** the message is captured as that target's source and no action fires

#### Scenario: Entering map mode stops recording

- **WHEN** the user enters map mode while recording
- **THEN** recording is stopped before map mode becomes active

### Requirement: In-place overlay badges on mappable controls

While map mode is active, the editor SHALL render an in-place badge on every
mappable control showing its current source (e.g. `C1`, `CC14`) or an
"unmapped" indicator. Badges SHALL update as mappings change.

#### Scenario: Badge reflects current mapping

- **WHEN** map mode is active and a control has a mapping
- **THEN** that control shows a badge with the mapped source

#### Scenario: Unmapped control shown

- **WHEN** map mode is active and a control has no mapping
- **THEN** that control shows an "unmapped" badge

### Requirement: Mappings list in the Sidebar dock

While map mode is active, the Sidebar dock SHALL host a Mappings list of all
current mappings, grouped by target kind. Selecting a row SHALL arm that target.
On exit, the Sidebar dock SHALL restore its normal content.

#### Scenario: List shows all mappings

- **WHEN** map mode is active with three mappings
- **THEN** the Sidebar dock lists all three, grouped by target kind

#### Scenario: Dock restores on exit

- **WHEN** the user exits map mode
- **THEN** the Sidebar dock shows its normal content again

### Requirement: Advanced config in the left (input) dock

While map mode is active, the left (input) dock SHALL host the advanced-config
panel for the armed/selected mapping — the control mapping configures incoming
MIDI, so its UI sits on the input side alongside the Mappings list. The panel
SHALL expose only the fields relevant to the target's kind (edge, button mode,
threshold, continuous range/encoder/takeover, enum mode, bars-per-phrase,
feedback). Edits SHALL update the mapping in the store.

#### Scenario: Config shows kind-relevant fields

- **WHEN** a continuous (`setBpm`) mapping is armed
- **THEN** the config panel shows range, encoder mode, and takeover controls

#### Scenario: Edit persists to store

- **WHEN** the user changes a mapping's edge in the config panel
- **THEN** the stored mapping reflects the new edge

### Requirement: Arm and learn flow

The editor SHALL let the user arm a target by clicking its control or its list
row, then learn its source by sending the next qualifying MIDI message. Learning
SHALL capture the message's kind, port, channel, and data into the mapping's
source.

#### Scenario: Learn captures the next message

- **WHEN** a target is armed and a qualifying MIDI message arrives
- **THEN** that message's kind/port/channel/data become the mapping's source

### Requirement: One source can drive multiple targets

A given source SHALL be allowed to map to more than one target, so a single
incoming event can trigger several actions. Each target SHALL still have at most
one source; learning SHALL replace only the armed target's source and SHALL keep
other targets already bound to that source. The editor MAY surface an
informational toast naming the other targets the source also triggers.

#### Scenario: Binding a source to a second target

- **WHEN** the user learns a source already mapped to another target
- **THEN** both targets are mapped to that source
- **AND** a single matching message triggers both targets' actions

### Requirement: Clear and relearn

The editor SHALL allow clearing a mapping and relearning its source per mapping.

#### Scenario: Clear removes a mapping

- **WHEN** the user clears a mapping
- **THEN** the mapping is removed and its control shows "unmapped"

