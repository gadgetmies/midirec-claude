### Requirement: CCLane data shape

The codebase SHALL expose a TypeScript type `CCLane` describing one MIDI control stream with the shape `{ id: string; name: string; cc: string; color: string; points: CCPoint[]; muted: boolean; soloed: boolean }`, where `CCPoint` is `{ t: number; v: number }` (`t` in session-time beats, `v` in `[0, 1]`).

`cc` is a free-form display label (e.g., `"01"`, `"PB"`, `"VEL"`) — NOT a numeric MIDI controller number — so streams that aren't strict CCs (Pitch Bend, Velocity) can share the same shape. `color` is a CSS color string used as the bar fill.

The seeded default lane set SHALL contain exactly three lanes with the following identities:

- `{ id: "cc1", name: "Mod Wheel",  cc: "01",  color: "var(--mr-cc)",          muted: false, soloed: false }`
- `{ id: "cc2", name: "Pitch Bend", cc: "PB",  color: "var(--mr-pitch)",       muted: false, soloed: false }`
- `{ id: "cc3", name: "Velocity",   cc: "VEL", color: "var(--mr-aftertouch)",  muted: true,  soloed: false }`

Each lane's `points` SHALL be produced by a deterministic seed generator that takes `totalT: number` and returns a `CCPoint[]` whose `t` values lie in `[0, totalT]`:

- Lane `cc1` uses `ccModWheel(totalT)`: starts at `v=0.5`, walks at `t += 0.5` with `v ← clamp(v + sin(t * 1.3) * 0.18, 0.1, 1.0)`. Mirrors `prototype/components.jsx` `ccPoints1`.
- Lane `cc2` uses `ccPitchBend(totalT)`: walks at `t += 1` with `v = 0.3 + 0.5 * |sin(t * 0.6)|`. Mirrors `ccPoints2`.
- Lane `cc3` uses `ccVelocity(totalT)`: starts at `{t:0, v:0.5}`, walks at `t += 0.4` with `v = 0.5 + 0.4 * sin(t * 2.1)`. Mirrors `ccPoints3`.

#### Scenario: Three default lanes seeded

- **WHEN** `useCCLanes()` is read on first mount
- **THEN** the returned `lanes` array SHALL have length 3
- **AND** the lane ids SHALL be `["cc1", "cc2", "cc3"]` in that order
- **AND** lane `cc3` SHALL have `muted === true`
- **AND** no lane SHALL have `soloed === true`

#### Scenario: Seed generators are deterministic

- **WHEN** `ccModWheel(16)` is called twice in the same process
- **THEN** the two returned arrays SHALL deep-equal each other

### Requirement: useCCLanes hook is the source of CC lane state

The codebase SHALL expose a `useCCLanes()` hook returning `{ lanes: CCLane[]; toggleCCLaneMuted: (id: string) => void; toggleCCLaneSoloed: (id: string) => void }`.

`toggleCCLaneMuted(id)` SHALL flip the matching lane's `muted` field; `toggleCCLaneSoloed(id)` SHALL flip its `soloed` field. If `id` is not present in `lanes`, both SHALL be no-ops.

The hook SHALL NOT mutate the input `points[]` of any lane on toggle — only the `muted`/`soloed` booleans change. New lane objects SHALL be returned for changed lanes; unchanged lanes SHALL share referential identity with the prior render.

#### Scenario: Toggle mute flips a single lane's muted flag

- **WHEN** `toggleCCLaneMuted("cc1")` is dispatched
- **THEN** lane `cc1`'s `muted` SHALL flip
- **AND** lanes `cc2` and `cc3` SHALL retain referential identity (`Object.is(prev.cc2, next.cc2) === true`)

#### Scenario: Toggle solo flips a single lane's soloed flag

- **WHEN** `toggleCCLaneSoloed("cc2")` is dispatched
- **THEN** lane `cc2`'s `soloed` SHALL flip
- **AND** other lanes SHALL retain referential identity

#### Scenario: Toggle on unknown id is a no-op

- **WHEN** `toggleCCLaneMuted("does-not-exist")` is dispatched
- **THEN** the returned `lanes` array SHALL be referentially identical to the previous one

