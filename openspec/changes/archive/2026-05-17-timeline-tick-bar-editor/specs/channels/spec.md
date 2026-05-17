## ADDED Requirements

### Requirement: Channel rolls and lanes persist tick timing

`PianoRollTrack.notes` SHALL be an array of **`Note`** values whose **`tTicks`** / **`durTicks`** fields are authoritative after migration.

Each `ParamLane` point (`CCPoint`) SHALL use **`tTicks`**.

Channel helpers (`appendNote`, lane editors, seeds) SHALL write integers on the tick axis only.

#### Scenario: appendNote stores tick-native notes

- **WHEN** `appendNote` is called with a `Note` carrying `tTicks` and `durTicks`
- **THEN** the stored note SHALL preserve those integers verbatim (subject to validation/clamping policy)
