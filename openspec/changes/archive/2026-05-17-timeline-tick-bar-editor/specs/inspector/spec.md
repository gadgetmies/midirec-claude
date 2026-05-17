## ADDED Requirements

### Requirement: DJ event timing editor inside Note tab Output region

When `djActionSelection` and `djEventSelection` refer to the same `(trackId, pitch)` and the Note tab renders the DJ **row-level** Output mapping panel, the panel SHALL include the musical **tick-native** start-time control block (bar, beat, MIDI tick within beat at TPQ) tied to **`tTicks`**.

When only the **track-level** DJ panel is visible (`djActionSelection === null` with timeline DJ track focused), the timing editor SHALL NOT render.

#### Scenario: Row Output panel includes timing fields when an event is selected

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **THEN** the Inspector Note body SHALL contain both the Output mapping rows and the tick-derived three-field start editor

#### Scenario: Track-level panel omits timing fields without row selection

- **WHEN** `selectedTimelineTrack.kind === 'dj'` AND `djActionSelection === null`
- **THEN** the Inspector SHALL NOT render the per-event three-field start-time editor

### Requirement: Channel-roll Inspector summaries derive range from tTicks

Where the Inspector Note panel summarizes channel-roll selections (`summarizeSelection`, range rows), computations SHALL use **`tTicks` / `durTicks`** (or tick-derived beat floats built once from ticks for display-only), not legacy floating **`Note.t`** fields.

#### Scenario: Selection range uses tick endpoints

- **WHEN** selected notes carry `tTicks` and `durTicks`
- **THEN** reported temporal range SHALL match `(min tTicks)` through `(max tTicks + durTicks)` on the tick axis
