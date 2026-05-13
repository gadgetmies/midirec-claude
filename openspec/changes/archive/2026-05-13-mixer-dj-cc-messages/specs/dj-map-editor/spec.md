## ADDED Requirements

### Requirement: Map Note form exposes optional incoming MIDI CC binding

The `InputMappingPanel` body SHALL place a `.mr-kv` (or grid-equivalent) row labelled **`MIDI in · CC`** after the existing **`MIDI in · note`** row (or in the same two-column grid group as ch/note, consistent with the implementation layout). The row SHALL contain a numeric input accepting integers `0..127`, controlling `ActionMapEntry.midiInputCc`. When the field is empty or cleared, writers SHALL omit `midiInputCc` from the persisted entry (note-only binding). The field SHALL coexist with `MIDI in · ch` and `MIDI in · note`; when `midiInputCc` is set, record-time semantics SHALL follow `midi-recording` (CC takes precedence over note matching for that row).

#### Scenario: CC field commits on change

- **WHEN** the panel is open for a row and the user enters `7` in the `MIDI in · CC` input
- **THEN** `setActionEntry` SHALL be called with `midiInputCc: 7` merged into the entry
- **AND** subsequent renders SHALL show `7` in the input

#### Scenario: Clearing CC restores note-only matching

- **WHEN** the panel is open for a row that has `midiInputCc: 7` and the user clears the CC input
- **THEN** `setActionEntry` SHALL be called with `midiInputCc` unset (omitted)
- **AND** record routing SHALL use `midiInputNote` / row pitch per the prior behavior

## MODIFIED Requirements

### Requirement: Form changes auto-save via setActionEntry

Every form interaction SHALL commit its result immediately by calling `useStage().setActionEntry(trackId, pitch, mergedEntry)`. There SHALL be NO Done / Save / Apply button; field changes are the commit point.

When the user selects a different **action** from the Action `<select>`, the committed entry SHALL adopt that action's `id`, `label`, `short`, `device`, and (when present) `pad` and `pressure` from the matched `DEFAULT_ACTION_MAP` template. The `cat` and `trigger` fields SHALL be preserved from the prior entry. The **`midiInputCc` field SHALL be preserved** unless the new template forbids CC binding by explicit product rule (none in this slice — implementors SHALL preserve).

When the user activates a different **category** chip, the committed entry SHALL set `cat` to the chip's key AND set `id`, `label`, `short`, `pad`, `pressure` from the first entry in `DEFAULT_ACTION_MAP` matching the new category (sorted by numeric pitch). The `device` and `trigger` fields SHALL be preserved from the prior entry. The **`midiInputCc` field SHALL be preserved** from the prior entry. If no entry in `DEFAULT_ACTION_MAP` matches the new category, `id`, `label`, `short` SHALL be the empty string.

When the user changes the **device** or **trigger** select, the committed entry SHALL update that field only.

#### Scenario: Changing the trigger select commits immediately

- **WHEN** the panel is open for `pitch: 56` and the user changes the Trigger select from `momentary` to `toggle`
- **THEN** `setActionEntry` SHALL be called exactly once with `(trackId, 56, { ..., trigger: 'toggle' })`
- **AND** the next render SHALL have `actionMap[56].trigger === 'toggle'`

#### Scenario: Changing the device commits immediately

- **WHEN** the panel is open for `pitch: 56` and the user changes the Device select to `Deck 2`
- **THEN** `setActionEntry` SHALL be called with an entry whose `device === 'deck2'`

#### Scenario: Changing the action overwrites label/short/pad/pressure from the template

- **WHEN** the panel is open for `pitch: 56` with `id === 'hc1'` and the user picks `Hot Cue 2` from the Action select
- **THEN** `setActionEntry` SHALL be called with an entry whose `id === 'hc2'`, `label === 'Hot Cue 2'`, `short === 'HC2'`, and `pad === true`
- **AND** the committed entry's `pressure` field SHALL be unset (Hot Cue 2 has no pressure flag in `DEFAULT_ACTION_MAP`)

#### Scenario: Changing the category picks the first action in that category

- **WHEN** the panel is open for an entry with `cat === 'deck'` and the user clicks the `FX` chip
- **THEN** `setActionEntry` SHALL be called with an entry whose `cat === 'fx'` AND `id === 'fx1_on'` (the first FX entry in `DEFAULT_ACTION_MAP` by numeric pitch order)

## REMOVED Requirements

(none)
