## ADDED Requirements

### Requirement: DJ track Control Change capture when inputSources and action row match

When **recording** and a **Control Change** message arrives whose `(portId, midiChannel, cc)` matches a `DJActionTrack` row with `actionMap[pitch].midiInputCc === cc` (same **wire channel** matching as note capture) and that row is selected by the same conflict-resolution rules as instrument vs DJ note capture, the recorder SHALL append or update **`ActionEvent`** entries for that `pitch` consistent with the design in change `mixer-dj-cc-messages` `design.md` **CC capture** subsection (level derived from CC value `0..127` normalized to `vel`, timing in beats consistent with existing `ActionEvent` storage).

The concrete pairing semantics (open vs close of a fader move) SHALL be implemented deterministically and covered by unit tests in `src/midi/recorder`.

#### Scenario: CC from configured DJ source appends an event

- **GIVEN** DJ track `t1` lists `inputSources: [{ inputDeviceId: 'pad', channels: [10] }]` and `actionMap[80].midiInputCc === 7`
- **WHEN** a Control Change `0xB9, 7, 64` arrives on port `pad` (channel 10, CC 7, value 64)
- **THEN** `appendDJActionEvent` (or equivalent) SHALL run for `t1` with an `ActionEvent` on **pitch `80`** whose `vel` reflects `64/127`

## MODIFIED Requirements

### Requirement: DJ track note capture when inputSources match

When a note-on event's `(portId, midiChannel)` matches a `TrackInputListenRow` on a `DJActionTrack` (same matching rule as instrument channels) and the event is not consumed by a higher-priority instrument match per `design.md`, **AND** the targeted action row does **not** use `midiInputCc` for capture (see prior note-only behavior), the recorder SHALL open a DJ-specific active-note entry (or reuse the same map with a distinct namespace) and SHALL finalize an `ActionEvent` on note-off with `{ pitch, t, dur, vel }` in beats consistent with piano-roll notes, dispatching via `useStage().appendDJActionEvent(trackId, event)` (or equivalent name defined in `dj-action-tracks` delta).

When a row **has** `midiInputCc` set, **note-on/note-off `matchingDJActions` SHALL NOT** route to that row for capture — CC capture owns that row.

#### Scenario: Note from configured DJ source appends an event

- **GIVEN** DJ track `t1` lists `inputSources: [{ inputDeviceId: 'pad', channels: [10] }]` and **no** row on `t1` has `midiInputCc` that would claim the event's pitch/channel combination
- **WHEN** a NOTE ON / NOTE OFF pair completes on port `pad` with MIDI channel nibble `9` and pitch `48`
- **THEN** `t1.events` SHALL gain one `ActionEvent` with `pitch === 48` and non-negative `dur`

## REMOVED Requirements

(none)
