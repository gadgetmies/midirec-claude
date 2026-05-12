## MODIFIED Requirements

### Requirement: useTransport hook is the single source of transport state

The codebase SHALL expose a `useTransport()` hook returning a `TransportState` object and action functions (`play`, `pause`, `stop`, `record`, `toggleLoop`, `toggleMetronome`, `toggleQuantize`, `seek`, `setLoopRegion`, `clearLoopRegion`). The hook SHALL be backed by a React context provider so multiple consumers see the same state. The internal clock SHALL advance `timecodeMs` while `mode !== 'idle'` using `requestAnimationFrame`. Calling `stop()` SHALL set `mode` to `'idle'` and reset `timecodeMs` to `0`. Calling `pause()` SHALL set `mode` to `'idle'` without resetting `timecodeMs`.

`TransportState` SHALL include a `loopRegion: { start: number; end: number } | null` field, where `start` and `end` are session-time beat values with the invariant `end > start` when non-null. The default value SHALL be `null` (no loop region defined).

`setLoopRegion(start, end)` SHALL set `loopRegion` to `{ start, end }`. If `end <= start`, the implementation SHALL either swap the endpoints or no-op the call — it SHALL NOT store an invalid region. `clearLoopRegion()` SHALL set `loopRegion` back to `null`.

When `mode !== 'idle'` AND `looping === true` AND `loopRegion != null`, the rAF tick reducer SHALL check whether the playhead, expressed in beats as `(timecodeMs / 1000) * (bpm / 60)`, has crossed `loopRegion.end`, and if so SHALL set `timecodeMs` to the millisecond equivalent of `loopRegion.start * (60000 / bpm)`. When `looping === false` OR `loopRegion === null`, `timecodeMs` SHALL advance indefinitely without wrapping — there SHALL be no implicit modular wrap at any non-loop boundary.

`TransportState` SHALL include a `clockSource: 'internal' | 'external-clock' | 'external-mtc'` field. The default value SHALL be `'internal'`. No public action for changing `clockSource` is required in this slice (real clock-source switching lands with the MIDI runtime); the field SHALL be exposed on the returned value so the Titlebar can read it.

`TransportState` SHALL include a `recordingStartedAt: number | null` field. The default value SHALL be `null`. The reducer SHALL set `recordingStartedAt = performance.now()` when transitioning into `'record'` mode from a non-record mode (the same transition that today also resets `timecodeMs` to `0` when entering from `'idle'`). The reducer SHALL clear `recordingStartedAt` back to `null` when `stop()` or `pause()` runs. Re-entering `'record'` from `'record'` (no-op today) SHALL NOT change `recordingStartedAt`. Switching from `'record'` to `'play'` is not a supported transition in this slice; if it occurs, `recordingStartedAt` SHALL be cleared.

#### Scenario: Playing advances timecode

- **WHEN** `play()` is called and ~500ms elapses
- **THEN** `timecodeMs` SHALL be approximately 500 (±2 frames of jitter)

#### Scenario: Stop resets timecode

- **WHEN** the transport is in `play` or `record` mode with `timecodeMs > 0` and `stop()` is called
- **THEN** `timecodeMs` SHALL be `0`
- **AND** `mode` SHALL be `'idle'`

#### Scenario: Pause preserves timecode

- **WHEN** the transport is in `play` mode with `timecodeMs === 12345` and `pause()` is called
- **THEN** `timecodeMs` SHALL be `12345`
- **AND** `mode` SHALL be `'idle'`

#### Scenario: Two consumers share state

- **WHEN** two components in the rendered tree each call `useTransport()`
- **THEN** they SHALL receive identical state references at any given commit
- **AND** an action dispatched from one SHALL be observed by the other on the next commit

#### Scenario: Default loopRegion is null

- **WHEN** the TransportProvider is freshly mounted
- **THEN** `loopRegion` SHALL be `null`

#### Scenario: setLoopRegion stores the region

- **WHEN** `setLoopRegion(4, 12)` is called from any consumer
- **THEN** `loopRegion` SHALL be `{ start: 4, end: 12 }`

#### Scenario: clearLoopRegion removes the region

- **WHEN** `loopRegion === { start: 4, end: 12 }` and `clearLoopRegion()` is called
- **THEN** `loopRegion` SHALL be `null`

#### Scenario: setLoopRegion rejects invalid input

