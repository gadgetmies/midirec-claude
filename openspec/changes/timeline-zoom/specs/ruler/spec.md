## ADDED Requirements

### Requirement: Ruler subdivision adapts to pxPerBeat

The `Ruler` component SHALL choose its tick subdivision and label cadence by calling `chooseRulerSubdivision(pxPerBeat)` (exported from `src/session/timelineZoom.ts`). The function SHALL return `{ ticksPerLine, labelEvery, format }` where `ticksPerLine` is the spacing (in MIDI ticks) between adjacent rendered ticks and `labelEvery` is the spacing (in MIDI ticks) between adjacent labels.

The thresholds SHALL be:

- `pxPerBeat < 12` — render phrase boundaries (`beatIdx % 16 === 0`) only; bars (`beatIdx % 4 === 0`) MAY also render if density permits without overlap; no beat or sub-beat ticks.
- `12 <= pxPerBeat < 176` — render every beat (`ticksPerLine = TPQ`); phrase / bar emphasis preserved per the existing modifier classes.
- `176 <= pxPerBeat < 352` — render every 8th note (`ticksPerLine = TPQ / 2`); beats and bars emphasized via the existing major / phrase classes.
- `352 <= pxPerBeat < 800` — render every 16th note (`ticksPerLine = TPQ / 4`).
- `pxPerBeat >= 800` — render every 32nd note (`ticksPerLine = TPQ / 8`).

The function SHALL be monotone: a strictly higher `pxPerBeat` SHALL never return a coarser `ticksPerLine`.

Phrase ticks (`beatIdx % BEATS_PER_PHRASE === 0`) and bar majors (`beatIdx % BEATS_PER_BAR === 0`) SHALL continue to carry the `mr-ruler__tick--phrase` and `mr-ruler__tick--major` classes respectively at every subdivision level, including the highest-density 32nd-note view. Sub-beat ticks (between integer beats) SHALL NOT carry the `--major` modifier.

Labels (`.mr-ruler__lbl`) SHALL render at the cadence defined by `labelEvery`, which SHALL be a multiple of `TPQ` (i.e., labels never appear between integer beats). The phrase.bar.beat format from the existing `ruler` capability SHALL continue to apply to the labels that do render.

The Ruler's intrinsic width SHALL continue to be `KEYS_COLUMN_WIDTH + layoutHorizonTicks * pxPerTick`, with `pxPerTick = pxPerBeat / TPQ`.

#### Scenario: Phrase-only density at very low zoom

- **WHEN** `<Ruler layoutHorizonTicks={...} pxPerBeat={8} />` is rendered with a horizon spanning multiple phrases
- **THEN** every `mr-ruler__tick` rendered SHALL also carry `mr-ruler__tick--phrase`
- **AND** no tick SHALL render at non-phrase positions

#### Scenario: Beat density at default zoom

- **WHEN** `<Ruler layoutHorizonTicks={7680} pxPerBeat={88} />` is rendered (TPQ 480, 16 beats)
- **THEN** at least 17 `mr-ruler__tick` elements SHALL render (beats 0..16)
- **AND** elements at beats 0, 4, 8, 12, 16 SHALL carry `mr-ruler__tick--major`
- **AND** elements at beats 0 and 16 SHALL also carry `mr-ruler__tick--phrase`

#### Scenario: Sub-beat density at high zoom

- **WHEN** `<Ruler layoutHorizonTicks={7680} pxPerBeat={400} />` is rendered
- **THEN** ticks SHALL render at every 16th-note position (`ticksPerLine = TPQ / 4 = 120`)
- **AND** ticks at integer beats SHALL still carry `mr-ruler__tick--major` where `beatIdx % 4 === 0`
- **AND** sub-beat ticks (not on integer beats) SHALL NOT carry `--major`

#### Scenario: Subdivision is monotone in pxPerBeat

- **WHEN** `chooseRulerSubdivision(prev).ticksPerLine` and `chooseRulerSubdivision(next).ticksPerLine` are compared for any `next > prev`
- **THEN** the `next` value SHALL be less than or equal to the `prev` value (denser or equal)

#### Scenario: Labels stay on integer beats

- **WHEN** any subdivision is active, including 16ths and 32nds
- **THEN** every rendered `.mr-ruler__lbl` SHALL correspond to an integer-beat position (its underlying tick offset SHALL be divisible by `TPQ`)
