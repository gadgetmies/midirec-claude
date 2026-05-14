# dj-automation-demo

## ADDED Requirements

### Requirement: URL token `demo=dj-automation` selects the automation demo preset

`parseDemoQueryFlags` SHALL recognize an additional `demo` token with value `dj-automation` (trimmed, same parsing rules as existing tokens). The implementation SHALL expose an explicit boolean (e.g. `djAutomationDemo`) on the returned flags object. **`djAutomationDemo` SHALL only take effect when both `djDemo` is true and `djDemoMessages` is true** (i.e. full `demo=dj` flow with synthetic events — not `demo=dj-empty`). When `djAutomationDemo` is false or inactive, behavior SHALL match the flags object prior to this capability.

#### Scenario: Combined URL enables the preset

- **WHEN** the app parses `?demo=dj&demo=dj-automation`
- **THEN** `djDemo` SHALL be true
- **AND** `djDemoMessages` SHALL be true
- **AND** `djAutomationDemo` SHALL be true

#### Scenario: dj-empty wins over messages and disables automation preset

- **WHEN** the app parses `?demo=dj&demo=dj-empty&demo=dj-automation`
- **THEN** `djDemoMessages` SHALL be false
- **AND** the seed SHALL NOT apply the automation demo timeline (same as existing `dj-empty` contract)

#### Scenario: Automation token alone does not enable DJ demo

- **WHEN** the app parses `?demo=dj-automation` without `demo=dj` or `demo=dj-empty`
- **THEN** `djDemo` SHALL be false
- **AND** `djAutomationDemo` MAY be true in the parsed object but the stage SHALL NOT seed DJ tracks from this token alone

### Requirement: Automation demo seeds deterministic Deck 1 and Deck 2 action events

When the automation preset is active at first render, **Deck 1** (`dj-deck1`) and **Deck 2** (`dj-deck2`) SHALL each include the following `ActionEvent` rows (session time `t` in **beats**, 0-based; `vel` in **0..1** as elsewhere):

| Order | Beat (1-based) | `t` | Deck 1 `pitch` | Deck 2 `pitch` | Role | MIDI-style value (via `round(vel × 127)`) |
| ----- | -------------- | --- | -------------- | -------------- | ---- | ---------------------------------------- |
| 1 | 1 | 0 | 89 | 90 | Beat Jump Size | 11 |
| 2 | 2 | 1 | 76 | 77 | Beat Jump (backward with 127) | 127 |
| 3 | 4 | 3 | — | 65 | Play / Pause (Deck 2 only) | note-on style `vel` appropriate for full velocity (e.g. `1.0`) |

Deck 1 SHALL NOT emit a Play event in that third row. All listed events SHALL use pitches that exist in each track’s `actionMap` for the seeded demo. Event `dur` SHALL be positive and small enough to classify as momentary taps (implementation MAY match existing deck demo defaults such as `0.1` beats).

#### Scenario: Deck 1 has beat-jump events at t = 0 and t = 1

- **WHEN** the automation preset is active
- **THEN** Deck 1’s `events` SHALL include at least one event with `pitch === 89` and `t === 0` and `round(vel * 127) === 11`
- **AND** Deck 1’s `events` SHALL include at least one event with `pitch === 76` and `t === 1` and `round(vel * 127) === 127`

#### Scenario: Deck 2 has beat-jump and play events

- **WHEN** the automation preset is active
- **THEN** Deck 2’s `events` SHALL include beat-jump-size and beat-jump events at `t === 0` and `t === 1` on pitches **90** and **77** with the same scaled values as Deck 1
- **AND** Deck 2’s `events` SHALL include a Play event with `pitch === 65` at `t === 3`

### Requirement: Automation demo seeds mixer CC ramps as stepped ActionEvents

When the automation preset is active, the **Mixer** track’s `events` SHALL include CC-backed rows (pitches **81** Ch 1 Volume, **82** Ch 2 Volume, **85** Ch 1 EQ Low, **88** Ch 2 EQ Low) sampled at **integer beat** positions with one event per scheduled beat on an interval. Values SHALL follow:

- **Ch 1 Volume (`pitch` 81)**: for each integer `t` from **4 through 20** inclusive, one event at session time `t` with `round(vel × 127) = round((t − 4) / (20 − 4) × 127)`.

- **Ch 2 Volume (`pitch` 82)**: for each integer `t` from **34 through 68** inclusive, one event at session time `t` with `round(vel × 127) = round((68 − t) / (68 − 34) × 127)`.

- **Ch 2 EQ Low (`pitch` 88)**: one event at **`t = 4`** with value **0**; for each integer `t` from **26 through 34** inclusive, one event at session time `t` with `round(vel × 127) = round((t − 26) / (34 − 26) × 63)`.

- **Ch 1 EQ Low (`pitch` 85)**: for each integer `t` from **26 through 34** inclusive, one event at session time `t` with `round(vel × 127) = round((34 − t) / (34 − 26) × 63)`.

The default **playback** CC number for the Ch 2 Volume row (`ch2_vol`) SHALL be **8** (not CC 7). Ch 1 Volume (`ch1_vol`) SHALL remain CC **7** unless overridden elsewhere.

Each generated event SHALL satisfy existing mixer demo constraints: `pitch` MUST exist in the Mixer `actionMap` with CC output mapping per seeded `outputMap`. Event `dur` SHALL be positive (implementation MAY use a small constant identical across ramp steps).

#### Scenario: Ch 1 volume ramp covers endpoints

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 81`, there SHALL be an event at `t === 4` with `round(vel * 127) === 0`
- **AND** there SHALL be an event at `t === 20` with `round(vel * 127) === 127`

#### Scenario: Ch 2 volume ramp covers endpoints

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 82`, there SHALL be an event at `t === 34` with `round(vel * 127) === 127`
- **AND** there SHALL be an event at `t === 68` with `round(vel * 127) === 0`

#### Scenario: Ch 2 EQ low has a zero at beat 4 and rises through beat 34

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 88`, there SHALL be an event at `t === 4` with `round(vel * 127) === 0`
- **AND** there SHALL be an event at `t === 34` with `round(vel * 127) === 63`

### Requirement: Default DJ demo remains unchanged without the automation token

When `djAutomationDemo` is false at parse time, the initial `events` arrays for all DJ demo tracks SHALL match the implementation’s pre-change defaults (existing `SEEDED_EVENTS_*` content and ordering rules). No additional mixer or deck events from this capability SHALL appear.

#### Scenario: demo=dj without automation keeps sparse mixer CC events

- **WHEN** the app loads with `?demo=dj` and no `demo=dj-automation`
- **THEN** the Mixer track’s `events` filtered to `pitch === 82` SHALL have length **2** (the historical Deck Ch 2 Volume tap pattern)

#### Scenario: Automation demo densifies Ch 1 volume steps

- **WHEN** the app loads with `?demo=dj&demo=dj-automation`
- **THEN** the Mixer track’s `events` filtered to `pitch === 81` SHALL have length **17** (one per beat from `t = 4` through `t = 20` inclusive)

#### Scenario: Automation demo densifies Ch 2 volume steps

- **WHEN** the app loads with `?demo=dj&demo=dj-automation`
- **THEN** the Mixer track’s `events` filtered to `pitch === 82` SHALL have length **35** (one per beat from `t = 34` through `t = 68` inclusive)
