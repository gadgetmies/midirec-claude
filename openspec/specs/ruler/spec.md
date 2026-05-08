### Requirement: Ruler renders bar/beat ticks with major/minor differentiation

The codebase SHALL expose a `Ruler` React component at `src/components/ruler/Ruler.tsx`. Given props `{ width, totalT? }`, the component SHALL render a `.mr-ruler` element containing one `.mr-ruler__tick` per integer beat from `0` through `totalT` inclusive, absolute-positioned at `left: i * (width / totalT)`. Beats divisible by 4 SHALL ALSO carry the `mr-ruler__tick--major` class and SHALL be accompanied by a `.mr-ruler__lbl` element rendering the bar.beat label in the format `{bar}.{beat}` (e.g. `1.1`, `2.1`, `3.1`, `4.1` for `totalT=16`).

The bar/beat label format SHALL match `prototype/components.jsx` `Ruler` lines ~436–447: bar = `1 + Math.floor(i / 4)`, beat = `(i % 4) + 1`. So for `totalT = 16`, the major-tick labels SHALL be exactly `1.1`, `2.1`, `3.1`, `4.1`, `5.1`.

#### Scenario: Default totalT=16 renders 17 ticks with 5 majors

- **WHEN** `<Ruler width={1600} />` is rendered (using prop default `totalT=16`)
- **THEN** the rendered DOM SHALL contain exactly 17 `.mr-ruler__tick` elements
- **AND** exactly 5 of those SHALL carry the `mr-ruler__tick--major` class
- **AND** exactly 5 `.mr-ruler__lbl` elements SHALL be present
- **AND** their text contents (in left-to-right order) SHALL be `1.1`, `2.1`, `3.1`, `4.1`, `5.1`

#### Scenario: Tick positions are evenly spaced

- **WHEN** `<Ruler width={1600} totalT={16} />` is rendered
- **THEN** consecutive `.mr-ruler__tick` elements SHALL have computed `left` values differing by exactly `100px` (i.e., `width / totalT`)
- **AND** the first `.mr-ruler__tick` SHALL have `left: 56px` (the keys-column offset, see "Ruler offsets its content")
- **AND** the last `.mr-ruler__tick` SHALL have `left: 1656px`; the Ruler's `overflow: hidden` clips this tick at the right edge of the Ruler's `width: 1600px` box, matching the prototype's behavior

### Requirement: Ruler offsets its content by the keys-column width

The `.mr-ruler` element SHALL render its tick + label children offset by 56px from the region's left edge, so beat tick `0` aligns vertically with the left edge of the lane area in the `PianoRoll` below. The offset SHALL be applied in the component's JSX by computing `left = 56 + i * (width / totalT)` for each tick (and matching `left` for each label), so the keys-column offset is honored without relying on a CSS `padding-left` (which would not apply to absolutely-positioned descendants).

This 56px literal mirrors `.mr-keys { width: 56px; }` from the PianoRoll stylesheet; both literals come from `prototype/app.css` and remain duplicated in this slice. A future slice MAY promote them to a shared `--mr-w-keys` token in `tokens.css`. The Ruler's `overflow: hidden` clips ticks that fall past its right edge — for `totalT=16` and `width=W`, the rightmost tick at `i=16` lands at `56 + W` and is clipped (matching the prototype's behavior, where the PianoRoll's lane-area beat ticks also overflow at the right by 56px).

#### Scenario: Ruler tick at beat 0 aligns with lane area

- **WHEN** the app is rendered with `<Ruler />` above `<PianoRoll />` in the same column
- **THEN** the first `.mr-ruler__tick`'s rendered `getBoundingClientRect().left` SHALL equal `.mr-roll__lanes`' `getBoundingClientRect().left` (within ±1px tolerance)

### Requirement: Ruler stylesheet ports prototype rules verbatim

The codebase SHALL ship `src/components/ruler/Ruler.css` containing the rules from `prototype/app.css` lines ~466–490 covering: `.mr-ruler`, `.mr-ruler__tick`, `.mr-ruler__tick--major`, `.mr-ruler__lbl`. All visual values SHALL resolve through `--mr-*` tokens.

#### Scenario: Ruler uses panel surface and hairline divider

- **WHEN** computed styles are inspected for the `.mr-ruler` element
- **THEN** its `background-color` SHALL match the computed value of `--mr-bg-panel`
- **AND** its `border-bottom` SHALL be `1px solid` matching the computed value of `--mr-line-2`

#### Scenario: No new hex literals or oklch in CSS

- **WHEN** `src/components/ruler/Ruler.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases
