## ADDED Requirements

### Requirement: PressurePoint and PressureRenderMode types are exported

The codebase SHALL expose two types from `src/data/dj.ts`:

- `PressurePoint`: `{ t: number; v: number }`. `t` is note-relative in the inclusive range `0..1` (0 = note-on, 1 = note-off). `v` is `0..1` (mapped to MIDI `0..127` at the audio engine boundary).
- `PressureRenderMode`: the literal union `'curve' | 'step'`.

Both SHALL be importable by other modules and TypeScript SHALL resolve them without error.

#### Scenario: Types are importable

- **WHEN** another file imports `PressurePoint` and `PressureRenderMode` from `src/data/dj.ts`
- **THEN** TypeScript SHALL resolve the imports without errors
- **AND** a value `{ t: 0.5, v: 0.8 }` SHALL satisfy `PressurePoint`
- **AND** the values `'curve'` and `'step'` SHALL be the only inhabitants of `PressureRenderMode`

### Requirement: Pressure helpers are pure and unit-tested

The codebase SHALL ship a module at `src/data/pressure.ts` exporting the following pure helpers:

- `synthesizePressure(event: ActionEvent): PressurePoint[]` — returns the deterministic 14-point curve derived from the event's pitch and the per-pitch event index. The synthesis SHALL match the seed and shape that `ActionRoll.tsx` uses today for pressure-bearing events (so untouched events render identically before and after this slice).
- `rasterizePressure(points: PressurePoint[], bins?: number): number[]` — returns an array of length `bins` (default 16) where each element is in `0..1`. Sampling is nearest-neighbour at bin centers (`t = (i + 0.5) / bins`). When `points` is empty (`length === 0`), the result SHALL be an array of `bins` zeroes.
- `summarizePressure(points: PressurePoint[], bins?: number): { count: number; peak: number; avg: number }` — returns `count = points.length`, `peak = max(v)` and `avg = sum(v) / count` computed over the **rasterised** bins (so empty input produces `{ count: 0, peak: 0, avg: 0 }`).
- `smoothPressure(points: PressurePoint[], kernel?: number): PressurePoint[]` — applies a centered moving-average kernel (default `3`) across the 16-bin rasterisation and returns a 16-point array evenly spaced at `t = i / 15`. When `points` is empty, returns `[]`.
- `flattenPressure(points: PressurePoint[]): PressurePoint[]` — returns a 16-point array evenly spaced at `t = i / 15`, every `v` equal to the rasterised mean. When `points` is empty, returns `[]`.
- `clearPressure(): PressurePoint[]` — returns `[]` (a fresh array).

All helpers SHALL be deterministic and pure — no `Date`, no `Math.random`, no DOM access. They SHALL be unit-tested in `src/data/pressure.test.ts` covering at minimum: synthesis determinism, rasterisation of empty/sparse/dense inputs, summary statistics for known inputs, smoothing flattens a spike, flatten reduces variance to zero, clear returns an empty array.

#### Scenario: synthesizePressure is deterministic and stable across calls

- **WHEN** `synthesizePressure({ pitch: 56, t: 0, dur: 1, vel: 0.5 })` is called twice with the same input
- **THEN** the two returned arrays SHALL be deep-equal
- **AND** each returned array SHALL have length 14

#### Scenario: rasterizePressure handles empty input

- **WHEN** `rasterizePressure([])` is called
- **THEN** the result SHALL be an array of length 16 where every entry equals `0`

#### Scenario: rasterizePressure handles dense input

- **WHEN** `rasterizePressure([{ t: 0, v: 0.2 }, { t: 0.5, v: 0.9 }, { t: 1, v: 0.5 }])` is called with default bins
- **THEN** the result SHALL have length 16
- **AND** every entry SHALL be in the inclusive range `0..1`

#### Scenario: summarizePressure computes count, peak, avg

- **WHEN** `summarizePressure([{ t: 0, v: 0.4 }, { t: 0.5, v: 0.8 }, { t: 1, v: 0.6 }])` is called
- **THEN** the result's `count` SHALL be `3`
- **AND** the result's `peak` SHALL equal the maximum bin value (within `0.001`)
- **AND** the result's `avg` SHALL equal `(sumOfBins) / 16` (within `0.001`)

#### Scenario: summarizePressure handles empty input

- **WHEN** `summarizePressure([])` is called
- **THEN** the result SHALL equal `{ count: 0, peak: 0, avg: 0 }`

#### Scenario: smoothPressure flattens a sharp spike

