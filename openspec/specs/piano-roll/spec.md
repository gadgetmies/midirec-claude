### Requirement: PianoRoll renders keys column, lane grid, notes, and playhead

The codebase SHALL expose a `PianoRoll` React component at `src/components/piano-roll/PianoRoll.tsx`. Given props `{ width, height, notes, lo?, hi?, totalT?, playheadT?, marquee?, selectedIdx?, trackColor?, accent? }`, the component SHALL render a `.mr-roll` element containing:

1. A `.mr-keys` keys column on the left with width 56px (matching `prototype/app.css` line 500), containing one `.mr-key` element per pitch in `[lo, hi)`. Each key SHALL be absolute-positioned bottom-up such that pitch `lo` is at the bottom and pitch `hi - 1` is at the top, with row height `height / (hi - lo)`. Black-key pitches (semitone classes 1, 3, 6, 8, 10) SHALL carry `data-black="true"`. Keys at C (pitch `% 12 === 0`) SHALL render the note name + octave (e.g. `C4`); other keys SHALL render an empty label.
2. A `.mr-roll__lanes` lane area to the right of the keys column, occupying the remaining width. Inside it:
   - One `.mr-lane` per pitch row, absolute-positioned to align with its key in the keys column; black-key rows SHALL carry `data-black="true"`.
   - Vertical beat tick lines at every integer beat from `0` through `totalT` inclusive. Beats divisible by 4 SHALL render with stronger opacity than other beats.
   - One `.mr-note` element per note in `notes` whose pitch is in `[lo, hi)`. Notes whose pitch is outside the range SHALL be omitted (no overflow rendering).
3. A `.mr-playhead` element absolute-positioned at `left: playheadT * (width / totalT)`, spanning the full lane height.

#### Scenario: Default props produce a 28-row, 16-beat surface

- **WHEN** `<PianoRoll width={800} height={400} notes={[]} />` is rendered (using prop defaults `lo=48`, `hi=76`, `totalT=16`, `playheadT=0`)
- **THEN** the rendered DOM SHALL contain exactly 28 `.mr-key` elements
- **AND** SHALL contain exactly 28 `.mr-lane` elements
- **AND** SHALL contain at least 17 vertical beat-tick elements (beats 0 through 16)
- **AND** SHALL contain exactly one `.mr-playhead` element
- **AND** the `.mr-playhead`'s computed `left` SHALL be `0px`

#### Scenario: Notes outside the pitch range are not rendered

- **WHEN** `<PianoRoll width={800} height={400} lo={60} hi={72} notes={[{t:0,dur:1,pitch:48,vel:0.8},{t:1,dur:1,pitch:64,vel:0.8}]} />` is rendered
- **THEN** the rendered DOM SHALL contain exactly one `.mr-note` element (the one at pitch 64)

#### Scenario: Black-key rows are flagged

