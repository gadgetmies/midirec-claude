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
2. Six `.mr-kv` rows, in this order:
   - **Start**: key text `Start`, value consisting of editable controls (**not** a single static `<span>` only): **(a)** an input accepting a three-part numerical timeline position string canonically formatted like `formatBBT`/`01.1.1` (`bar.beat.subdivision`, 1-based, zero-padded bar as enforced by helpers), encoding the note's **`tTicks` start on commit**, and **(b)** an input for the **integer `tTicks`** start (session tick axis). Both controls SHALL reflect the selected note's current `tTicks` when focus is not committing a dirty edit; after a successful commit from either control, **`tTicks` SHALL update** on the targeted note **and** the other control's displayed value SHALL stay **consistent** with the new **`tTicks`**. Parsed BB(T) commits SHALL coerce to **`tTicks`** using the session TPQ lattice and documented rounding policy; malformed or incomplete committed input SHALL **not** mutate the note **and SHALL** preserve or revert the field UX per product rules documented in implementation.
   - **End**: key text `End`, value consisting of editable controls — **(a)** a phrase·bar·beat input encoding **`endTicks = tTicks + durTicks`** and **(b)** an integer **`endTicks`** input. Both controls SHALL reflect the selected note's current `tTicks + durTicks` when focus is not committing a dirty edit; after a successful commit, **`durTicks` SHALL be set to `max(1, committedEndTicks − tTicks)`** on the targeted note (i.e., the note's `tTicks` SHALL NOT change; only `durTicks` adjusts) **and** the other End control SHALL stay consistent with the resulting `endTicks`. A committed `endTicks` less than or equal to `tTicks` SHALL revert the field UX to canonical without mutating the note. The Length controls SHALL re-canonicalize from the new `durTicks` after any End commit.
   - **Length**: key text `Length`, value consisting of editable controls — **(a)** a numeric input accepting a decimal **beats** value (e.g. `1.000`) bound to the note's **`durTicks`** via `beatsToSessionTicks` at the session TPQ, and **(b)** an input for the **integer `durTicks`** raw value. Both controls SHALL reflect the selected note's current `durTicks` when focus is not committing a dirty edit; after a successful commit from either control, **`durTicks` SHALL update** on the targeted note (clamped to a minimum of `1`) **and** the other control's displayed value SHALL stay **consistent** with the new **`durTicks`**. Malformed or non-numeric committed input SHALL **not** mutate the note and SHALL revert the field UX.
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
- **AND** the mono velocity readout SHALL display `91` (i.e., `Math.round(0.72 * 127)`)

#### Scenario: Start row exposes phrase-bar-beat and ticks editors

- **WHEN** the Inspector renders with a valid single-note selection
- **THEN** the **Start** row SHALL contain editable inputs for phrase-bar-beat-style position **and** for integer **`tTicks`**
- **AND** neither input SHALL mutate the note solely from partial typing prior to commit

#### Scenario: Commit ticks input updates note position

- **WHEN** the user commits a new valid **`tTicks`** integer for the Start row
- **THEN** the persisted note **`tTicks`** SHALL equal that committed value **before** fractional beat display helpers run
- **AND** the phrase-bar-beat field SHALL thereafter reflect the decoding of **`tTicks`**

#### Scenario: Commit phrase-bar-beat updates note ticks

- **WHEN** the user commits a valid three-part timeline string aligned with the display lattice
- **THEN** the note **`tTicks`** SHALL be updated per the lattice mapping and rounding policy
- **AND** the ticks input SHALL thereafter display the resulting **`tTicks`**

#### Scenario: Length row exposes beats and ticks editors

- **WHEN** the Inspector renders with a valid single-note selection
- **THEN** the **Length** row SHALL contain editable inputs for a decimal beats value **and** for integer **`durTicks`**
- **AND** neither input SHALL mutate the note solely from partial typing prior to commit

#### Scenario: Commit beats input updates note duration

- **WHEN** the user commits a new valid decimal beats value in the Length row that resolves to a different integer `durTicks`
- **THEN** the persisted note **`durTicks`** SHALL equal `max(1, beatsToSessionTicks(beats, TPQ))`
- **AND** the Length ticks input SHALL thereafter reflect the resulting **`durTicks`**
- **AND** the End controls SHALL re-canonicalize from the new `tTicks + durTicks`

#### Scenario: End row exposes phrase-bar-beat and ticks editors

- **WHEN** the Inspector renders with a valid single-note selection
- **THEN** the **End** row SHALL contain editable inputs for a phrase·bar·beat absolute end position **and** for integer **`endTicks`**, both reflecting `tTicks + durTicks`

#### Scenario: Commit End updates durTicks only

- **WHEN** the user commits a new valid `endTicks` greater than the note's current `tTicks`
- **THEN** the persisted note **`durTicks`** SHALL equal `endTicks − tTicks`
- **AND** the note's **`tTicks`** SHALL be unchanged
- **AND** the Length controls SHALL thereafter reflect the resulting **`durTicks`**

