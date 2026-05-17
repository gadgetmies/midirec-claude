## MODIFIED Requirements

### Requirement: DJ event timing editor inside Note tab Output region

When `djActionSelection` and `djEventSelection` refer to the same `(trackId, pitch)` and the Note tab renders the DJ **row-level** Output mapping panel, the panel SHALL include the same **two-field tick-native start-time editor** used by the instrument-channel `SingleNoteView` — a **phrase·bar·beat (BBT) input** plus an **integer ticks input**, both bound to the event's **`tTicks`**.

The editor SHALL commit on input `blur` and on `Enter` keydown. A commit SHALL update the referenced event's `tTicks` via the stage DJ-event timing mutator (see `dj-action-tracks` spec). A commit whose parsed value equals the current `tTicks` SHALL be a no-op that re-canonicalizes the draft fields from the stored `tTicks`.

When only the **track-level** DJ panel is visible (`djActionSelection === null` with timeline DJ track focused), the timing editor SHALL NOT render.

When `djEventSelection` is null, refers to a different `(trackId, pitch)`, or its `eventIdx` is out of range or its event's `pitch` no longer matches the row pitch, the timing editor SHALL NOT render.

#### Scenario: Row Output panel includes timing fields when an event is selected

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` and `track.events[2].pitch === 56`
- **THEN** the Inspector Note body SHALL contain both the Output mapping rows and a two-field start editor (BBT input + integer ticks input) reflecting `track.events[2].tTicks`

#### Scenario: Track-level panel omits timing fields without row selection

- **WHEN** `selectedTimelineTrack.kind === 'dj'` AND `djActionSelection === null`
- **THEN** the Inspector SHALL NOT render the per-event two-field start-time editor

#### Scenario: Stale event selection hides the editor

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection.eventIdx` is past the end of `track.events` OR the event at that index has a `pitch` other than 56
- **THEN** the Inspector SHALL NOT render the two-field start-time editor

#### Scenario: Commit on Enter writes tTicks via the stage mutator

- **WHEN** the user edits the BBT field to a value that canonicalizes to a different `tTicks` and presses `Enter`
- **THEN** the Inspector SHALL invoke the DJ-event timing mutator with the new `tTicks`
- **AND** the input SHALL blur

#### Scenario: Commit equal to current tTicks re-canonicalizes draft

- **WHEN** the user edits the ticks field to a string that parses back to the same integer `tTicks` and blurs
- **THEN** the Inspector SHALL NOT invoke the mutator
- **AND** the BBT and ticks drafts SHALL be reset from the stored `tTicks`