- **WHEN** `smoothPressure(spike)` is called where `spike` rasterises to a single bin at `1.0` surrounded by zeros, with kernel `3`
- **THEN** the result's rasterised peak SHALL be strictly less than `1.0`
- **AND** the result SHALL have length 16
- **AND** each result point's `t` SHALL equal `i / 15` for its index `i`

#### Scenario: flattenPressure reduces variance to zero

- **WHEN** `flattenPressure(points)` is called for any non-empty `points`
- **THEN** the result SHALL have length 16
- **AND** all entries in the result SHALL share the same `v` value (within `0.001`)

#### Scenario: clearPressure returns a fresh empty array

- **WHEN** `clearPressure()` is called twice
- **THEN** both results SHALL deep-equal `[]`
- **AND** the two returned arrays SHALL NOT be referentially identical (each call returns a fresh array)

### Requirement: Pressure section renders inside ActionPanel when an event is selected on a pressure-bearing action

The Inspector's `ActionPanel` SHALL render an additional **Pressure section** below the Output mapping form when ALL of the following hold:

1. `useStage().djEventSelection !== null`
2. `djEventSelection.trackId === djActionSelection.trackId` AND `djEventSelection.pitch === djActionSelection.pitch`
3. The selected track's `actionMap[djActionSelection.pitch]?.pressure === true`
4. The selected event exists: `track.events[djEventSelection.eventIdx] !== undefined`

When ANY of those is false, the Pressure section SHALL NOT render and the DOM SHALL NOT contain a `.mr-pressure` element.

The Pressure section SHALL be wrapped in a `<section className="mr-pressure" data-mr-dj-selection-region="true">` element so the outside-click handler treats clicks inside it as "keep selection".

The section SHALL contain, in DOM order:

1. An eyebrow row with the uppercase text `PRESSURE` (class `.mr-pressure__eyebrow`).
2. A `.mr-pressure__graph` element containing the bar-graph editor (see "Pressure bar-graph editor renders 16 rasterised bins").
3. A `.mr-pressure__summary` element containing the summary readout text (see "Pressure summary readout shows event count, peak, and average").
4. A `.mr-pressure__bulk` element containing exactly three `.mr-btn` children with text content `Smooth`, `Flatten`, `Clear` in that order.
5. A `.mr-pressure__mode` element containing exactly two `.mr-pressure__mode-chip` children with text content `Curve` and `Step` in that order. The chip whose label matches `useStage().pressureRenderMode` SHALL carry `data-on="true"`; the other SHALL NOT.

#### Scenario: Pressure section renders when conditions are met

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` AND the seeded track's `actionMap[56].pressure === true` AND `track.events[2]` exists
- **THEN** the Inspector body SHALL contain exactly one `.mr-pressure` element
- **AND** that element SHALL carry `data-mr-dj-selection-region="true"`
- **AND** the element SHALL contain (in DOM order) `.mr-pressure__eyebrow`, `.mr-pressure__graph`, `.mr-pressure__summary`, `.mr-pressure__bulk`, `.mr-pressure__mode`
- **AND** `.mr-pressure__bulk` SHALL contain three `.mr-btn` children with text content `Smooth`, `Flatten`, `Clear`
- **AND** `.mr-pressure__mode` SHALL contain two `.mr-pressure__mode-chip` children with text content `Curve` and `Step`

#### Scenario: Pressure section absent when action does not have pressure capability

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 48 }` AND `djEventSelection === { trackId: 'dj1', pitch: 48, eventIdx: 0 }` AND `actionMap[48].pressure !== true`
- **THEN** the Inspector body SHALL NOT contain any `.mr-pressure` element

#### Scenario: Pressure section absent when djEventSelection is null

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === null`
- **THEN** the Inspector body SHALL NOT contain any `.mr-pressure` element

#### Scenario: Pressure section absent when event index points past events array

- **WHEN** `djEventSelection.eventIdx >= track.events.length` (e.g. event was deleted)
- **THEN** the Inspector body SHALL NOT contain any `.mr-pressure` element

#### Scenario: Pressure section absent when selections target different rows

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 60, eventIdx: 0 }`
- **THEN** the Inspector body SHALL NOT contain any `.mr-pressure` element

### Requirement: Pressure bar-graph editor renders 16 rasterised bins

The `.mr-pressure__graph` element SHALL render an SVG containing exactly 16 `rect` elements (one per rasterised bin). Each bar SHALL:

