## ADDED Requirements

### Requirement: DJ ActionEvent timing uses integer tTicks and durTicks

Each `ActionEvent` SHALL persist **`tTicks`** and **`durTicks`** as non-negative integers on the session MIDI tick axis at TPQ. Legacy **`t` / `dur` in beats SHALL NOT** remain authoritative after migration.

Merge grouping thresholds that were expressed in beats SHALL be converted to tick thresholds equivalent under TPQ.

#### Scenario: Stored DJ position survives tick round-trip

- **WHEN** an event’s `tTicks` is set to `481` at `TPQ = 480` and `durTicks = 48`
- **THEN** persisted session reload SHALL preserve `tTicks === 481` and `durTicks === 48`

### Requirement: Stage SHALL mutate DJ action event timing with coordinated automation translation

The codebase SHALL expose mutation API(s) reachable via `useStage()` (delegating into `useDJActionTracks` or equivalent) that update the timing of the DJ timeline item identified by `djEventSelection`.

Commits SHALL compute **`deltaTicks`** as the signed integer difference between committed **`tTicks`** and the prior anchor **`tTicks`**.

When the selected item is a **single** `ActionEvent`, a **start-time** commit SHALL set **`tTicks := tTicks + deltaTicks`** and SHALL add **`deltaTicks`** to each embedded automation timestamp stored as ticks (pressure samples).

When the selected item is a **merged CC automation strip**, a **start-time** commit SHALL add **`deltaTicks`** to **`tTicks` on every `ActionEvent` in that cluster**.

The implementation SHALL keep `djEventSelection` valid after the mutation.

#### Scenario: Moving a note-style event translates stored aftertouch points

- **WHEN** `djEventSelection` references an event with non-empty `pressure` arrays keyed by tick time and the user commits **`deltaTicks = 960`**
- **THEN** the event's `tTicks` SHALL increase by exactly `960`
- **AND** each pressure sample tick coordinate SHALL increase by exactly `960`

#### Scenario: Moving a merged CC strip translates every member step

- **WHEN** `djEventSelection.eventIdx` is the representative index of a merged CC cluster with multiple underlying events and the user commits integer **`deltaTicks`**
- **THEN** every member event SHALL have its `tTicks` increased by **`deltaTicks`**

### Requirement: Inspector SHALL show bar-beat-tick fields for selected DJ timeline items

When the Note tab is active AND `djEventSelection !== null` AND the referenced event exists, the Inspector SHALL render bar, beat, and tick-within-beat fields bound **only** to **`tTicks`** decode/encode.

The timing controls SHALL live inside `data-mr-dj-selection-region="true"`.

#### Scenario: Selected event shows three-field start editor

- **WHEN** `djEventSelection === { trackId, pitch, eventIdx }` and the event exists
- **THEN** the Inspector SHALL render three inputs reflecting **`tTicks`**

#### Scenario: Timing inputs preserve DJ selection on interaction

- **WHEN** `djEventSelection !== null` and the user focuses or edits timing inputs
- **THEN** the DJ outside-click handler SHALL NOT clear selections solely due to that focus
