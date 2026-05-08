## MODIFIED Requirements

### Requirement: Ruler region has fixed height

The Ruler region SHALL render at height `var(--mr-h-ruler)` directly above the timeline scroll container's content. The Ruler element SHALL be the first child of `.mr-timeline` and SHALL participate in the timeline's shared horizontal scroll axis. While `.mr-timeline` scrolls vertically, the Ruler SHALL remain pinned at the top of the visible timeline area via `position: sticky; top: 0`.

#### Scenario: Ruler slot present at the right height

- **WHEN** the app is rendered
- **THEN** an element with class `.mr-ruler` SHALL exist as the first child of `.mr-timeline`
- **AND** its computed height SHALL equal `var(--mr-h-ruler)`
- **AND** its computed `position` SHALL be `sticky` with `top` resolving to `0`

#### Scenario: Ruler stays visible during vertical scroll

- **WHEN** the user vertically scrolls `.mr-timeline` so that earlier track rows would scroll out the top
- **THEN** the Ruler SHALL remain visible at the top of the timeline area (its computed `top` offset relative to the viewport SHALL stay constant at the timeline area's top edge)

### Requirement: Stage region fills remaining vertical space

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler, multi-track stack, CC lanes block) and a vertical scrollbar for the multi-track stack when its content exceeds the available vertical space.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. Under this requirement, `.mr-stage` no longer exists as a center-column grid row; the multi-track stack renders as a CHILD of `.mr-timeline` between the Ruler and the CC lanes block.

#### Scenario: Timeline fills remaining vertical space

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, and Statusbar SHALL remain constant
- **AND** the height of `.mr-timeline` SHALL absorb the remaining vertical space inside `.mr-center` (after the Toolstrip)

#### Scenario: Timeline owns the shared horizontal scrollbar

- **WHEN** the timeline content's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) exceeds `.mr-timeline`'s visible width
- **THEN** exactly one horizontal scrollbar SHALL appear, attached to `.mr-timeline`
- **AND** dragging that scrollbar SHALL scroll the Ruler ticks, every `.mr-track__roll`'s lane area, and every `.mr-cc-lane__plot` in lockstep
- **AND** no other element in the shell (not `.mr-stage`, not `.mr-multi-track-stage`, not `.mr-track__roll`, not `.mr-cc-lanes`, not `.mr-cc-lane__plot`) SHALL show its own horizontal scrollbar

#### Scenario: Stage grid row is removed

- **WHEN** the rendered DOM is inspected
- **THEN** there SHALL NOT be a `.mr-stage` element as a direct grid-row child of `.mr-center`
- **AND** the multi-track stack (`.mr-multi-track-stage`) SHALL appear as a descendant of `.mr-timeline`, between the Ruler and the CC lanes block in document order

### Requirement: CC Lanes block holds three fixed-height lanes

The CC Lanes block at the bottom of the timeline SHALL contain exactly three lane slots, each with height `var(--mr-h-cc-lane)`. The slots SHALL be populated by the `cc-lanes` capability — one `<CCLane>` per slot. The Slice-0 placeholder `.mr-cc-slot` divs SHALL NOT appear in the rendered DOM.

The CC Lanes block SHALL render as the LAST child of `.mr-timeline` and SHALL carry `position: sticky; bottom: 0`, so it stays visible at the bottom of the visible timeline area while the multi-track stack scrolls vertically.

#### Scenario: Three lane slots present

- **WHEN** the app is rendered
- **THEN** the `.mr-cc-lanes` region SHALL contain exactly three child `.mr-cc-lane` elements
- **AND** each child's computed height SHALL equal `var(--mr-h-cc-lane)`
- **AND** the rendered DOM SHALL NOT contain any `.mr-cc-slot` elements

#### Scenario: CC Lanes block sticks to the bottom of the timeline

- **WHEN** the multi-track stack's content extends below the visible vertical area and the user scrolls vertically
- **THEN** `.mr-cc-lanes` SHALL remain at the bottom edge of `.mr-timeline`'s visible area (its computed `bottom` offset relative to the viewport SHALL stay constant at the timeline area's bottom edge)

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real CC lane bars, no inspector tabs, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + multi-track stack + CC Lanes block) is populated by the `ruler`, `tracks`, `piano-roll`, and `cc-lanes` capabilities, and these regions are NOT subject to this rule. The remaining empty regions are: Sidebar, Toolstrip, Inspector, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Sidebar, Toolstrip, Inspector, and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Timeline may contain a multi-track stack of piano-roll renderers

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain the `MultiTrackStage` orchestrator (the `tracks` capability), which in turn contains one or more `.mr-roll` elements (`piano-roll` capability) — one per open track
- **AND** `.mr-timeline` MAY contain `<button>` elements inside track headers (chevron toggles, M/S chips per the `tracks` capability)

#### Scenario: Timeline may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability, inside the sticky-top `.mr-ruler` element

#### Scenario: Timeline may contain CCLane components

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain the `.mr-cc-lanes` block with `.mr-cc-lane` elements per the `cc-lanes` capability
- **AND** `.mr-timeline` MAY contain `<button>` elements inside lane headers (M/S chips per the `cc-lanes` capability)
