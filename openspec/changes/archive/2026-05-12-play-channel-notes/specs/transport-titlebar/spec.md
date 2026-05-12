## MODIFIED Requirements

### Requirement: useTransport hook is the single source of transport state

The codebase SHALL expose a `useTransport()` hook returning a `TransportState` object and action functions (`play`, `pause`, `stop`, `record`, `toggleLoop`, `toggleMetronome`, `toggleQuantize`, `seek`, `setLoopRegion`, `clearLoopRegion`). The hook SHALL be backed by a React context provider so multiple consumers see the same state. The internal clock SHALL advance `timecodeMs` while `mode !== 'idle'` using `requestAnimationFrame`. Calling `stop()` SHALL set `mode` to `'idle'` and reset `timecodeMs` to `0`. Calling `pause()` SHALL set `mode` to `'idle'` without resetting `timecodeMs`.

`TransportState` SHALL include a `loopRegion: { start: number; end: number } | null` field, where `start` and `end` are session-time beat values with the invariant `end > start` when non-null. The default value SHALL be `null` (no loop region defined).

`setLoopRegion(start, end)` SHALL set `loopRegion` to `{ start, end }`. If `end <= start`, the implementation SHALL either swap the endpoints or no-op the call — it SHALL NOT store an invalid region. `clearLoopRegion()` SHALL set `loopRegion` back to `null`.

When `mode !== 'idle'` AND `looping === true` AND `loopRegion != null`, the rAF tick reducer SHALL check whether the playhead, expressed in beats as `(timecodeMs / 1000) * (bpm / 60)`, has crossed `loopRegion.end`, and if so SHALL set `timecodeMs` to the millisecond equivalent of `loopRegion.start * (60000 / bpm)`. When `looping === false` OR `loopRegion === null`, `timecodeMs` SHALL advance indefinitely without wrapping — there SHALL be no implicit modular wrap at any non-loop boundary.

`TransportState` SHALL include a `clockSource: 'internal' | 'external-clock' | 'external-mtc'` field. The default value SHALL be `'internal'`. No public action for changing `clockSource` is required in this slice (real clock-source switching lands with the MIDI runtime); the field SHALL be exposed on the returned value so the Titlebar can read it.

`TransportState` SHALL include a `recordingStartedAt: number | null` field. The default value SHALL be `null`. The reducer SHALL set `recordingStartedAt = performance.now()` when transitioning into `'record'` mode from a non-record mode (the same transition that today also resets `timecodeMs` to `0` when entering from `'idle'`). The reducer SHALL clear `recordingStartedAt` back to `null` when `stop()` or `pause()` runs. Re-entering `'record'` from `'record'` (no-op today) SHALL NOT change `recordingStartedAt`. Switching from `'record'` to `'play'` is not a supported transition in this slice; if it occurs, `recordingStartedAt` SHALL be cleared.

`play()` and `stop()` SHALL drive the outbound MIDI scheduler (see the `midi-playback` capability) as observable side effects of the `mode` transition. The `useTransport` reducer itself SHALL NOT call `MIDIOutput.send` or any other side-effecting Web MIDI API — the scheduler subscribes to `mode` transitions externally. The reducer's contract for `play()` SHALL remain: set `mode = 'play'` (from any prior mode), preserve `timecodeMs` (do NOT reset to 0 — `play()` resumes from the current playhead), and trigger the rAF loop. The reducer's contract for `stop()` SHALL remain: set `mode = 'idle'`, reset `timecodeMs` to `0`, clear `recordingStartedAt`. The reducer's contract for `pause()` SHALL remain: set `mode = 'idle'`, preserve `timecodeMs`, clear `recordingStartedAt`.

The OBSERVABLE behavior of `play()` and `stop()` — beyond the reducer-level state changes above — SHALL be:

- `play()` from any non-`'play'` mode SHALL cause the scheduler to snapshot `bpm` and the first available output, emit a toast describing the situation (either `'No output device available'` if no output, or `'Playing to <output.name>'` if one is present), and begin dispatching note-on / note-off pairs through `MIDIOutput.send` according to the `midi-playback` capability's contracts. These observable behaviors SHALL hold regardless of which UI element triggered `play()` (Titlebar play button, programmatic test invocation, future keyboard shortcut).
- `stop()` from `'play'` mode SHALL cause the scheduler to emit panic — explicit note-off messages for every still-dispatched note-on without a delivered note-off, plus an All Notes Off CC (`#123`, `0x7B`) on every channelByte that produced activity during the play session, sent to the output snapshotted at the prior `play()` — before the reducer resets `timecodeMs`.
- `stop()` from `'record'` mode SHALL not trigger playback panic (no playback was running); the reducer's recording-side state changes (clearing `recordingStartedAt`, resetting `timecodeMs`) are unchanged.

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

#### Scenario: Play from idle resumes from current playhead, not zero

- **GIVEN** `mode === 'idle'`, `timecodeMs === 4250` (after a prior pause), and a non-empty channel
- **WHEN** `play()` is called
- **THEN** `mode` SHALL transition to `'play'`
- **AND** `timecodeMs` SHALL remain `4250` at the moment of the transition (no implicit reset to 0)
- **AND** the next rAF tick SHALL advance `timecodeMs` past `4250`

#### Scenario: Play triggers the scheduler to dispatch notes

- **GIVEN** the transport is in `mode === 'idle'`, at least one MIDIOutput is connected, and the active channel contains a note that falls within the first 100 ms of playback
- **WHEN** `play()` is called
- **THEN** the scheduler SHALL invoke `MIDIOutput.send` for that note's note-on within one rAF tick of the mode transition
- **AND** the scheduler SHALL invoke a matching note-off `MIDIOutput.send` whose timestamp resolves to `(t + dur) * (60000 / bpm)` ms after the play started

#### Scenario: Play with no output emits a no-output toast

- **GIVEN** `useMidiOutputs().outputs.length === 0`
- **WHEN** `play()` is called
- **THEN** `useToast().show` SHALL have been called exactly once with `'No output device available'`
- **AND** `mode` SHALL still transition to `'play'`
- **AND** `timecodeMs` SHALL advance as usual

#### Scenario: Play with an output emits a playing-to toast

- **GIVEN** `useMidiOutputs().outputs[0].name === 'MicroFreak'`
- **WHEN** `play()` is called
- **THEN** `useToast().show` SHALL have been called exactly once with `'Playing to MicroFreak'`

#### Scenario: Stop from play emits panic before resetting timecode

- **GIVEN** `mode === 'play'`, the scheduler has dispatched at least one note-on whose matching note-off is in the future, and at least one channelByte has produced activity during the session
- **WHEN** `stop()` is called
- **THEN** the scheduler SHALL emit the explicit note-offs followed by All Notes Off CCs (`0xB0 | byte, 0x7B, 0x00`) for every active channelByte
- **AND** the reducer SHALL then set `mode = 'idle'` and `timecodeMs = 0`

#### Scenario: Stop from record does not emit playback panic

- **GIVEN** `mode === 'record'` (no playback in progress)
- **WHEN** `stop()` is called
- **THEN** the scheduler SHALL NOT emit any note-off, All Notes Off, or other outbound MIDI messages
- **AND** the reducer's recording-side state SHALL clear as documented (`recordingStartedAt = null`, `timecodeMs = 0`)
