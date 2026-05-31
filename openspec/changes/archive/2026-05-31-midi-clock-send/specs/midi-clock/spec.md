## ADDED Requirements

### Requirement: MidiClockProvider exposes onPulse subscription for downstream relayers

`MidiClockProvider` SHALL expose a context method `onPulse(callback: (timestampMs: number) => void): () => void` accessible via the existing `useMidiClock()` hook (added as a top-level field on the returned value). The method SHALL register `callback` to be invoked synchronously inside the receiver's `onmidimessage` handler each time an accepted `0xF8` pulse is processed for the active master (after the active-master filter described in the existing requirement "Clock receiver parses System Real-Time messages from every connected input").

`timestampMs` SHALL be `performance.now()` captured at the moment the pulse is accepted (NOT the `MIDIMessageEvent.timeStamp` field, which the receiver already normalises). The callback SHALL be called exactly once per accepted pulse, in the order they arrived, with no batching.

The returned function SHALL unregister the callback when invoked.

If a callback throws, the receiver SHALL catch the exception, log it via `console.error`, and continue processing the pulse for other subscribers and for the receiver's own bookkeeping. A throwing subscriber SHALL NOT crash the receiver or cause other subscribers to miss the pulse.

When `useMidiClock().selection === 'internal'`, no pulse is "accepted" (per the existing requirement), and therefore no subscriber SHALL be called.

#### Scenario: onPulse subscriber receives accepted pulses in order

- **GIVEN** a subscriber registered via `useMidiClock().onPulse(cb)` and `selection === 'auto'`
- **WHEN** the active master sends 5 `0xF8` pulses
- **THEN** the subscriber SHALL have been called exactly 5 times
- **AND** the `timestampMs` argument SHALL be monotonically non-decreasing across calls

#### Scenario: Discarded pulses do not reach subscribers

- **GIVEN** input A is the active master and input B sends a `0xF8` pulse while A is still active
- **WHEN** B's pulse is discarded per the active-master filter
- **THEN** no subscriber SHALL be called for B's pulse
- **AND** the subscriber SHALL be called for A's next pulse as normal

#### Scenario: Internal selection silences all subscribers

- **GIVEN** `useMidiClock().selection === 'internal'` and a subscriber is registered
- **WHEN** any connected input sends a `0xF8` pulse
- **THEN** the subscriber SHALL NOT be called

#### Scenario: Unsubscribe stops calls

- **GIVEN** a subscriber `cb` registered via `const unsub = onPulse(cb)`
- **WHEN** the caller invokes `unsub()`
- **AND** the active master then sends a `0xF8` pulse
- **THEN** `cb` SHALL NOT be called

#### Scenario: Throwing subscriber does not break other subscribers

- **GIVEN** subscribers `cb1` (which throws) and `cb2` (which records calls) both registered
- **WHEN** the active master sends a `0xF8` pulse
- **THEN** `cb2` SHALL have been called exactly once
- **AND** the receiver's own pulse-count bookkeeping SHALL have advanced by 1
- **AND** `console.error` SHALL have been called at least once

### Requirement: useMidiClock exposes strictStart and setStrictStart

