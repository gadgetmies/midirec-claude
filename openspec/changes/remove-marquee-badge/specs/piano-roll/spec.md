## REMOVED Requirements

### Requirement: Marquee renders dashed rect with badge

**Reason**: The badge half of the marquee rendering contract — a separate floating chip with a selection count and `selected` label, rendered to the upper-right of the marquee rectangle — duplicates information that is now better surfaced elsewhere:

1. The orange-red `var(--mr-note-sel)` background plus `data-sel="true"` attribute on each selected `.mr-note` already encodes "these notes are selected" visually, directly on the affected notes.
2. The Inspector's multi-select panel (from the `inspector` capability, Slice 5) reads `useStage().resolvedSelection.indexes.length` and renders a richer selection summary in the right-aside, with count, pitch range, velocity, and channel.

The rectangle half of the requirement is preserved unchanged under the new `Marquee renders dashed rect` requirement below.

**Migration**: Consumers needing a selection-count signal SHALL read it from `useStage().resolvedSelection.indexes.length` (or from `data-sel="true"` element counts in DOM inspection / tests). The badge DOM (`.mr-marquee__badge`, `.mr-marquee__count`, `.mr-marquee__lbl`) is removed from rendered output and from the codebase; any test asserting on these classes SHALL be retargeted at `data-sel="true"` counts or at `resolvedSelection.indexes.length`.

## ADDED Requirements

### Requirement: Marquee renders dashed rect

