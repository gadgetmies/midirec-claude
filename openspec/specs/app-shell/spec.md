## Purpose

Define the single-window app shell: the static six-region layout (Titlebar, Sidebar, Toolstrip, Timeline, Inspector, Statusbar), the timeline scroll container that hosts the Ruler and channel groups, the panel-token surface palette, and the empty-region rule that gates content per implementation slice.
## Requirements
### Requirement: Single-window shell with six static regions

The app SHALL render a single-window layout containing six regions, in the following arrangement:

- **Titlebar** at the top, full-width, height `var(--mr-h-toolbar)`.
- **Browser Sidebar** on the left of the body, width `var(--mr-w-sidebar)`, full body height.
- **Inspector** on the right of the body, width `var(--mr-w-inspector)`, full body height.
- **Center column** between sidebar and inspector, occupying remaining horizontal space, containing top-to-bottom: Toolstrip, Timeline (which itself contains the Ruler and a vertical stack of channel groups).
- **Statusbar** at the bottom, full-width.

All region sizes SHALL resolve through `--mr-*` size tokens; no pixel literals duplicating token values are permitted.

#### Scenario: Geometry resolves from tokens

- **WHEN** the app is rendered at a 1440×900 viewport
- **THEN** the titlebar height SHALL equal the computed value of `--mr-h-toolbar`
- **AND** the sidebar width SHALL equal the computed value of `--mr-w-sidebar`
- **AND** the inspector width SHALL equal the computed value of `--mr-w-inspector`

#### Scenario: All regions are present in the DOM

- **WHEN** the app is rendered
- **THEN** the DOM SHALL contain elements representing Titlebar, Sidebar, Toolstrip, Timeline (with Ruler + channel groups), Inspector, and Statusbar
- **AND** each region SHALL be uniquely addressable via a `mr-*` class name matching the prototype's class taxonomy (e.g. `.mr-titlebar`, `.mr-sidebar`, `.mr-toolstrip`, `.mr-ruler`, `.mr-timeline`, `.mr-channel`, `.mr-inspector`, `.mr-statusbar`)

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

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler + every channel group's roll + every param lane plot + every dj-action-track's body) and a vertical scrollbar for the channel/dj-action-track stack when its content exceeds the available vertical space.

The browser scrollbar SHALL be hidden via `scrollbar-width: none` and the WebKit `::-webkit-scrollbar { display: none }` pseudo so that no reserved-track gap appears at the timeline's right or bottom edge.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. The timeline body — between the sticky-top Ruler and the timeline's bottom — SHALL host one `<ChannelGroup>` (`.mr-channel` element) per visible channel, followed by one `<DJActionTrack>` (`.mr-djtrack` element) per entry in `state.djActionTracks`. Both kinds appear simultaneously in the same timeline; channels do NOT hide when dj-action-tracks are present, and vice versa. There SHALL NOT be a separate `.mr-multi-track-stage` orchestrator element nor a separate `.mr-cc-lanes` block element at this level.

`.mr-timeline` (or `.mr-timeline__inner`) SHALL carry the global `data-soloing="true"` attribute when any channel/roll/lane/dj-action-track in the session has `soloed === true`, per the `channels` and `dj-action-tracks` capabilities. The flag combines contributions from both kinds; it is track-kind-independent.

The timeline's horizontal intrinsic width SHALL equal `KEYS_COLUMN_WIDTH + layoutHorizonBeats * pxPerBeat`, where `layoutHorizonBeats` is furnished by session-level derivation per `session-model` ADDED requirement "Timeline layout horizon derives from session extent".

After any programmatic or user-authored horizontal adjustment to `.mr-timeline`, its `scrollLeft` property SHALL be clamped such that `scrollLeft >= 0`, preventing the viewpoint from drifting past beat `0` into negative musical time relative to lane coordinates.

#### Scenario: Timeline fills remaining vertical space

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, and Statusbar SHALL remain constant
- **AND** the height of `.mr-timeline` SHALL absorb the remaining vertical space inside `.mr-center` (after the Toolstrip)