- Be 1.5px wide.
- Position horizontally at `x = (bin_index + 0.5) * (graph_width / 16) - 0.75` so bars are centered in their bin.
- Have a height proportional to the rasterised bin value: `height = bin_value * graph_height` (with a minimum visible height equivalent to `0.06 * graph_height` so non-zero values do not vanish, matching the prototype's `Math.max(0.06, ...)` clamp).
- Use a `fill` value of `color-mix(in oklab, var(--action-color) 85%, transparent)` where `--action-color` resolves to `devColor(actionEntry.device)` set as an inline CSS variable on the `.mr-pressure` root.
- Anchor at the **bottom** of the graph area (i.e. growing upward).

Each bar SHALL also have a 1.5px-high "highlight dot" rendered as a separate `rect` at the bar's top (matching `ParamLane`'s `BAR_W` rendering primitive).

The rasterisation SHALL come from `rasterizePressure(currentPressurePoints, 16)`, where `currentPressurePoints` is:
- The event's stored `pressure` array if it is non-`undefined` (including the explicit `[]` case).
- Otherwise the result of `synthesizePressure(event)`.

When `useStage().pressureRenderMode === 'step'`, the bars SHALL render unchanged (visual: discrete blocks). When the mode is `'curve'`, the bars SHALL render unchanged for Slice 9 (a future overlay polyline is deferred — see design.md Open Questions). The mode toggle SHALL still update `data-on` on the chip even though the bar visuals match across modes in this slice; the value is plumbed through so the lane-body rendering (in `ActionRoll`) can branch on it.

The `.mr-pressure__graph` SVG SHALL carry `data-mode={pressureRenderMode}` so future render branches and tests can read the active mode from the DOM.

#### Scenario: Graph contains 16 bar rectangles

- **WHEN** the Pressure section renders with any visible state
- **THEN** the `.mr-pressure__graph svg` SHALL contain exactly 16 `rect` elements representing bars (excluding highlight dots, which may bring the total to 32)
- **AND** the SVG SHALL carry `data-mode` equal to either `curve` or `step`

#### Scenario: Empty pressure renders 16 zero-height (or minimum-height) bars

- **WHEN** the selected event has `pressure === []` (explicitly cleared)
- **THEN** every bar in `.mr-pressure__graph` SHALL have `height` equal to the minimum height clamp (or zero)
- **AND** no bar SHALL exceed the minimum height

#### Scenario: Undefined pressure uses synthesised curve

- **WHEN** the selected event has `pressure === undefined`
- **THEN** the rasterised bins drawn in `.mr-pressure__graph` SHALL be those produced by `rasterizePressure(synthesizePressure(event), 16)`

#### Scenario: data-mode reflects current render mode

- **WHEN** `useStage().pressureRenderMode === 'curve'`
- **THEN** `.mr-pressure__graph svg` SHALL carry `data-mode="curve"`
- **WHEN** `pressureRenderMode` is switched to `'step'`
- **THEN** the same SVG SHALL carry `data-mode="step"` on next render

### Requirement: Pressure summary readout shows event count, peak, and average

The `.mr-pressure__summary` element SHALL display a single line of monospace text of the form:

```
<N> events · peak <P> · avg <A>
```

Where:
- `<N>` is the number of stored points (`pressure.length` if defined, otherwise `synthesizePressure(event).length`).
- `<P>` is `peak.toFixed(2)` of the **rasterised** value (so empty input shows `peak 0.00`).
- `<A>` is `avg.toFixed(2)` of the rasterised value.

The element SHALL carry `color: var(--mr-text-3)` and `font-size: 9px`, monospace. No additional decoration.

#### Scenario: Summary text for stored points

- **WHEN** the selected event has `pressure` such that `summarizePressure(pressure) === { count: 14, peak: 0.86, avg: 0.54 }`
- **THEN** the `.mr-pressure__summary` text content SHALL be `14 events · peak 0.86 · avg 0.54`

#### Scenario: Summary for empty pressure

- **WHEN** the selected event has `pressure === []`
- **THEN** the summary text SHALL be `0 events · peak 0.00 · avg 0.00`

#### Scenario: Summary for synthesised fallback

- **WHEN** the selected event has `pressure === undefined`
- **THEN** the summary SHALL count the synthesised array (`14 events`) and show its rasterised peak/avg

### Requirement: Smooth button materialises and smooths stored pressure

Clicking the `Smooth` button SHALL call `useStage().setEventPressure(trackId, pitch, eventIdx, smoothPressure(currentPressurePoints))` exactly once, where `currentPressurePoints` is:
- The event's stored `pressure` array if non-`undefined`.
- Otherwise `synthesizePressure(event)` (the synthesised curve is materialised on first edit).

