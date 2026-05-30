## ADDED Requirements

### Requirement: Session model defines a persistable surface

The session model SHALL define a **persistable session surface**: the authoritative set of datums that constitute the user's authoring session and that any persistence layer (in particular `timeline-storage`) SHALL round-trip through serialisation.

The persistable session surface SHALL consist of exactly the following slices:

- **Channels** — `Channel[]` with fields `id, name, color, collapsed, muted, soloed, inputSources` (per `channels` capability).
- **Piano-roll rolls** — `PianoRollTrack[]` with fields `channelId, notes, muted, soloed, collapsed` (per `piano-roll` capability). `Note` fields `tTicks, durTicks, pitch, velocity` and any additional fields declared by `piano-roll` SHALL all participate.
- **Param lanes** — `ParamLane[]` with fields `channelId, kind, cc, name, color, points, muted, soloed, collapsed` (per `param-lanes` capability). `CCPoint.tTicks` and value fields SHALL all participate.
- **DJ action tracks** — `DJActionTrack[]` with fields `id, name, color, midiChannel, actionMap, outputMap, events, inputRouting, outputRouting, collapsed, muted, soloed, mutedRows, soloedRows, defaultMidiInputDeviceId, defaultMidiOutputDeviceId` (per `dj-action-tracks` capability). `ActionEvent.tTicks` and `.durTicks` SHALL participate; `outputMap` entries SHALL participate verbatim.
- **Transport-authoring fields** — the subset `{ bpm, sig, quantizeOn, quantizeGrid, snapAbsoluteOn, looping, metronomeOn, clockSource }` of `TransportState`.
- **Loop region** — `loopRegion: LoopRegion | null` from `StageState`.
- **MIDI-learn mappings** — whatever shape the `midi-learn` capability declares as persistable.

The following fields SHALL NOT be part of the persistable session surface and SHALL be classified as **transient state**:

- Selection state: `selectedChannelId, selectedIdx, resolvedSelection, marquee, djActionSelection, djEventSelection`.
- Dialog and overlay flags: `dialogOpen`, MIDI-permission banner state, transient toasts.
- Runtime transport fields: `mode, playing, recording, timecodeMs, bar, recordingStartedAt`.
- Derived horizon and extent values: `sessionHorizonFloorBeats, sessionHorizonFloorTicks, layoutHorizonBeats, lo, hi, totalT, playheadT, playheadTicks`.
- Scroll position, hover, focus, and any other DOM-derived ephemeral state.

Any future timed layer added to `session-model` SHALL explicitly declare, in the spec text introducing it, whether its fields join the persistable session surface or are classified as transient state. A new timed layer that omits this declaration SHALL be considered ill-formed.

#### Scenario: Persistable surface enumerates the authoring datums

- **WHEN** the codebase exports `serializeTimeline(state, name)` (per `timeline-storage`)
- **THEN** the resulting `TimelinePayload.session` object SHALL contain exactly the slices enumerated by the persistable session surface and no others
- **AND** each slice's fields SHALL match the enumeration in this requirement

#### Scenario: Transient state is excluded from the payload

- **GIVEN** an editor state with `marquee !== null`, `selectedIdx` non-empty, `dialogOpen === true`, `transport.mode === 'play'`, `transport.timecodeMs === 4200`, and a non-default `sessionHorizonFloorTicks`
- **WHEN** the state is serialised
- **THEN** the resulting payload's `session` object SHALL NOT contain any field named in the transient-state list above
- **AND** the payload SHALL be byte-identical to one produced from the same state with `marquee === null`, `selectedIdx === undefined`, `dialogOpen === false`, `transport.mode === 'idle'`, `transport.timecodeMs === 0`, and the default horizon

#### Scenario: New timed layer declares its persistence class

- **WHEN** a future change introduces a new timed layer to `session-model`
- **THEN** that change's spec SHALL include a sentence assigning the new layer's fields either to the persistable session surface or to transient state
- **AND** a change that adds a new timed layer without such a declaration SHALL be considered ill-formed at review time
