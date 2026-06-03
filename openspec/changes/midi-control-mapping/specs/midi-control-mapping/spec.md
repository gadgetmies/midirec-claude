## ADDED Requirements

### Requirement: Control mapping data model and target registry

The codebase SHALL expose a pure, React-free module `src/midi/controlMap.ts`
defining the control-mapping data model and a single static **target registry**.

The registry SHALL declare every mappable target exactly once. Each entry SHALL
provide: a `key` (`TargetKey`), a human `label`, a `kind`
(`trigger | toggle | continuous | enum`), a `dispatch(transport, value?)`
function that performs the action via `useTransport` actions, and a
`stateSelector` that reads the target's current state for feedback.

A `ControlMapping` SHALL carry a `target: TargetKey`, a `source`
(`{ kind: 'note'|'cc'|'pressure'|'pb', portId, channel, data, anyPort? }`), and
the optional advanced fields relevant to its kind (`edge`, `buttonMode`,
`minValue`, `continuous`, `enumMode`, `barsPerPhrase`, `feedback`). The mapping
set SHALL be `ControlMapState { version: number, mappings: ControlMapping[] }`.

#### Scenario: Registry is the single source of truth

- **WHEN** a target is added to the registry
- **THEN** its key, label, kind, dispatch, and stateSelector are all defined in that one registry entry
- **AND** the receiver, overlay, and feedback layer read the target's behavior from the registry rather than redefining it

#### Scenario: Mapping carries only relevant advanced fields

- **WHEN** a `ControlMapping` targets a `trigger` target
- **THEN** `buttonMode`, `continuous`, and `enumMode` are ignored for that mapping
- **AND** `edge` and `minValue` are honored

### Requirement: Always-on MIDI control receiver

The codebase SHALL expose a `MidiControlProvider` and `useMidiControl()` that
install `onmidimessage` handlers on all granted `MIDIInput` ports whenever the
app is open, independent of recording state. Parsing SHALL reuse
`src/midi/midiLearn.ts`.

Outside map mode, for each parsed message the receiver SHALL find EVERY mapping
whose source matches, apply the advanced rules for each target's kind, and invoke
each registry `dispatch`. A single source bound to multiple targets therefore
triggers all of them.

System Real-Time bytes (`0xF8`, `0xFA`, `0xFB`, `0xFC`) SHALL never match a
control source.

#### Scenario: Mapped note fires its action outside map mode

- **WHEN** the app is not in map mode and a note-on matching a mapping's source arrives
- **THEN** the receiver invokes that target's `dispatch`

#### Scenario: One source drives multiple targets

- **WHEN** a source is bound to two targets and a matching message arrives
- **THEN** the receiver invokes both targets' `dispatch`

#### Scenario: Clock bytes are never treated as control sources

- **WHEN** a `0xF8` clock pulse arrives
- **THEN** the receiver does not match it to any mapping and takes no control action

### Requirement: Listened input devices

`ControlMapState` SHALL carry a `listenInputIds` list configuring which input
ports the control receiver acts on. When the list is empty, the receiver SHALL
act on every granted input. When non-empty, the receiver SHALL ignore messages
(for both live dispatch and learn) from any port not in the list. The list
SHALL persist with the mapping set and be editable from the map editor.

#### Scenario: Listens to all inputs by default

- **WHEN** `listenInputIds` is empty and a mapped message arrives from any port
- **THEN** the receiver acts on it

#### Scenario: Restricts to selected inputs

- **WHEN** `listenInputIds` lists only port A and a message arrives from port B
- **THEN** the receiver ignores it

### Requirement: Source matching

The receiver SHALL match an incoming message to a mapping by `source.kind`,
`channel`, and `data` (note or CC number). When `source.anyPort` is false the
match SHALL also require the originating `portId`; when `anyPort` is true the
`portId` SHALL be ignored.

#### Scenario: Port-specific match

- **WHEN** a mapping has `anyPort: false` and a matching message arrives from a different port id
- **THEN** the message does not match that mapping

#### Scenario: Any-port match

- **WHEN** a mapping has `anyPort: true` and a message with the same kind/channel/data arrives from any port
- **THEN** the message matches that mapping

### Requirement: Trigger edge and value threshold

For note/CC mappings the receiver SHALL fire on the configured `edge`
(`press` = note-on / CC rising, `release` = note-off / CC falling) and SHALL
ignore messages whose velocity/value is below `minValue`.

#### Scenario: Press edge ignores release

- **WHEN** a mapping uses `edge: 'press'` and a note-off arrives
- **THEN** no action fires

#### Scenario: Below-threshold message is ignored

- **WHEN** a mapping has `minValue: 10` and a message with value 5 arrives
- **THEN** no action fires

### Requirement: Button mode for toggle targets

For toggle targets the receiver SHALL honor `buttonMode`: `toggle` flips the
target state on the configured edge; `momentary` enables the state on press and
disables it on release.

#### Scenario: Momentary enables on press and disables on release

- **WHEN** a momentary mapping receives a press
- **THEN** the target state is enabled
- **WHEN** the matching release arrives
- **THEN** the target state is disabled

### Requirement: Continuous BPM mapping

