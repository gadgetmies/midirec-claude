# ruler Specification

## Purpose
Bar/beat ruler strip at the top of the timeline. Renders ticks and phrase.bar.beat labels aligned to the piano-roll lanes below, using the same `pxPerBeat` zoom and keys-column offset as the lanes so beat 0 in the ruler lines up with beat 0 in the rolls. Phrase boundaries (every 16 beats) are visually emphasized so the 4-bar structure is legible at a glance.
## Requirements
### Requirement: Ruler renders bar/beat ticks with major/minor differentiation

The codebase SHALL expose a `Ruler` React component at `src/components/ruler/Ruler.tsx`. Given props `{ width, totalT? }`, the component SHALL render a `.mr-ruler` element containing one `.mr-ruler__tick` per integer beat from `0` through `totalT` inclusive, absolute-positioned at `left: i * (width / totalT)`. Beats divisible by 4 SHALL ALSO carry the `mr-ruler__tick--major` class and SHALL be accompanied by a `.mr-ruler__lbl` element rendering the phrase/bar/beat label in the format `{phrase}.{bar}.{beat}`.

The label math SHALL be: `phrase = 1 + Math.floor(beatIdx / 16)`, `bar = (Math.floor(beatIdx / 4) % 4) + 1` (bar resets to `1` at each phrase boundary), `beat = (beatIdx % 4) + 1`. So for `totalT = 16`, the major-tick labels SHALL be exactly `1.1.1`, `1.2.1`, `1.3.1`, `1.4.1`, `2.1.1`.

The constants for beats-per-bar (4) and beats-per-phrase (16) SHALL be defined as named constants at module scope in `Ruler.tsx` so a future time-signature slice has a single change point.

#### Scenario: Default totalT=16 renders 17 ticks with 5 majors

- **WHEN** `<Ruler width={1600} />` is rendered (using prop default `totalT=16`)
- **THEN** the rendered DOM SHALL contain exactly 17 `.mr-ruler__tick` elements
- **AND** exactly 5 of those SHALL carry the `mr-ruler__tick--major` class
- **AND** exactly 5 `.mr-ruler__lbl` elements SHALL be present
- **AND** their text contents (in left-to-right order) SHALL be `1.1.1`, `1.2.1`, `1.3.1`, `1.4.1`, `2.1.1`

#### Scenario: Tick positions are evenly spaced

- **WHEN** `<Ruler width={1600} totalT={16} />` is rendered
- **THEN** consecutive `.mr-ruler__tick` elements SHALL have computed `left` values differing by exactly `100px` (i.e., `width / totalT`)
- **AND** the first `.mr-ruler__tick` SHALL have `left: 56px` (the keys-column offset, see "Ruler offsets its content")
- **AND** the last `.mr-ruler__tick` SHALL have `left: 1656px`; the Ruler's `overflow: hidden` clips this tick at the right edge of the Ruler's `width: 1600px` box, matching the prototype's behavior

#### Scenario: Phrase number increments every 16 beats

- **WHEN** `<Ruler width={3200} totalT={32} />` is rendered
- **THEN** the 9 `.mr-ruler__lbl` text contents (in left-to-right order) SHALL be `1.1.1`, `1.2.1`, `1.3.1`, `1.4.1`, `2.1.1`, `2.2.1`, `2.3.1`, `2.4.1`, `3.1.1`

### Requirement: Ruler distinguishes phrase boundaries with a dedicated tick modifier

Every major tick whose beat index is divisible by 16 (i.e., every phrase boundary, including beat `0`) SHALL ALSO carry the `mr-ruler__tick--phrase` class in addition to `mr-ruler__tick` and `mr-ruler__tick--major`. The CSS rule for `.mr-ruler__tick--phrase` SHALL render the vertical line with a stronger visual weight than `.mr-ruler__tick--major` (brighter color and/or wider), using only existing `--mr-*` tokens — no new hex literals or `oklch(...)` values SHALL be introduced.

The phrase modifier SHALL be applied identically whether or not ruler thinning is active; because thinning preserves all `beatIdx % 4 === 0` ticks, phrase boundaries (`beatIdx % 16 === 0`) are always rendered.

#### Scenario: Phrase ticks are marked at every 16 beats

- **WHEN** `<Ruler width={3200} totalT={32} />` is rendered
- **THEN** the rendered DOM SHALL contain exactly 3 `.mr-ruler__tick--phrase` elements (at beats `0`, `16`, and `32`)
- **AND** each of those elements SHALL also carry `mr-ruler__tick` and `mr-ruler__tick--major`

#### Scenario: Phrase tick has stronger visual weight than a regular major

- **WHEN** computed styles are inspected for a `.mr-ruler__tick--phrase` element and a `.mr-ruler__tick--major` element that is not a phrase boundary
- **THEN** the phrase tick's computed `background-color` SHALL differ from the non-phrase major tick's `background-color` (resolving to a more prominent `--mr-*` token) OR its computed `width` SHALL be strictly greater
- **AND** the phrase tick's computed `background-color` SHALL match a value defined in `tokens.css` (no inline hex or `oklch` literal)

#### Scenario: Phrase ticks survive ruler thinning

- **WHEN** `layoutHorizonTicks` exceeds `GRID_TICK_THINNING_THRESHOLD_TICKS` such that ruler thinning is active
- **THEN** every phrase boundary (`beatIdx % 16 === 0`) within the horizon SHALL still render a `.mr-ruler__tick--phrase` element
- **AND** every such element SHALL also carry the `mr-ruler__tick--major` class

