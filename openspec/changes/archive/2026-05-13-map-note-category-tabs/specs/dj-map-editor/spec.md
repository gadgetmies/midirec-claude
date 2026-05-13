## ADDED Requirements

(none — behavior captured under MODIFIED requirements below)

## MODIFIED Requirements

### Requirement: Map Note form renders category chips, action, device, trigger

The form SHALL contain, in DOM order:

1. A header row with a 24×24px swatch element whose `background` is `devColor(entry.device)`, and a two-line label group containing the action's `label` (top, e.g. `Hot Cue 1`) and a mono subtitle `<pitchLabel> · note <pitch>` (e.g. `G♯3 · note 56`). If `entry.label` is the empty string, the header SHALL render the literal text `— unmapped —` instead.
2. A `Category` section: a small uppercase label `Category` and a wrapping row of category chips, one per key of `DJ_CATEGORIES` (in declared key order: `deck`, `mixer`, `fx`, `global`). The chip whose key equals the current `entry.cat` SHALL carry `data-on="true"` and visually highlight in that category's color (border, text, and tinted background via `color-mix(in oklab, <color> 14%, transparent)`).
3. An `Action` section: a small uppercase label `Action` and a full-width `<select class="mr-select">`. Options SHALL be populated from `DEFAULT_ACTION_MAP` entries whose `cat` equals the current `entry.cat`, with this exception: when `entry.cat === 'deck'`, the select SHALL list **at most one** option per distinct pair of `(label, short)` among matching entries (deduplicating Deck 1 vs Deck 2 template duplicates). Options SHALL be sorted by ascending numeric pitch of their representing template row (the lowest pitch within each dedupe group). Each option's `value` SHALL still be an entry `id` from `DEFAULT_ACTION_MAP` (the id of the representing template after dedupe resolution). The select's current value SHALL be `entry.id`.
4. A two-column grid containing a `Device` section and a `Trigger` section. The `Device` `<select>` SHALL list every key of `DJ_DEVICES` (in declared order: `deck1`, `deck2`, `deck3`, `deck4`, `fx1`, `fx2`, `mixer`, `global`), each option's text equal to `devLabel(key)`. The `Trigger` `<select>` SHALL contain exactly two options with text `momentary` and `toggle`.
5. A footer row containing a single button with `data-danger="true"` and text content `Delete mapping`.

#### Scenario: Header pitch label is present

- **WHEN** the panel is open for `pitch: 60`
- **THEN** the header subtitle SHALL contain the text `C4`
- **AND** the header subtitle SHALL contain the text `note 60`

#### Scenario: Category chips render in declared order

- **WHEN** the panel is open
- **THEN** the category-chip row SHALL contain exactly 4 buttons
- **AND** their text content SHALL be, in DOM order: `Deck`, `Mixer`, `FX`, `Global`

#### Scenario: Active category chip carries data-on

- **WHEN** the panel is open for an entry with `cat === 'deck'`
- **THEN** exactly one chip in the category row SHALL carry `data-on="true"`
- **AND** that chip's text content SHALL be `Deck`

#### Scenario: Action select is filtered by current category

- **WHEN** the panel is open for an entry with `cat === 'deck'` and `entry.id` identifies a Hot Cue template
- **THEN** the Action `<select>` SHALL contain exactly one option whose visible `text` is `Hot Cue 1` for that control family (no duplicate `Hot Cue 1` rows tied solely to Deck 1 vs Deck 2 template copies)
- **AND** the Action `<select>` SHALL visibly reflect that Hot Cue selection even when the underlying `entry.id` is the Deck 2-prefixed template (`hc1_b` vs `hc1`), whichever the row currently uses

#### Scenario: Device select contains all DJ_DEVICES

- **WHEN** the panel is open
- **THEN** the Device `<select>` SHALL contain exactly 8 `<option>` elements
- **AND** the options' text content SHALL be, in DOM order: `Deck 1`, `Deck 2`, `Deck 3`, `Deck 4`, `FX 1`, `FX 2`, `Mixer`, `Global`

#### Scenario: Trigger select shows momentary and toggle

- **WHEN** the panel is open
- **THEN** the Trigger `<select>` SHALL contain exactly 2 `<option>` elements with text `momentary` and `toggle`
- **AND** when the resolved entry has no `trigger` field, the select's current value SHALL be `momentary`

### Requirement: Form changes auto-save via setActionEntry

Every form interaction SHALL commit its result immediately by calling `useStage().setActionEntry(trackId, pitch, mergedEntry)`. There SHALL be NO Done / Save / Apply button; field changes are the commit point.

When the user selects a different **action** from the Action `<select>`, the committed entry SHALL adopt that action's `id`, `label`, `short`, `device`, and (when present) `pad` and `pressure` from the matched `DEFAULT_ACTION_MAP` template. The `cat` and `trigger` fields SHALL be preserved from the prior entry.

When the user activates a different **category** chip, the committed entry SHALL set `cat` to the chip's key AND set `id`, `label`, `short`, `pad`, `pressure` from the first entry in `DEFAULT_ACTION_MAP` matching the new category (sorted by numeric pitch). The `device` and `trigger` fields SHALL be preserved from the prior entry. If no entry in `DEFAULT_ACTION_MAP` matches the new category, `id`, `label`, `short` SHALL be the empty string.

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
