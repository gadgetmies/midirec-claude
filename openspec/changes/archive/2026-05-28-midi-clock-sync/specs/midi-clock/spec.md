## ADDED Requirements

### Requirement: Clock receiver parses System Real-Time messages from every connected input

The codebase SHALL expose a module at `src/midi/clockReceiver.ts` that attaches an `onmidimessage` handler to every `MIDIInput` returned by `useMidiInputs()`. The handler SHALL preserve any previously-installed handler on that input (chaining, identical to the pattern in `src/midi/recorder.ts`) and SHALL restore the prior handler when the receiver detaches.

The handler SHALL recognize four System Real-Time status bytes and ignore every other message:

- `0xF8` — Clock pulse (no data bytes)
- `0xFA` — Start
- `0xFB` — Continue
- `0xFC` — Stop

Song Position Pointer (`0xF2`) and all other System messages SHALL be ignored in this slice.

The receiver SHALL track which input most recently sent a `0xF8` pulse as the "active master". Pulses from any other input SHALL be discarded until the active master has been silent for at least 2000 ms, at which point the next input to send a pulse becomes the active master.

#### Scenario: Handler attaches to every connected input

- **GIVEN** `useMidiInputs().inputs` resolves with three connected `MIDIInput` ports
- **WHEN** the `MidiClockProvider` mounts
- **THEN** all three inputs SHALL have an `onmidimessage` handler installed
- **AND** the receiver SHALL chain after any handler that was already present (the prior handler SHALL still be called on every message)

#### Scenario: Hotplug attaches to newly connected inputs

- **GIVEN** the receiver is mounted with one input attached
- **WHEN** the `MIDIAccess` fires a `statechange` adding a second connected input
- **THEN** the receiver SHALL attach to the second input on the next render
- **AND** the receiver SHALL NOT re-attach to the first input (no double-counted pulses)

#### Scenario: Unmount restores prior handlers

- **GIVEN** a `MIDIInput` had an `onmidimessage` handler installed before the receiver attached
- **WHEN** the receiver detaches (provider unmount or input disconnect)
- **THEN** the input's `onmidimessage` SHALL be the prior handler reference (not `null`, not the chained handler)

#### Scenario: Non-real-time messages are ignored

- **WHEN** the input delivers a Note On (`0x90` family), CC (`0xB0` family), Pitch Bend (`0xE0` family), or Aftertouch (`0xA0`/`0xD0` family) message
- **THEN** the receiver SHALL NOT update its pulse counter, BPM estimate, or running state
- **AND** the chained prior handler SHALL still receive the message

#### Scenario: Second master is ignored while first is active

- **GIVEN** input A has sent a `0xF8` pulse within the last 2000 ms (active master)
- **WHEN** input B sends a `0xF8` pulse
- **THEN** the pulse from B SHALL be discarded
- **AND** the receiver's `bpm`, `pulse`, and `beat` SHALL NOT advance

#### Scenario: Active master changes after silence

- **GIVEN** input A was active master and has not sent a pulse for 2100 ms
- **WHEN** input B sends a `0xF8` pulse
- **THEN** input B SHALL become the active master
- **AND** the next `0xF8` from B SHALL count toward the smoothing window (starting a fresh window)

### Requirement: useMidiClock hook exposes BPM, pulse count, beat count, and running state

The codebase SHALL expose `useMidiClock()` returning:

```
type MidiClockState = {
  present: boolean;       // true if a 0xF8 has arrived in the last 500ms
  bpm: number | null;     // smoothed BPM rounded to nearest integer, or null until ≥24 pulses observed
  pulse: number;          // monotonic count of received 0xF8 pulses in this session
  beat: number;           // floor(pulse / 24) — monotonic count of quarter-note beats
  running: boolean;       // true between an incoming Start/Continue and the next Stop
};
```

The hook SHALL throw with a clear error message when invoked outside `<MidiClockProvider>`.

`bpm` SHALL be computed by taking the mean interval (in milliseconds) between the last 24 received pulses, then `bpm = round(60000 / (meanInterval * 24))`. Until 24 pulses have been observed in the current active-master window, `bpm` SHALL be `null`. The provider MAY hold the unrounded BPM internally for derived calculations; only the rounded value is exposed via the hook.

`present` SHALL be `true` while the active master has sent a `0xF8` within the last 500 ms, and `false` otherwise. When `present` transitions from `true` to `false`, `bpm` SHALL remain at its last value (not reset to `null`) so the display does not flicker; `bpm` SHALL only reset to `null` when a new active master begins a fresh smoothing window.

#### Scenario: bpm is null until 24 pulses observed

- **WHEN** the receiver has observed 23 pulses from the active master
- **THEN** `useMidiClock().bpm` SHALL be `null`
- **WHEN** the 24th pulse arrives
- **THEN** `useMidiClock().bpm` SHALL be a positive integer

#### Scenario: bpm converges on the master's tempo

- **GIVEN** the active master sends pulses at 20.833 ms intervals (corresponding to 120 BPM)
- **WHEN** 24 pulses have been observed
- **THEN** `useMidiClock().bpm` SHALL be `120` (±1 BPM rounding tolerance)

