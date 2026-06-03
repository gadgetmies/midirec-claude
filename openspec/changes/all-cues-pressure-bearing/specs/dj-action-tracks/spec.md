## ADDED Requirements

### Requirement: All cue and hot-cue entries in DEFAULT_ACTION_MAP are pressure-bearing

Every entry in `DEFAULT_ACTION_MAP` whose `id` belongs to the cue family SHALL carry both `pad: true` and `pressure: true`, so that `actionMode(entry)` returns `'pressure-bearing'` for that entry. The cue family is the set of ids: `cue`, `cue_b`, `hc1`, `hc1_b`, `hc2`, `hc2_b`, `hc3`, `hc3_b`, `hc4`, `hc4_b`.

This requirement is about the **seeded** action map only. User-customised entries persisted in storage SHALL retain whatever flags the user committed; no retroactive migration is implied.

#### Scenario: cue entries on both decks are pressure-bearing in the seed

- **WHEN** a reader inspects `DEFAULT_ACTION_MAP[49]` and `DEFAULT_ACTION_MAP[66]`
- **THEN** each entry SHALL have `pad === true` AND `pressure === true`
- **AND** `actionMode(entry)` SHALL return `'pressure-bearing'` for each

#### Scenario: hot-cue entries on both decks are pressure-bearing in the seed

- **WHEN** a reader inspects the `DEFAULT_ACTION_MAP` entries at pitches 56, 57, 58, 59, 69, 70, 78, 79
- **THEN** each entry SHALL have `pad === true` AND `pressure === true`
- **AND** `actionMode(entry)` SHALL return `'pressure-bearing'` for each
