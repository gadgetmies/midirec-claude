## Purpose

Define the right-aside Inspector panel: its mounting in the `.mr-inspector` aside, the three-tab strip (Note, Pressure, Channel), the Note panel's three render states (none, single, multi) driven by `useStage().resolvedSelection`, the single-select and multi-select content layouts, the pure summary helpers that derive multi-select values, and the CSS port of the prototype's inspector primitives.
## Requirements
### Requirement: Inspector mounts in the .mr-inspector aside

The codebase SHALL expose an `<Inspector>` React component at `src/components/inspector/Inspector.tsx`. `AppShell.tsx` SHALL mount exactly one `<Inspector>` element inside the `.mr-inspector` aside, replacing the prior `<span class="mr-stub">Inspector</span>` placeholder.

The Inspector SHALL read its selection state from `useStage()` — specifically the `resolvedSelection`, `channels`, and `rolls` fields — and SHALL NOT receive selection state via React props. The Inspector SHALL NOT mutate stage state in this slice (no bulk-action handlers, no tab persistence to stage state).

#### Scenario: Inspector replaces the stub

- **WHEN** the app is rendered
- **THEN** the `.mr-inspector` aside SHALL contain exactly one element with class `.mr-inspector__panel` (the Inspector's root inside the aside) or equivalent component-root marker
- **AND** the `.mr-inspector` aside SHALL NOT contain any `.mr-stub` element
- **AND** the prior placeholder text "Inspector" SHALL NOT appear

#### Scenario: Inspector reads from useStage, not props

- **WHEN** `<Inspector>` is rendered
- **THEN** its props SHALL NOT include `resolvedSelection`, `channels`, `rolls`, `marquee`, or `selectedIdx`
- **AND** the component SHALL call `useStage()` internally to obtain those values

### Requirement: Inspector renders a three-tab strip with Note active by default

The Inspector SHALL render a `.mr-insp-tabs` element containing exactly three `.mr-insp-tab` children with text content `Note`, `Pressure`, `Channel` in that order. The `Note` tab SHALL carry `data-on="true"` on initial render. Clicking any tab SHALL update the component-local active-tab state so that the clicked tab carries `data-on="true"` and the others do not.

In this slice, only the `Note` tab has body content. When `Pressure` or `Channel` is the active tab, the Inspector body SHALL be empty (no children inside the body container) — no placeholder text, no panels.

#### Scenario: Three tabs render in correct order with Note active

- **WHEN** the Inspector is rendered at mount
- **THEN** the `.mr-insp-tabs` element SHALL contain exactly 3 `.mr-insp-tab` children
- **AND** the children's text content SHALL be `Note`, `Pressure`, `Channel` in DOM order
- **AND** the first child (`Note`) SHALL carry `data-on="true"`
- **AND** the other two SHALL NOT carry `data-on="true"`

#### Scenario: Clicking Pressure activates it and empties the body

- **WHEN** the user clicks the `Pressure` tab
- **THEN** the `Pressure` tab SHALL carry `data-on="true"`
- **AND** the `Note` tab SHALL NOT carry `data-on="true"`
- **AND** the Inspector body SHALL contain no `.mr-kv`, no `.mr-slider`, no `.mr-btn` elements

#### Scenario: Clicking Channel activates it and empties the body

- **WHEN** the user clicks the `Channel` tab
- **THEN** the `Channel` tab SHALL carry `data-on="true"`
- **AND** the Inspector body SHALL contain no `.mr-kv`, no `.mr-slider`, no `.mr-btn` elements

### Requirement: Note panel renders three states based on resolvedSelection

When the active tab is `Note`, the Inspector body SHALL render one of three render states based on `useStage().resolvedSelection`:

- **none** — when `resolvedSelection === null` OR `resolvedSelection.indexes.length === 0`. The body SHALL contain no header swatch, no `.mr-kv` rows, no bulk-actions block. The body MAY be entirely empty.
- **single** — when `resolvedSelection.indexes.length === 1`. The body SHALL render the single-note view (see "Single-select Note panel content").
- **multi** — when `resolvedSelection.indexes.length >= 2`. The body SHALL render the multi-select view (see "Multi-select Note panel content").

The state determination SHALL re-evaluate on every render; switching demo flags or selection state SHALL transition the Inspector between states without remount.

#### Scenario: No selection produces empty body

- **WHEN** the Inspector is rendered with `resolvedSelection === null` (the default no-demo-flag state)
- **THEN** the Inspector body SHALL contain no `.mr-kv` elements
- **AND** the body SHALL contain no `.mr-slider` elements
- **AND** the body SHALL contain no `.mr-btn` elements

#### Scenario: Single selection produces single-note view

- **WHEN** the Inspector is rendered with `resolvedSelection = { channelId: 1, indexes: [3] }` and `useStage().rolls` contains a roll for channelId `1` whose `notes[3]` is defined
- **THEN** the Inspector body SHALL contain exactly four `.mr-kv` elements
- **AND** the body SHALL contain no bulk-actions section

#### Scenario: Multi-selection produces multi view with bulk actions

- **WHEN** the Inspector is rendered with `resolvedSelection.indexes.length === 7`
- **THEN** the Inspector body SHALL contain at least five `.mr-kv` elements (Range, Pitches, Velocity, Length, Channel)
- **AND** the body SHALL contain a `.mr-btn[data-danger="true"]` element whose text content includes `7`

### Requirement: Single-select Note panel content

When in the `single` state, the Inspector body SHALL render in DOM order:

1. A header row with a 28×28px swatch element styled with `background: var(--mr-note-sel)` (a solid-color flat fill, no hatching), and a two-line label group containing the pitch name (e.g. `D♯4`) on top and a mono-font subtitle reading `note <midi-number>` (e.g. `note 63`) below.
2. Four `.mr-kv` rows, in this order:
   - **Start**: key text `Start`, value text equal to `formatBBT(note.t)` followed by ` · ` and the integer tick offset within the beat.
   - **Length**: key text `Length`, value text equal to `note.dur.toFixed(3)` seconds (note: at the placeholder BPM 124, beats and seconds differ; the rendering convention is the prototype's "0.500s · ♩" — for this slice, render `<dur>s` as the primary value, optional symbolic affix is a stretch goal).
   - **Velocity**: key text `Velocity`, value is a flex-row containing a `.mr-slider` with `.mr-slider__fill` width set to `note.vel * 100%` and a `.mr-slider__thumb` at `left: note.vel * 100%`, plus a mono `<span>` to the right with the integer MIDI velocity (e.g. `92` for `vel ≈ 0.72`).
   - **Channel**: key text `Channel`, value text equal to `CH ` + the channel id from `resolvedSelection.channelId`.

Header swatch and label generation SHALL use `formatPitch(note.pitch)` for the pitch name. The MIDI velocity SHALL be `Math.round(note.vel * 127)`.

#### Scenario: Single-select header shows derived pitch and note number

- **WHEN** the Inspector renders with a single-note selection where `note.pitch = 63`
- **THEN** the header pitch label SHALL contain the text `D♯4`
- **AND** the header subtitle SHALL contain the text `note 63`

#### Scenario: Single-select velocity slider reflects the note's velocity

- **WHEN** the Inspector renders with a single-note selection where `note.vel = 0.72`
- **THEN** the `.mr-slider__fill` element's computed width SHALL equal `72%` of the slider's width (within ±1px)
- **AND** the mono velocity readout SHALL display `91` (i.e. `Math.round(0.72 * 127)`)

### Requirement: Multi-select Note panel content

When in the `multi` state, the Inspector body SHALL render in DOM order:

1. A header row with a 28×28px hatched swatch element (class `.mr-insp-swatch--multi` or equivalent, applying a `repeating-linear-gradient(135deg, var(--mr-note-sel), var(--mr-note-sel) 4px, color-mix(in oklab, var(--mr-note-sel) 60%, transparent) 4px, color-mix(in oklab, var(--mr-note-sel) 60%, transparent) 8px)` background, with the prototype's accent box-shadow), and a two-line label group containing `<N> notes selected` on top (where `N = resolvedSelection.indexes.length`) and a mono subtitle of the form `multi · <K> pitches · <M> bars` (where K is the count of distinct pitches and M is the bar-count of the time range).
2. Five `.mr-kv` rows, in this order:
   - **Range**: key text `Range`, value text `<formatBBT(minT)> → <formatBBT(maxT_inclusive)>` where `minT = min(note.t for note in selected)` and `maxT_inclusive = max(note.t + note.dur for note in selected)`.
   - **Pitches**: key text `Pitches`, value text equal to the distinct selected pitches sorted ascending and formatted as `formatPitch(p)` joined by ` · `.
   - **Velocity**: key text `Velocity`, value is a flex-row containing a `.mr-slider` whose `__fill` width reflects the *mean* selected velocity (`mean = sum(vel) / N`). The `.mr-slider` element SHALL carry `data-mixed="true"` if the velocity values are NOT all equal (within an epsilon of `1/127`); else the attribute SHALL be absent. The mono readout SHALL display `~<round(mean * 127)>` if mixed, or `<round(mean * 127)>` if all equal.
   - **Length**: key text `Length`. If all selected notes have equal `dur` (within `0.001` epsilon), the value text SHALL be `<dur.toFixed(3)>s`. Else the value text SHALL be `mixed (<min.toFixed(2)> – <max.toFixed(2)>s)` where min/max are the durations.
   - **Channel**: key text `Channel`. If all selected notes belong to the same channel (which is always true in this slice since selection is per-roll), the value SHALL be `CH ` + the channel id. The `mixed` branch (cross-channel selection) is not exercised in this slice but the helper SHALL handle it for forward compatibility.
3. A 1px `var(--mr-line-1)` divider.
4. An eyebrow row with text `BULK ACTIONS` (uppercase, tracked, in `var(--mr-text-3)`).
5. A button grid with six `.mr-btn` elements:
   - Row 1: `Quantize`, `Nudge ←→`
   - Row 2: `Transpose`, `Velocity ±`
   - Row 3 (full-width, `gridColumn: '1 / -1'`): `Duplicate`
   - Row 4 (full-width, `gridColumn: '1 / -1'`, `data-danger="true"`): `Delete <N>` (the count from `resolvedSelection.indexes.length`)

All bulk-action buttons SHALL render with `onClick` set to a no-op handler (or omitted entirely such that clicks have no effect). Clicking any of them SHALL NOT mutate stage state.

#### Scenario: Multi-select header reflects derived count and pitch summary

- **WHEN** the Inspector renders with `resolvedSelection.indexes.length === 7` and the selected notes have 4 distinct pitches
- **THEN** the header line SHALL contain the text `7 notes selected`
- **AND** the header subtitle SHALL contain `multi`, `4 pitches`, and a bar-count substring

#### Scenario: Velocity slider is mixed when velocities differ

- **WHEN** the Inspector renders with selected notes whose velocities are not all equal
- **THEN** the `.mr-slider` element in the Velocity row SHALL carry `data-mixed="true"`
- **AND** the mono velocity readout text SHALL begin with `~`

#### Scenario: Length row says "mixed" when durations differ

- **WHEN** the Inspector renders with selected notes whose `dur` values differ by more than `0.001`
- **THEN** the Length row's value text SHALL begin with `mixed (`

#### Scenario: Delete button shows the selection count

- **WHEN** the Inspector renders with `resolvedSelection.indexes.length === 7`
- **THEN** there SHALL be a `.mr-btn[data-danger="true"]` whose text content equals `Delete 7`

#### Scenario: Bulk-action buttons are inert

- **WHEN** the user clicks the Quantize button (or Nudge, Transpose, Velocity ±, Duplicate, Delete N)
- **THEN** the rendered selection state SHALL be unchanged
- **AND** no toast SHALL appear
- **AND** no observable side effect SHALL occur

### Requirement: Multi-select summary values are derived by pure helpers

The codebase SHALL expose a pure helper module at `src/components/inspector/summary.ts` containing:

- `formatBBT(t: number, sig?: { num: number; den: number }): string` — converts a beat-time into a 1-indexed bar.beat.sixteenth string of the form `<bar>.<beat>.<sixteenth>`. Default time signature is `4/4`. Bar = `Math.floor(t / sig.num) + 1`. Beat = `Math.floor(t % sig.num) + 1`. Sixteenth = `Math.floor((t % 1) * 4) + 1`. Two-digit zero-padded bar; single-digit beat and sixteenth.
- `formatPitch(midi: number): string` — converts a MIDI integer to a pitch label using sharp accidentals (`C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B`) and an octave number where `MIDI 60 == C4`. (If a `pitchLabel` helper already exists in `src/components/piano-roll/notes.ts`, that helper SHALL be reused or moved.)
- `summarizeSelection(notes: Note[], indexes: number[], channelName: string): InspectorSummary` — returns a structured summary of `count`, `range: { t0, t1 }`, `pitches: number[]` (distinct, sorted), `velocity: { mean: number, mixed: boolean }`, `length: { uniform: number | null, range: [number, number] }`, `channelLabel: string`.

These helpers SHALL be deterministic and pure — no `Date`, `Math.random`, or DOM access. They SHALL be unit-tested in `src/components/inspector/summary.test.ts` (or equivalent test file) covering at minimum: BBT formatting at integer and fractional beats, pitch formatting at C4/middle-C and edge octaves, mixed-vs-uniform velocity detection, and length-range computation.

#### Scenario: formatBBT for integer beats

- **WHEN** `formatBBT(0)` is called
- **THEN** the result SHALL be `01.1.1`
- **WHEN** `formatBBT(4)` is called
- **THEN** the result SHALL be `02.1.1`
- **WHEN** `formatBBT(6.5)` is called
- **THEN** the result SHALL be `02.3.3`

#### Scenario: formatPitch covers sharps and octaves

- **WHEN** `formatPitch(60)` is called
- **THEN** the result SHALL be `C4`
- **WHEN** `formatPitch(63)` is called
- **THEN** the result SHALL be `D♯4`

#### Scenario: summarizeSelection detects mixed velocity

- **WHEN** `summarizeSelection(notes, indexes, "Lead")` is called with selected notes whose velocities are `[0.5, 0.7, 0.8]`
- **THEN** the result's `velocity.mixed` SHALL be `true`
- **AND** the result's `velocity.mean` SHALL equal `0.6667` within `0.001`

#### Scenario: summarizeSelection produces uniform length when all equal

- **WHEN** `summarizeSelection` is called with selected notes whose `dur` is `[0.5, 0.5, 0.5]`
- **THEN** the result's `length.uniform` SHALL equal `0.5`
- **AND** the result's `length.range` SHALL equal `[0.5, 0.5]`

### Requirement: Inspector CSS ports prototype primitives

The codebase SHALL ship `src/components/inspector/Inspector.css` containing the rules from `prototype/app.css` lines ~905–1001 covering: `.mr-inspector` (the aside surface — though this rule may already be covered by `AppShell.css`; if so, omit to avoid duplicate declarations), `.mr-insp-tabs`, `.mr-insp-tab`, `.mr-insp-tab[data-on="true"]`, `.mr-kv`, `.mr-kv__k`, `.mr-kv__v`, `.mr-slider`, `.mr-slider__fill`, `.mr-slider__thumb`, `.mr-slider[data-mixed="true"] .mr-slider__fill`, plus a new `.mr-insp-swatch--multi` rule capturing the prototype's inline hatched-swatch background.

All visual values SHALL resolve through `--mr-*` tokens (or `rgba(...)` literals already present in the prototype's same lines, e.g. white slider thumb).

#### Scenario: No new hex literals in Inspector CSS

- **WHEN** the file `src/components/inspector/Inspector.css` is inspected
- **THEN** every color value SHALL be either `var(--mr-*)`, `color-mix(...)`, an `rgba(...)` literal already present in the prototype's lines ~905–1001, `currentColor`, `transparent`, `inherit`, or `#fff` for the slider thumb (the only hex literal in the prototype's ported range)
- **AND** there SHALL be no new `oklch(...)` literals

#### Scenario: Inspector tab strip has the prototype's geometry

- **WHEN** the Inspector is rendered
- **THEN** the `.mr-insp-tabs` element's computed `height` SHALL be `28px`
- **AND** its computed `border-bottom` SHALL match `var(--mr-bw-1) solid var(--mr-line-1)`
- **AND** the active tab's computed `border-bottom-color` SHALL match `var(--mr-accent)`

### Requirement: Note tab renders an Output mapping panel when a DJ action row is selected

The Inspector's Note tab body SHALL render an **Output mapping panel** when `useStage().djActionSelection !== null` AND the active tab is `Note`. The panel SHALL replace the channel/roll-based Note panel content (no concurrent rendering of both). The three render states defined by the prior `Inspector renders three states based on resolvedSelection` requirement (none, single, multi) SHALL apply only when `djActionSelection === null`.

The Output mapping panel SHALL be wrapped in an element carrying `data-mr-dj-selection-region="true"` so the outside-click handler treats clicks inside it as "keep selection".

If `djActionSelection` references a `(trackId, pitch)` whose `actionMap[pitch]` is no longer present (because it was deleted), the panel SHALL render an empty body (no header, no rows, no buttons). This mirrors the safety guard in the Sidebar's Map Note panel.

The panel SHALL render, in DOM order:

1. A header row with a 28×28px swatch element whose `background` is `devColor(entry.device)` (resolved from the **input** binding), and a two-line label group containing the action's `label` on top (e.g. `Hot Cue 1`) and a mono-font subtitle of the form `in <pitchLabel> · note <pitch>` (e.g. `in G♯3 · note 56`). The `in` prefix signals that the displayed pitch is the input pitch, not the output pitch.
2. An eyebrow row with the uppercase text `Output`.
3. When `track.outputMap[pitch]` is `undefined`, a hint line with the text `No output configured. Editing any field below will create the mapping.` (placed below the eyebrow, above the input rows).
4. A `.mr-kv` row with key text `Device` and a value that is a `<select class="mr-select">` populated with the keys of `DJ_DEVICES` in declared order; each option's text is `devLabel(key)`. The select's current value SHALL be the existing `outputMap[pitch].device` if set, otherwise the input binding's `entry.device`.
5. A `.mr-kv` row with key text `Channel` and a value that is an `<input type="number" min="1" max="16" class="mr-input">`. The current value SHALL be the existing `outputMap[pitch].channel` if set, otherwise `1`.
6. A `.mr-kv` row with key text `Pitch` and a value that contains an `<input type="number" min="0" max="127" class="mr-input">` followed by a `<span>` showing `pitchLabel(currentPitch)`. The input's current value SHALL be the existing `outputMap[pitch].pitch` if set, otherwise the input binding's `pitch`.
7. When `outputMap[pitch]` is set (i.e. the mapping has been created), a footer row containing a single button with `data-danger="true"` and text content `Delete output`.
8. When ALL of the following hold — `djEventSelection !== null`, the event selection refers to the same `(trackId, pitch)` as `djActionSelection`, `actionMap[pitch]?.pressure === true`, and `track.events[djEventSelection.eventIdx] !== undefined` — a Pressure section SHALL render below the Output rows (see the `dj-pressure-editor` capability for the section's internal layout). When any of those conditions is false, the Pressure section SHALL NOT render.

#### Scenario: Output panel renders for a selected DJ action row with no existing outputMap

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }`, the seeded track has `actionMap[56].label === 'Hot Cue 1'` and `actionMap[56].device === 'deck1'`, and `outputMap[56] === undefined`
- **AND** the active Inspector tab is `Note`
- **THEN** the Inspector body SHALL contain the hint text `No output configured. Editing any field below will create the mapping.`
- **AND** the body's header SHALL contain the text `Hot Cue 1`
- **AND** the body's header SHALL contain the text `in G♯3 · note 56`
- **AND** the Device `<select>` SHALL have current value `deck1` (matches the input device)
- **AND** the Channel `<input>` SHALL have current value `1`
- **AND** the Pitch `<input>` SHALL have current value `56` and its readout SHALL contain the text `G♯3`
- **AND** the body SHALL NOT contain a button with text `Delete output`

#### Scenario: Output panel renders existing outputMap values when set

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and `outputMap[56] === { device: 'deck2', channel: 5, pitch: 64 }`
- **THEN** the Device `<select>` SHALL have current value `deck2`
- **AND** the Channel `<input>` SHALL have current value `5`
- **AND** the Pitch `<input>` SHALL have current value `64` and its readout SHALL contain `E4`
- **AND** the body SHALL contain a button with text `Delete output`

#### Scenario: Output panel handles missing actionMap entry safely

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` but `actionMap[56]` is `undefined`
- **THEN** the Inspector body SHALL contain no `.mr-kv` rows
- **AND** the Inspector body SHALL contain no `Device` / `Channel` / `Pitch` inputs

#### Scenario: Output panel wrapper carries the selection-region attribute

- **WHEN** the Output panel is rendered
- **THEN** the wrapper element SHALL carry `data-mr-dj-selection-region="true"`

#### Scenario: Pressure section renders below Output rows when an event is selected on a pressure-bearing action

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` AND `actionMap[56].pressure === true` AND `track.events[2]` exists
- **THEN** the Inspector body SHALL contain exactly one `.mr-pressure` element
- **AND** that `.mr-pressure` element SHALL be a child of the same wrapper that contains the Output `.mr-kv` rows

#### Scenario: Pressure section absent when event is not selected

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === null`
- **THEN** the Inspector body SHALL contain the Output rows
- **AND** the Inspector body SHALL NOT contain any `.mr-pressure` element

#### Scenario: Pressure section absent when action does not support pressure

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 48 }` AND `djEventSelection === { trackId: 'dj1', pitch: 48, eventIdx: 0 }` AND `actionMap[48].pressure !== true`
- **THEN** the Inspector body SHALL contain the Output rows for the action
- **AND** the Inspector body SHALL NOT contain any `.mr-pressure` element

### Requirement: Output form changes auto-save via setOutputMapping

Every field change on the Output panel SHALL call `useStage().setOutputMapping(trackId, pitch, mergedMapping)` exactly once with the new value merged into the current mapping. When no `outputMap[pitch]` existed before, the first edit SHALL create the entry using the form's current default values (input device, channel 1, input pitch) with the edited field overridden.

The Channel input SHALL clamp values to the inclusive range `1..16`. The Pitch input SHALL clamp values to the inclusive range `0..127`. The **CC# input, when present, SHALL clamp to `0..127`**. Out-of-range input MUST NOT throw or produce invalid persisted state.

#### Scenario: Editing the Channel input commits immediately

- **WHEN** the panel is open for `pitch: 56` with no existing outputMap entry, and the user changes the Channel input from `1` to `5`
- **THEN** `setOutputMapping` SHALL be called once with `(trackId, 56, { device, channel: 5, pitch })` where `device` matches the input's device and `pitch` matches the input pitch
- **AND** after the next render, the panel SHALL show the `Delete output` button (because the entry now exists)

#### Scenario: Editing the Pitch input updates the readout

- **WHEN** the user changes the Pitch input from `56` to `60`
- **THEN** `setOutputMapping` SHALL be called with a mapping whose `pitch === 60`
- **AND** the pitch readout SHALL contain the text `C4`

#### Scenario: Channel clamps out-of-range input

- **WHEN** the user enters `99` in the Channel input
- **THEN** the value passed to `setOutputMapping` SHALL be `16`

#### Scenario: CC# clamps out-of-range input

- **WHEN** the user enters `200` in the CC# input
- **THEN** the value passed to `setOutputMapping` SHALL be `127`

### Requirement: Delete output button removes the outputMap entry

The `Delete output` button SHALL call `useStage().deleteOutputMapping(trackId, pitch)` when clicked. After deletion the panel re-renders with the no-mapping hint and the button SHALL no longer be present. The `djActionSelection` SHALL be unchanged by this action.

#### Scenario: Delete output clears the entry and re-shows the hint

- **WHEN** the panel is open for `pitch: 56` with an existing outputMap entry and the user clicks `Delete output`
- **THEN** `deleteOutputMapping` SHALL be called once with `(trackId, 56)`
- **AND** after the next render the Inspector body SHALL contain the hint text `No output configured. Editing any field below will create the mapping.`
- **AND** the body SHALL NOT contain a button with text `Delete output`
- **AND** `useStage().djActionSelection` SHALL be unchanged

### Requirement: Output panel and channel/roll Note panel are mutually exclusive

When `djActionSelection !== null`, the Inspector SHALL NOT render the channel/roll Note panel content (none/single/multi). Conversely, when `djActionSelection === null`, the Output panel SHALL NOT render — the inspector reverts to the existing `resolvedSelection`-driven Note panel.

This rule preserves the Slice 5 contract for channel/roll selection and does not change the three-tab strip's behavior.

#### Scenario: DJ selection suppresses channel-roll Note panel

- **WHEN** `useStage().djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `useStage().resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the Output panel
- **AND** the Inspector body SHALL NOT contain the single-select channel/roll header rows for the channel note (no `Start` / `Length` `.mr-kv` rows from that panel)

#### Scenario: Clearing DJ selection restores channel-roll Note panel

- **WHEN** `djActionSelection` transitions from `{ trackId: 'dj1', pitch: 56 }` to `null` AND `resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the single-select channel/roll Note panel (four `.mr-kv` rows: `Start`, `Length`, `Velocity`, `Channel`)
- **AND** the Inspector body SHALL NOT contain the `Device` / `Channel` / `Pitch` inputs from the Output panel

### Requirement: DJ Output panel exposes output CC number when mapping Control Change

When the selected action row’s output uses **Control Change** (i.e. `outputMap[pitch].cc` is set, or the row is a continuous mixer control per `dj-action-tracks` such that the UI offers CC output), the Output mapping panel SHALL render a `.mr-kv` row with key text **`CC#`** and a numeric `<input type="number" min="0" max="127" class="mr-input">` bound to `outputMap[pitch].cc`. When **`cc` is unset**, the input SHALL show an empty or placeholder state until the user enters a value, at which point `setOutputMapping` creates or updates `cc`. When **`cc`** is set, changing the field SHALL commit per the existing auto-save requirement. Rows that only emit **note** output MAY omit the `CC#` row when `cc` is absent and the action is not mixer-CC-backed; when the product always shows both Pitch and CC#, **Pitch** remains the note output and **CC#** is optional until filled.

#### Scenario: CC row appears for mixer crossfader output mapping

- **WHEN** `djActionSelection` references a mixer `xfade_pos` row and the user edits output
- **THEN** the Inspector body SHALL contain a `.mr-kv` row whose key label is `CC#`
- **AND** editing the value SHALL call `setOutputMapping` with an updated `cc` field

#### Scenario: Mapping persists cc in outputMap

- **WHEN** the user sets `CC#` to `11`
- **THEN** `useStage().setOutputMapping` SHALL be called with a mapping that includes `cc: 11` merged with device/channel/pitch

