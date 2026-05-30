## ADDED Requirements

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