When the `marquee` prop is non-null, the `PianoRoll` SHALL render a `.mr-marquee` SVG element absolute-positioned to enclose the rectangle from `(min(t0,t1), max(p0,p1))` (top-left in lane coordinates, since pitch grows upward) to `(max(t0,t1), min(p0,p1))`. The SVG SHALL contain a single `.mr-marquee__rect` `<rect>` with a 1px dashed stroke in `var(--mr-accent)`, a translucent fill of `color-mix(in oklab, var(--mr-accent) 10%, transparent)`, and SHALL animate via the `mr-marquee-march` keyframe (0.8s linear infinite) by varying `stroke-dashoffset` (which produces a visible marching-ants effect, unlike the prototype's flat-color `background-position` animation which is invisible).

The rendered DOM SHALL NOT contain any `.mr-marquee__badge`, `.mr-marquee__count`, or `.mr-marquee__lbl` element for any marquee value.

The prototype's four `.mr-marquee__corner` markers are intentionally omitted — they were visually noisy and added no signal beyond what the dashed border already conveys. The prototype's `.mr-marquee__badge` chip is also intentionally omitted; see the `inspector` capability's multi-select panel for the selection-count signal it used to carry.

#### Scenario: Marquee rectangle dimensions match the input

- **WHEN** `<PianoRoll width={1600} height={280} lo={48} hi={76} totalT={16} marquee={{t0:4, t1:8, p0:60, p1:67}} notes={[]} />` is rendered
- **THEN** the rendered `.mr-marquee`'s computed `left` SHALL be `400px` (`4 * 100`)
- **AND** its computed `width` SHALL be `400px` (`(8-4) * 100`)
- **AND** its computed `top` SHALL be `80px` (`height - (max(p0,p1) - lo + 1) * rowH = 280 - 20*10 = 80`)
- **AND** its computed `height` SHALL be `(max(p0,p1) - min(p0,p1) + 1) * rowH = 80px`

#### Scenario: No badge elements are rendered

- **WHEN** `<PianoRoll marquee={{t0:0, t1:4, p0:60, p1:64}} selectedIdx={[1, 4, 9]} notes={[...]} />` is rendered
- **THEN** the rendered DOM SHALL contain zero `.mr-marquee__badge` elements
- **AND** SHALL contain zero `.mr-marquee__count` elements
- **AND** SHALL contain zero `.mr-marquee__lbl` elements

## MODIFIED Requirements

### Requirement: Selection resolution prefers explicit selectedIdx over marquee derivation

The renderer's effective selection list SHALL be computed as:

- If `selectedIdx` is provided (not undefined), use it verbatim.
- Else if `marquee` is non-null, compute `notesInMarquee(notes, marquee)` and use the result.
- Else, the effective selection is the empty list.

The pure helper `notesInMarquee(notes, marquee)` SHALL be exported from `src/components/piano-roll/notes.ts` and SHALL return the indexes (in `notes`-array order) of every note whose `[t, t+dur)` interval overlaps `[min(t0,t1), max(t0,t1))` AND whose `pitch` is in `[min(p0,p1), max(p0,p1)]` (inclusive on both ends — pitch is integer-valued).

#### Scenario: Explicit selectedIdx wins over marquee

- **WHEN** `<PianoRoll marquee={{t0:0,t1:16,p0:48,p1:76}} selectedIdx={[2]} notes={[{t:0,dur:1,pitch:60,vel:.5},{t:1,dur:1,pitch:62,vel:.5},{t:2,dur:1,pitch:64,vel:.5}]} />` is rendered
- **THEN** only the note at index 2 SHALL carry `data-sel="true"`
- **AND** exactly one `.mr-note` element SHALL carry `data-sel="true"`

#### Scenario: Marquee auto-derives selection when selectedIdx is omitted

- **WHEN** `notesInMarquee([{t:0,dur:1,pitch:60,vel:.5},{t:1.5,dur:1,pitch:62,vel:.5},{t:5,dur:1,pitch:64,vel:.5}], {t0:0,t1:3,p0:60,p1:65})` is called
- **THEN** the returned array SHALL be `[0, 1]` (in this order)

#### Scenario: notesInMarquee handles reversed corners

- **WHEN** `notesInMarquee([{t:1,dur:1,pitch:60,vel:.5}], {t0:3,t1:0,p0:65,p1:55})` is called
- **THEN** the returned array SHALL be `[0]` (the helper SHALL normalise corner order internally)

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
  - **`demo=marquee`**: return `marquee = { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }`, omit `selectedIdx` (so it is auto-derived as the empty array; `resolvedSelection` derives from the marquee branch above), and set `selectedChannelId = 1`. The rectangle is tuned so that `notesInMarquee(makeNotes(38, 7), marquee)` returns exactly 7 indexes — matching screenshot 04's previously-displayed `7 SELECTED` count. `resolvedSelection` SHALL therefore have `indexes.length === 7`.
  - **`demo=note`**: return `marquee = null`, `selectedIdx = [<idx>]` for a fixed index `<idx>` chosen so that the selected note has a recognisable pitch in the Lead channel's roll (the implementation MAY choose any deterministic index in `[0, makeNotes(38, 7).length)`), and `selectedChannelId = 1`. `resolvedSelection.indexes` SHALL therefore have length exactly 1.
  - **Neither flag**: return `marquee = null`, `selectedIdx = []`, `selectedChannelId = null`. `resolvedSelection` SHALL be `null`.

#### Scenario: Default load shows no marquee and null resolvedSelection

- **WHEN** the app is loaded at the bare `/` URL
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL equal `null`

#### Scenario: ?demo=marquee shows the screenshot-04 marquee

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** exactly seven `.mr-note` elements SHALL carry `data-sel="true"`
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 7`
- **AND** the rendered DOM SHALL contain zero `.mr-marquee__badge` elements

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

### Requirement: PianoRoll stylesheet ports prototype rules verbatim

The codebase SHALL ship `src/components/piano-roll/PianoRoll.css` containing the rules from `prototype/app.css` lines ~493–692 covering: `.mr-roll`, `.mr-keys`, `.mr-key` (including `[data-black="true"]`), `.mr-roll__lanes`, `.mr-lane` (including `[data-black="true"]`), `.mr-note` (including `[data-sel="true"]`), `.mr-marquee`, `.mr-marquee__corner` (including all four `[data-c]` variants), `.mr-playhead` (including `::before`), and the `@keyframes mr-marquee-march` definition. The prototype's `.mr-marquee__badge`, `.mr-marquee__count`, and `.mr-marquee__lbl` rules SHALL NOT be ported — the selection-count badge they styled is intentionally omitted (see `Marquee renders dashed rect`). All visual values in the stylesheet SHALL resolve through `--mr-*` tokens or `rgba(...)` literals already present in the prototype's same lines.

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

#### Scenario: No badge class rules in PianoRoll.css

- **WHEN** `src/components/piano-roll/PianoRoll.css` is grepped for `mr-marquee__badge`, `mr-marquee__count`, and `mr-marquee__lbl`
- **THEN** the search SHALL return zero matches for each pattern

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
