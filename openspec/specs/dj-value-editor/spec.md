# dj-value-editor Specification

## Purpose
TBD - created by archiving change dj-action-cc-value-editor. Update Purpose after archive.
## Requirements
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
- `smoothPressure(points: PressurePoint[], kernel?: number): PressurePoint[]` — applies a centered moving-average kernel (default `3`) across the 16-bin rasterisation and returns a 16-point array evenly spaced at `t = i / 15`. When `points` is empty, returns `[]`.
- `flattenPressure(points: PressurePoint[]): PressurePoint[]` — returns a 16-point array evenly spaced at `t = i / 15`, every `v` equal to the rasterised mean. When `points` is empty, returns `[]`.

All helpers SHALL be deterministic and pure — no `Date`, no `Math.random`, no DOM access. They SHALL be unit-tested in `src/data/pressure.test.ts` covering at minimum: synthesis determinism, rasterisation of empty/sparse/dense inputs, smoothing flattens a spike, flatten reduces variance to zero.

The helpers `summarizePressure` and `clearPressure` SHALL NOT exist in `src/data/pressure.ts`. They were removed when the Inspector pressure section was retired; callers that need an empty array SHALL pass `[]` directly to `setEventPressure`.

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

#### Scenario: smoothPressure flattens a sharp spike

- **WHEN** `smoothPressure(spike)` is called where `spike` rasterises to a single bin at `1.0` surrounded by zeros, with kernel `3`
- **THEN** the result's rasterised peak SHALL be strictly less than `1.0`
- **AND** the result SHALL have length 16
- **AND** each result point's `t` SHALL equal `i / 15` for its index `i`

#### Scenario: flattenPressure reduces variance to zero

- **WHEN** `flattenPressure(points)` is called for any non-empty `points`
- **THEN** the result SHALL have length 16
- **AND** all entries in the result SHALL share the same `v` value (within `0.001`)

#### Scenario: summarizePressure and clearPressure are not exported

- **WHEN** another module imports from `src/data/pressure.ts`
- **THEN** the named exports `summarizePressure` and `clearPressure` SHALL be absent
- **AND** TypeScript SHALL report an error if either name is imported

### Requirement: DJValueEditor mounts as a global sticky footer when its derived mode is non-hidden

The codebase SHALL ship a component at `src/components/dj-value-editor/DJValueEditor.tsx` mounted as a direct child of `.mr-shell` between the timeline body and the existing `Statusbar` footer. The component SHALL render an element with class `.mr-dj-value-editor` only when its derived mode (see "Editor mode is derived from selection state") is non-hidden. When the derived mode is `hidden`, the component SHALL render `null` and the DOM SHALL NOT contain any `.mr-dj-value-editor` element.

The `Statusbar` SHALL remain the absolute bottom of the viewport whether or not the editor is mounted; the editor SHALL stack directly above the `Statusbar`.

#### Scenario: Editor is absent when no value-bearing selection exists

- **WHEN** `useStage().djActionSelection === null` AND `useStage().djEventSelection === null`
- **THEN** the DOM SHALL NOT contain any `.mr-dj-value-editor` element

#### Scenario: Editor mounts when a CC-output row is selected

- **WHEN** `useStage().djActionSelection === { trackId, pitch }` AND the row's `outputMap[pitch]` resolves to a CC output (`out === 'cc'` or `out` unset with `cc !== undefined`) AND `djEventSelection === null`
- **THEN** the DOM SHALL contain exactly one `.mr-dj-value-editor` element
- **AND** that element SHALL be a sibling of `.mr-statusbar` rendered immediately before it

#### Scenario: Editor mounts when an event on a pressure-bearing row is selected

- **WHEN** `useStage().djEventSelection === { trackId, pitch, eventIdx }` AND the row's `actionMap[pitch].pressure === true` AND `track.events[eventIdx]` exists
- **THEN** the DOM SHALL contain exactly one `.mr-dj-value-editor` element

### Requirement: Editor mode is derived from selection state

The editor SHALL compute its mode from `useStage()` selections via a pure function `deriveEditorMode(stage): { kind: 'cc' | 'pb' | 'at' | 'hidden'; target?: ... }`. The mapping SHALL be:

| Selection state | Mode `kind` |
|---|---|
| `djActionSelection` set on a row whose `outputMap[pitch].out === 'cc'`, or `out` unset and `cc !== undefined`; `djEventSelection === null` (or pointing to a different row) | `'cc'` |
| `djActionSelection` set on a row whose `outputMap[pitch].out === 'pb'`; `djEventSelection === null` (or pointing to a different row) | `'pb'` |
| `djEventSelection` set, with `actionMap[pitch].pressure === true`, and `track.events[eventIdx]` exists | `'at'` |
| Any selection state describing more than one row, or more than one event across rows | `'hidden'` |
| `djActionSelection` set on a `trigger`, `velocity-sensitive`, or `fallback` row with `djEventSelection === null` | `'hidden'` |
| Neither selection set, or both `null` | `'hidden'` |

The mode SHALL be re-derived on every render and SHALL NOT be persisted in component state. When the mode `target` identity (the `(trackId, pitch)` tuple for CC/PB; the `(trackId, pitch, eventIdx)` tuple for AT) changes, the editor's shift-anchor (see "Shift+click writes a linearly interpolated range") SHALL clear.

#### Scenario: CC-output row selection produces cc mode

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 80 }` AND `track.outputMap[80] === { device: 'mixer', channel: 2, cc: 7 }` (no `out` field) AND `djEventSelection === null`
- **THEN** `deriveEditorMode(stage).kind` SHALL equal `'cc'`

#### Scenario: Explicit out:'pb' produces pb mode

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 80 }` AND `track.outputMap[80] === { device: 'mixer', channel: 2, out: 'pb' }` AND `djEventSelection === null`
- **THEN** `deriveEditorMode(stage).kind` SHALL equal `'pb'`

#### Scenario: Event selection on a pressure row produces at mode

- **WHEN** `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` AND `track.actionMap[56].pressure === true` AND `track.events[2]` exists
- **THEN** `deriveEditorMode(stage).kind` SHALL equal `'at'`

#### Scenario: Trigger-only row produces hidden mode

- **WHEN** `djActionSelection` points to a row whose `actionMap[pitch].cat === 'trigger'` AND there is no `djEventSelection`
- **THEN** `deriveEditorMode(stage).kind` SHALL equal `'hidden'`

#### Scenario: Mode switch clears the shift-anchor

- **WHEN** the user clicks once in the editor (establishing a shift-anchor) AND then changes `djActionSelection` to a different row
- **THEN** on the next render the shift-anchor SHALL be cleared
- **AND** a subsequent shift+click in the editor SHALL behave as a regular single click (no interpolation)

### Requirement: Editor canvas mirrors the timeline's horizontal scroll and pxPerBeat

The editor canvas SHALL share the timeline's x-axis: the canvas's tick→px mapping SHALL use the same `pxPerBeat` (and derived `pxPerTick = pxPerBeat / DEFAULT_MIDI_TPQ`) as the timeline body, and the canvas's inner content SHALL be horizontally translated to match the timeline's current `scrollLeft`. Implementation: the canvas's outer container SHALL clip overflow; its inner content SHALL apply `transform: translateX(-scrollLeft)` where `scrollLeft` is read from the `.mr-timeline` element (or an equivalent ref source) on every `scroll` event. The scroll listener SHALL be `passive` and the transform update SHALL be rAF-batched.