For the `setBpm` target the receiver SHALL support `continuous.mode`:
`absolute` SHALL scale incoming value `0–127` across `[continuous.min,
continuous.max]`; `relative` SHALL decode CC increment/decrement and step BPM.
When `continuous.takeover` is true in absolute mode, the receiver SHALL ignore
incoming values until the incoming value crosses the current BPM (soft pickup).

#### Scenario: Absolute scaling

- **WHEN** an absolute BPM mapping with range 60–200 receives CC value 0 then 127
- **THEN** BPM is set to 60 then 200 respectively

#### Scenario: Soft takeover suppresses jumps

- **WHEN** takeover is enabled, current BPM is 120, and an incoming value maps to 90
- **THEN** BPM does not change until a subsequent incoming value crosses 120

#### Scenario: Relative encoder steps

- **WHEN** a relative BPM mapping receives an increment then a decrement
- **THEN** BPM increases by one step then decreases by one step

### Requirement: Enum stepping for enum targets

For enum targets (`cycleQuantizeGrid`, `cycleClockSource`) the receiver SHALL
honor `enumMode`: `cycle` advances to the next value on press; `select` maps the
incoming value range across the target's value set.

#### Scenario: Cycle advances on press

- **WHEN** a cycle enum mapping receives a press
- **THEN** the target advances to its next value, wrapping at the end

#### Scenario: Select maps value range across options

- **WHEN** a select enum mapping with 4 options receives a value in the lowest quarter of the range
- **THEN** the first option is selected

### Requirement: Phrase-jump action

`useTransport` SHALL expose phrase-jump actions, and the registry SHALL expose
`phraseForward` and `phraseBack` targets. A phrase jump SHALL seek the playhead
by `barsPerPhrase` (default 8) bars, snapped to the bar, computed from the
current `bpm`/`sig`. Backward jumps SHALL clamp the playhead at 0.

#### Scenario: Phrase forward seeks by configured bars

- **WHEN** `phraseForward` fires with `barsPerPhrase` 8 in 4/4 at 120 BPM
- **THEN** the playhead advances by 8 bars, snapped to the bar

#### Scenario: Phrase back clamps at zero

- **WHEN** `phraseBack` fires near the start of the timeline
- **THEN** the playhead is clamped to 0 and does not go negative

### Requirement: setBpm honors clock source

The `setBpm` target SHALL change tempo only while `clockSource === 'internal'`,
updating the stored user BPM. While slaved to an external clock the target SHALL
be a no-op and SHALL surface a hint.

#### Scenario: BPM mapping ignored under external clock

- **WHEN** `clockSource` is external and a `setBpm` mapping receives a value
- **THEN** the tempo does not change
- **AND** a hint is surfaced

### Requirement: Mapped messages are consumable

`controlMap.ts` SHALL expose a pure predicate `matchesActiveMapping(message,
state)` that returns whether a parsed message matches any mapping in the active
`ControlMapState`. This predicate SHALL be the single integration point other
subsystems use to decide whether a message is consumed by control mapping.

#### Scenario: Predicate reports a match

- **WHEN** a message matches an active mapping's source
- **THEN** `matchesActiveMapping` returns true

#### Scenario: Predicate reports no match

- **WHEN** a message matches no active mapping
- **THEN** `matchesActiveMapping` returns false

### Requirement: Global versioned mapping store

The codebase SHALL expose `useControlMapStore()` that persists `ControlMapState`
under its own versioned persistence key, independent of the session
`TimelinePayload`. The store SHALL load at app start and SHALL survive creating
or loading a session. New installs SHALL start with an empty mapping set.

#### Scenario: Mappings persist across session load

- **WHEN** a mapping exists and the user loads a different session
- **THEN** the mapping remains active

#### Scenario: Empty by default

- **WHEN** the app starts with no stored mapping state
- **THEN** the active mapping set is empty and no control actions fire

### Requirement: JSON import and export of the mapping set

The store SHALL serialize the active `ControlMapState` to JSON for export and
SHALL accept a JSON mapping set for import. Import SHALL validate against the
current `version`, migrate older versions where defined, and replace the active
mapping set. Imported mappings referencing absent ports SHALL load and remain
inactive until those ports appear (or the mapping is `anyPort`).

#### Scenario: Round-trip preserves mappings

- **WHEN** a mapping set is exported and then imported
- **THEN** the resulting active mapping set equals the original

#### Scenario: Import replaces the active set

- **WHEN** a valid mapping set is imported
- **THEN** the previous active mappings are replaced by the imported set

### Requirement: MIDI feedback output

For toggle and enum mappings with `feedback.enabled`, a feedback watcher SHALL
subscribe to the target's state via the registry `stateSelector` and emit the
configured `note`/`cc` (using `onValue`/`offValue`) to `feedback.portId` on each
state change, plus an initial sync at app load and on map-mode exit. Output
writes SHALL be independent of `clockSender`. When the feedback port is
unavailable, emission SHALL be skipped silently until it returns.

#### Scenario: Feedback emits on state change

- **WHEN** a toggle target with feedback enabled changes from off to on
- **THEN** the configured `onValue` message is emitted to the feedback port

#### Scenario: Feedback skipped when port missing

- **WHEN** the feedback port is not currently available and the target state changes
- **THEN** no message is emitted and no error is raised

#### Scenario: Initial sync on load

- **WHEN** the app loads with a feedback-enabled mapping and its port available
- **THEN** the current state is emitted once as an initial sync
