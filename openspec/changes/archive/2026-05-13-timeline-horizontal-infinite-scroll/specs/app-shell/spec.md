## MODIFIED Requirements

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
