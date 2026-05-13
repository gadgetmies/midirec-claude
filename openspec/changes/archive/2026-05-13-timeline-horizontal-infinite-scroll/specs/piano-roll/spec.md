## ADDED Requirements

### Requirement: PianoRoll distinguishes layout horizon stripe width from view-window filtering props

Prop `layoutHorizonBeats` OPTIONAL (default derives from legacy `totalT` so existing tests untouched). `.mr-roll__lanes` intrinsic width SHALL be `layoutHorizonBeats * pxPerBeat`. Vertical stripe ticks SHALL traverse `0 … layoutHorizonBeats` analogous to ruler behavior (subject to same thinning policy when spans are huge).

Note filtering, marquee math, loops, selection, and geometry SHALL continue honoring `totalT` + optional `viewT0` semantics from `session-model` for **which events render**.

#### Scenario: Narrow totalT wide horizon shows extended grid with filtered notes unchanged

- **WHEN** `totalT = 16`, `layoutHorizonBeats = 64`, notes include `{t:0,dur:1,pitch:60}` and `{t:40,dur:1,pitch:60}`
- **THEN** tick marks SHALL render through horizon `64` while only notes intersecting `[viewT0, viewT0 + totalT)` appear (per unchanged session-model semantics)
