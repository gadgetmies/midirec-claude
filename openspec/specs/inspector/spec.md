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