#### Scenario: Commit End less than or equal to Start reverts field UX

- **WHEN** the user commits an `endTicks` ≤ the note's current `tTicks`
- **THEN** the note's `durTicks` SHALL NOT be mutated
- **AND** the End input(s) SHALL re-canonicalize from the stored `tTicks + durTicks`

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
5. A row exposing **MIDI learn** for this output mapping: a control that complies with the **midi-learn** capability (arm/disarm, single capture into `setOutputMapping` while retaining the virtual `device` key). The row SHALL use `.mr-kv` layout consistency with neighboring rows (key label e.g. `Learn` or action-only value cell as implemented) **and** SHALL appear **after** the Device row **and before** the Channel row.
6. A `.mr-kv` row with key text `Channel` and a value that is an `<input type="number" min="1" max="16" class="mr-input">`. The current value SHALL be the existing `outputMap[pitch].channel` if set, otherwise `1`.
7. A `.mr-kv` row with key text `Pitch` and a value that contains an `<input type="number" min="0" max="127" class="mr-input">` followed by a `<span>` showing `pitchLabel(currentPitch)`. The input's current value SHALL be the existing `outputMap[pitch].pitch` if set, otherwise the input binding's `pitch`.
8. When `outputMap[pitch]` is set (i.e. the mapping has been created), a footer row containing a single button with `data-danger="true"` and text content `Delete output`.

The Inspector body SHALL NOT render any `.mr-pressure` element. The pressure section that previously appeared below the Output rows (when `djEventSelection` referred to a pressure-bearing event on the same row) has been removed: pressure editing now happens in the dedicated DJ value editor (see `dj-value-editor` capability), which mounts as a global sticky footer keyed off `djEventSelection`.

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

#### Scenario: Inspector body never contains a pressure section

- **WHEN** the Inspector renders for any combination of `djActionSelection` and `djEventSelection`
- **THEN** the Inspector body SHALL NOT contain any `.mr-pressure` element
- **AND** the Inspector body SHALL NOT contain any `.mr-pressure__graph`, `.mr-pressure__summary`, `.mr-pressure__bulk`, `.mr-pressure__mode`, or `.mr-pressure__eyebrow` element

#### Scenario: Output learn appears between Device and Channel

- **WHEN** the row-level Output mapping panel is rendered for `djActionSelection` with a valid `actionMap` entry
- **THEN** the element tree SHALL contain the Device `.mr-kv` row before the Learn row
- **AND** the Learn row SHALL appear before the Channel `.mr-kv` row

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

When `djActionSelection !== null`, the Inspector SHALL NOT render the channel/roll Note panel content (none/single/multi). When `djActionSelection === null` AND `selectedTimelineTrack?.kind === 'dj'`, the Inspector SHALL render the **DJ track output mapping panel** (see "Note tab renders a DJ track output mapping panel when a DJ timeline track is selected") instead of the `resolvedSelection`-driven channel Note panel, even if `resolvedSelection` would otherwise show single/multi content. When `djActionSelection === null` AND `selectedTimelineTrack` is **not** a DJ track selection, the Output panel SHALL NOT render — the inspector reverts to the existing `resolvedSelection`-driven Note panel.

This rule preserves the Slice 5 contract for channel/roll selection and does not change the three-tab strip's behavior.

#### Scenario: DJ selection suppresses channel-roll Note panel

- **WHEN** `useStage().djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `useStage().resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the Output panel (row-level)
- **AND** the Inspector body SHALL NOT contain the single-select channel/roll header rows for the channel note (no `Start` / `Length` `.mr-kv` rows from that panel)

#### Scenario: Clearing DJ selection restores channel-roll Note panel

- **WHEN** `djActionSelection` transitions from `{ trackId: 'dj1', pitch: 56 }` to `null` AND `resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the single-select channel/roll Note panel (four `.mr-kv` rows: `Start`, `Length`, `Velocity`, `Channel`)
- **AND** the Inspector body SHALL NOT contain the `Device` / `Channel` / `Pitch` inputs from the row-level Output panel

#### Scenario: DJ timeline track suppresses channel-roll Note panel without row selection

- **WHEN** `djActionSelection === null` AND `selectedTimelineTrack === { kind: 'dj', trackId: 'dj1' }` AND `resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the DJ track output mapping panel
- **AND** the Inspector body SHALL NOT contain the single-select channel/roll Note panel rows (`Start`, `Length`, etc.)

### Requirement: DJ Output panel exposes output CC number when mapping Control Change

