## MODIFIED Requirements

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
