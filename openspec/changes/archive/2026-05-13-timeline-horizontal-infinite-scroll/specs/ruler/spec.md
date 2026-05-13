## ADDED Requirements

### Requirement: Ruler layout width follows layoutHorizonBeats

The `Ruler` SHALL accept `layoutHorizonBeats` (defaulting to legacy `totalT` when callers omit either for backward compatibility tests). Its scrollable raster width SHALL be `layoutHorizonBeats * pxPerBeat`; tick placement SHALL cover beats `0` through `layoutHorizonBeats` inclusive consistent with existing major/minor differentiation.

When span density would exceed thresholds defined in engineering notes (derived from UX review), implementations MAY omit non-major ticks while preserving bar-aligned majors at every fourth beat identical to today's labeling math.

#### Scenario: Wide horizon aligns beat zero with PianoRoll stripes

- **WHEN** `layoutHorizonBeats = 64` and PianoRoll renders with the same orchestrated horizon
- **THEN** ruler tick `i = 0` SHALL share lane-area x-coordinate with piano-roll stripe start for beat `0` within ±1 px