### Requirement: CCLanesBlock renders all lanes and owns lane-scoped solo flag

The codebase SHALL expose a `CCLanesBlock` component that takes `lanes: CCLane[]`, `viewT0?: number` (default 0), `totalT: number`, and the toggle action callbacks, and renders a single `<div className="mr-cc-lanes">` containing one `<CCLane>` per lane in `lanes` order.

The block root SHALL carry `data-soloing="true"` whenever ANY lane in `lanes` has `soloed === true`, and SHALL omit the attribute (or set it to `undefined`) otherwise. Lane solos SHALL NOT propagate beyond `.mr-cc-lanes` — they SHALL NOT dim track rows in the stage or DJ units.

The block SHALL replace the Slice-0 placeholder `.mr-cc-slot` divs entirely. The block's root element carries `className="mr-cc-lanes"`; it is no longer applied to a parent wrapper in `AppShell`.

#### Scenario: data-soloing reflects any lane's solo state

- **WHEN** `<CCLanesBlock lanes={[{...cc1, soloed: false}, {...cc2, soloed: true}, {...cc3, soloed: false}]} ... />` is rendered
- **THEN** the rendered `.mr-cc-lanes` element SHALL have attribute `data-soloing="true"`
- **AND** the soloed lane (cc2) SHALL render at full opacity
- **AND** the non-soloed lanes' `.mr-cc-lane__plot` SHALL inherit `opacity: 0.45` from the `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot` rule

#### Scenario: data-soloing is omitted when no lane is soloed

- **WHEN** `<CCLanesBlock lanes={[cc1, cc2, cc3]} ... />` is rendered with all three `soloed: false`
- **THEN** the rendered `.mr-cc-lanes` element SHALL NOT have a `data-soloing` attribute (or SHALL have `data-soloing` set to `undefined`)

### Requirement: CCLane renders a 56px header strip

The `CCLane` component SHALL render a `<div className="mr-cc-lane" data-muted={lane.muted} data-soloed={lane.soloed}>` containing two children: `.mr-cc-lane__hdr` (the 56px-wide left strip) and `.mr-cc-lane__plot` (the SVG plot fills the remaining width).

The header SHALL contain:

- A top row with `display: flex; justify-content: space-between` containing:
  - `<span className="mr-cc-lane__name">{lane.name}</span>` rendering the uppercase 9px lane name in `var(--mr-text-2)`.
  - `<MSChip muted={lane.muted} soloed={lane.soloed} onMute={...} onSolo={...} />` (reused from the `tracks` capability without modification).
- A bottom row containing `<span className="mr-cc-lane__cc">CC {lane.cc}</span>` rendering the CC label in 9px monospace `var(--mr-text-3)`. The literal text "CC " is hard-coded; the variable portion is `lane.cc`.

The header strip's computed width SHALL equal `56px` and its background SHALL be `var(--mr-bg-panel-2)`.

#### Scenario: Header structure for a representative lane

- **WHEN** `<CCLane lane={{ id:"cc2", name:"Pitch Bend", cc:"PB", ... }} />` is rendered
- **THEN** the rendered DOM SHALL contain `.mr-cc-lane__hdr > .mr-cc-lane__name` with text `"Pitch Bend"`
- **AND** SHALL contain `.mr-cc-lane__hdr > .mr-cc-lane__cc` with text `"CC PB"`
- **AND** SHALL contain `.mr-cc-lane__hdr > .mr-ms` (the MSChip root)

#### Scenario: Header data attributes mirror lane state

- **WHEN** `<CCLane lane={{ ..., muted:true, soloed:false }} />` is rendered
- **THEN** the rendered `.mr-cc-lane` SHALL have `data-muted="true"` and `data-soloed="false"`

### Requirement: CCLane renders a 64-cell discrete-bar SVG plot

The `.mr-cc-lane__plot` element SHALL contain an inline `<svg>` with `width="100%" height="72" preserveAspectRatio="none" viewBox={"0 0 ${plotW} 72"}` where `plotW` is the lane's measured plot width in pixels.

