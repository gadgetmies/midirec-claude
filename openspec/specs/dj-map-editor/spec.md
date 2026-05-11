# dj-map-editor Specification

## Purpose
TBD - created by archiving change dj-map-editor. Update Purpose after archive.
## Requirements
### Requirement: Sidebar exposes a Map Note panel for the selected DJ action row

The codebase SHALL expose an `<InputMappingPanel>` React component at `src/components/sidebar/InputMappingPanel.tsx`. The component SHALL be mounted exactly once, from `Sidebar.tsx`, as the **first child** of the sidebar (above the existing MIDI Inputs / Outputs / Record Filter / Routing sections).

The panel SHALL render only when ALL of the following hold:

1. `useStage().djActionSelection !== null`.
2. The referenced `trackId` resolves to a `DJActionTrack` in `useStage().djActionTracks`.
3. The referenced `pitch` is a key in that track's `actionMap`.

When any of the above fails, the component MUST return `null` (no DOM contribution).

The panel's outer wrapper element SHALL carry `data-mr-dj-selection-region="true"` so the global outside-click handler treats clicks inside it as "keep selection".

The panel SHALL use the existing `<Panel>` primitive (`src/components/sidebar/Panel.tsx`) with title text `Map Note`.

#### Scenario: Panel is absent when no selection

- **WHEN** `useStage().djActionSelection === null`
- **THEN** there SHALL be no element with class `.mr-map-form` anywhere in the Sidebar
- **AND** the Sidebar SHALL still render the four existing panels (MIDI Inputs / Outputs / Record Filter / Routing)

#### Scenario: Panel mounts when a DJ action row is selected

- **WHEN** the user clicks the action row for pitch 56 on the seeded track `dj1` and `actionMap[56].label === 'Hot Cue 1'`
- **THEN** the Sidebar SHALL contain a `<Panel>` whose head text content includes `Map Note`
- **AND** the panel body SHALL contain exactly one `.mr-map-form` element
- **AND** the `.mr-map-form__hd-title` SHALL contain the text `Hot Cue 1`
- **AND** the `.mr-map-form__hd-sub` SHALL contain the text `G♯3 · note 56`

#### Scenario: Panel is absent when selection points to a missing entry

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` but `actionMap[56]` is `undefined` (e.g. just deleted)
- **THEN** the Sidebar SHALL contain no `.mr-map-form` element

#### Scenario: Outer wrapper carries the selection-region attribute

- **WHEN** the panel is rendered
- **THEN** an ancestor of `.mr-map-form` SHALL carry `data-mr-dj-selection-region="true"`

### Requirement: Map Note form renders category chips, action, device, trigger

The form SHALL contain, in DOM order:

1. A header row with a 24×24px swatch element whose `background` is `devColor(entry.device)`, and a two-line label group containing the action's `label` (top, e.g. `Hot Cue 1`) and a mono subtitle `<pitchLabel> · note <pitch>` (e.g. `G♯3 · note 56`). If `entry.label` is the empty string, the header SHALL render the literal text `— unmapped —` instead.
2. A `Category` section: a small uppercase label `Category` and a wrapping row of category chips, one per key of `DJ_CATEGORIES` (in declared key order: `transport`, `cue`, `hotcue`, `loop`, `fx`, `deck`, `mixer`). The chip whose key equals the current `entry.cat` SHALL carry `data-on="true"` and visually highlight in that category's color (border, text, and tinted background via `color-mix(in oklab, <color> 14%, transparent)`).
3. An `Action` section: a small uppercase label `Action` and a full-width `<select class="mr-select">` populated with the entries of `DEFAULT_ACTION_MAP` whose `cat` matches the current `entry.cat`, sorted by numeric pitch key. Each option's `value` is the entry's `id` and `text` is the entry's `label`. The select's current value SHALL be `entry.id`.
4. A two-column grid containing a `Device` section and a `Trigger` section. The `Device` `<select>` SHALL list every key of `DJ_DEVICES` (in declared order: `deck1`, `deck2`, `deck3`, `deck4`, `fx1`, `fx2`, `mixer`, `global`), each option's text equal to `devLabel(key)`. The `Trigger` `<select>` SHALL contain exactly two options with text `momentary` and `toggle`.
5. A footer row containing a single button with `data-danger="true"` and text content `Delete mapping`.

#### Scenario: Header pitch label is present

- **WHEN** the panel is open for `pitch: 60`
- **THEN** the header subtitle SHALL contain the text `C4`
- **AND** the header subtitle SHALL contain the text `note 60`

#### Scenario: Category chips render in declared order

- **WHEN** the panel is open
- **THEN** the category-chip row SHALL contain exactly 7 buttons
- **AND** their text content SHALL be, in DOM order: `Transport`, `Cue`, `Hot Cue`, `Loop`, `FX`, `Deck`, `Mixer`

#### Scenario: Active category chip carries data-on

- **WHEN** the panel is open for an entry with `cat === 'hotcue'`
- **THEN** exactly one chip in the category row SHALL carry `data-on="true"`
- **AND** that chip's text content SHALL be `Hot Cue`

#### Scenario: Action select is filtered by current category

- **WHEN** the panel is open for an entry with `cat === 'hotcue'`
- **THEN** the Action `<select>` SHALL contain options whose `value` is each `id` in `DEFAULT_ACTION_MAP` whose `cat === 'hotcue'` (and only those)
- **AND** the option whose `value` matches the entry's `id` SHALL be the select's current value

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

- **WHEN** the panel is open for an entry with `cat === 'hotcue'` and the user clicks the `FX` chip
- **THEN** `setActionEntry` SHALL be called with an entry whose `cat === 'fx'` AND `id === 'fx1_on'` (the first FX entry in `DEFAULT_ACTION_MAP` by numeric pitch order)

### Requirement: Delete mapping button removes the entry

The form's `Delete mapping` button SHALL call `useStage().deleteActionEntry(trackId, pitch)` when clicked. After deletion, the panel SHALL render `null` (because the entry no longer resolves), AND the `useStage().djActionSelection` SHALL be cleared by the same call (via the cascading clear in the hook), AND the corresponding action row in `<ActionKeys>` SHALL no longer render.

#### Scenario: Delete removes the entry and clears selection

- **WHEN** the panel is open for `pitch: 56` and the user clicks `Delete mapping`
- **THEN** `deleteActionEntry` SHALL be called once with `(trackId, 56)`
- **AND** after the next render the panel SHALL be absent (`.mr-map-form` no longer in the DOM)
- **AND** `useStage().djActionSelection` SHALL be `null`
- **AND** the DJ action track's keys column SHALL contain no row for pitch 56