#### Scenario: pulse and beat are monotonic

- **WHEN** the active master has sent 50 pulses since the start of the session
- **THEN** `useMidiClock().pulse` SHALL be `50`
- **AND** `useMidiClock().beat` SHALL be `2` (floor(50/24))

#### Scenario: running follows Start and Stop

- **GIVEN** `running === false`
- **WHEN** the active master sends `0xFA` (Start)
- **THEN** `running` SHALL be `true`
- **WHEN** the active master then sends `0xFC` (Stop)
- **THEN** `running` SHALL be `false`

#### Scenario: Continue sets running without resetting pulse

- **GIVEN** `running === false` and `pulse === 42`
- **WHEN** the active master sends `0xFB` (Continue)
- **THEN** `running` SHALL be `true`
- **AND** `pulse` SHALL remain `42`

#### Scenario: present goes false after silence

- **GIVEN** `present === true` and `bpm === 124`
- **WHEN** no `0xF8` arrives from the active master for 600 ms
- **THEN** `useMidiClock().present` SHALL be `false`
- **AND** `useMidiClock().bpm` SHALL still be `124` (preserved, not reset)

#### Scenario: Hook throws outside provider

- **WHEN** `useMidiClock()` is invoked from a component not nested inside `<MidiClockProvider>`
- **THEN** the hook SHALL throw an Error whose message names the missing provider

### Requirement: Clock receiver drives transport playhead when external clock is active

When `useMidiClock().present === true`, the clock receiver SHALL flip `useTransport().clockSource` to `'external-clock'`. When `present` transitions from `true` to `false`, the receiver SHALL flip `clockSource` back to `'internal'`.

While `useTransport().clockSource === 'external-clock'`, the transport's `requestAnimationFrame` tick SHALL NOT advance `timecodeMs`. Instead, each incoming `0xF8` pulse SHALL dispatch an `{ type: 'externalTick', deltaMs }` action where `deltaMs = (meanIntervalMs_rolling24) / 1` — i.e., the smoothed per-pulse duration. The `externalTick` reducer behaves identically to the existing `tick` reducer: it advances `timecodeMs` by `deltaMs` when `mode !== 'idle'` and is a no-op otherwise.

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

#### Scenario: External pulse advances timecode by smoothed per-pulse duration

- **GIVEN** `clockSource === 'external-clock'`, `mode === 'play'`, smoothed BPM is 120 (per-pulse `≈20.833` ms), and `timecodeMs === 1000`
- **WHEN** a `0xF8` arrives
- **THEN** `timecodeMs` SHALL be approximately `1020.833` (±0.1 ms rounding tolerance)

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

### Requirement: MidiClockProvider mounts in App.tsx alongside other providers

The codebase SHALL expose a `MidiClockProvider` React component (exported from `src/midi/MidiClockProvider.tsx`). `App.tsx` SHALL mount exactly one `MidiClockProvider` nested inside `MidiRuntimeProvider` (so it can call `useMidiInputs()`) and as a sibling/wrapper of `TransportProvider` such that it can read transport mode and dispatch transport actions.

The provider SHALL be a no-op when `useMidiInputs().status !== 'granted'` — no handlers attached, `useMidiClock()` returns the default state described in the "useMidiClock hook exposes BPM, pulse count, beat count, and running state" requirement (plus `selection: 'auto'` and a no-op `setSelection`).

#### Scenario: Provider is mounted in App.tsx

- **WHEN** the app is rendered
- **THEN** exactly one `<MidiClockProvider>` SHALL exist in the React tree
- **AND** it SHALL be a descendant of `<MidiRuntimeProvider>`

#### Scenario: No-op when MIDI runtime is not granted

- **GIVEN** `useMidiInputs().status === 'unsupported'`
- **WHEN** the provider mounts
- **THEN** no `onmidimessage` handler SHALL be attached to any input
- **AND** `useMidiClock()` SHALL return `{ present: false, bpm: null, pulse: 0, beat: 0, running: false, selection: 'auto', setSelection: <fn> }`

### Requirement: Clock source selection — Auto, Internal, or a specific device

`useMidiClock()` SHALL additionally expose a `selection: ClockSourceSelection` field and a `setSelection(sel: ClockSourceSelection): void` action, where:

```
type ClockSourceSelection = 'auto' | 'internal' | string; // string = MIDIInput id
```

The default value of `selection` SHALL be `'auto'`. `selection` SHALL be in-memory only — it SHALL NOT persist across reloads. The receiver's pulse-acceptance behavior SHALL depend on `selection`:

- `selection === 'auto'`: existing first-wins behavior. All inputs may compete for the active-master slot. After 2000 ms of silence the next input to pulse becomes the new active master.
- `selection === 'internal'`: ALL incoming `0xF8 / 0xFA / 0xFB / 0xFC` messages SHALL be discarded, regardless of source. The provider SHALL immediately dispatch `revertToInternalClock()` so `useTransport().clockSource` reverts to `'internal'`.
- `selection === <deviceId>` (any other string): ONLY pulses from the input whose `id === selection` SHALL count. Pulses from any other input SHALL be discarded. The active master SHALL effectively be pinned to `<deviceId>` for the duration of this selection — there is NO auto-fallback when the locked device goes silent.

