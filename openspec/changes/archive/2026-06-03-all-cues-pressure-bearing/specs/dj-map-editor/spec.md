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
- **THEN** `setActionEntry` SHALL be called with an entry whose `id === 'hc2'`, `label === 'Hot Cue 2'`, `short === 'HC2'`, `pad === true`, AND `pressure === true`
- **AND** the committed entry's mode under `actionMode()` SHALL be `'pressure-bearing'` (Hot Cue 2 now carries the pressure flag in `DEFAULT_ACTION_MAP`)

#### Scenario: Changing the category picks the first action in that category

- **WHEN** the panel is open for an entry with `cat === 'deck'` and the user clicks the `FX` chip
- **THEN** `setActionEntry` SHALL be called with an entry whose `cat === 'fx'` AND `id === 'fx1_on'` (the first FX entry in `DEFAULT_ACTION_MAP` by numeric pitch order)

#### Scenario: Browser chip picks Load Deck as first browser template

- **WHEN** the panel is open for an entry with `cat === 'deck'` and the user clicks the `Browser` chip (label matching `DJ_CATEGORIES.browser.label`)
- **THEN** `setActionEntry` SHALL be called with an entry whose `cat === 'browser'` AND `id === 'load_a'`

#### Scenario: Mixer chip picks crossfader as first mixer template

- **WHEN** the panel is open for an entry with `cat === 'deck'` and the user clicks the `Mixer` chip
- **THEN** `setActionEntry` SHALL be called with an entry whose `cat === 'mixer'` AND `id === 'xfade_pos'`
