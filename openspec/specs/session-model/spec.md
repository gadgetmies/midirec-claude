# session-model Specification

## Purpose
Conceptual model of a session: an unbounded note stream with optional user-defined loop markers that wrap playback. Session length is derived on demand (`max(n.t + n.dur)`), never stored as state.
## Requirements
### Requirement: Session is an unbounded note stream

A **session** SHALL be modelled as an unbounded sequence of notes. There SHALL NOT be a session-length field, an end-time field, or any session-scope state that caps the time range. Any `Note` carrying `t >= 0` is a valid session note; the system makes no assumption that `t + dur` is below any threshold.

The de-facto session-length span endpoints, when needed (e.g., by the export dialog's `Whole session` range or other on-demand computations), SHALL be derived as the supremum `max(t_end)` across every timed layer in the orchestration baseline: `(n.t + n.dur)` for rolls, `(p.t)` for param lane samples, `(e.t + e.dur)` for DJ action events, analogous rules for future layers. When none of those datums exist along the temporal axis relevant to feature `F`, computations SHALL behave as-if the upper bound equals `0` for an empty spine. No code path SHALL store this supremum exclusively as authoritative session state—it remains derived.

#### Scenario: Note with large t value is a valid session note

- **WHEN** a `Note` is constructed with `t = 384` (i.e., 96 bars at 4 beats per bar) and `dur = 1`
- **THEN** the note SHALL be valid session data
- **AND** no part of the system SHALL reject, clamp, or truncate it on the basis of session length

#### Scenario: Empty session has length 0

- **WHEN** a session has neither notes nor lane points nor DJ action events spanning time
- **AND** an on-demand extent computation is performed matching the instrumentation layer under test
- **THEN** it SHALL behave as-if the supremum lacks positive extent (baseline `hi = 0` where applicable such as `[0,0)` export bounds)

### Requirement: Session musical coordinates use integer MIDI ticks at TPQ

All persisted musical timing that denotes **horizontal timeline position or duration** SHALL use **non-negative integers** on the **session MIDI tick axis** at **`DEFAULT_MIDI_TPQ`** until a session PPQ setting exists.

This SHALL apply at minimum to: **`Note.tTicks`**, **`Note.durTicks`**, **`ActionEvent.tTicks`**, **`ActionEvent.durTicks`**, **`CCPoint.tTicks`**, **`Marquee`** horizontal bounds, **`LoopRegion`** endpoints, piano-roll **scroll/view** extents, **layout horizon**, **DJ pressure** sample times when stored, and any future timed layer documented in `session-model`.

**Beats SHALL NOT** be written as authoritative placement when saving edited clips; UI MAY still display bar/beat/tick by decoding ticks.

The supremum session extent SHALL derive from tick endpoints: e.g. `max(tTicks + durTicks)` across notes and DJ events, `max(tTicks)` for point streams, using the same layering rule as the prior beat-based supremum.

#### Scenario: Note addressing uses ticks

- **WHEN** a `Note` is persisted after migration with `tTicks = 184320` at `TPQ = 480`
- **THEN** it SHALL represent start time **exactly** on that tick lattice
- **AND** SHALL NOT rely on a parallel floating `t` in beats as source of truth

### Requirement: Transport boundary converts milliseconds to playhead ticks

Clock-driven playback SHALL convert **`TransportState.timecodeMs`** to **`playheadTicks`** (rounded or snapped per product rules) in **one module**. Components that render playheads or schedule clips SHALL read **ticks**, not floating beats, from stage/transport for timeline alignment.

#### Scenario: Single conversion site

- **WHEN** layout needs the current playhead X position on the timeline
- **THEN** it SHALL obtain tick-aligned coordinates derived from the transport boundary conversion
- **AND** SHALL NOT re-derive floating beat playheads independently in scattered modules

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

