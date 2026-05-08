## ADDED Requirements

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

### Requirement: Marquee renders dashed rect with corners and badge

When the `marquee` prop is non-null, the `PianoRoll` SHALL render:

1. A `.mr-marquee` element absolute-positioned to enclose the rectangle from `(min(t0,t1), max(p0,p1))` (top-left in lane coordinates, since pitch grows upward) to `(max(t0,t1), min(p0,p1))`. The element SHALL have a 1px dashed border in `var(--mr-accent)`, a translucent background fill of `color-mix(in oklab, var(--mr-accent) 10%, transparent)`, and SHALL animate via the `mr-marquee-march` keyframe (0.8s linear infinite).
2. Four `.mr-marquee__corner` elements, one each for `data-c="tl"`, `"tr"`, `"bl"`, `"br"`, positioned at the rectangle's corners (offset -3px to overlap the border).
3. A `.mr-marquee__badge` element positioned at `left: rectRight + 6, top: rectTop`, containing a `.mr-marquee__count` displaying the effective selection count and a `.mr-marquee__lbl` displaying the static text `selected`.

#### Scenario: Marquee rectangle dimensions match the input

- **WHEN** `<PianoRoll width={1600} height={280} lo={48} hi={76} totalT={16} marquee={{t0:4, t1:8, p0:60, p1:67}} notes={[]} />` is rendered
- **THEN** the rendered `.mr-marquee`'s computed `left` SHALL be `400px` (`4 * 100`)
- **AND** its computed `width` SHALL be `400px` (`(8-4) * 100`)
- **AND** its computed `top` SHALL be `120px` (`280 - (67-48+1) * 10 = 80`... actually `height - (max-pitch - lo + 1) * rowH = 280 - 20*10 = 80`); the spec value is `280 - (67 - 48 + 1) * 10 = 80px`. Implementations MUST use the formula `height - (max(p0,p1) - lo + 1) * rowH`.
- **AND** its computed `height` SHALL be `(max(p0,p1) - min(p0,p1) + 1) * rowH = 80px`

#### Scenario: All four corner markers render

- **WHEN** any non-null `marquee` is provided
- **THEN** the `.mr-marquee` SHALL contain exactly four `.mr-marquee__corner` children
- **AND** their `data-c` attributes SHALL be `tl`, `tr`, `bl`, `br` (each appearing exactly once)

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

The codebase SHALL ship `src/components/piano-roll/PianoRoll.css` containing the rules from `prototype/app.css` lines ~493–692 covering: `.mr-roll`, `.mr-keys`, `.mr-key` (including `[data-black="true"]`), `.mr-roll__lanes`, `.mr-lane` (including `[data-black="true"]`), `.mr-note` (including `[data-sel="true"]`), `.mr-marquee`, `.mr-marquee__corner` (including all four `[data-c]` variants), `.mr-marquee__badge`, `.mr-marquee__count`, `.mr-marquee__lbl`, `.mr-playhead` (including `::before`), and the `@keyframes mr-marquee-march` definition. All visual values in the stylesheet SHALL resolve through `--mr-*` tokens or `rgba(...)` literals already present in the prototype's same lines (the prototype uses `rgba(255,255,255,0.025)` and `rgba(0,0,0,0.25)` for lane shading; these are accepted because they're not theme colors). The single-pixel-literal `width: 56px` for `.mr-keys` SHALL be ported as-is.

#### Scenario: Marquee animation is registered

- **WHEN** the rendered DOM is inspected with `PianoRoll` mounted
- **THEN** the document SHALL define `@keyframes mr-marquee-march`
- **AND** an element with `.mr-marquee` SHALL have `animation-name: mr-marquee-march`

#### Scenario: No new hex literals or oklch in CSS

- **WHEN** `src/components/piano-roll/PianoRoll.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases

### Requirement: Stage hosts a single PianoRoll driven by useStage()

The codebase SHALL expose a `useStage()` hook at `src/hooks/useStage.ts` returning `{ notes, lo, hi, totalT, playheadT, marquee, selectedIdx }`. `AppShell.tsx` SHALL mount a single `PianoRoll` inside the `.mr-stage` region whose props are bound to `useStage()`'s return value, with `width` and `height` measured from the `.mr-stage` element's content box via a `ResizeObserver`-backed hook.

`useStage()` SHALL:

- Return `notes = makeNotes(38, 7)` — the prototype's deterministic seed (count 38, seed 7). The `makeNotes(count, seed)` helper SHALL be implemented in `src/components/piano-roll/notes.ts` and SHALL produce identical output to the prototype's `makeNotes` function (same LCG constants 9301, 49297, 233280; same starting `t` accumulation; same pitch offset 48; same velocity formula).
- Return `lo = 48`, `hi = 76`, `totalT = 16`.
- Return `playheadT` derived from the `useTransport()` clock as `((timecodeMs / 1000) * (bpm / 60)) % totalT`, so the playhead sweeps proportionally to the fake clock and wraps at the right edge.
- Return `marquee = { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }` AND omit `selectedIdx` (so it is auto-derived) when `window.location.search` contains the substring `demo=marquee`. The rectangle is tuned so that `notesInMarquee(makeNotes(38, 7), marquee)` returns exactly 7 indexes — matching screenshot 04's `7 SELECTED` badge. Otherwise return `marquee = null` and `selectedIdx = []`.

#### Scenario: Default load shows no marquee

- **WHEN** the app is loaded at the bare `/` URL
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element

#### Scenario: ?demo=marquee shows the screenshot-04 marquee

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** the `.mr-marquee__count` SHALL display `7` (the count of notes from `makeNotes(38, 7)` whose `[t, t+dur)` interval overlaps `[3.5, 8.5)` AND whose `pitch` is in `[56, 69]`)
- **AND** exactly seven `.mr-note` elements SHALL carry `data-sel="true"`

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
