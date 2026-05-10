## MODIFIED Requirements

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real param lane bars, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + channel groups + dj-action-tracks) is populated by the `ruler`, `channels`, `tracks`, `piano-roll`, `param-lanes`, and `dj-action-tracks` capabilities, the **Inspector** is populated by the `inspector` capability, the **Sidebar** is populated by the `sidebar` capability, the **Toolstrip** is populated by the `export-dialog` capability (Export button), and these regions are NOT subject to this rule. The remaining empty regions are: Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Statusbar region SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside the Statusbar SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Timeline may contain channel groups and dj-action-tracks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain one or more `<div className="mr-channel">` elements per the `channels` capability
- **AND** each `.mr-channel` MAY contain a `<Track>` (`tracks` capability) with its `<PianoRoll>` (`piano-roll` capability) and zero-or-more `<ParamLane>` elements (`param-lanes` capability)
- **AND** `.mr-timeline` MAY contain one or more `<div className="mr-djtrack">` elements per the `dj-action-tracks` capability
- **AND** `.mr-timeline` MAY contain `<button>` elements inside channel headers, track headers, lane headers, dj-action-track headers, and the `+ Add Lane` affordance
- **AND** dj-action-tracks SHALL be siblings of channel groups (direct children of `.mr-timeline__inner`), NOT nested inside them

#### Scenario: Timeline may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability, inside the sticky-top `.mr-ruler` element

#### Scenario: Inspector may contain tabs and panel content

- **WHEN** the app is rendered
- **THEN** the `.mr-inspector` aside MAY contain `.mr-insp-tabs` and `.mr-insp-tab` elements per the `inspector` capability
- **AND** the `.mr-inspector` aside MAY contain `<button>` elements (bulk-action buttons in the multi-select Note panel)
- **AND** the `.mr-inspector` aside SHALL NOT contain a `.mr-stub` placeholder element

#### Scenario: Sidebar may contain panels and form controls

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside MAY contain `.mr-panel` elements per the `sidebar` capability
- **AND** each `.mr-panel` MAY contain `.mr-panel__head` (a clickable element toggling collapse), `.mr-panel__body`, `.mr-dev` rows, `.mr-row` form rows, `.mr-switch` toggles, `.mr-chip` channel chips, and a `.mr-routing` matrix
- **AND** the `.mr-sidebar` aside MAY contain `<button>` elements (panel heads, channel chips)
- **AND** the `.mr-sidebar` aside SHALL NOT contain a `.mr-stub` placeholder element

#### Scenario: Toolstrip may contain functional controls

- **WHEN** the app is rendered
- **THEN** the `.mr-toolstrip` region MAY contain `<button>` elements per the `export-dialog` capability (the Export button)
- **AND** the `.mr-toolstrip` region SHALL NOT contain a `.mr-stub` placeholder element

### Requirement: Stage region fills remaining vertical space

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler + every channel group's roll + every param lane plot + every dj-action-track's body) and a vertical scrollbar for the channel/dj-action-track stack when its content exceeds the available vertical space.

The browser scrollbar SHALL be hidden via `scrollbar-width: none` and the WebKit `::-webkit-scrollbar { display: none }` pseudo so that no reserved-track gap appears at the timeline's right or bottom edge.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. The timeline body — between the sticky-top Ruler and the timeline's bottom — SHALL host one `<ChannelGroup>` (`.mr-channel` element) per visible channel, followed by one `<DJActionTrack>` (`.mr-djtrack` element) per entry in `state.djActionTracks`. Both kinds appear simultaneously in the same timeline; channels do NOT hide when dj-action-tracks are present, and vice versa. There SHALL NOT be a separate `.mr-multi-track-stage` orchestrator element nor a separate `.mr-cc-lanes` block element at this level.

`.mr-timeline` (or `.mr-timeline__inner`) SHALL carry the global `data-soloing="true"` attribute when any channel/roll/lane/dj-action-track in the session has `soloed === true`, per the `channels` and `dj-action-tracks` capabilities. The flag combines contributions from both kinds; it is track-kind-independent.

#### Scenario: Timeline fills remaining vertical space

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, and Statusbar SHALL remain constant
- **AND** the height of `.mr-timeline` SHALL absorb the remaining vertical space inside `.mr-center` (after the Toolstrip)

#### Scenario: Timeline owns the shared horizontal scrollbar

- **WHEN** the timeline content's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) exceeds `.mr-timeline`'s visible width
- **THEN** exactly one horizontal scrollbar SHALL appear, attached to `.mr-timeline`
- **AND** dragging that scrollbar (or wheel/touch scroll) SHALL scroll the Ruler ticks, every channel's `.mr-track__roll`'s lane area, every `.mr-param-lane__plot`, and every dj-action-track's `.mr-djtrack__body` in lockstep
- **AND** no other element in the shell SHALL show its own horizontal scrollbar

#### Scenario: Browser scrollbar is hidden

- **WHEN** the timeline overflows horizontally or vertically
- **THEN** no visible scrollbar track SHALL appear inside `.mr-timeline` (`scrollbar-width: none` is set; `::-webkit-scrollbar` is `display: none`)
- **AND** there SHALL NOT be a black gap on the right or bottom of `.mr-timeline` corresponding to a reserved scrollbar track

#### Scenario: Timeline body hosts both channel groups and dj-action-tracks

- **WHEN** the rendered DOM is inspected
- **THEN** there SHALL NOT be a `.mr-stage` element as a direct grid-row child of `.mr-center`
- **AND** there SHALL NOT be a `.mr-multi-track-stage` element inside `.mr-timeline`
- **AND** there SHALL NOT be a standalone `.mr-cc-lanes` block element anywhere
- **AND** the timeline body SHALL contain one `<div className="mr-channel">` per visible channel (between the Ruler and the dj-action-tracks)
- **AND** the timeline body SHALL contain one `<div className="mr-djtrack">` per entry in `state.djActionTracks` (after the channel groups, before the bottom of the timeline)
- **AND** dj-action-tracks SHALL NOT be nested inside any `.mr-channel` element

#### Scenario: data-soloing combines all track-kind solo

- **WHEN** any channel/roll/lane/dj-action-track in the session has `soloed === true`
- **THEN** `.mr-timeline` (or `.mr-timeline__inner`) SHALL carry `data-soloing="true"`
- **AND** no `.mr-multi-track-stage` or other intermediate orchestrator element SHALL carry `data-soloing` (those elements no longer exist as orchestrators)
- **AND** the flag SHALL NOT depend on the kind of track that is soloed — channel-track solo and dj-action-track solo both contribute