When the selected action row’s output uses **Control Change** (i.e. `outputMap[pitch].cc` is set, or the row is a continuous mixer control per `dj-action-tracks` such that the UI offers CC output), the Output mapping panel SHALL render a `.mr-kv` row with key text **`CC#`** and a numeric `<input type="number" min="0" max="127" class="mr-input">` bound to `outputMap[pitch].cc`. When **`cc` is unset**, the input SHALL show an empty or placeholder state until the user enters a value, at which point `setOutputMapping` creates or updates `cc`. When **`cc`** is set, changing the field SHALL commit per the existing auto-save requirement. Rows that only emit **note** output MAY omit the `CC#` row when `cc` is absent and the action is not mixer-CC-backed; when the product always shows both Pitch and CC#, **Pitch** remains the note output and **CC#** is optional until filled.

#### Scenario: CC row appears for mixer crossfader output mapping

- **WHEN** `djActionSelection` references a mixer `xfade_pos` row and the user edits output
- **THEN** the Inspector body SHALL contain a `.mr-kv` row whose key label is `CC#`
- **AND** editing the value SHALL call `setOutputMapping` with an updated `cc` field

#### Scenario: Mapping persists cc in outputMap

- **WHEN** the user sets `CC#` to `11`
- **THEN** `useStage().setOutputMapping` SHALL be called with a mapping that includes `cc: 11` merged with device/channel/pitch

### Requirement: Note tab renders a DJ track output mapping panel when a DJ timeline track is selected

When the active tab is `Note` AND `useStage().djActionSelection === null` AND `useStage().selectedTimelineTrack !== null` AND `selectedTimelineTrack.kind === 'dj'`, the Inspector body SHALL render a **DJ track output mapping panel** for the track `id === selectedTimelineTrack.trackId`.

The panel SHALL:

- Wrap its root in an element carrying `data-mr-dj-selection-region="true"`.
- Render a track header (name / color consistent with existing Inspector styling conventions) and a **track default** `.mr-kv` row for **MIDI output** whose `<select>` lists all outputs from `useMidiOutputs()` (or equivalent hook), bound to `setDJTrackDefaultMidiOutputDevice`, including a sentinel option for “default / system” when `defaultMidiOutputDeviceId` is empty.
- List **one block per pitch** in `track.actionMap` sorted ascending by pitch. Each block SHALL identify the action (`entry.label`, `devColor(entry.device)` swatch) and SHALL expose:
  - MIDI **output** `<select>` with “Track default” (or equivalent) when the row has no `outputMap[pitch].midiOutputDeviceId`, else the specific port id; changes commit via `setOutputMapping` merging the existing mapping.
  - **Channel** `1..16` bound to `outputMap[pitch].channel` with fallback to `track.midiChannel` when no `outputMap[pitch]` exists, same auto-save behavior as the single-row Output panel.
  - **Pitch** (note number `0..127`) when the row’s effective playback mode is **note** (not CC-out per `dj-action-tracks` / `defaultMixerOutputCc` / pressure rules).
  - **CC#** `0..127` when the row’s effective playback mode is **CC-out**, matching the visibility rules of the existing per-row Output panel.

The panel SHALL NOT render when `djActionSelection !== null` (row-level Action panel takes precedence).

#### Scenario: Track panel appears when timeline DJ track is focused

- **WHEN** `selectedTimelineTrack === { kind: 'dj', trackId: 'dj1' }`, `djActionSelection === null`, and the Note tab is active
- **THEN** the Inspector body SHALL contain a region with `data-mr-dj-selection-region="true"`
- **AND** that region SHALL list one mapping block per key in `actionMap` for `dj1`

#### Scenario: Row selection hides the track panel

- **WHEN** `djActionSelection !== null` for the same `trackId` as `selectedTimelineTrack`
- **THEN** the Inspector body SHALL render the single-row Output / Action panel instead of the track-level list panel

### Requirement: DJ event timing editor inside Note tab Output region

When `djActionSelection` and `djEventSelection` refer to the same `(trackId, pitch)` and the Note tab renders the DJ **row-level** Output mapping panel, the panel SHALL include the following editor block, in DOM order:

1. A **Start** editor — two-field tick-native start-time editor used by the instrument-channel `SingleNoteView`: a **phrase·bar·beat (BBT) input** plus an **integer ticks input**, both bound to the event's **`tTicks`**.
2. An **End** editor — a **phrase·bar·beat (BBT) input** plus an **integer ticks input**, both bound to the derived **`endTicks = tTicks + effectiveDurTicks`**.
3. A **Length** editor — a **decimal beats input** plus an **integer ticks input**, both bound to the event's **`effectiveDurTicks`**. The beats input parses via `beatsToSessionTicks(parseFloat, SESSION_TPQ)` and renders the inverse for display.

`effectiveDurTicks` SHALL equal the event's own `durTicks` for single events (non-clustered, or non-representative cluster members) and SHALL equal the cluster's total span (`max(member.tTicks + member.durTicks) − representative.tTicks`) when the selected event is the representative of a `CcMergedGroup`. The same value is what the stage DJ-event duration mutator interprets as the cluster span on commit, ensuring read/write symmetry.

