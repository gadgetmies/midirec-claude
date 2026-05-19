## MODIFIED Requirements

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

## ADDED Requirements

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
