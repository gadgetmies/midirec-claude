## ADDED Requirements

### Requirement: DJ timeline header selection clears row and event mapping selections

`StageState` from `useStage()` SHALL expose `selectDJTimelineTrack(trackId: DJTrackId): void`.

Calling `selectDJTimelineTrack(trackId)` SHALL:

1. Set `selectedTimelineTrack` to `{ kind: 'dj', trackId }`.
2. Set `djActionSelection` to `null`.
3. Set `djEventSelection` to `null`.

The DJ track timeline header click path in `AppShell.tsx` SHALL invoke `selectDJTimelineTrack` for that track’s id (not a raw `setSelectedTimelineTrack` call that omits the clears).

#### Scenario: Header click clears mapping selections but keeps DJ timeline selection

- **GIVEN** `djActionSelection !== null` OR `djEventSelection !== null`
- **WHEN** the user activates the DJ track’s `.mr-djtrack__hdr` (not the chevron) such that `selectDJTimelineTrack('dj1')` runs
- **THEN** the next render SHALL have `selectedTimelineTrack === { kind: 'dj', trackId: 'dj1' }`
- **AND** `djActionSelection === null`
- **AND** `djEventSelection === null`

#### Scenario: Chevron does not invoke timeline selection helper

- **WHEN** the user clicks only `.mr-djtrack__chev-btn` to toggle collapsed state
- **THEN** `selectDJTimelineTrack` SHALL NOT be invoked by that gesture