- **WHEN** `setLoopRegion(8, 8)` or `setLoopRegion(8, 4)` is called
- **THEN** `loopRegion` SHALL NOT be set to a region whose `end <= start`
- **AND** the call SHALL either swap the endpoints (producing `{ start: 4, end: 8 }`) or be a no-op (leaving the prior `loopRegion`)

#### Scenario: Looping wraps the playhead at the loop end

- **WHEN** `mode === 'play'`, `looping === true`, `loopRegion === { start: 4, end: 8 }`, and `timecodeMs` has advanced past the millisecond equivalent of beat 8
- **THEN** the rAF tick reducer SHALL detect the crossing and set `timecodeMs` to the millisecond equivalent of beat 4
- **AND** subsequent ticks SHALL continue advancing from that point until the next crossing

#### Scenario: Non-looping playback does not wrap

- **WHEN** `mode === 'play'`, `looping === false` (regardless of whether `loopRegion` is set), and `timecodeMs` has advanced past beat 8
- **THEN** `timecodeMs` SHALL continue to grow without resetting

#### Scenario: Default clockSource is internal

- **WHEN** the TransportProvider is freshly mounted
- **THEN** `clockSource` SHALL be `'internal'`

#### Scenario: Two consumers see the same clockSource

- **WHEN** two components both call `useTransport()`
- **THEN** their `clockSource` values SHALL be identical at any commit

#### Scenario: Default recordingStartedAt is null

- **WHEN** the TransportProvider is freshly mounted
- **THEN** `recordingStartedAt` SHALL be `null`

#### Scenario: Entering record from idle stamps recordingStartedAt

- **GIVEN** `mode === 'idle'` and `recordingStartedAt === null`
- **WHEN** `record()` is called at `performance.now() === T`
- **THEN** `recordingStartedAt` SHALL be approximately `T` (the value of `performance.now()` at the moment the reducer runs)
- **AND** `mode` SHALL be `'record'`

#### Scenario: Stop from record clears recordingStartedAt

- **GIVEN** `mode === 'record'` and `recordingStartedAt !== null`
- **WHEN** `stop()` is called
- **THEN** `recordingStartedAt` SHALL be `null`
- **AND** `timecodeMs` SHALL be `0`

#### Scenario: Pause from record clears recordingStartedAt

- **GIVEN** `mode === 'record'` and `recordingStartedAt !== null` and `timecodeMs > 0`
- **WHEN** `pause()` is called
- **THEN** `recordingStartedAt` SHALL be `null`
- **AND** `timecodeMs` SHALL be preserved (not reset)

## ADDED Requirements

### Requirement: Record button disabled when input or channel is missing

The record button in the Titlebar transport group SHALL be `disabled` when EITHER of the following is true:

- `useMidiInputs().inputs.length === 0` (no MIDI input device available — runtime ungranted, unsupported, or zero connected inputs)
- `useStage().selectedChannelId === null` (no channel selected to record into)

When disabled, the button SHALL render a tooltip explaining the cause. If no input is available, the tooltip SHALL read `No MIDI input available`. If an input is available but no channel is selected, the tooltip SHALL read `Select a channel to record into`. If both conditions are true, the input-missing tooltip wins.

When enabled, the button SHALL behave as today: clicking dispatches `record()`, the `mrPulse` animation engages while armed, and the timecode color flips to `var(--mr-rec)`.

#### Scenario: No input available disables the record button with tooltip

- **WHEN** `useMidiInputs().inputs.length === 0`
- **THEN** the record button SHALL carry the `disabled` attribute
- **AND** its tooltip / `title` SHALL read `No MIDI input available`
- **AND** clicking it SHALL NOT dispatch `record()`

#### Scenario: No channel selected disables the record button with tooltip

- **WHEN** `useMidiInputs().inputs.length > 0` AND `useStage().selectedChannelId === null`
- **THEN** the record button SHALL carry the `disabled` attribute
- **AND** its tooltip / `title` SHALL read `Select a channel to record into`

#### Scenario: Both conditions met enables the record button

- **WHEN** `useMidiInputs().inputs.length > 0` AND `useStage().selectedChannelId !== null`
- **THEN** the record button SHALL NOT carry `disabled`
- **AND** clicking it SHALL dispatch `record()` (transitioning `mode` to `'record'`)

#### Scenario: Input-missing tooltip wins when both conditions are absent

- **WHEN** `useMidiInputs().inputs.length === 0` AND `useStage().selectedChannelId === null`
- **THEN** the record button's tooltip SHALL read `No MIDI input available`