### Requirement: Ruler offsets its content by the keys-column width

The `.mr-ruler` element SHALL render its tick + label children offset by 56px from the region's left edge, so beat tick `0` aligns vertically with the left edge of the lane area in the `PianoRoll` below. The offset SHALL be applied in the component's JSX by computing `left = 56 + i * pxPerBeat` for each tick (and matching `left` for each label).

To make this offset visually robust under the timeline's horizontal scroll, the Ruler SHALL ALSO render a sticky-left mask element as the first child of `.mr-ruler`:

```html
<div className="mr-ruler__keys-spacer" />
```

`.mr-ruler__keys-spacer` SHALL have computed style `position: sticky; left: 0; top: 0; width: 56px; height: 100%; background: var(--mr-bg-panel); z-index: 3`. This element occupies the area directly above the keys column at every horizontal scroll offset, masking any beat tick whose computed `left` value would otherwise show through the keys area when the user scrolls right.

The 56px literal mirrors `.mr-keys { width: 56px; }` from the PianoRoll stylesheet; both literals come from `prototype/app.css` and remain duplicated in this slice. A future slice MAY promote them to a shared `--mr-w-keys` token in `tokens.css`.

#### Scenario: Ruler tick at beat 0 aligns with lane area

- **WHEN** the app is rendered with `<Ruler />` above `<PianoRoll />` in the same column AND the timeline is at scroll offset `0`
- **THEN** the first `.mr-ruler__tick`'s rendered `getBoundingClientRect().left` SHALL equal `.mr-roll__lanes`' `getBoundingClientRect().left` (within ±1px tolerance)

#### Scenario: Keys-spacer masks ticks under horizontal scroll

- **WHEN** the user horizontally scrolls `.mr-timeline` so beat tick `0` would render at a negative `left` relative to the visible area
- **THEN** `.mr-ruler__keys-spacer` SHALL remain visible at the left edge of the visible scroll area
- **AND** `.mr-ruler__keys-spacer`'s computed `z-index` SHALL be `3` (above ticks and labels)
- **AND** no tick SHALL be visible to the left of the keys-spacer's right edge

### Requirement: Ruler stylesheet ports prototype rules verbatim

The codebase SHALL ship `src/components/ruler/Ruler.css` containing the rules from `prototype/app.css` lines ~466–490 covering: `.mr-ruler`, `.mr-ruler__tick`, `.mr-ruler__tick--major`, `.mr-ruler__lbl`. All visual values SHALL resolve through `--mr-*` tokens.

In addition to the prototype's rules, the stylesheet SHALL define:

- `.mr-ruler { position: sticky; top: 0; z-index: 3 }` — pinning the Ruler to the top of `.mr-timeline`'s visible area at all vertical scroll offsets.
- `.mr-ruler__keys-spacer { position: sticky; left: 0; top: 0; width: 56px; height: 100%; background: var(--mr-bg-panel); z-index: 3 }` — the new sticky-left mask element (see the "Ruler offsets its content" requirement).

`.mr-ruler` SHALL NOT carry `overflow: hidden`; the outer `.mr-timeline` clips horizontally.

#### Scenario: Ruler uses panel surface and hairline divider

- **WHEN** computed styles are inspected for the `.mr-ruler` element
- **THEN** its `background-color` SHALL match the computed value of `--mr-bg-panel`
- **AND** its `border-bottom` SHALL be `1px solid` matching the computed value of `--mr-line-2`

#### Scenario: Ruler is sticky-top inside the timeline

- **WHEN** the rendered DOM is inspected
- **THEN** `.mr-ruler`'s computed `position` SHALL be `sticky` with `top` resolving to `0`
- **AND** `.mr-ruler`'s computed `z-index` SHALL be `3`

#### Scenario: No new hex literals or oklch in CSS

- **WHEN** `src/components/ruler/Ruler.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases

### Requirement: Ruler layout width follows layoutHorizonBeats

The `Ruler` SHALL accept `layoutHorizonBeats` (defaulting to legacy `totalT` when callers omit either for backward compatibility tests). Its scrollable raster width SHALL be `layoutHorizonBeats * pxPerBeat`; tick placement SHALL cover beats `0` through `layoutHorizonBeats` inclusive consistent with existing major/minor differentiation.

When span density would exceed thresholds defined in engineering notes (derived from UX review), implementations MAY omit non-major ticks while preserving bar-aligned majors at every fourth beat identical to today's labeling math.

#### Scenario: Wide horizon aligns beat zero with PianoRoll stripes

- **WHEN** `layoutHorizonBeats = 64` and PianoRoll renders with the same orchestrated horizon
- **THEN** ruler tick `i = 0` SHALL share lane-area x-coordinate with piano-roll stripe start for beat `0` within ±1 px

### Requirement: Ruler and timeline ticks align to tick grid

The `Ruler` (and shared timeline strip backgrounds) SHALL subdivide and label using **`layoutHorizonTicks`**, **`viewT0Ticks`**, and **`pxPerTick`** (or derived equivalents) so vertical guides correspond to **integer tick** columns. Major/minor line emphasis MAY remain bar-aligned by decoding ticks through time signature.

#### Scenario: Horizontal zoom respects tick spacing

- **WHEN** the user scrolls or zooms the timeline
- **THEN** guide placement SHALL remain coherent with **`viewT0Ticks`** without accumulating beat-float error across scroll offsets