The button SHALL be inert (visually shows hover/active feedback but produces no state change) only if the bulk-op result deep-equals the current pressure — but Slice 9 does NOT require this optimisation. Every click MAY produce a hook-action call.

#### Scenario: Smooth materialises synthesised pressure on first click

- **WHEN** the selected event has `pressure === undefined` and the user clicks `Smooth`
- **THEN** `setEventPressure` SHALL be called once with `(trackId, pitch, eventIdx, smoothPressure(synthesizePressure(event)))`
- **AND** the next render SHALL show the event's `pressure` as a 16-point smoothed array

#### Scenario: Smooth is re-applicable

- **WHEN** the user clicks `Smooth` once, then clicks `Smooth` again
- **THEN** `setEventPressure` SHALL be called twice
- **AND** the second call SHALL receive `smoothPressure` of the result of the first call

### Requirement: Flatten button replaces stored pressure with the mean

Clicking the `Flatten` button SHALL call `useStage().setEventPressure(trackId, pitch, eventIdx, flattenPressure(currentPressurePoints))` exactly once. Source of `currentPressurePoints` matches the Smooth requirement.

#### Scenario: Flatten produces a uniform curve

- **WHEN** the user clicks `Flatten` on an event with varying pressure
- **THEN** `setEventPressure` SHALL be called with a 16-point array whose `v` values are all equal (within `0.001`)

### Requirement: Clear button writes an empty pressure array

Clicking the `Clear` button SHALL call `useStage().setEventPressure(trackId, pitch, eventIdx, [])` exactly once. After clearing, the renderer SHALL draw the editor with all bars at minimum height (per "Empty pressure renders 16 zero-height" scenario above) and the summary SHALL read `0 events · peak 0.00 · avg 0.00`.

#### Scenario: Clear empties the stored pressure

- **WHEN** the user clicks `Clear` on an event with stored pressure
- **THEN** `setEventPressure` SHALL be called with `(trackId, pitch, eventIdx, [])`
- **AND** the next render SHALL show `track.events[eventIdx].pressure === []`
- **AND** the summary text SHALL be `0 events · peak 0.00 · avg 0.00`

### Requirement: Curve and Step chips toggle pressureRenderMode

Clicking the `Curve` chip SHALL call `useStage().setPressureRenderMode('curve')`. Clicking the `Step` chip SHALL call `useStage().setPressureRenderMode('step')`. Both calls SHALL be exactly once per click and SHALL NOT mutate any pressure data.

The chip whose label matches the current mode SHALL carry `data-on="true"`; the other SHALL NOT.

#### Scenario: Clicking Step switches the mode

- **WHEN** `pressureRenderMode === 'curve'` and the user clicks the `Step` chip
- **THEN** `setPressureRenderMode` SHALL be called once with `'step'`
- **AND** the next render SHALL have the `Step` chip carry `data-on="true"`
- **AND** the `Curve` chip SHALL NOT carry `data-on="true"`
- **AND** the `.mr-pressure__graph svg` SHALL carry `data-mode="step"`

#### Scenario: Clicking the active mode chip is a no-op visually

- **WHEN** `pressureRenderMode === 'curve'` and the user clicks the `Curve` chip
- **THEN** `setPressureRenderMode` MAY be called with `'curve'` (calling with the same value is permitted)
- **AND** the rendered DOM SHALL be unchanged

### Requirement: Pressure section CSS uses tokens, no new hex literals

The pressure section's CSS SHALL ship at `src/components/inspector/PressureEditor.css` and SHALL use only existing design tokens for colors. Specifically:

- Bar fill SHALL resolve through `var(--action-color)` (the inline CSS variable set on `.mr-pressure`) composed via `color-mix(...)`.
- Eyebrow and summary text SHALL use `var(--mr-text-3)`.
- Button and chip surfaces SHALL reuse the existing `.mr-btn` and `.mr-pressure__mode-chip` tokens (the chip class MAY share styling primitives with `.mr-insp-tab` but is a new selector so the chip lives outside the tab strip).
- No new `oklch(...)`, `#RGB`, or `#RRGGBB` literals.

#### Scenario: No new color literals

- **WHEN** `src/components/inspector/PressureEditor.css` is inspected
- **THEN** every color value SHALL be either `var(--mr-*)`, `color-mix(...)`, `currentColor`, `transparent`, `inherit`, or a `var(--action-color)` reference
- **AND** there SHALL be no new `oklch(...)` literals or hex color literals