The renderer SHALL resample `lane.points` onto a fixed 64-cell grid spanning `[viewT0, viewT0 + totalT]`. For each cell `i` in `[0, 64)`:

- `cellT = totalT / 64`
- `tCenter = (i + 0.5) * cellT + viewT0`
- The cell's `v` SHALL be the `v` of whichever sample in `lane.points` has the smallest `|sample.t - tCenter|` (nearest-sample averaging). If `lane.points` is empty, every cell's `v` SHALL be 0.

Each cell SHALL render two `<rect>` elements inside the same `<g>`:

1. The bar: `width=1.5`, `height = cell.v * 56`, positioned at `x = i * cellW + (cellW - 1.5)/2`, `y = 8 + (56 - height)`, with `fill = lane.color`, `fill-opacity = 0.78`, `shape-rendering="crispEdges"`. (`cellW = plotW / 64`.)
2. The cap: `width = 1.5 + 1`, `height = 2`, positioned at `x = bar.x - 0.5`, `y = bar.y - 0.5`, with `fill = lane.color`, `opacity = 1`, `shape-rendering="crispEdges"`.

Cells with `v = 0` SHALL still render both rectangles — the bar at `height = 0`, the cap at the bar's top — so the plot maintains a regular 64-event grid even for silent regions.

The plot's background mid-line SHALL be drawn in CSS as a 1px horizontal stripe at 50% height in `rgba(255,255,255,0.04)` via the `.mr-cc-lane__plot` rule's `linear-gradient` background.

#### Scenario: 64 bar groups rendered for any non-empty points

- **WHEN** `<CCLane lane={{ ..., points: [{t:4, v:0.5}, {t:8, v:0.7}] }} totalT={16} />` is rendered
- **THEN** the rendered SVG SHALL contain exactly 64 `<g>` elements at the bar level
- **AND** each `<g>` SHALL contain exactly two `<rect>` elements (bar + cap)

#### Scenario: Empty points render zero-height bars

- **WHEN** `<CCLane lane={{ ..., points: [] }} totalT={16} />` is rendered
- **THEN** every bar `<rect>` SHALL have `height="0"`
- **AND** every cap `<rect>` SHALL still render at `y = 64.5` (top of the zero-height bar)

#### Scenario: Bars are 1.5px regardless of cell pitch

- **WHEN** `<CCLane lane={...} totalT={16} />` is rendered into a plot of any width
- **THEN** every bar `<rect>` SHALL have `width="1.5"`
- **AND** every cap `<rect>` SHALL have `width="2.5"`

### Requirement: CCLane shows a hover scrubbing readout

The `CCLane` component SHALL maintain a local hover state of type `{ idx: number; v: number } | null` (initial `null`). On `mousemove` over the `.mr-cc-lane__plot` element, the renderer SHALL compute `idx = floor((event.offsetX / plotW) * 64)` clamped to `[0, 63]`, look up `v` from the resampled bar array at that index, and set hover state to `{ idx, v }`. On `mouseleave`, hover state SHALL be set back to `null`.

While `hover != null`, the SVG SHALL render an additional `<g>` at the end of the children list (so it z-orders above the bars) containing:

- A `<rect>` at `x = hover.idx * cellW`, `y = 8`, `width = cellW`, `height = 56`, `fill = "var(--mr-accent)"`, `opacity = 0.10`, `shape-rendering = "crispEdges"` — the column tint.
- A `<rect>` at `x = hover.idx * cellW + (cellW - 1.5)/2`, `y = 8 + (56 - hover.v * 56)`, `width = 1.5`, `height = hover.v * 56`, `fill = "var(--mr-accent)"`, `opacity = 0.7`, `shape-rendering = "crispEdges"` — the ghost bar.

In the same hover-active branch, the `.mr-cc-lane__plot` SHALL also render a sibling `<div className="mr-cc-lane__readout">` (outside the SVG) positioned at `style={{ left: hover.idx * cellW + cellW/2, top: 0 }}` with text `Math.round(hover.v * 127)` (a 0–127 integer string). The readout SHALL be styled in 10px monospace `var(--mr-text-2)` with no background fill.

When hover state is `null`, none of the column tint, ghost bar, or readout elements SHALL render.