`useMidiClock()` SHALL additionally expose a `strictStart: boolean` field and a `setStrictStart(b: boolean): void` action. The default value of `strictStart` SHALL be `true` — matching the MIDI 1.0 spec where incoming Start = "rewind to 0 then play" — so that incoming `0xFA` from a master (e.g. Traktor's Sync emitter) realigns the slave's grid to bar 1 by default. Users running this app as standalone or wanting resume-style Start semantics can flip the toggle off via the Clk menu. The value SHALL be in-memory only — it SHALL NOT persist across reloads. Setting `strictStart` to its current value SHALL be a no-op (no state churn).

`strictStart` modifies the behavior of incoming `0xFA` Start messages (see the MODIFIED requirement "Clock receiver drives transport playhead when external clock is active"). It SHALL NOT affect the handling of `0xFB` Continue or `0xFC` Stop.

`strictStart` SHALL be available regardless of `selection` value. Calling `setStrictStart(...)` SHALL NOT reset the smoother, pulse counter, or any other receiver state.

#### Scenario: Default strictStart is true

- **WHEN** the `MidiClockProvider` is freshly mounted
- **THEN** `useMidiClock().strictStart` SHALL be `true`

#### Scenario: setStrictStart updates state

- **GIVEN** `useMidiClock().strictStart === true`
- **WHEN** the user calls `setStrictStart(false)`
- **THEN** `useMidiClock().strictStart` SHALL be `false`
- **WHEN** the user calls `setStrictStart(true)`
- **THEN** `useMidiClock().strictStart` SHALL be `true`

#### Scenario: setStrictStart with same value is a no-op

- **GIVEN** `useMidiClock().bpm === 124`, `pulse === 50`, `strictStart === true`
- **WHEN** the user calls `setStrictStart(true)`
- **THEN** `useMidiClock().bpm` SHALL remain `124`
- **AND** `useMidiClock().pulse` SHALL remain `50`
- **AND** no transport action SHALL be dispatched

## MODIFIED Requirements

### Requirement: Clock receiver drives transport playhead when external clock is active

When `useMidiClock().present === true`, the clock receiver SHALL flip `useTransport().clockSource` to `'external-clock'`. When `present` transitions from `true` to `false`, the receiver SHALL flip `clockSource` back to `'internal'`.

While `useTransport().clockSource === 'external-clock'`, the transport's `requestAnimationFrame` tick SHALL NOT advance `timecodeMs`. Instead, each incoming `0xF8` pulse SHALL dispatch an `{ type: 'applyExternalPulse', deltaMs, bpm }` action where `deltaMs` is the raw inter-pulse interval (in ms) since the previous pulse from the active master. The reducer SHALL advance `timecodeMs` by `Math.max(0, deltaMs)` when `mode !== 'idle'` and SHALL advance `playheadTicks` by a constant `DEFAULT_MIDI_TPQ / 24` (one twenty-fourth of a quarter note) when `mode !== 'idle'`. Both are no-ops when `mode === 'idle'`.

`useTransport().playheadTicks` SHALL be the source of truth for the visible playhead position. Under external clock the per-pulse tick advance is independent of the carried `bpm`, so the playhead SHALL NOT regress when the smoother's rounded `bpm` reading oscillates between neighbouring integers.

When `clockSource === 'external-clock'`, `useTransport().bpm` SHALL mirror `useMidiClock().bpm` (or the last known value while `present === false` is briefly true between updates). When `clockSource === 'internal'`, `useTransport().bpm` SHALL be the user-set value (the existing reducer-managed field), unaffected by any cached external BPM.

Incoming Start (`0xFA`) SHALL invoke `useTransport().play()` if `mode === 'idle'`. **When `useMidiClock().strictStart === true`**, incoming Start (`0xFA`) SHALL additionally invoke `useTransport().rewind()` *before* `useTransport().play()`, atomically — no intermediate render commit SHALL be visible in which `mode === 'idle'` and `timecodeMs > 0`. When `strictStart === false`, current behavior is preserved (Start resumes from current `timecodeMs`).

Incoming Continue (`0xFB`) SHALL invoke `useTransport().play()` if `mode === 'idle'` (resuming from current `timecodeMs`, which the existing `play()` contract already preserves). `strictStart` SHALL NOT affect Continue. Incoming Stop (`0xFC`) SHALL invoke `useTransport().pause()` if `mode === 'play'`. All three real-time messages SHALL be IGNORED when `mode === 'record'` — recording is driven by the user's record button, not by the master.

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

#### Scenario: Start triggers play from idle (default mode preserves position)

- **GIVEN** `mode === 'idle'`, `clockSource === 'external-clock'`, `timecodeMs === 5000`, `playheadTicks === 9600`, `strictStart === false`
- **WHEN** the active master sends `0xFA` (Start)
- **THEN** `useTransport().mode` SHALL transition to `'play'`
- **AND** `useTransport().timecodeMs` SHALL remain approximately `5000`
- **AND** `useTransport().playheadTicks` SHALL remain approximately `9600`

#### Scenario: Strict Start rewinds before play

- **GIVEN** `mode === 'idle'`, `clockSource === 'external-clock'`, `timecodeMs === 5000`, `playheadTicks === 9600`, `strictStart === true`
- **WHEN** the active master sends `0xFA` (Start)
- **THEN** `useTransport().mode` SHALL transition to `'play'`
- **AND** `useTransport().timecodeMs` SHALL be `0`
- **AND** `useTransport().playheadTicks` SHALL be `0`
- **AND** no intermediate React commit SHALL be observable in which `mode === 'idle'` and `timecodeMs > 0` after the Start arrived

#### Scenario: Strict Start does not affect Continue

- **GIVEN** `mode === 'idle'`, `timecodeMs === 5000`, `strictStart === true`
- **WHEN** the active master sends `0xFB` (Continue)
- **THEN** `useTransport().mode` SHALL transition to `'play'`
- **AND** `useTransport().timecodeMs` SHALL remain approximately `5000` (no rewind)

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

#### Scenario: Strict Start has no effect in record mode

- **GIVEN** `mode === 'record'`, `strictStart === true`, `timecodeMs === 3000`
- **WHEN** the active master sends `0xFA` (Start)
- **THEN** `useTransport().mode` SHALL remain `'record'`
- **AND** `useTransport().timecodeMs` SHALL remain `3000` (no rewind, since Start is ignored in record mode regardless of `strictStart`)

#### Scenario: Source switch mid-playback does not move timecode backwards

- **GIVEN** `clockSource === 'internal'`, `mode === 'play'`, `timecodeMs === 3000`
- **WHEN** an incoming `0xF8` flips `clockSource` to `'external-clock'`
- **THEN** `timecodeMs` SHALL be at least `3000` at the moment of the next observable commit
- **AND** subsequent external pulses SHALL continue advancing from that point
