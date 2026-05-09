## MODIFIED Requirements

### Requirement: Stage region fills remaining vertical space

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler + every channel group's roll + every param lane plot) and a vertical scrollbar for the channel stack when its content exceeds the available vertical space.

The browser scrollbar SHALL be hidden via `scrollbar-width: none` and the WebKit `::-webkit-scrollbar { display: none }` pseudo so that no reserved-track gap appears at the timeline's right or bottom edge.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. The timeline body — between the sticky-top Ruler and the timeline's bottom — SHALL host one `<ChannelGroup>` (`.mr-channel` element) per visible channel, in numeric ascending order of `Channel.id`. There SHALL NOT be a separate `.mr-multi-track-stage` orchestrator element nor a separate `.mr-cc-lanes` block element at this level (the `.mr-cc-lanes` class is removed entirely from the codebase as part of the rename to `param-lanes`).

`.mr-timeline` (or `.mr-timeline__inner`) SHALL carry the global `data-soloing="true"` attribute when any channel/roll/lane in the session has `soloed === true`, per the `channels` capability.

#### Scenario: Timeline fills remaining vertical space

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, and Statusbar SHALL remain constant
- **AND** the height of `.mr-timeline` SHALL absorb the remaining vertical space inside `.mr-center` (after the Toolstrip)

#### Scenario: Timeline owns the shared horizontal scrollbar

- **WHEN** the timeline content's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) exceeds `.mr-timeline`'s visible width
- **THEN** exactly one horizontal scrollbar SHALL appear, attached to `.mr-timeline`
- **AND** dragging that scrollbar (or wheel/touch scroll) SHALL scroll the Ruler ticks, every channel's `.mr-track__roll`'s lane area, and every `.mr-param-lane__plot` in lockstep
- **AND** no other element in the shell SHALL show its own horizontal scrollbar

#### Scenario: Browser scrollbar is hidden

- **WHEN** the timeline overflows horizontally or vertically
- **THEN** no visible scrollbar track SHALL appear inside `.mr-timeline` (`scrollbar-width: none` is set; `::-webkit-scrollbar` is `display: none`)
- **AND** there SHALL NOT be a black gap on the right or bottom of `.mr-timeline` corresponding to a reserved scrollbar track

#### Scenario: Timeline body hosts channel groups

- **WHEN** the rendered DOM is inspected
- **THEN** there SHALL NOT be a `.mr-stage` element as a direct grid-row child of `.mr-center`
- **AND** there SHALL NOT be a `.mr-multi-track-stage` element inside `.mr-timeline`
- **AND** there SHALL NOT be a standalone `.mr-cc-lanes` block element anywhere (the class is removed entirely as part of the rename to `param-lanes`)
- **AND** the timeline body SHALL contain one `<div className="mr-channel">` per visible channel, between the Ruler and the bottom of the timeline

#### Scenario: data-soloing is on the timeline root

- **WHEN** any channel/roll/lane in the session has `soloed === true`
- **THEN** `.mr-timeline` (or `.mr-timeline__inner`) SHALL carry `data-soloing="true"`
- **AND** no `.mr-multi-track-stage` or other intermediate orchestrator element SHALL carry `data-soloing` (those elements no longer exist as orchestrators)

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real param lane bars, no inspector tabs, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + channel groups) is populated by the `ruler`, `channels`, `tracks`, `piano-roll`, and `param-lanes` capabilities, and these regions are NOT subject to this rule. The remaining empty regions are: Sidebar, Toolstrip, Inspector, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Sidebar, Toolstrip, Inspector, and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Timeline may contain channel groups

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain one or more `<div className="mr-channel">` elements per the `channels` capability
- **AND** each `.mr-channel` MAY contain a `<Track>` (`tracks` capability) with its `<PianoRoll>` (`piano-roll` capability) and zero-or-more `<ParamLane>` elements (`param-lanes` capability)
- **AND** `.mr-timeline` MAY contain `<button>` elements inside channel headers, track headers, lane headers, and the `+ Add Lane` affordance

#### Scenario: Timeline may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability, inside the sticky-top `.mr-ruler` element
