## ADDED Requirements

### Requirement: DJ timeline bodies match shared layout horizon

`ActionRoll` / `.mr-djtrack__body` horizontal footprint SHALL likewise consume `layoutHorizonBeats * pxPerBeat` for grids, overlays, beats, clips, aligning with PianoRoll/param lane surfaces so DJ rows stay phase-locked scrolling with channel groups.

#### Scenario: Mixed channel + DJ timelines share scrollbar phase

- **WHEN** the session renders at least one `.mr-channel` and one `.mr-djtrack` concurrently
- **THEN** horizontally scrolling `.mr-timeline` SHALL slide both stripes so beat `k` aligns across kinds for identical `layoutHorizonBeats`