When the locked device (selection = `<deviceId>`) goes silent for 500 ms, `present` SHALL flip to `false` per the existing requirement, BUT the provider SHALL NOT dispatch `revertToInternalClock()`. `useTransport().clockSource` SHALL remain `'external-clock'`, `useTransport().bpm` SHALL stay at its last known value (frozen), and `useTransport().timecodeMs` SHALL NOT advance (rAF stays gated off). The user SHALL be required to call `setSelection('internal')` (or `setSelection('auto')`) to recover.

Calling `setSelection(newSel)` SHALL, in all cases:

- Reset the smoother, clear `activeMasterId`, clear `lastPulseAtByInputId`, clear the present timer
- Set `state.pulse`, `state.beat`, `state.running` to `0`, `0`, `false`
- Set `state.bpm` to `null`
- Set `state.present` to `false`
- Set `state.selection` to `newSel`
- If `newSel === 'internal'`, immediately dispatch `useTransport().revertToInternalClock()`

If `newSel === selection` (no change), the call SHALL be a no-op (no state reset, no dispatch).

#### Scenario: Default selection is auto

- **WHEN** the `MidiClockProvider` is freshly mounted
- **THEN** `useMidiClock().selection` SHALL be `'auto'`

#### Scenario: Auto selection preserves first-wins behavior

- **GIVEN** `useMidiClock().selection === 'auto'` and two connected inputs A and B
- **WHEN** input A sends a `0xF8` pulse
- **THEN** A SHALL become the active master and `useMidiClock().pulse` SHALL advance per the existing requirements

#### Scenario: Internal selection discards all incoming clock

- **GIVEN** `setSelection('internal')` has been called
- **WHEN** any connected input sends `0xF8`, `0xFA`, `0xFB`, or `0xFC`
- **THEN** `useMidiClock().pulse`, `beat`, `bpm`, and `running` SHALL NOT change
- **AND** `useTransport().clockSource` SHALL remain `'internal'`

#### Scenario: Internal selection reverts an existing external lock

- **GIVEN** the receiver is in `'auto'` mode with input A as active master, `useTransport().clockSource === 'external-clock'`, and `useTransport().bpm === 124`
- **WHEN** the user calls `setSelection('internal')`
- **THEN** `useTransport().clockSource` SHALL transition to `'internal'` on the next commit
- **AND** `useTransport().bpm` SHALL revert to the user-set value (`userBpm`)
- **AND** `useMidiClock().pulse`, `beat`, `running` SHALL reset to `0`, `0`, `false`
- **AND** `useMidiClock().bpm` SHALL be `null`

#### Scenario: Device-locked selection accepts only the locked device

- **GIVEN** inputs A and B are connected and `setSelection(<id-of-B>)` has been called
- **WHEN** input A sends a `0xF8` pulse
- **THEN** `useMidiClock().pulse` SHALL NOT advance
- **AND** `useTransport().clockSource` SHALL remain `'internal'`
- **WHEN** input B sends a `0xF8` pulse
- **THEN** `useMidiClock().pulse` SHALL advance by 1
- **AND** `useTransport().clockSource` SHALL transition to `'external-clock'`

#### Scenario: Locked device silence does not auto-revert

- **GIVEN** `setSelection(<id-of-B>)` has been called, B has pulsed enough times for `bpm === 128`, and `useTransport().clockSource === 'external-clock'`
- **WHEN** B goes silent for 600 ms
- **THEN** `useMidiClock().present` SHALL be `false`
- **AND** `useTransport().clockSource` SHALL remain `'external-clock'`
- **AND** `useTransport().bpm` SHALL remain `128` (frozen)
- **AND** `useTransport().timecodeMs` SHALL NOT advance via rAF
- **WHEN** the user then calls `setSelection('internal')`
- **THEN** `useTransport().clockSource` SHALL transition to `'internal'`

#### Scenario: Changing selection resets state

- **GIVEN** the receiver has observed 50 pulses with `bpm === 124` under selection `'auto'`
- **WHEN** the user calls `setSelection('internal')` or `setSelection(<deviceId>)`
- **THEN** `useMidiClock().pulse` SHALL be `0`
- **AND** `useMidiClock().beat` SHALL be `0`
- **AND** `useMidiClock().bpm` SHALL be `null`
- **AND** `useMidiClock().running` SHALL be `false`
- **AND** `useMidiClock().present` SHALL be `false`

#### Scenario: setSelection with the same value is a no-op

- **GIVEN** `useMidiClock().selection === 'auto'` and `useMidiClock().bpm === 124` with `pulse === 50`
- **WHEN** the user calls `setSelection('auto')`
- **THEN** `useMidiClock().pulse` SHALL remain `50`
- **AND** `useMidiClock().bpm` SHALL remain `124`
- **AND** no transport action SHALL be dispatched
