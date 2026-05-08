## ADDED Requirements

### Requirement: PianoRoll renders a view window into the session, not the full session

The `PianoRoll` component SHALL accept an optional `viewT0?: number` prop (default `0`), representing the session-time beat at which the visible window begins. The visible time range SHALL be `[viewT0, viewT0 + totalT]`. `totalT` SHALL be re-stated, as part of this requirement, as the **visible window length in beats** — NOT the session length.

The `viewT0 = 0` default preserves Slice-2 behavior (window starts at session time 0) and is the only mode the renderer is exercised in until a future scroll/zoom slice introduces a non-zero `viewT0`.

When the renderer receives `notes`, it SHALL filter and position them as follows, where `pxPerBeat` is the configured zoom level:

- **Filter**: a note `n` SHALL be rendered only if `(n.t + n.dur) > viewT0 && n.t < (viewT0 + totalT)`. Notes failing this check SHALL be omitted entirely from the rendered DOM.
- **Position**: a note's `left` value SHALL be `(n.t - viewT0) * pxPerBeat`. Notes whose `left` is negative (i.e., they start before the view window) render at negative offsets and are clipped by the lane area's `overflow: hidden`.

The playhead's `left` SHALL be `(playheadT - viewT0) * pxPerBeat`. When `playheadT < viewT0` or `playheadT > viewT0 + totalT`, the playhead is rendered at its natural off-window x-position and clipped by the lanes' `overflow: hidden`.

#### Scenario: Default viewT0 is 0

- **WHEN** `<PianoRoll notes={...}/>` is rendered without an explicit `viewT0` prop
- **THEN** the renderer SHALL behave as if `viewT0 = 0`
- **AND** existing Slice-2 scenarios that rely on `viewT0 = 0` SHALL remain valid

#### Scenario: Notes entirely outside the view window are not rendered

- **WHEN** `<PianoRoll viewT0={32} totalT={16} notes={[{t:4, dur:1, pitch:60, vel:0.5}]} />` is rendered
- **THEN** the rendered DOM SHALL contain zero `.mr-note` elements

#### Scenario: Notes overlapping the left edge render at negative offset

- **WHEN** `<PianoRoll viewT0={32} totalT={16} pxPerBeat={88} notes={[{t:30, dur:4, pitch:60, vel:0.5}]} />` is rendered
- **THEN** the rendered DOM SHALL contain exactly one `.mr-note` element
- **AND** its computed `left` SHALL be `(30 - 32) * 88 = -176px`
- **AND** the off-window portion SHALL be clipped by `.mr-roll__lanes`'s `overflow: hidden`

#### Scenario: Playhead before the view window is clipped at the left edge

- **WHEN** `<PianoRoll viewT0={32} totalT={16} pxPerBeat={88} playheadT={20} notes={[]} />` is rendered
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be `(20 - 32) * 88 = -1056px`
- **AND** the playhead SHALL be visually clipped (not visible) by the lanes' `overflow: hidden`

### Requirement: PianoRoll renders loop markers when a LoopRegion is provided

The `PianoRoll` component SHALL accept an optional `loopRegion?: { start: number; end: number } | null` prop (default `null`). When non-null AND at least one of `start` or `end` falls within `[viewT0, viewT0 + totalT]`, the renderer SHALL display:

1. One `.mr-loop-marker` element per visible endpoint, absolute-positioned at lane-x `(endpoint - viewT0) * pxPerBeat`, full lane height, with `data-edge="start"` or `data-edge="end"` to distinguish the two.
2. A `.mr-loop-tint` element absolute-positioned to span from the start endpoint's x (clamped to 0 if the start is left of the window) to the end endpoint's x (clamped to lane width if the end is right of the window), full lane height. The tint SHALL be `color-mix(in oklab, var(--mr-loop) 6%, transparent)`.

When the entire loop region is outside the view window (`loopRegion.end <= viewT0` OR `loopRegion.start >= viewT0 + totalT`), no loop-marker or loop-tint elements SHALL render.

The marker color SHALL be `var(--mr-loop)` — a dedicated loop-marker token introduced for this concept. Until the design source's `tokens.css` ships the token's canonical value, the codebase MAY fall back to `var(--mr-cue)` as a placeholder. Each visible marker SHALL carry a bracket glyph cap: a left-bracket `[` for the start endpoint (`data-edge="start"`) and a right-bracket `]` for the end endpoint (`data-edge="end"`), drawn in `var(--mr-loop)`.

#### Scenario: Both endpoints inside the view window

- **WHEN** `<PianoRoll viewT0={0} totalT={16} pxPerBeat={88} loopRegion={{start: 4, end: 12}} notes={[]} />` is rendered
- **THEN** the rendered DOM SHALL contain exactly two `.mr-loop-marker` elements
- **AND** the start marker's `data-edge` SHALL be `start`, computed `left` `4 * 88 = 352px`
- **AND** the end marker's `data-edge` SHALL be `end`, computed `left` `12 * 88 = 1056px`
- **AND** SHALL contain exactly one `.mr-loop-tint` element with computed `left: 352px` and `width: 704px`

#### Scenario: Loop region entirely outside the view window

- **WHEN** `<PianoRoll viewT0={0} totalT={16} loopRegion={{start: 32, end: 48}} notes={[]} />` is rendered
- **THEN** the rendered DOM SHALL contain zero `.mr-loop-marker` elements
- **AND** SHALL contain zero `.mr-loop-tint` elements

#### Scenario: Only the start endpoint is visible

- **WHEN** `<PianoRoll viewT0={0} totalT={16} pxPerBeat={88} loopRegion={{start: 8, end: 24}} notes={[]} />` is rendered
- **THEN** the rendered DOM SHALL contain exactly one `.mr-loop-marker` element with `data-edge="start"` at `left: 8 * 88 = 704px`
- **AND** the `.mr-loop-tint` SHALL have `left: 704px` and SHALL extend to the right edge of the lane area (clamped width)

#### Scenario: loopRegion null produces no markers

- **WHEN** `<PianoRoll loopRegion={null} ... />` or `<PianoRoll ... />` (loopRegion omitted) is rendered
- **THEN** the rendered DOM SHALL contain zero `.mr-loop-marker` elements
- **AND** SHALL contain zero `.mr-loop-tint` elements