The keys column (`KEYS_COLUMN_WIDTH` from `app-shell`) SHALL NOT appear in the editor's left margin; the editor's left edge SHALL align with tick 0 of the timeline body. (The header strip's left content describes the editor target rather than mirroring the keys column.)

#### Scenario: Editor aligns with timeline at scrollLeft = 0

- **WHEN** the editor is mounted AND `.mr-timeline.scrollLeft === 0`
- **THEN** the canvas's tick 0 SHALL render at the canvas's left edge (after the keys-column offset)

#### Scenario: Editor follows timeline scroll

- **WHEN** the user scrolls `.mr-timeline` so that `scrollLeft === 400`
- **THEN** on the next animation frame the editor's inner content SHALL apply `transform: translateX(-400px)` (or equivalent translation expressed in px)
- **AND** a tick that previously appeared at canvas-x `500` SHALL now appear at canvas-x `100`

### Requirement: Editor header strip shows target summary, close chip, and resize-grip

The editor's first child SHALL be a 24px-tall header strip (`.mr-dj-value-editor__hdr`) containing:

1. A left-aligned label describing the current target. For CC/PB mode the label SHALL include the track name, the row label (or pitch name when no label exists), and the output specifier (`CC #<n>` for CC mode; `PB` for PB mode). For AT mode the label SHALL include the row label and the event index (`event <i+1>/<count>`).
2. A right-aligned close chip `✕` (`.mr-dj-value-editor__close`). Clicking it SHALL clear the relevant selection:
   - In AT mode: `setDJEventSelection(null)`.
   - In CC mode and PB mode: `setDJActionSelection(null)`.
3. The top edge of the strip SHALL be the editor's resize-grip: hovering it SHALL show `cursor: row-resize`; a pointer-drag on that edge SHALL resize the editor by adjusting the inner canvas height (see "Editor canvas height is user-resizable").

#### Scenario: Close chip clears the right selection in AT mode

- **WHEN** the editor is in AT mode AND the user clicks the `.mr-dj-value-editor__close` chip
- **THEN** `setDJEventSelection` SHALL be called exactly once with `null`
- **AND** `setDJActionSelection` SHALL NOT be called by this click

#### Scenario: Close chip clears the right selection in CC mode

- **WHEN** the editor is in CC mode AND the user clicks the `.mr-dj-value-editor__close` chip
- **THEN** `setDJActionSelection` SHALL be called exactly once with `null`
- **AND** `setDJEventSelection` SHALL NOT be called by this click

### Requirement: Editor canvas height is user-resizable and persisted

The editor's canvas height SHALL default to `96px`. Dragging the header strip's top edge SHALL change the height, clamped to the inclusive range `48..400`. On `pointerup` (debounced ~200ms) the resulting height SHALL be written to `localStorage` under the key `mr.dj-value-editor.heightPx` as a JSON number. On mount the editor SHALL read that key and use the persisted value (clamped to the same range) when present; otherwise it SHALL use the `96px` default.

#### Scenario: Initial height defaults to 96px without persistence

- **WHEN** the editor mounts AND `localStorage` has no key `mr.dj-value-editor.heightPx`
- **THEN** the canvas height SHALL be `96px`

#### Scenario: Persisted height is restored on mount

- **WHEN** `localStorage.getItem('mr.dj-value-editor.heightPx') === '180'` AND the editor mounts
- **THEN** the canvas height SHALL be `180px`

#### Scenario: Resize clamps to 48..400

- **WHEN** the user drags the resize-grip down to a height of `600px`
- **THEN** the applied canvas height SHALL be `400px`
- **AND** the persisted value SHALL be `400`

### Requirement: CC and PB modes render bars across the visible timeline

In CC and PB modes, the canvas SHALL render one bar per `ActionEvent` whose `pitch === rowKey` (the selected row) within the currently visible timeline window. Each bar's horizontal position SHALL be the event's `tTicks` converted via `pxPerTick`; its height SHALL be proportional to `event.vel`, where `vel === 1` maps to the canvas's top and `vel === 0` maps to the canvas's bottom (linear in between). Bars SHALL be anchored at the canvas's bottom.

Quantize-grid lines SHALL be drawn faintly at the active grid (`quantizeGridToTicks(quantizeGrid)`), matching the ticks the timeline ruler draws.

In PB mode the canvas SHALL additionally draw a 1px dashed horizontal "center line" at `y = canvas_height / 2` (corresponding to `vel === 0.5`, MIDI value 8192) so users can read the bipolar shape.

The existing `ActionRoll` in-lane `cc-group` strip rendering SHALL be unchanged; the editor is an additional input surface that reads and writes the same `track.events` data.

#### Scenario: Each CC event renders one bar

- **WHEN** the editor is in CC mode AND the selected row has three events in the visible window with `vel` values `0.1`, `0.5`, `0.9`
- **THEN** the canvas SHALL contain three bars
- **AND** the bar heights SHALL be proportional to `0.1`, `0.5`, `0.9` of the canvas height

#### Scenario: PB mode renders a center line

- **WHEN** the editor is in PB mode
- **THEN** the canvas SHALL contain a horizontal dashed line at `y = canvas_height / 2`
- **WHEN** the editor is in CC mode
- **THEN** the canvas SHALL NOT contain a center line

### Requirement: AT mode renders bars over the event span with a window mask

In AT mode the canvas SHALL render a 16-bin bar-graph computed via `rasterizePressure(currentPressurePoints, 16)` where `currentPressurePoints` is `event.pressure` when non-`undefined` (including the explicit `[]` case) or `synthesizePressure(event)` when `pressure === undefined`. The 16 bins SHALL be positioned over the event's tick span `[event.tTicks, event.tTicks + event.durTicks]` and rendered using the same tick→px mapping as the editor's x-axis.

The canvas SHALL dim the area outside `[event.tTicks, event.tTicks + event.durTicks]` with a window-mask overlay. Pointer gestures whose snapped tick lies outside that span SHALL be ignored (see "AT-mode gestures are clamped to the event span").

#### Scenario: Undefined pressure renders the synthesized curve

- **WHEN** the editor is in AT mode AND `event.pressure === undefined`
- **THEN** the rasterised bins drawn over the event span SHALL match `rasterizePressure(synthesizePressure(event), 16)`

#### Scenario: Empty pressure renders 16 zero-height bars

- **WHEN** the editor is in AT mode AND `event.pressure === []`
- **THEN** every bar in the canvas SHALL have height `0` (or the minimum visible height clamp)

### Requirement: Single click writes one point at the snapped tick

In CC and PB modes, a left-click without modifier on the canvas SHALL:

1. Compute the snapped tick as `snapTickForWrite(clientX, quantizeOn, quantizeGrid, snapAbsoluteOn)`. When `quantizeOn === true`, the result SHALL be the absolute grid cell selected per `snapAbsoluteOn` (nearest cell when on; floor to cell when off). When `quantizeOn === false`, the result SHALL be the exact tick under the cursor (no snap).
2. Compute the value as `vel = 1 - (clientY - canvasTop) / canvasHeight`, clamped to `[0, 1]`. Vertical position SHALL NOT be snapped.
3. Write one point: if an existing `ActionEvent` on this row has `tTicks === snappedTick`, replace its `vel` with the computed value. Otherwise append a new `ActionEvent { pitch: rowKey, tTicks: snappedTick, durTicks: 0, vel }` to `track.events`.
4. Set the editor's shift-anchor to `(snappedTick, vel)`.

In AT mode, the same gesture SHALL only fire when the snapped tick lies within `[event.tTicks, event.tTicks + event.durTicks]` and SHALL write a `PressurePoint { t: noteRelativeT, v: vel }` into `event.pressure` (replacing any existing point with the same `t` within `0.001`). The `noteRelativeT` SHALL be `(snappedTick - event.tTicks) / event.durTicks`, clamped to `[0, 1]`.

#### Scenario: CC click writes a new event at the snapped tick

- **WHEN** the editor is in CC mode with `quantizeOn === true`, `quantizeGrid === '1/16'` (snap = 120 ticks), the row has no existing events, and the user clicks at a `clientX` corresponding to tick 145
- **THEN** `track.events` SHALL gain exactly one entry with `tTicks === 120` (snap to nearest 120-tick cell)
- **AND** the new entry's `pitch` SHALL equal the row key
- **AND** the new entry's `durTicks` SHALL equal `0`

#### Scenario: CC click on an existing tick replaces the vel

- **WHEN** the editor is in CC mode AND an existing event on this row has `tTicks === 120, vel === 0.3` AND the user clicks at the same snapped tick with a `clientY` corresponding to `vel === 0.8`
- **THEN** `track.events` SHALL still contain exactly one event at `tTicks === 120`
- **AND** the event's `vel` SHALL be `0.8` (within `0.001`)

#### Scenario: Click at the bottom of the canvas writes vel 0

- **WHEN** the user clicks at `clientY === canvasBottom`
- **THEN** the written `vel` SHALL be `0`

#### Scenario: Click in AT mode outside the event span is ignored

- **WHEN** the editor is in AT mode for an event with `tTicks === 480, durTicks === 240` AND the user clicks at a `clientX` corresponding to tick `100`
- **THEN** `event.pressure` SHALL be unchanged

### Requirement: Click-and-drag sweeps the range between consecutive samples

In CC and PB modes, a left-click followed by `pointermove` SHALL sweep the range between consecutive pointer samples:

1. On `pointerdown`, follow the single-click write rules (see "Single click writes one point at the snapped tick"), capture the pointer via `setPointerCapture`, and record the snapped tick and `clientY`-derived value as the drag's *previous sample* `(prevTick, prevVel)`.
2. On every `pointermove`, recompute the snapped tick `curTick` and the current value `curVel`. Define the swept range as `[min(prevTick, curTick), max(prevTick, curTick)]` inclusive. Replace every event on the row with `tTicks` in that range with exactly two endpoint events: one at `prevTick` carrying `prevVel`, one at `curTick` carrying `curVel`. When `prevTick === curTick`, the range degenerates and the cell is rewritten with `curVel` (latest-wins).
3. After each `pointermove`, advance the previous sample to `(curTick, curVel)`.
4. The swept range SHALL clear *all* pre-existing events between the two endpoints, including events at intermediate snapped grid cells AND off-grid events. Events outside the swept range SHALL be untouched. This applies even to cells that were written earlier in the same drag — backward motion sweeps through them.
5. On `pointerup`, the last sample's `(curTick, curVel)` SHALL become the shift-anchor.

When `quantizeOn === false`, the same range-sweep rule applies with `prevTick` / `curTick` taken from the unsnapped pointer ticks (rounded to the nearest integer); the inclusive-range replace still wipes any events with `tTicks` strictly between the endpoints.

In AT mode, the same range-sweep SHALL apply with the AT tick-clamping rule. The range is taken in note-relative `t` derived from the snapped ticks; pressure points with `t` in the swept range SHALL be replaced with two endpoint points at the previous and current samples' `(tRel, vel)`. Pressure points outside the swept range SHALL be untouched.

#### Scenario: Drag across three cells leaves one event per sampled cell

- **WHEN** the user clicks at the snapped tick `120`, drags to `240` (one `pointermove` sample), then `360` (another `pointermove` sample), then releases, with `quantizeOn === true` and `quantizeGrid === '1/16'`
- **THEN** `track.events` SHALL contain points at `tTicks === 120, 240, 360` (one per sample)
- **AND** no other events SHALL be added on this row during the drag

#### Scenario: Fast drag clears pre-existing events between samples

- **WHEN** the row has pre-existing events at `tTicks === 240` (`vel === 0.5`), `tTicks === 360` (`vel === 0.5`), AND an off-grid event at `tTicks === 263` (`vel === 0.5`) AND the user clicks at cell `120` with `vel === 0.2` AND the pointer jumps directly to cell `480` with `vel === 0.8` in a single `pointermove` (no sample at `240` or `360` in between), then releases, with `quantizeOn === true` and `quantizeGrid === '1/16'`
- **THEN** `track.events` SHALL contain exactly two events on this row: `tTicks === 120, vel === 0.2` and `tTicks === 480, vel === 0.8`
- **AND** the pre-existing events at `240`, `263`, and `360` SHALL be removed
- **AND** events outside `[120, 480]` SHALL be unchanged

#### Scenario: Backward motion sweeps cells painted earlier in the drag

- **WHEN** the user drags forward across cells `120, 240, 360, 480` (one sample per cell, painting each) AND then drags backward in a single `pointermove` from `480` directly to `120` (no intermediate samples)
- **THEN** at the end of the drag the row SHALL contain exactly two events: `tTicks === 480` (carrying the vel from the forward `480` sample) and `tTicks === 120` (carrying the backward sample's current vel)
- **AND** the in-drag events at `tTicks === 240, 360` SHALL be removed by the backward sweep

#### Scenario: Re-crossing the same cell rewrites it (latest-wins)

- **WHEN** the user clicks at cell `120` with `vel === 0.2`, drags to cell `240` with `vel === 0.8`, then drags back to cell `120` with `vel === 0.6`, and releases (each cell hit by a `pointermove` sample)
- **THEN** the event at `tTicks === 120` SHALL have `vel === 0.6` (within `0.001`)
- **AND** the event at `tTicks === 240` SHALL retain `vel === 0.8` (it is the previous-sample endpoint of the backward sweep)

#### Scenario: Drag-paint completes as one logical gesture

- **WHEN** the user drags from cell `120` through cell `600` (continuously, no `pointerup` in between)
- **THEN** all range-sweep writes SHALL commit before `pointerup` resolves
- **AND** the shift-anchor after `pointerup` SHALL equal the last sampled `(curTick, curVel)`

### Requirement: Shift+click writes a linearly interpolated range

When the user shift-clicks the canvas AND a shift-anchor `(t0, v0)` exists for the current editor mode and target, the editor SHALL:

1. Compute the snapped endpoint `(t1, v1)` using the same rules as a single click.
2. For each quantize-grid cell `t` in the inclusive range `[min(t0, t1), max(t0, t1)]`, write a point at `t` with `v = v0 + (v1 - v0) * (t - t0) / (t1 - t0)`. When `t0 === t1`, write a single point at `t0` with `v1` (the most recent value wins).
3. After writing, remove any pre-existing events/points strictly inside `(min(t0, t1), max(t0, t1))` that do NOT fall on a grid cell the interpolation just wrote. The interpolation range SHALL become fully owned by the interpolation.
4. Set the shift-anchor to `(t1, v1)`.

When `quantizeOn === false`, the interpolation SHALL produce writes at every tick in the range (not just grid cells). This may be expensive; clients MAY downsample to one write per pointer-tick if needed but MUST cover the inclusive endpoints.

When no shift-anchor exists yet for the current mode/target, a shift+click SHALL behave as a regular single click.

#### Scenario: Shift+click interpolates from anchor

- **WHEN** the editor's shift-anchor is `(t0=120, v0=0.0)` AND the user shift-clicks at `t1=600, v1=1.0` with `quantizeOn === true` and `quantizeGrid === '1/16'` (snap = 120)
- **THEN** `track.events` SHALL contain points at `tTicks === 120, 240, 360, 480, 600` with `vel === 0.0, 0.25, 0.5, 0.75, 1.0` (within `0.001`)

#### Scenario: Shift+click without anchor falls back to single click

- **WHEN** the editor has just mounted (no prior click) AND the user shift+clicks at `t1, v1`
- **THEN** the behavior SHALL match a single click at `(t1, v1)`
- **AND** the shift-anchor SHALL be set to `(t1, v1)` for subsequent shift+clicks

#### Scenario: Interpolation clears off-grid points inside the range

- **WHEN** the row has existing events at `tTicks === 145, 263` (off-grid) AND the user shift+clicks from anchor `(120, 0)` to `(360, 1.0)` with `quantizeGrid === '1/16'` (snap = 120)
- **THEN** the off-grid events at `tTicks === 145, 263` SHALL be removed
- **AND** the row SHALL contain interpolated points at `tTicks === 120, 240, 360`

### Requirement: Right-click and right-drag delete points

In CC, PB, and AT modes, a right-click on the canvas SHALL delete the point at the snapped tick on the current target (no-op when no point exists at that snapped tick). A right-click followed by `pointermove` SHALL sweep the range between consecutive pointer samples and delete every event (or pressure point) with `tTicks` (or note-relative `t`) in that inclusive range, using the same range-sweep rule as paint-drag but with empty replacements — both intermediate snapped grid cells AND off-grid events inside the swept range SHALL be removed. The browser `contextmenu` event SHALL be suppressed via `preventDefault()` so no native menu appears.

Right-click SHALL NOT modify the shift-anchor.

In AT mode, right-click gestures SHALL only fire when the snapped tick lies within the event span; outside the span the gesture SHALL be a no-op (no deletion, no `contextmenu` menu — the `preventDefault` still fires for the outside-span case too, to keep the surface uniform).

#### Scenario: Right-click on an empty cell is a no-op

- **WHEN** the row has no event at the snapped tick AND the user right-clicks
- **THEN** `track.events` SHALL be unchanged
- **AND** the browser `contextmenu` menu SHALL NOT appear

#### Scenario: Right-click on an existing event deletes it

- **WHEN** an event exists at the snapped tick AND the user right-clicks
- **THEN** that event SHALL be removed from `track.events`

#### Scenario: Right-drag deletes multiple cells

- **WHEN** the row has events at `tTicks === 120, 240, 360, 480` AND the user right-presses at cell `240`, drags through `360`, and releases at `480`
- **THEN** the events at `tTicks === 240, 360, 480` SHALL be removed
- **AND** the event at `tTicks === 120` SHALL remain

#### Scenario: Fast right-drag sweeps in-between cells and off-grid events

- **WHEN** the row has events at `tTicks === 240, 360` AND an off-grid event at `tTicks === 500` AND the user right-presses at cell `120` AND the pointer jumps directly to cell `600` in a single `pointermove` (no sample in between), then releases
- **THEN** every event with `tTicks` in `[120, 600]` SHALL be removed — including `240`, `360`, and the off-grid `500`
- **AND** events with `tTicks` outside `[120, 600]` SHALL be unchanged

### Requirement: AT-mode gestures are clamped to the event span

In AT mode, every gesture (click, drag-paint, shift+click, right-click) SHALL only fire when the snapped tick is within `[event.tTicks, event.tTicks + event.durTicks]`. The cursor SHALL show a `no-drop` indicator when the pointer is outside the span. Writes happening at the boundary SHALL convert to note-relative `t = (snappedTick - event.tTicks) / event.durTicks` clamped to `[0, 1]`.

When `event.durTicks < quantizeGridToTicks(quantizeGrid)` (the event is shorter than one grid cell), gestures SHALL degrade gracefully: writes use the exact pointer tick (no snap) inside the span instead of returning a snapped tick outside it.

#### Scenario: Click outside event span is a no-op

- **WHEN** the event has `tTicks === 480, durTicks === 240` AND the user clicks at `clientX` corresponding to tick `100`
- **THEN** `event.pressure` SHALL be unchanged

#### Scenario: Write at event boundary clamps note-relative t to 1.0

- **WHEN** the user clicks at the exact end tick of the event (snapped tick === `event.tTicks + event.durTicks`)
- **THEN** the written `PressurePoint`'s `t` SHALL equal `1.0` (within `0.001`)

#### Scenario: Short events degrade to unsnapped writes

- **WHEN** the event has `durTicks === 60` AND `quantizeGrid === '1/16'` (grid = 120 ticks) AND `quantizeOn === true` AND the user clicks inside the event span
- **THEN** the written `PressurePoint`'s `t` SHALL be derived from the exact pointer tick rather than the (outside-span) snapped tick

### Requirement: Bulk-op chips Smooth, Flatten, Clear operate on the current range

The editor's right margin SHALL render a small strip containing three chips with text content `Smooth`, `Flatten`, `Clear` in that order. Below the chips, a value-scale legend SHALL render: `0` / `0.5` / `1` for CC and AT modes, `−` / `0` / `+` for PB mode.

For each chip, the operation's range SHALL be:
- **CC / PB modes**: the timeline's currently-visible tick range, computed as `[scrollLeftTick, scrollLeftTick + viewportWidthTicks]` where the tick conversion uses the same `pxPerTick` as the editor canvas.
- **AT mode**: the event span `[event.tTicks, event.tTicks + event.durTicks]`.

Chip semantics:

- **Smooth**: For CC/PB, rasterize the row's events in the range to 16 bins, apply `smoothPressure` (kernel `3`), then replace every event in the range with 16 evenly-spaced events at the smoothed values (`tTicks` evenly distributed across the range; `vel` equal to the smoothed bin value). For AT, dispatch `setEventPressure(trackId, pitch, eventIdx, smoothPressure(currentPressurePoints))` once, where `currentPressurePoints` is `event.pressure` (or `synthesizePressure(event)` when `pressure === undefined` — materialised on first edit).
- **Flatten**: For CC/PB, compute the rasterised mean of the in-range events, then replace every event in the range with 16 evenly-spaced events at that mean. For AT, dispatch `setEventPressure(trackId, pitch, eventIdx, flattenPressure(currentPressurePoints))` once.
- **Clear**: For CC/PB, remove every event in the range from `track.events`. For AT, dispatch `setEventPressure(trackId, pitch, eventIdx, [])` once (the empty array semantically means "explicitly cleared").

Bulk operations SHALL NOT modify the shift-anchor.

#### Scenario: Smooth in CC mode replaces in-viewport events

- **WHEN** the editor is in CC mode, the viewport covers ticks `[0, 1920]`, the row has 5 events in that range and 2 events at `tTicks > 1920`, and the user clicks `Smooth`
- **THEN** the row SHALL have 16 events in `[0, 1920]` evenly spaced (`tTicks` at `0, 128, 256, ..., 1920`)
- **AND** the 2 events outside the viewport SHALL remain unchanged

#### Scenario: Flatten in AT mode produces a uniform pressure

- **WHEN** the editor is in AT mode AND the user clicks `Flatten`
- **THEN** `setEventPressure` SHALL be called once with a 16-point array whose `v` values are all equal (within `0.001`)

#### Scenario: Clear in CC mode removes in-viewport events

- **WHEN** the editor is in CC mode, the viewport covers ticks `[0, 1920]`, the row has events at `tTicks === 100, 500, 2000`, and the user clicks `Clear`
- **THEN** `track.events` on the row SHALL contain only the event at `tTicks === 2000`

#### Scenario: Clear in AT mode writes empty pressure

- **WHEN** the editor is in AT mode AND the user clicks `Clear`
- **THEN** `setEventPressure` SHALL be called once with `(trackId, pitch, eventIdx, [])`

### Requirement: Editor uses transport quantize state without owning it

The editor SHALL read `quantizeOn`, `quantizeGrid`, and `snapAbsoluteOn` from the same source `ActionRoll` consumes today (via `useStage()` or the transport titlebar hook). The editor SHALL NOT mutate those values. Changes to those values mid-edit SHALL apply to new writes immediately; existing points (CC events with `tTicks` set, AT `PressurePoint`s with `t` set) SHALL NOT re-snap retroactively.

#### Scenario: Grid change does not move existing points

- **WHEN** the row has events at `tTicks === 120, 240` painted with `quantizeGrid === '1/16'` AND the user switches `quantizeGrid` to `'1/8'`
- **THEN** the existing events SHALL remain at `tTicks === 120, 240`

#### Scenario: Grid change applies to new writes

- **WHEN** `quantizeGrid` switches from `'1/16'` to `'1/8'` AND the user clicks at `clientX` corresponding to tick `145`
- **THEN** the new write's `tTicks` SHALL snap to `240` (the nearest `1/8` cell at TPQ=480)

### Requirement: Editor CSS uses design tokens only

The editor's stylesheet SHALL ship at `src/components/dj-value-editor/DJValueEditor.css` and SHALL use only existing design tokens for colors. Specifically:

- Bar fill SHALL resolve through a `var(--action-color)` inline CSS variable set on the editor root (matching the convention used by the retired pressure section).
- Header label, legend text, and chip surfaces SHALL use existing `var(--mr-*)` tokens (text, panel, border).
- The center-line dash in PB mode SHALL use `var(--mr-text-3)` or another existing token, not a new hex literal.
- No new `oklch(...)`, `#RGB`, or `#RRGGBB` literals SHALL appear.

#### Scenario: No new color literals

- **WHEN** `src/components/dj-value-editor/DJValueEditor.css` is inspected
- **THEN** every color value SHALL be either `var(--mr-*)`, `var(--action-color)`, `color-mix(...)`, `currentColor`, `transparent`, or `inherit`
- **AND** there SHALL be no new `oklch(...)` literals or hex color literals

