## ADDED Requirements

### Requirement: DJ playback resolves Web MIDI output port per row

For DJ action-track events, each scheduled `output.send` SHALL target a `MIDIOutput` (or scheduler adapter) obtained by:

1. Reading `midiOutputDeviceId` from `track.outputMap[event.pitch]` when present and non-empty.
2. Otherwise using `track.defaultMidiOutputDeviceId` when non-empty.
3. Otherwise using the **same** fallback port used for channel-roll playback when no per-device id is set (the existing first-enumerated / session-default output behavior).

Channel-roll notes SHALL continue to use the existing single-port behavior from this change unless a future capability unifies them. When the resolved port id does not map to an open `MIDIOutput` at dispatch time, the implementation SHALL skip that message without throwing.

#### Scenario: Row override port is used when set

- **GIVEN** a DJ track where `outputMap[48].midiOutputDeviceId === 'out-a'` and `defaultMidiOutputDeviceId === ''`
- **WHEN** an audible DJ event on pitch `48` is scheduled during play
- **THEN** the scheduler SHALL invoke `.send` on the output associated with `out-a` (when that output exists in the granted MIDIAccess)

#### Scenario: Track default port applies when row omits override

- **GIVEN** a DJ track where `outputMap[48]` has no `midiOutputDeviceId` and `defaultMidiOutputDeviceId === 'out-b'`
- **WHEN** an audible DJ event on pitch `48` is scheduled during play
- **THEN** the scheduler SHALL invoke `.send` on the output associated with `out-b` (when that output exists)

#### Scenario: Fallback matches channel-roll when both ids empty

- **GIVEN** a DJ track with no row override and empty `defaultMidiOutputDeviceId`
- **WHEN** channel rolls and DJ events dispatch in the same tick
- **THEN** DJ events SHALL use the same fallback `MIDIOutput` instance as channel-roll notes for that play session