#### Scenario: Hover renders three overlay elements

- **WHEN** the user mouses over a CC lane plot at a position that resolves to cell index 12 (with that cell's `v = 0.4`)
- **THEN** the rendered SVG SHALL contain a column-tint `<rect>` with `x = 12 * cellW`, `width = cellW`, `fill = "var(--mr-accent)"`, `opacity = 0.10`
- **AND** SHALL contain a ghost-bar `<rect>` with `x = 12 * cellW + (cellW - 1.5)/2`, `width = 1.5`, `fill = "var(--mr-accent)"`, `opacity = 0.7`
- **AND** the lane's DOM SHALL contain a `.mr-cc-lane__readout` element with text content `"51"` (`Math.round(0.4 * 127)`)

#### Scenario: Mouseleave clears hover state

- **WHEN** the user mouses over the plot then leaves it
- **THEN** the rendered DOM SHALL contain zero column-tint, ghost-bar, or `.mr-cc-lane__readout` elements

#### Scenario: Readout uses 0–127 integer formatting, not float

- **WHEN** the hovered cell's `v` is `0.5`
- **THEN** the `.mr-cc-lane__readout` text content SHALL be `"64"` (`Math.round(0.5 * 127)`) — NOT `"0.50"`, NOT `"50%"`

### Requirement: CCLane mute and solo composition matches data-attribute rules

The component's stylesheet SHALL implement the prototype's lane-scoped composition (port of `prototype/app.css` lines 736–747):

- `[data-muted="true"] .mr-cc-lane__plot { opacity: 0.32; filter: grayscale(0.7); }` — muted lanes' plots are dimmed and desaturated (the header retains full opacity to keep the M/S chips legible).
- `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot { opacity: 0.45; }` — when ANY lane in the block is soloed, non-soloed lanes' plots dim. The selector ancestry is the `.mr-cc-lanes` block; lane solos do NOT affect track rows or DJ units.

These rules SHALL be defined in the cc-lanes stylesheet, not in app-shell or tracks CSS.

#### Scenario: Muted lane plot is dimmed and grayscaled

- **WHEN** a `CCLane` renders with `lane.muted === true`
- **THEN** the computed style of its `.mr-cc-lane__plot` SHALL have `opacity: 0.32` and `filter: grayscale(0.7)`
- **AND** the computed style of its `.mr-cc-lane__hdr` SHALL retain the default `opacity: 1`

#### Scenario: Non-soloed lane plot is dimmed when block is soloing

- **WHEN** the `.mr-cc-lanes` block has `data-soloing="true"` and a lane has `data-soloed="false"`
- **THEN** the computed style of that lane's `.mr-cc-lane__plot` SHALL have `opacity: 0.45`

### Requirement: CCLane forward-compat props for paint and interp are inert

The `CCLane` component SHALL accept optional `paint?: number[]` and `interp?: { a: number | null; b: number | null }` props for forward-compat with a future paint/interp slice.

In Slice 4 the `CCLanesBlock` orchestrator SHALL NOT pass either prop; both SHALL default to `undefined` at the component boundary. When undefined, `CCLane` SHALL render no paint trail, no interp endpoints, no interp guide line, and no paint/interp cursor hints — the rendered SVG SHALL be identical to a render with both props omitted.

A future slice may activate these props; until then, type-checking SHALL still pass with `paint` and `interp` set, but no visual behavior SHALL be triggered.

#### Scenario: Paint prop with values renders no trail

- **WHEN** `<CCLane paint={[5, 6, 7]} ... />` is rendered (despite the orchestrator not passing it)
- **THEN** the rendered SVG SHALL be identical to a render with `paint` omitted in this slice
- **AND** the implementation MAY render the trail in a future slice without breaking this test (the test asserts current behavior, not eventual behavior)

#### Scenario: Interp prop with endpoints renders no guide line

- **WHEN** `<CCLane interp={{ a: 4, b: 12 }} ... />` is rendered in this slice
- **THEN** the rendered SVG SHALL contain zero `<line>` elements
- **AND** SHALL contain zero `.mr-cc-cursor` elements
