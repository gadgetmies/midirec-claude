## ADDED Requirements

### Requirement: DJActionTrack carries Web MIDI inputSources

Each `DJActionTrack` SHALL include `inputSources: TrackInputListenRow[]` using the same type as `Channel` (defined in `channels` / `track-input-mapping`). Seeded tracks SHALL default to `inputSources: []`.

#### Scenario: Default seed has empty inputSources

- **WHEN** the app loads with the default session
- **THEN** every `DJActionTrack` SHALL have `inputSources` equal to `[]`

### Requirement: Stage exposes DJ input source and event-append actions

`StageState` from `useStage()` SHALL expose:

- `appendDJActionEvent(trackId: DJTrackId, event: ActionEvent): void` — appends `event` to `djActionTracks` entry matching `trackId`. No-op for unknown ids.
- `setDJTrackInputSourceChannels(trackId: DJTrackId, inputDeviceId: string, channels: ChannelId[]): void` — upserts or removes (when empty) a `TrackInputListenRow` on that DJ track. No-op for unknown ids.

#### Scenario: appendDJActionEvent adds to events array

- **GIVEN** track `dj1` exists
- **WHEN** `appendDJActionEvent('dj1', { pitch: 60, t: 0, dur: 0.5, vel: 100 })` is called
- **THEN** `djActionTracks` SHALL contain the new event on that track’s `events` array

#### Scenario: setDJTrackInputSourceChannels updates only the targeted track

- **WHEN** `setDJTrackInputSourceChannels('dj1', 'dev-a', [1])` is called
- **THEN** only `dj1`’s `inputSources` SHALL change

### Requirement: Instrument channel match precedence over DJ match

When a single inbound note would match both an instrument `Channel` `inputSources` row and a `DJActionTrack` `inputSources` row, the recorder SHALL route to the instrument channel unless `design.md` directs otherwise for the current `selectedTimelineTrack` bias.

#### Scenario: Documented precedence is stable

- **WHEN** both an instrument channel and a DJ track list the same `(inputDeviceId, MIDI channel)` pair
- **THEN** the `midi-recording` capability’s note-on requirement SHALL define a single deterministic resolution order
