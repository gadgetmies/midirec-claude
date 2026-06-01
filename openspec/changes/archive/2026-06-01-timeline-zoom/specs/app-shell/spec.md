## MODIFIED Requirements

### Requirement: Stage region fills remaining vertical space

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler + every channel group's roll + every param lane plot + every dj-action-track's body) and a vertical scrollbar for the channel/dj-action-track stack when its content exceeds the available vertical space.

The browser scrollbar SHALL be hidden via `scrollbar-width: none` and the WebKit `::-webkit-scrollbar { display: none }` pseudo so that no reserved-track gap appears at the timeline's right or bottom edge.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. The timeline body — between the sticky-top Ruler and the timeline's bottom — SHALL host one `<ChannelGroup>` (`.mr-channel` element) per visible channel, followed by one `<DJActionTrack>` (`.mr-djtrack` element) per entry in `state.djActionTracks`. Both kinds appear simultaneously in the same timeline; channels do NOT hide when dj-action-tracks are present, and vice versa. There SHALL NOT be a separate `.mr-multi-track-stage` orchestrator element nor a separate `.mr-cc-lanes` block element at this level.

`.mr-timeline` (or `.mr-timeline__inner`) SHALL carry the global `data-soloing="true"` attribute when any channel/roll/lane/dj-action-track in the session has `soloed === true`, per the `channels` and `dj-action-tracks` capabilities. The flag combines contributions from both kinds; it is track-kind-independent.

The timeline's horizontal intrinsic width SHALL equal `KEYS_COLUMN_WIDTH + layoutHorizonBeats * pxPerBeat`, where `layoutHorizonBeats` is furnished by session-level derivation per `session-model` ADDED requirement "Timeline layout horizon derives from session extent", and **where `pxPerBeat` is the live value from `useStage().pxPerBeat` per the `timeline-zoom` capability — not the hardcoded `DEFAULT_PX_PER_BEAT` constant.** Changes to `stage.pxPerBeat` SHALL recompute the inner width on the next render.

After any programmatic or user-authored horizontal adjustment to `.mr-timeline`, its `scrollLeft` property SHALL be clamped such that `scrollLeft >= 0`, preventing the viewpoint from drifting past beat `0` into negative musical time relative to lane coordinates.

The horizon-expansion routine that runs on scroll, on viewport resize, and on session floor changes SHALL ALSO re-run when `stage.pxPerBeat` changes, so that zooming out grows the horizon to fill the viewport without requiring a separate scroll event.

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

#### Scenario: Timeline width reflects live pxPerBeat

- **GIVEN** `useStage().pxPerBeat` is `88` and `layoutHorizonBeats * pxPerBeat = 1408`
- **WHEN** the user invokes a zoom action that sets `stage.pxPerBeat = 176`
- **THEN** on the next render the computed width of `.mr-timeline__inner` SHALL equal `KEYS_COLUMN_WIDTH + layoutHorizonBeats * 176`

#### Scenario: Zoom-out grows the horizon without a scroll event

- **GIVEN** `layoutHorizonTicks` is at its minimum (the session floor) and the viewport exactly fits the session at `pxPerBeat = 88`
- **WHEN** `stage.setPxPerBeat(44)` is invoked (zoom out, halving density)
- **THEN** the horizon-expansion routine SHALL run as part of the zoom commit
- **AND** the resulting `layoutHorizonTicks` SHALL be large enough that the timeline content fills (or overflows) the viewport's inner width at the new `pxPerBeat`

## ADDED Requirements

### Requirement: AppShell hosts timeline zoom gestures

`AppShell.tsx` SHALL attach a `wheel` event listener to the `.mr-timeline` element with `{ passive: false }` for the lifetime of the shell. The handler SHALL:

- Bail (no-op, allow native scroll) when `event.ctrlKey === false && event.metaKey === false`.
- When the modifier is present (Cmd / Ctrl, including macOS pinch's synthetic `ctrlKey`), call `event.preventDefault()`, compute the next `pxPerBeat` per the `timeline-zoom` wheel-step contract, compute `nextScrollLeft = zoomAroundAnchor(prev, next, anchorPx, scrollLeft, KEYS_COLUMN_WIDTH).nextScrollLeft` where `anchorPx = max(event.clientX - timelineRect.left, KEYS_COLUMN_WIDTH)`, call `stage.setPxPerBeat(next)`, and assign `timelineRef.current.scrollLeft = nextScrollLeft` synchronously.

`AppShell.tsx` SHALL ALSO attach a `keydown` listener to `window` honouring the focus guard defined by `timeline-zoom`: `+` / `=` zoom in, `-` zoom out, `0` fit-session.

The wheel listener SHALL NOT consume non-modifier wheel events, so native vertical / horizontal scroll continues to work.

#### Scenario: Wheel without modifier scrolls natively

- **WHEN** the user wheels over `.mr-timeline` with no Cmd/Ctrl
- **THEN** the AppShell wheel handler SHALL NOT call `event.preventDefault()`
- **AND** SHALL NOT call `setPxPerBeat`
- **AND** the native scroll SHALL proceed

#### Scenario: Cmd-wheel calls preventDefault and zooms

- **WHEN** the user wheels over `.mr-timeline` with `metaKey: true` (or `ctrlKey: true`)
- **THEN** the handler SHALL call `event.preventDefault()`
- **AND** SHALL call `stage.setPxPerBeat(next)` with a clamped value
- **AND** SHALL set `timelineRef.current.scrollLeft` to the value computed by `zoomAroundAnchor`

#### Scenario: Keyboard `0` fits and resets scroll

- **GIVEN** the document body has focus
- **WHEN** the user presses `0` with no modifiers and no editable target
- **THEN** `stage.setPxPerBeat(fitPxPerBeat(...))` SHALL be called
- **AND** `timelineRef.current.scrollLeft` SHALL equal `0` on the next render