- **WHEN** the keys column is rendered for `lo=60, hi=72` (one octave starting at C4)
- **THEN** the keys at offsets 1, 3, 6, 8, 10 within the octave (C#, D#, F#, G#, A#) SHALL each carry `data-black="true"`
- **AND** the keys at offsets 0, 2, 4, 5, 7, 9, 11 SHALL NOT carry `data-black="true"`

#### Scenario: C-pitch keys carry their note name label

- **WHEN** the keys column is rendered including pitch 60 (C4)
- **THEN** the `.mr-key` element at pitch 60 SHALL contain the text `C4`
- **AND** the `.mr-key` element at pitch 61 (C#4) SHALL contain no visible text

### Requirement: Note color follows the prototype's velocity formula

Each `.mr-note` element's background SHALL be set inline (via `style.background`) according to the following rules, in priority order:

1. If the note's index is included in the renderer's effective selection list (see "Selection resolution" below), the background SHALL be `var(--mr-note-sel)` and the element SHALL carry `data-sel="true"`.
2. Otherwise, if `trackColor` is provided, the background SHALL be `color-mix(in oklab, {trackColor} {50 + vel*50}%, transparent)` where `vel` is the note's normalised velocity (0..1).
3. Otherwise, the background SHALL be `oklch(68% {0.06 + vel*0.10} 240 / {0.5 + vel*0.5})` — the prototype's default-blue velocity formula.

This is the only place in the codebase outside `tokens.css` where `oklch(...)` may appear, because the velocity-derived chroma and alpha cannot be expressed as static CSS rules.

#### Scenario: Selected notes use the selection token

- **WHEN** `<PianoRoll selectedIdx={[0]} notes={[{t:0,dur:1,pitch:60,vel:0.5}]} />` is rendered
- **THEN** the `.mr-note` element SHALL carry `data-sel="true"`
- **AND** its inline `style.background` SHALL be the string `var(--mr-note-sel)`

#### Scenario: Track color overrides the default formula

- **WHEN** `<PianoRoll trackColor="oklch(70% 0.16 30)" notes={[{t:0,dur:1,pitch:60,vel:0.8}]} />` is rendered (with no selection)
- **THEN** the `.mr-note` element's inline `style.background` SHALL be the literal string `color-mix(in oklab, oklch(70% 0.16 30) 90%, transparent)`

#### Scenario: Default formula at velocity 1.0

- **WHEN** `<PianoRoll notes={[{t:0,dur:1,pitch:60,vel:1.0}]} />` is rendered (with no selection, no `trackColor`)
- **THEN** the `.mr-note` element's inline `style.background` SHALL be the literal string `oklch(68% 0.16 240 / 1)`

### Requirement: Note geometry matches the prototype's formulas

Each `.mr-note` element SHALL be absolute-positioned according to the following formulas, where `range = hi - lo`, `rowH = height / range`, and `px = width / totalT`:

- `top = height - ((pitch - lo) + 1) * rowH + 1`
- `left = t * px`
- `width = max(2, dur * px)` (clamped so very short notes are still visible)
- `height = max(5, rowH - 2)` (clamped so very narrow rows still render the bar)

#### Scenario: Note at lo pitch lands at the bottom of the lane area

- **WHEN** `<PianoRoll width={1600} height={280} lo={48} hi={76} totalT={16} notes={[{t:0,dur:1,pitch:48,vel:0.5}]} />` is rendered
- **THEN** the rendered `.mr-note`'s computed `top` SHALL be `height - rowH + 1 = 271px` (where `rowH = 280/28 = 10`)

#### Scenario: Note at time 0 with duration 1 is one beat wide

- **WHEN** `<PianoRoll width={1600} totalT={16} notes={[{t:0,dur:1,pitch:60,vel:0.5}]} />` is rendered
- **THEN** the rendered `.mr-note`'s computed `width` SHALL be `100px` (`1 * 1600/16`)

#### Scenario: Sub-pixel note widths are clamped to 2px

- **WHEN** `<PianoRoll width={160} totalT={16} notes={[{t:0,dur:0.05,pitch:60,vel:0.5}]} />` is rendered (raw width = 0.5px)
- **THEN** the rendered `.mr-note`'s computed `width` SHALL be `2px`

### Requirement: Marquee renders dashed rect with badge

When the `marquee` prop is non-null, the `PianoRoll` SHALL render:

1. A `.mr-marquee` SVG element absolute-positioned to enclose the rectangle from `(min(t0,t1), max(p0,p1))` (top-left in lane coordinates, since pitch grows upward) to `(max(t0,t1), min(p0,p1))`. The SVG SHALL contain a single `.mr-marquee__rect` `<rect>` with a 1px dashed stroke in `var(--mr-accent)`, a translucent fill of `color-mix(in oklab, var(--mr-accent) 10%, transparent)`, and SHALL animate via the `mr-marquee-march` keyframe (0.8s linear infinite) by varying `stroke-dashoffset` (which produces a visible marching-ants effect, unlike the prototype's flat-color `background-position` animation which is invisible).
2. A `.mr-marquee__badge` element positioned at `left: rectRight + 6, top: rectTop`, containing a `.mr-marquee__count` displaying the effective selection count and a `.mr-marquee__lbl` displaying the static text `selected`.

The prototype's four `.mr-marquee__corner` markers are intentionally omitted — they were visually noisy and added no signal beyond what the dashed border already conveys.

#### Scenario: Marquee rectangle dimensions match the input

- **WHEN** `<PianoRoll width={1600} height={280} lo={48} hi={76} totalT={16} marquee={{t0:4, t1:8, p0:60, p1:67}} notes={[]} />` is rendered
- **THEN** the rendered `.mr-marquee`'s computed `left` SHALL be `400px` (`4 * 100`)
- **AND** its computed `width` SHALL be `400px` (`(8-4) * 100`)
- **AND** its computed `top` SHALL be `80px` (`height - (max(p0,p1) - lo + 1) * rowH = 280 - 20*10 = 80`)
- **AND** its computed `height` SHALL be `(max(p0,p1) - min(p0,p1) + 1) * rowH = 80px`

#### Scenario: Badge count matches selectedIdx length

- **WHEN** `<PianoRoll marquee={{...}} selectedIdx={[1, 4, 9]} ... />` is rendered
- **THEN** the rendered `.mr-marquee__badge` SHALL contain a `.mr-marquee__count` whose text content is `3`
- **AND** SHALL contain a `.mr-marquee__lbl` whose text content is `selected`

### Requirement: Selection resolution prefers explicit selectedIdx over marquee derivation

The renderer's effective selection list SHALL be computed as:

- If `selectedIdx` is provided (not undefined), use it verbatim.
- Else if `marquee` is non-null, compute `notesInMarquee(notes, marquee)` and use the result.
- Else, the effective selection is the empty list.

The pure helper `notesInMarquee(notes, marquee)` SHALL be exported from `src/components/piano-roll/notes.ts` and SHALL return the indexes (in `notes`-array order) of every note whose `[t, t+dur)` interval overlaps `[min(t0,t1), max(t0,t1))` AND whose `pitch` is in `[min(p0,p1), max(p0,p1)]` (inclusive on both ends — pitch is integer-valued).

#### Scenario: Explicit selectedIdx wins over marquee

- **WHEN** `<PianoRoll marquee={{t0:0,t1:16,p0:48,p1:76}} selectedIdx={[2]} notes={[{t:0,dur:1,pitch:60,vel:.5},{t:1,dur:1,pitch:62,vel:.5},{t:2,dur:1,pitch:64,vel:.5}]} />` is rendered
- **THEN** only the note at index 2 SHALL carry `data-sel="true"`
- **AND** the badge count SHALL display `1`

#### Scenario: Marquee auto-derives selection when selectedIdx is omitted

- **WHEN** `notesInMarquee([{t:0,dur:1,pitch:60,vel:.5},{t:1.5,dur:1,pitch:62,vel:.5},{t:5,dur:1,pitch:64,vel:.5}], {t0:0,t1:3,p0:60,p1:65})` is called
- **THEN** the returned array SHALL be `[0, 1]` (in this order)

#### Scenario: notesInMarquee handles reversed corners

- **WHEN** `notesInMarquee([{t:1,dur:1,pitch:60,vel:.5}], {t0:3,t1:0,p0:65,p1:55})` is called
- **THEN** the returned array SHALL be `[0]` (the helper SHALL normalise corner order internally)

### Requirement: Playhead position is computed from playheadT

The `.mr-playhead` element's computed `left` SHALL equal `playheadT * (width / totalT)` rounded to sub-pixel precision (no integer snapping). The element SHALL render even when `playheadT === 0`.

#### Scenario: Playhead at time 0 lands at left edge of lanes

- **WHEN** `<PianoRoll width={1600} totalT={16} playheadT={0} notes={[]} />` is rendered
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be `0px`

#### Scenario: Playhead at time totalT lands at right edge of lanes

- **WHEN** `<PianoRoll width={1600} totalT={16} playheadT={16} notes={[]} />` is rendered
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be `1600px`

### Requirement: PianoRoll stylesheet ports prototype rules verbatim

The codebase SHALL ship `src/components/piano-roll/PianoRoll.css` containing the rules from `prototype/app.css` lines ~493–692 covering: `.mr-roll`, `.mr-keys`, `.mr-key` (including `[data-black="true"]`), `.mr-roll__lanes`, `.mr-lane` (including `[data-black="true"]`), `.mr-note` (including `[data-sel="true"]`), `.mr-marquee`, `.mr-marquee__corner` (including all four `[data-c]` variants), `.mr-marquee__badge`, `.mr-marquee__count`, `.mr-marquee__lbl`, `.mr-playhead` (including `::before`), and the `@keyframes mr-marquee-march` definition. All visual values in the stylesheet SHALL resolve through `--mr-*` tokens or `rgba(...)` literals already present in the prototype's same lines.

In addition to the prototype's rules, `.mr-keys` SHALL carry `position: sticky; left: 0; z-index: 2`. This pins the keys column to the visible left edge of the outer `.mr-timeline` scroll container at any horizontal scroll offset. The keys column's `width: 56px` and `background: var(--mr-bg-panel-2)` SHALL be preserved so it visually masks the lanes content beneath it when sticky-pinned.

`.mr-roll__lanes` SHALL NOT carry `overflow: hidden`. Horizontal clipping of off-window note rectangles, beat ticks, marquee rectangle, and loop-marker glyphs SHALL be performed by the outer `.mr-timeline` scroll container's `overflow-x: auto`. The lanes content's existing absolute-positioning math is unchanged — elements with negative `left` values continue to render off-screen-left and are clipped by the timeline.

`.mr-roll` itself SHALL NOT carry `overflow: hidden`. Like `.mr-roll__lanes` and `.mr-track__roll`, it relies on the outer scroller for clipping.

#### Scenario: Marquee animation is registered

- **WHEN** the rendered DOM is inspected with `PianoRoll` mounted
- **THEN** the document SHALL define `@keyframes mr-marquee-march`
- **AND** an element with `.mr-marquee` SHALL have `animation-name: mr-marquee-march`

#### Scenario: No new hex literals or oklch in CSS

- **WHEN** `src/components/piano-roll/PianoRoll.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases

#### Scenario: Keys column is sticky-left

- **WHEN** the rendered DOM is inspected with a `PianoRoll` mounted inside `.mr-timeline`
- **THEN** the `.mr-keys` element's computed `position` SHALL be `sticky`
- **AND** its computed `left` SHALL resolve to `0`
- **AND** its computed `z-index` SHALL be `2`

#### Scenario: Keys column stays visible during horizontal scroll

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural left edge of `.mr-roll` would scroll out the visible left
- **THEN** every track row's `.mr-keys` SHALL remain visible at the left edge of `.mr-timeline`'s visible area
- **AND** the keys column's left edge SHALL stay aligned with the timeline's visible-area left edge regardless of scroll offset

#### Scenario: PianoRoll lanes do not clip horizontally

- **WHEN** the rendered DOM is inspected
- **THEN** `.mr-roll`'s computed `overflow-x` SHALL NOT be `hidden`
- **AND** `.mr-roll__lanes`'s computed `overflow-x` SHALL NOT be `hidden`

### Requirement: Stage hosts a single PianoRoll driven by useStage()

The codebase SHALL expose a `useStage()` hook at `src/hooks/useStage.ts` returning `{ notes, lo, hi, totalT, playheadT, marquee, selectedIdx, resolvedSelection }`. `AppShell.tsx` SHALL mount a single `PianoRoll` inside the `.mr-stage` region whose props are bound to `useStage()`'s return value, with `width` and `height` measured from the `.mr-stage` element's content box via a `ResizeObserver`-backed hook.

The `resolvedSelection` field SHALL have shape `{ channelId: ChannelId, indexes: number[] } | null` and SHALL be derived as follows, evaluated in this order:

- If `selectedIdx` is a non-empty array, `resolvedSelection = { channelId: selectedChannelId, indexes: selectedIdx }`.
- Else if `marquee` is non-null AND `selectedChannelId` is non-null, `resolvedSelection = { channelId: selectedChannelId, indexes: notesInMarquee(roll.notes, marquee) }` where `roll` is the roll whose `channelId === selectedChannelId`. If the resulting `indexes` array is empty, `resolvedSelection = null`.
- Else `resolvedSelection = null`.

This pre-computed shape is consumed by the `inspector` capability so the Inspector reads a single resolved value rather than re-deriving from the marquee + selectedIdx + selectedChannelId triple.

`useStage()` SHALL:

- Return `notes = makeNotes(38, 7)` — the prototype's deterministic seed (count 38, seed 7). The `makeNotes(count, seed)` helper SHALL be implemented in `src/components/piano-roll/notes.ts` and SHALL produce identical output to the prototype's `makeNotes` function (same LCG constants 9301, 49297, 233280; same starting `t` accumulation; same pitch offset 48; same velocity formula).
- Return `lo = 48`, `hi = 76`, `totalT = 16`.
- Return `playheadT` derived from the `useTransport()` clock as `((timecodeMs / 1000) * (bpm / 60)) % totalT`, so the playhead sweeps proportionally to the fake clock and wraps at the right edge.
- Branch on URL flags as follows. The flags are mutually exclusive; when both are present, `?demo=marquee` SHALL win:
  - **`demo=marquee`**: return `marquee = { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }`, omit `selectedIdx` (so it is auto-derived as the empty array; `resolvedSelection` derives from the marquee branch above), and set `selectedChannelId = 1`. The rectangle is tuned so that `notesInMarquee(makeNotes(38, 7), marquee)` returns exactly 7 indexes — matching screenshot 04's `7 SELECTED` count. `resolvedSelection` SHALL therefore have `indexes.length === 7`.
  - **`demo=note`**: return `marquee = null`, `selectedIdx = [<idx>]` for a fixed index `<idx>` chosen so that the selected note has a recognisable pitch in the Lead channel's roll (the implementation MAY choose any deterministic index in `[0, makeNotes(38, 7).length)`), and `selectedChannelId = 1`. `resolvedSelection.indexes` SHALL therefore have length exactly 1.
  - **Neither flag**: return `marquee = null`, `selectedIdx = []`, `selectedChannelId = null`. `resolvedSelection` SHALL be `null`.

#### Scenario: Default load shows no marquee and null resolvedSelection

- **WHEN** the app is loaded at the bare `/` URL
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL equal `null`

#### Scenario: ?demo=marquee shows the screenshot-04 marquee

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** the `.mr-marquee__count` SHALL display `7` (the count of notes from `makeNotes(38, 7)` whose `[t, t+dur)` interval overlaps `[3.5, 8.5)` AND whose `pitch` is in `[56, 69]`)
- **AND** exactly seven `.mr-note` elements SHALL carry `data-sel="true"`
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 7`

#### Scenario: ?demo=note shows a single-note selection

- **WHEN** the app is loaded at `/?demo=note`
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 1`
- **AND** exactly one `.mr-note` element SHALL carry `data-sel="true"`

#### Scenario: ?demo=marquee wins over ?demo=note when both are present

- **WHEN** the app is loaded at `/?demo=marquee&demo=note`
  (or equivalently `/?demo=note&demo=marquee`, since URL flag order does not matter for this test)
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** `useStage().resolvedSelection.indexes.length` SHALL equal `7`

#### Scenario: Playhead advances when transport is playing

- **WHEN** `useTransport()` reports `mode === 'play'` and `timecodeMs > 0`
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be greater than `0px`

#### Scenario: Playhead resets when stop is dispatched

- **WHEN** `useTransport().stop()` has been called and `timecodeMs === 0`
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be `0px`

### Requirement: makeNotes seed produces deterministic output

The pure helper `makeNotes(count: number, seed: number): Note[]` exported from `src/components/piano-roll/notes.ts` SHALL produce a deterministic, side-effect-free array of `Note` objects from the given seed, using the same LCG (`seed = (seed * 9301 + 49297) % 233280`) as `prototype/components.jsx` lines ~314–326.

#### Scenario: Same seed yields same output

- **WHEN** `makeNotes(38, 7)` is called twice
- **THEN** both invocations SHALL return arrays of length 38
- **AND** the two arrays SHALL be deeply equal in `t`, `dur`, `pitch`, and `vel` for every index

#### Scenario: Notes lie within the documented pitch range

- **WHEN** `makeNotes(38, 7)` is called
- **THEN** every returned note's `pitch` SHALL satisfy `48 <= pitch < 76`
- **AND** every returned note's `vel` SHALL satisfy `0.45 <= vel <= 1.0`
- **AND** every returned note's `dur` SHALL satisfy `0.25 <= dur < 1.75`

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