When the row's action has render mode `trigger` (per `actionMode(entry)` in `src/data/dj.ts` — momentary deck buttons such as Play, Cue, Sync, Reverse), the **End** and **Length** editors SHALL NOT render. The **Start** editor SHALL still render. Trigger-style events are momentary glyphs without a meaningful duration; exposing duration editors for them would invite edits that have no observable effect on playback or timeline rendering.

The editors SHALL commit on input `blur` and on `Enter` keydown.

- A Start commit SHALL update the referenced event's `tTicks` via the stage DJ-event start-time mutator (see `dj-action-tracks` spec).
- A Length commit SHALL update the referenced event's `durTicks` via the stage DJ-event duration mutator (see `dj-action-tracks` spec), clamped to a minimum of `1` tick.
- An End commit SHALL update the referenced event's `durTicks` to `max(1, committedEndTicks − tTicks)` via the same DJ-event duration mutator. The event's `tTicks` SHALL NOT change. A committed `endTicks` ≤ the event's `tTicks` SHALL re-canonicalize the End fields without mutating the event.
- A commit whose parsed value equals the current stored value SHALL be a no-op that re-canonicalizes the corresponding draft fields.

After any commit, the other two editor blocks SHALL stay consistent: changing `tTicks` re-canonicalizes Start and End; changing `durTicks` re-canonicalizes Length and End.

When only the **track-level** DJ panel is visible (`djActionSelection === null` with timeline DJ track focused), none of the Start, Length, or End editors SHALL render.

When `djEventSelection` is null, refers to a different `(trackId, pitch)`, or its `eventIdx` is out of range or its event's `pitch` no longer matches the row pitch, none of the Start, Length, or End editors SHALL render.

#### Scenario: Row Output panel includes Start, Length, and End fields when an event is selected

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` and `track.events[2].pitch === 56`
- **THEN** the Inspector Note body SHALL contain the Output mapping rows AND a two-field Start editor reflecting `track.events[2].tTicks` AND a two-field End editor reflecting `track.events[2].tTicks + effectiveDurTicks` AND a two-field Length editor reflecting `effectiveDurTicks` (where `effectiveDurTicks` equals `track.events[2].durTicks` for single events and equals the cluster span when the event is the representative of a `CcMergedGroup`)

#### Scenario: Trigger-style action hides End and Length editors

- **WHEN** `djEventSelection` references an event whose row's action returns `'trigger'` from `actionMode(entry)` (e.g. Play, Cue, Sync, Reverse on a deck row)
- **THEN** the Inspector SHALL render the Start editor for that event
- **AND** the Inspector SHALL NOT render the End or Length editors for that event

#### Scenario: Track-level panel omits the editor block without row selection

- **WHEN** `selectedTimelineTrack.kind === 'dj'` AND `djActionSelection === null`
- **THEN** the Inspector SHALL NOT render the per-event Start, Length, or End editors

#### Scenario: Stale event selection hides the editor block

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection.eventIdx` is past the end of `track.events` OR the event at that index has a `pitch` other than 56
- **THEN** the Inspector SHALL NOT render the Start, Length, or End editors

#### Scenario: Commit Start on Enter writes tTicks via the stage mutator

- **WHEN** the user edits the Start BBT field to a value that canonicalizes to a different `tTicks` and presses `Enter`
- **THEN** the Inspector SHALL invoke the DJ-event start-time mutator with the new `tTicks`
- **AND** the input SHALL blur
- **AND** the End fields SHALL re-canonicalize from the updated `tTicks + durTicks`

#### Scenario: Commit Length writes durTicks via the stage mutator

- **WHEN** the user edits the Length beats field to a value that resolves to a different `durTicks` and blurs
- **THEN** the Inspector SHALL invoke the DJ-event duration mutator with the new `durTicks`
- **AND** the End fields SHALL re-canonicalize from the updated `tTicks + durTicks`

#### Scenario: Commit End updates durTicks only

- **WHEN** the user edits the End ticks field to a value greater than the event's current `tTicks` and blurs
- **THEN** the Inspector SHALL invoke the DJ-event duration mutator with `durTicks = endTicks − tTicks`
- **AND** the event's `tTicks` SHALL be unchanged
- **AND** the Length fields SHALL re-canonicalize from the updated `durTicks`

#### Scenario: Commit End less than or equal to Start reverts field UX

- **WHEN** the user commits an `endTicks` ≤ the event's current `tTicks`
- **THEN** the Inspector SHALL NOT invoke the DJ-event duration mutator
- **AND** the End BBT and ticks drafts SHALL re-canonicalize from the stored `tTicks + durTicks`

#### Scenario: Commit equal to current value re-canonicalizes draft

