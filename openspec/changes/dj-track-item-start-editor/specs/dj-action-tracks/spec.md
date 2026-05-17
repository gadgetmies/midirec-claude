## MODIFIED Requirements

### Requirement: Inspector SHALL show bar-beat-tick fields for selected DJ timeline items

When the Note tab is active AND `djEventSelection !== null` AND the referenced event exists (its `eventIdx` is in range and `track.events[eventIdx].pitch` equals the selected row pitch), the Inspector SHALL render a **two-field tick-native start-time editor** bound to the event's **`tTicks`**:

- a **phrase·bar·beat (BBT)** input whose value decodes and encodes via the same canonical `phrase·bar·beat ↔ tTicks` helpers used for instrument-channel notes (`canonicalPhraseBarBeatFromTicks`, etc.) at the session TPQ;
- an **integer ticks** input bound to raw `tTicks` from session zero.

Both inputs SHALL stay synchronized: a commit on either re-canonicalizes the other from the resulting stored `tTicks`.

The timing controls SHALL live inside `data-mr-dj-selection-region="true"`.

A focus, value change, or commit on either input SHALL NOT clear `djEventSelection` or `djActionSelection`.

#### Scenario: Selected event shows two-field start editor

- **WHEN** `djEventSelection === { trackId, pitch, eventIdx }` and the event exists with `track.events[eventIdx].pitch === pitch`
- **THEN** the Inspector SHALL render two inputs (BBT + integer ticks) reflecting `track.events[eventIdx].tTicks`

#### Scenario: Timing inputs preserve DJ selection on interaction

- **WHEN** `djEventSelection !== null` and the user focuses or edits the BBT or ticks input
- **THEN** the DJ outside-click handler SHALL NOT clear `djEventSelection` or `djActionSelection` solely due to that focus or edit