#### Scenario: Timeline owns the shared horizontal scrollbar

- **WHEN** the timeline content's intrinsic width (`KEYS_COLUMN_WIDTH + layoutHorizonBeats * pxPerBeat`) exceeds `.mr-timeline`'s visible width
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

#### Scenario: Horizontal scroll stays at beat zero boundary

- **WHEN** an implementation emits a programmatic `scrollTo`/`scrollLeft` assignment that would set `.mr-timeline.scrollLeft` below `0`
- **THEN** the resulting `scrollLeft` SHALL clamp to exactly `0`
- **AND** the left edge of the lane column SHALL align with musical beat `0` for ruler and stripes

### Requirement: Region surfaces use panel tokens

Each region's background SHALL be drawn from the panel surface tokens. Specifically:

- Titlebar, Sidebar, Inspector, Statusbar: `var(--mr-bg-panel)`.
- Toolstrip: `var(--mr-bg-panel)` or `var(--mr-bg-panel-2)` per the prototype's `app.css`.
- Stage timeline canvas: `var(--mr-bg-timeline)`.
- App backdrop (behind the shell): `var(--mr-bg-app)`.

Region dividers SHALL use `var(--mr-line-2)` 1px hairlines.

#### Scenario: Panel surfaces and dividers use tokens

- **WHEN** computed styles are inspected for each region
- **THEN** the `background-color` of Titlebar, Sidebar, Inspector, and Statusbar SHALL match the computed value of `--mr-bg-panel`
- **AND** divider borders between regions SHALL match the computed value of `--mr-line-2` at 1px width

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

### Requirement: Dialog overlays render as direct children of `.mr-shell`

When an overlay dialog is open (specifically the Export Dialog from the `export-dialog` capability), its scrim element (`.mr-dialog-scrim`) SHALL render as a direct child of `.mr-shell`, positioned `absolute; inset: 0` so it covers all six regions of the shell. The shell's stacking context (`.mr-shell` carries `position: relative`) SHALL be the dialog's positioning context; React portals SHALL NOT be used.

The dialog scrim's `z-index` SHALL resolve from `var(--mr-z-dialog)` (computed value `200`), which is below `var(--mr-z-toast)` (computed value `300`). Toasts emitted while a dialog is open SHALL render visually above the dialog.

While a dialog is open, pointer events on the six shell regions SHALL be blocked by the scrim (the scrim's `background: var(--mr-bg-overlay)` carries non-zero opacity AND `pointer-events: auto` by default). Pointer events on the dialog card itself SHALL continue to work.

#### Scenario: Dialog scrim covers all shell regions

- **WHEN** the Export Dialog is open
- **THEN** the `.mr-shell` element SHALL contain a direct-child `.mr-dialog-scrim` element with `position: absolute` and `inset: 0`
- **AND** the scrim's bounding rect SHALL match the shell's bounding rect (modulo subpixel rounding)
- **AND** the Titlebar, Sidebar, Toolstrip, Timeline, Inspector, and Statusbar regions SHALL all be visually under the scrim

#### Scenario: Toast renders above an open dialog

- **WHEN** the Export Dialog is open AND a toast is shown via `useToast().show(...)`
- **THEN** the toast's `.mr-toast-viewport` element's computed `z-index` SHALL be greater than the dialog scrim's computed `z-index`
- **AND** the toast SHALL be visually above the dialog scrim

### Requirement: Screenshot 01 visual parity

The rendered shell at zero functionality SHALL match `design_handoff_midi_recorder/screenshots/` screenshot 01 in geometry, surface colors, divider weights, and overall composition. Pixel-identical color sampling is the acceptance criterion for surfaces; ±1px tolerance is acceptable for region dimensions.

#### Scenario: Manual screenshot comparison passes

- **WHEN** a developer runs `npm run dev` and opens the app at the screenshot's documented viewport
- **AND** captures a screenshot of the rendered shell
- **THEN** the captured screenshot SHALL match screenshot 01 in region layout, surface colors, and divider weights, within stated tolerances