- **WHEN** the user edits any of the Start, Length, or End fields to a string that parses back to the currently stored value and blurs
- **THEN** the Inspector SHALL NOT invoke any mutator
- **AND** all drafts in the edited row SHALL be reset from the stored canonical values

### Requirement: Channel-roll Inspector summaries derive range from tTicks

Where the Inspector Note panel summarizes channel-roll selections (`summarizeSelection`, range rows), computations SHALL use **`tTicks` / `durTicks`** (or tick-derived beat floats built once from ticks for display-only), not legacy floating **`Note.t`** fields.

#### Scenario: Selection range uses tick endpoints

- **WHEN** selected notes carry `tTicks` and `durTicks`
- **THEN** reported temporal range SHALL match `(min tTicks)` through `(max tTicks + durTicks)` on the tick axis

### Requirement: Inspector renders a MIDI Clock Send section pinned at the bottom

The Inspector aside (`.mr-inspector`) SHALL render an additional section with class `.mr-insp-clock-send` as its **last child**, after the tabbed content. This section SHALL be present regardless of which tab is currently active and regardless of any timeline selection state — it is a global config surface, not a selection-driven panel.

The section SHALL be collapsible via a clickable header following the existing Sidebar panel pattern: a header element of class `.mr-panel__head` whose click handler toggles a local `[data-open]` boolean. Default `data-open === "true"` (open on first mount).

When `data-open === "false"`, the section's body SHALL be hidden (height 0, no visible content); only the header strip remains visible.

The section's header SHALL contain the label text `MIDI CLOCK SEND` in uppercase, rendered with `var(--mr-fs-11)`, mono font (`.mr-mono`), `letter-spacing: 0.08em`, color `var(--mr-text-2)`. The header SHALL also contain a `ChevDownIcon` rendered right-aligned, rotated 180° when the section is closed.

#### Scenario: Section is the last child of the Inspector

- **WHEN** the app is rendered
- **THEN** the `.mr-inspector` element SHALL contain exactly one `.mr-insp-clock-send` element
- **AND** that element SHALL be the last child of `.mr-inspector`

#### Scenario: Section is always visible regardless of selection

- **GIVEN** `useStage().djActionSelection === null` and no piano roll notes are selected
- **WHEN** the Inspector is rendered
- **THEN** the `.mr-insp-clock-send` element SHALL exist and SHALL NOT carry `[hidden]` or `[aria-hidden="true"]`
- **WHEN** the user selects a DJ action row
- **THEN** the `.mr-insp-clock-send` element SHALL still exist and still be visible

#### Scenario: Header collapse toggle

- **GIVEN** the section is open (`data-open="true"`)
- **WHEN** the user clicks the `.mr-panel__head` element
- **THEN** `data-open` SHALL become `"false"`
- **AND** the section body SHALL have computed `height: 0` or `display: none`

### Requirement: Clock Send section body shows master switch, cadence, status, output list

When `data-open === "true"`, the section body SHALL render the following rows in top-to-bottom DOM order:

1. **Master row** — contains:
   - A `role="switch"` toggle styled as a rocker (track + thumb) with `aria-checked={useMidiClockSend().enabled}`. Clicking SHALL invoke `setEnabled(!enabled)`.
   - A right-aligned label showing the current cadence source: text `Internal` rendered in `var(--mr-text-2)` when `useTransport().clockSource === 'internal'`, or text `External (relay)` rendered in `var(--mr-cue)` when `clockSource === 'external-clock'` (or `external-mtc`).

2. **CADENCE row** — `.mr-row` with two columns. Left column: uppercase label `CADENCE` in `var(--mr-text-3)`, `var(--mr-fs-11)`. Right column: `<bpm.toFixed(1)> BPM · <pulseHz.toFixed(1)> Hz · 24 PPQ` where `bpm = useTransport().bpm` and `pulseHz = bpm * 24 / 60`. Right column text in `var(--mr-text-1)`, mono.

3. **STATUS row** — `.mr-row` with two columns. Left column: uppercase label `STATUS`. Right column contains:
   - A `.mr-led[data-state='tx-on']` element when `enabled === true` and `txPulse` has advanced in the last 500 ms; otherwise a `.mr-led` with no `data-state` (dim).
   - Text indicating activity: `transmitting · <n> outs` when transmitting to `n > 0` connected selected outputs; `idle` when `enabled === false`; `enabled · no outs` when `enabled === true` and no selected outputs are connected.

