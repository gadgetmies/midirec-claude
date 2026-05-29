## MODIFIED Requirements

### Requirement: Clock receiver drives transport playhead when external clock is active

When `useMidiClock().present === true`, the clock receiver SHALL flip `useTransport().clockSource` to `'external-clock'`. When `present` transitions from `true` to `false`, the receiver SHALL flip `clockSource` back to `'internal'`.

While `useTransport().clockSource === 'external-clock'`, the transport's `requestAnimationFrame` tick SHALL NOT advance `timecodeMs`. Instead, each incoming `0xF8` pulse SHALL dispatch an `{ type: 'applyExternalPulse', deltaMs, bpm }` action where `deltaMs` is the raw inter-pulse interval (in ms) since the previous pulse from the active master. The reducer SHALL advance `timecodeMs` by `Math.max(0, deltaMs)` when `mode !== 'idle'` and SHALL advance `playheadTicks` by a constant `DEFAULT_MIDI_TPQ / 24` (one twenty-fourth of a quarter note) when `mode !== 'idle'`. Both are no-ops when `mode === 'idle'`.

`useTransport().playheadTicks` SHALL be the source of truth for the visible playhead position. Under external clock the per-pulse tick advance is independent of the carried `bpm`, so the playhead SHALL NOT regress when the smoother's rounded `bpm` reading oscillates between neighbouring integers.

When `clockSource === 'external-clock'`, `useTransport().bpm` SHALL mirror `useMidiClock().bpm` (or the last known value while `present === false` is briefly true between updates). When `clockSource === 'internal'`, `useTransport().bpm` SHALL be the user-set value (the existing reducer-managed field), unaffected by any cached external BPM.

Incoming Start (`0xFA`) SHALL invoke `useTransport().play()` if `mode === 'idle'`. Incoming Continue (`0xFB`) SHALL invoke `useTransport().play()` if `mode === 'idle'` (resuming from current `timecodeMs`, which the existing `play()` contract already preserves). Incoming Stop (`0xFC`) SHALL invoke `useTransport().pause()` if `mode === 'play'`. All three real-time messages SHALL be IGNORED when `mode === 'record'` — recording is driven by the user's record button, not by the master.

#### Scenario: clockSource auto-switches to external on first pulse

- **GIVEN** `useTransport().clockSource === 'internal'` and no clock has been received this session
- **WHEN** the first `0xF8` pulse arrives on any connected input
- **THEN** `useTransport().clockSource` SHALL be `'external-clock'`

#### Scenario: clockSource reverts to internal after timeout

- **GIVEN** `useTransport().clockSource === 'external-clock'` (an active master has been pulsing)
- **WHEN** no `0xF8` arrives from any input for 2000 ms
- **THEN** `useTransport().clockSource` SHALL be `'internal'`

#### Scenario: rAF tick is disabled in external mode

- **GIVEN** `clockSource === 'external-clock'`, `mode === 'play'`, and no `0xF8` has arrived for 100 ms
- **WHEN** the `requestAnimationFrame` callback fires multiple times in that window
- **THEN** `timecodeMs` SHALL NOT advance from rAF ticks
- **AND** `timecodeMs` SHALL only advance on the next `0xF8` arrival

#### Scenario: External pulse advances timecode by raw inter-pulse interval

- **GIVEN** `clockSource === 'external-clock'`, `mode === 'play'`, `timecodeMs === 1000`
- **WHEN** a `0xF8` arrives with raw inter-pulse interval `20.833 ms`
- **THEN** `timecodeMs` SHALL be approximately `1020.833` (±0.1 ms rounding tolerance)

#### Scenario: External pulse advances playheadTicks by tpq/24 regardless of bpm

- **GIVEN** `clockSource === 'external-clock'`, `mode === 'play'`, `DEFAULT_MIDI_TPQ === 480`, and `playheadTicks === 0`
- **WHEN** three consecutive `0xF8` pulses arrive carrying bpm readings `124`, `125`, `124` (rounding jitter)
- **THEN** `playheadTicks` SHALL be `20`, then `40`, then `60`
- **AND** the per-pulse advance SHALL NOT depend on the carried bpm

#### Scenario: External playhead is monotonic across a downward bpm swing

- **GIVEN** `clockSource === 'external-clock'`, `mode === 'play'`, and the smoother has been reporting bpm `≈120` for at least 24 pulses
- **WHEN** the next pulse carries a sharply lower bpm reading (e.g. `100`) because the rolling-window mean was pulled up by a slow interval
- **THEN** `playheadTicks` SHALL strictly increase across that pulse
- **AND** the new value SHALL equal the previous value plus `DEFAULT_MIDI_TPQ / 24`

#### Scenario: applyExternalPulse does not advance playheadTicks when idle

- **GIVEN** `mode === 'idle'` and `playheadTicks === 0`
- **WHEN** a `0xF8` pulse arrives carrying any bpm and any `deltaMs`
- **THEN** `playheadTicks` SHALL remain `0`
- **AND** `clockSource` SHALL transition to `'external-clock'`

#### Scenario: useTransport.bpm mirrors external BPM

- **GIVEN** `clockSource === 'external-clock'` and `useMidiClock().bpm === 128`
- **THEN** `useTransport().bpm` SHALL be `128`
- **WHEN** `clockSource` reverts to `'internal'`
- **THEN** `useTransport().bpm` SHALL revert to the user-set value (124 default)

#### Scenario: Start triggers play from idle

- **GIVEN** `mode === 'idle'` and `clockSource === 'external-clock'`
- **WHEN** the active master sends `0xFA` (Start)
- **THEN** `useTransport().mode` SHALL transition to `'play'`

#### Scenario: Continue resumes from current playhead

- **GIVEN** `mode === 'idle'` and `timecodeMs === 5000`
- **WHEN** the active master sends `0xFB` (Continue)
- **THEN** `useTransport().mode` SHALL transition to `'play'`
- **AND** `timecodeMs` SHALL remain approximately `5000` at the moment of the transition

#### Scenario: Stop triggers pause from play

- **GIVEN** `mode === 'play'` and `timecodeMs === 5000`
- **WHEN** the active master sends `0xFC` (Stop)
- **THEN** `useTransport().mode` SHALL transition to `'idle'`
- **AND** `timecodeMs` SHALL remain `5000` (preserved, since `pause()` does not reset)

#### Scenario: Real-time messages are ignored in record mode

- **GIVEN** `mode === 'record'`
- **WHEN** the active master sends `0xFA`, `0xFB`, or `0xFC`
- **THEN** `useTransport().mode` SHALL remain `'record'`
- **AND** `useTransport().timecodeMs` SHALL NOT be reset or paused by the message

#### Scenario: Source switch mid-playback does not move timecode backwards

- **GIVEN** `clockSource === 'internal'`, `mode === 'play'`, `timecodeMs === 3000`
- **WHEN** an incoming `0xF8` flips `clockSource` to `'external-clock'`
- **THEN** `timecodeMs` SHALL be at least `3000` at the moment of the next observable commit
- **AND** subsequent external pulses SHALL continue advancing from that point