4. **OUTPUTS list** — a vertical stack of per-output rows, one per `useMidiOutputs().outputs` entry, ordered as returned by the hook. Each row is a `<button>` with `role="checkbox"`, `aria-checked={selectedOutputIds.has(id)}`, layout `[checkbox-glyph 14×14] [device name flex-1, mono] [TX LED 8×8]`. Clicking the row SHALL invoke `toggleOutput(device.id)`. The TX LED SHALL pulse per-port whenever the sender commits a `0xF8` batch to that port (see the `midi-clock-send` capability's `txPulseByOutputId` requirement). The row's hover background SHALL be `var(--mr-bg-hdr-hover)`; idle background `var(--mr-bg-panel-2)`.

5. **Offline rows** — for each id in `selectedOutputIds` that is NOT present in `outputs` (port disconnected after selection), a row SHALL appear at the end of the OUTPUTS list with the suffix ` (offline)` rendered in `var(--mr-text-3)`. Clicking such a row SHALL invoke `toggleOutput(id)` so the user can remove a stale selection.

6. **Footer row** — two ghost buttons `Select all` and `Clear`, `var(--mr-fs-11)`, mono, `var(--mr-text-3)` hovering to `var(--mr-text-1)`. `Select all` invokes `setSelectedOutputs(outputs.map(o => o.id))`; `Clear` invokes `setSelectedOutputs([])`.

When `useMidiOutputs().status !== 'granted'`, the body SHALL render a single placeholder row reading `MIDI access not granted` in `var(--mr-text-3)`; the master switch SHALL render but SHALL be disabled (`aria-disabled="true"`, click is a no-op).

#### Scenario: Master toggle invokes setEnabled

- **GIVEN** the section is open and `useMidiClockSend().enabled === false`
- **WHEN** the user clicks the master rocker
- **THEN** `useMidiClockSend().setEnabled(true)` SHALL have been invoked exactly once
- **AND** the rocker's `aria-checked` SHALL update to `"true"` on the next render

#### Scenario: Cadence source label reflects clockSource

- **GIVEN** `useTransport().clockSource === 'internal'`
- **THEN** the master row's right-aligned label SHALL read `Internal`
- **WHEN** `clockSource` transitions to `'external-clock'`
- **THEN** the label SHALL read `External (relay)`
- **AND** its computed color SHALL match `var(--mr-cue)`

#### Scenario: CADENCE row reflects bpm

- **GIVEN** `useTransport().bpm === 124`
- **THEN** the CADENCE row's right column SHALL contain text `124.0 BPM · 49.6 Hz · 24 PPQ`

#### Scenario: STATUS row reflects transmission state

- **GIVEN** `enabled === true`, two selected connected outputs, and `txPulse` has advanced in the last 500 ms
- **THEN** the STATUS row's right column SHALL contain a `.mr-led[data-state='tx-on']` element
- **AND** the text SHALL be `transmitting · 2 outs`
- **GIVEN** `enabled === false`
- **THEN** the STATUS row's text SHALL be `idle`
- **GIVEN** `enabled === true` and zero selected connected outputs
- **THEN** the STATUS row's text SHALL be `enabled · no outs`

#### Scenario: OUTPUTS list renders one row per connected output

- **GIVEN** `useMidiOutputs().outputs` returns three devices
- **THEN** the OUTPUTS list SHALL contain exactly three `<button role="checkbox">` rows in the same order
- **AND** each row SHALL contain a TX LED element

#### Scenario: Output row reflects selection

- **GIVEN** `selectedOutputIds === Set(['out-a'])`
- **THEN** the `out-a` row SHALL have `aria-checked="true"` and `data-on="true"`
- **AND** every other row SHALL have `aria-checked="false"`

#### Scenario: Clicking an output row toggles its selection

- **GIVEN** `selectedOutputIds === Set()`
- **WHEN** the user clicks the row for `out-a`
- **THEN** `toggleOutput('out-a')` SHALL have been invoked exactly once

#### Scenario: Offline rows appear for selected-but-disconnected ids

- **GIVEN** `selectedOutputIds === Set(['out-a', 'out-b'])` and `outputs` contains only `out-a` (b is disconnected)
- **THEN** the OUTPUTS list SHALL contain a row for `out-a` and a row for `out-b`
- **AND** the `out-b` row's visible text SHALL end with the suffix ` (offline)`
- **AND** the suffix's computed color SHALL match `var(--mr-text-3)`

#### Scenario: Footer Select all and Clear

- **GIVEN** the section is open with three connected outputs `a`, `b`, `c`
- **WHEN** the user clicks `Select all`
- **THEN** `setSelectedOutputs(['a', 'b', 'c'])` SHALL have been invoked exactly once
- **WHEN** the user clicks `Clear`
- **THEN** `setSelectedOutputs([])` SHALL have been invoked exactly once

#### Scenario: MIDI access not granted

- **GIVEN** `useMidiOutputs().status === 'unsupported'`
- **THEN** the section body SHALL contain a placeholder row reading `MIDI access not granted`
- **AND** the master rocker SHALL carry `aria-disabled="true"`
- **AND** clicking the rocker SHALL NOT change any state

### Requirement: Clock Send section includes a Sync Slaves button

The Clock Send section SHALL render a full-width button with class `.mr-insp-clock-send__sync` positioned between the master row and the CADENCE row. Visual: `background: var(--mr-bg-panel-2)`, `border: 1px solid var(--mr-cue)`, `color: var(--mr-text-1)`, mono text reading `SYNC SLAVES`, `var(--mr-fs-11)`, `letter-spacing: 0.08em`, `padding: 6px 0`.

The button SHALL be disabled (`disabled` attribute present, computed text color `var(--mr-text-4)`, border `var(--mr-line-2)`) when:

- `useMidiClockSend().enabled === false`, OR
- no `id` in `useMidiClockSend().selectedOutputIds` is currently connected.

Otherwise the button SHALL be enabled. Clicking the enabled button SHALL invoke `useMidiClockSend().sync()` exactly once.

On click, the button SHALL render a brief inverted-flash style (`background: var(--mr-cue)`, `color: var(--mr-text-on-accent)`) for 120 ms via a CSS class toggle, then return to its idle style. The flash is purely visual feedback; no toast SHALL be shown.

The button SHALL carry `aria-label="Sync slaves now"` and `title="Stop + Song Position Pointer + Continue/Start"` so users understand the action without opening docs.

#### Scenario: Sync button renders between master and CADENCE rows

- **WHEN** the section is open
- **THEN** the section body's DOM order SHALL be: master row, `.mr-insp-clock-send__sync` button, CADENCE row, STATUS row, OUTPUTS list, ...
- **AND** the button's visible text SHALL be `SYNC SLAVES`

#### Scenario: Sync button is disabled when send is off

- **GIVEN** `useMidiClockSend().enabled === false`
- **WHEN** the section is open
- **THEN** the Sync button SHALL carry the `disabled` attribute

#### Scenario: Sync button is disabled when no outputs connected+selected

- **GIVEN** `useMidiClockSend().enabled === true` and either `selectedOutputIds.size === 0` OR all selected ids are disconnected
- **WHEN** the section is open
- **THEN** the Sync button SHALL carry the `disabled` attribute

#### Scenario: Clicking Sync button fires the action

- **GIVEN** `useMidiClockSend().enabled === true`, one selected connected output, button enabled
- **WHEN** the user clicks the Sync button
- **THEN** `useMidiClockSend().sync()` SHALL have been invoked exactly once

#### Scenario: Sync button flash

- **GIVEN** the Sync button is enabled
- **WHEN** the user clicks the Sync button
- **THEN** within one animation frame the button SHALL carry a CSS class indicating the inverted flash style
- **AND** within 200 ms the class SHALL be removed

### Requirement: Clock Send section includes a Grid Alignment subsection

The Clock Send section SHALL render a collapsible subsection with class `.mr-insp-grid-align` positioned between the OUTPUTS list and the footer row. The subsection's header (`.mr-panel__head` pattern) SHALL contain the label text `GRID ALIGNMENT` in uppercase, mono, `var(--mr-fs-11)`, `letter-spacing: 0.08em`, color `var(--mr-text-2)`, with a right-aligned `ChevDownIcon` reflecting collapsed state. Default `data-open === "true"`.

When `data-open === "true"`, the subsection body SHALL render the following rows in top-to-bottom DOM order:

1. **Enable row** — a `role="switch"` rocker with `aria-checked={gridAlignment.enabled}` and label `Enable`. Clicking SHALL invoke `setGridAlignment({ enabled: !enabled })`.

2. **OUTPUT row** — a `.mr-row` with left-column label `OUTPUT` (uppercase, `var(--mr-text-3)`, `var(--mr-fs-11)`) and a right-column `<select>` element (or styled `combobox`) listing one `<option>` per `useMidiOutputs().outputs` entry plus a `(none)` option at the top representing `outputId = null`. Selecting an option SHALL invoke `setGridAlignment({ outputId: <id> })`.

3. **TRIGGER row** — a `.mr-row` with label `TRIGGER` and a 3-button segmented control (`role="radiogroup"`) with options `Bar`, `Phrase`, `Manual`. Each option is a `role="radio"` button with `aria-checked` bound to `gridAlignment.boundary === <value>`. Clicking SHALL invoke `setGridAlignment({ boundary: <value> })`.

4. **PHRASE row** — `.mr-row` with label `PHRASE` and a numeric stepper `[— N +]` rendering `gridAlignment.phraseBars` (range 1..32). Visible only when `gridAlignment.boundary === 'phrase'`; absent from the DOM otherwise. Plus/minus buttons and a direct `<input type="number">` SHALL all invoke `setGridAlignment({ phraseBars: <value> })`.

5. **MESSAGE row** — `.mr-row` with label `MESSAGE` and a 2-button segmented control with options `Note` and `CC`. Clicking SHALL invoke `setGridAlignment({ message: { ...currentMessageWithKindFlipped } })` such that the kind flips and the kind-specific fields use the prior values when transferable (e.g. `channel`, `note → cc`, `velocity → value`).

6. **Three steppers** rendered below the MESSAGE row in a horizontal row:
   - `CH` — channel (1..16)
   - `N#` or `CC#` — note number or controller number (0..127); label switches based on `message.kind`
   - `VEL` or `VAL` — velocity or CC value (0..127); label switches based on `message.kind`
   Each stepper writes to the corresponding field via `setGridAlignment({ message: { ...patch } })`.

7. **Fire now button** — a ghost button styled like the Snd menu footer buttons (`var(--mr-fs-11)`, mono, `var(--mr-text-3)` idle → `var(--mr-text-1)` hover), text `Fire now`. Disabled (`var(--mr-text-4)`) when `gridAlignment.outputId === null` OR no connected output matches that id. Clicking the enabled button SHALL invoke `useMidiClockSend().fireGridAlignment()`. On every automatic boundary fire (when `enabled === true`), the button SHALL ALSO briefly pulse (80 ms accent fade) so the user can see the auto-trigger working.

All segmented controls SHALL carry `role="radiogroup"` with `role="radio"` children; the Enable rocker SHALL carry `role="switch"`; the steppers SHALL include keyboard-accessible `<input type="number">` elements (not just plus/minus buttons).

#### Scenario: Subsection renders between OUTPUTS and footer

- **WHEN** the Clock Send section is open
- **THEN** the DOM order of the section body SHALL be: master row, Sync button, CADENCE, STATUS, OUTPUTS list, `.mr-insp-grid-align`, footer row
- **AND** the `.mr-insp-grid-align` SHALL exist exactly once

#### Scenario: Enable rocker toggles gridAlignment.enabled

- **GIVEN** `gridAlignment.enabled === false`
- **WHEN** the user clicks the Enable rocker
- **THEN** `setGridAlignment({ enabled: true })` SHALL have been invoked exactly once

#### Scenario: OUTPUT picker lists outputs plus (none)

- **GIVEN** `useMidiOutputs().outputs` returns three devices
- **WHEN** the OUTPUT row is rendered
- **THEN** the picker SHALL contain exactly four options: `(none)` first, then one per device

#### Scenario: TRIGGER segmented control reflects boundary

- **GIVEN** `gridAlignment.boundary === 'phrase'`
- **THEN** the `Phrase` radio SHALL have `aria-checked="true"`
- **AND** the `Bar` and `Manual` radios SHALL have `aria-checked="false"`
- **AND** the PHRASE row SHALL be rendered (visible)
- **WHEN** the user clicks the `Manual` radio
- **THEN** `setGridAlignment({ boundary: 'manual' })` SHALL have been invoked exactly once
- **AND** on the next render the PHRASE row SHALL NOT be in the DOM

#### Scenario: PHRASE stepper writes phraseBars

- **GIVEN** `gridAlignment === { ..., boundary: 'phrase', phraseBars: 8 }`
- **WHEN** the user clicks the `+` button in the PHRASE stepper
- **THEN** `setGridAlignment({ phraseBars: 9 })` SHALL have been invoked exactly once
- **WHEN** the user enters `40` into the stepper input
- **THEN** the value SHALL be clamped to `32` (the max), per the underlying setter

#### Scenario: MESSAGE kind switches stepper labels

- **GIVEN** `gridAlignment.message.kind === 'note'`
- **THEN** the second stepper's label SHALL be `N#`
- **AND** the third stepper's label SHALL be `VEL`
- **WHEN** the user clicks the `CC` segmented option
- **THEN** the second stepper's label SHALL be `CC#`
- **AND** the third stepper's label SHALL be `VAL`

#### Scenario: Fire now button invokes fireGridAlignment

- **GIVEN** `gridAlignment.outputId === 'out-a'` (connected)
- **WHEN** the user clicks the `Fire now` button
- **THEN** `useMidiClockSend().fireGridAlignment()` SHALL have been invoked exactly once

#### Scenario: Fire now is disabled when outputId is null

- **GIVEN** `gridAlignment.outputId === null`
- **THEN** the `Fire now` button SHALL carry the `disabled` attribute

#### Scenario: Fire now pulses on automatic fire

- **GIVEN** `gridAlignment.enabled === true`, `outputId === 'out-a'` (connected), `boundary === 'bar'`, transport playing
- **WHEN** the playhead crosses a bar boundary (auto-fire occurs)
- **THEN** within one animation frame the `Fire now` button SHALL have a pulse CSS class applied
- **AND** within 200 ms the pulse class SHALL be removed

#### Scenario: Subsection collapse hides body but keeps header

- **GIVEN** the subsection is open
- **WHEN** the user clicks the `.mr-insp-grid-align` header
- **THEN** the body rows SHALL be hidden (height 0 or display none)
- **AND** the header SHALL still be visible
- **AND** `data-open` SHALL be `"false"`

