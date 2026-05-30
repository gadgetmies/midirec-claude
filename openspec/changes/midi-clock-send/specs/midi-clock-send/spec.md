## ADDED Requirements

### Requirement: MidiClockSendProvider mounts in App.tsx alongside other providers

The codebase SHALL expose a `MidiClockSendProvider` React component (exported from `src/midi/MidiClockSendProvider.tsx`). `App.tsx` SHALL mount exactly one `MidiClockSendProvider` nested inside `MidiRuntimeProvider` (so it can call `useMidiOutputs()`), inside `TransportProvider` (so it can read `mode`, `bpm`, `timecodeMs`, `clockSource`), and inside `MidiClockProvider` (so it can subscribe to relayed pulses under external clock).

The provider SHALL be a no-op when `useMidiOutputs().status !== 'granted'` — no scheduler started, no Web MIDI `send()` calls issued, and `useMidiClockSend().enabled` SHALL be clamped to `false` regardless of user attempts to enable it.

#### Scenario: Provider is mounted in App.tsx

- **WHEN** the app is rendered
- **THEN** exactly one `<MidiClockSendProvider>` SHALL exist in the React tree
- **AND** it SHALL be a descendant of `<MidiRuntimeProvider>`, `<TransportProvider>`, and `<MidiClockProvider>`

#### Scenario: No-op when MIDI runtime is not granted

- **GIVEN** `useMidiOutputs().status !== 'granted'`
- **WHEN** the provider mounts
- **THEN** `useMidiClockSend().enabled` SHALL be `false`
- **AND** no Web MIDI `MIDIOutput.send(...)` call SHALL be issued from the provider for any reason

### Requirement: useMidiClockSend hook exposes enabled, selectedOutputIds, txPulse

The codebase SHALL expose `useMidiClockSend()` returning:

```
type MidiClockSendState = {
  enabled: boolean;
  selectedOutputIds: ReadonlySet<string>;
  txPulse: number;
};

interface MidiClockSendValue extends MidiClockSendState {
  setEnabled(enabled: boolean): void;
  toggleOutput(id: string): void;
  setSelectedOutputs(ids: string[]): void;
}
```

The hook SHALL throw with a clear error message when invoked outside `<MidiClockSendProvider>`.

The initial value of `enabled` SHALL be `false` and `selectedOutputIds` SHALL be empty. Neither value SHALL persist across reloads (no IndexedDB write, no `hydrate` participation in this slice).

`txPulse` SHALL be a monotonic non-negative integer that increments at most once per animation frame and SHALL increment whenever the provider commits one or more `0xF8` batches (internal scheduler) or relays one or more `0xF8` pulses (external mode). When `enabled === false`, `txPulse` SHALL NOT increment.

`setEnabled(true)` SHALL be a no-op when `useMidiOutputs().status !== 'granted'`. In all other cases it SHALL update the `enabled` state.

`toggleOutput(id)` SHALL flip membership of `id` in `selectedOutputIds`. The id SHALL be retained across hotplug events — disconnecting and reconnecting an output port SHALL NOT clear the id from the set.

`setSelectedOutputs(ids)` SHALL replace the set with the given ids in a single update.

#### Scenario: Initial state is disabled with no selected outputs

- **WHEN** the provider mounts
- **THEN** `useMidiClockSend().enabled` SHALL be `false`
- **AND** `useMidiClockSend().selectedOutputIds.size` SHALL be `0`
- **AND** `useMidiClockSend().txPulse` SHALL be `0`

#### Scenario: setEnabled is a no-op when MIDI is not granted

- **GIVEN** `useMidiOutputs().status === 'unsupported'`
- **WHEN** the user calls `useMidiClockSend().setEnabled(true)`
- **THEN** `useMidiClockSend().enabled` SHALL remain `false`

#### Scenario: toggleOutput flips membership

- **GIVEN** `useMidiClockSend().selectedOutputIds === Set()`
- **WHEN** the user calls `toggleOutput('out-a')`
- **THEN** `selectedOutputIds` SHALL be `Set(['out-a'])`
- **WHEN** the user calls `toggleOutput('out-a')` again
- **THEN** `selectedOutputIds` SHALL be `Set()`

#### Scenario: Selected id persists across hotplug

- **GIVEN** `selectedOutputIds === Set(['out-a'])` and `out-a` is connected
- **WHEN** `out-a` disconnects (statechange removes it from `useMidiOutputs().outputs`)
- **THEN** `selectedOutputIds` SHALL still contain `'out-a'`
- **WHEN** `out-a` reconnects
- **THEN** the provider SHALL emit to `out-a` again without any user action

#### Scenario: Hook throws outside provider

- **WHEN** `useMidiClockSend()` is invoked from a component not nested inside `<MidiClockSendProvider>`
- **THEN** the hook SHALL throw an Error whose message names the missing provider

### Requirement: Sender emits System Real-Time Clock pulses on enabled outputs

While `enabled === true` and `selectedOutputIds` is non-empty, the sender SHALL emit `0xF8` System Real-Time Clock messages on every selected output port that is currently connected (`outputs.some(o => o.id === id)`). Disconnected ids SHALL be silently skipped on each emit batch; they remain in `selectedOutputIds`.

Cadence SHALL depend on `useTransport().clockSource`:

- `clockSource === 'internal'`: the sender SHALL run an internal scheduler that emits one `0xF8` every `60000 / (useTransport().bpm * 24)` ms on each selected output. The scheduler SHALL use `MIDIOutput.send([0xF8], performanceNowTimestamp)` with a lookahead window of 25 ms (next-batch trigger via `setTimeout(..., 12 ms)`).
- `clockSource === 'external-clock'`: the sender SHALL relay each incoming `0xF8` 1:1 to every selected connected output, calling `MIDIOutput.send([0xF8], 0)` (= send immediately) in the same callback that received the pulse. The internal scheduler SHALL NOT run while `clockSource === 'external-clock'`.

When `clockSource` transitions from `'internal'` to `'external-clock'` or back, the sender SHALL switch modes on the next observation without emitting a Start/Continue/Stop.

When `enabled` transitions from `true` to `false`, the internal scheduler SHALL stop and no further bytes SHALL be sent (including no trailing `0xFC`) — symmetric with the input side which ignores Stop in record mode. Followup explicit Stop sends, if any, are triggered by transport mode transitions, not by toggling `enabled`.

#### Scenario: Internal scheduler emits at 24 PPQ

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a'])`, `useTransport().bpm === 120`, `clockSource === 'internal'`
- **WHEN** one second of wall-clock time elapses
- **THEN** the `out-a` output SHALL have received exactly `48` `0xF8` messages (120 BPM × 24 PPQ ÷ 60 sec) within a tolerance of `±2` messages

#### Scenario: External relay forwards each pulse 1:1

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a', 'out-b'])`, `clockSource === 'external-clock'`, and the active master input sends 10 `0xF8` pulses
- **THEN** `out-a` SHALL have received exactly `10` `0xF8` messages
- **AND** `out-b` SHALL have received exactly `10` `0xF8` messages

#### Scenario: Disconnected output is silently skipped

- **GIVEN** `selectedOutputIds === Set(['out-a', 'out-b'])` and `out-b` has disconnected
- **WHEN** a `0xF8` would be emitted
- **THEN** the sender SHALL call `send()` on `out-a` exactly once
- **AND** the sender SHALL NOT call `send()` on the stale `out-b` reference (no exception thrown, no retry)

#### Scenario: Disable stops emission immediately

- **GIVEN** the internal scheduler is running on `out-a`
- **WHEN** the user calls `setEnabled(false)`
- **THEN** within 50 ms the sender SHALL stop calling `send()` on `out-a`
- **AND** the sender SHALL NOT emit a `0xFC` Stop as a result of the disable

#### Scenario: txPulse increments per emit batch

- **GIVEN** `enabled === true`, one selected output, and `txPulse === 0`
- **WHEN** the scheduler commits 10 `0xF8` batches over the next animation frames
- **THEN** `useMidiClockSend().txPulse` SHALL be a positive integer greater than `0`
- **AND** the increment rate SHALL NOT exceed one increment per animation frame (~60 Hz)

### Requirement: Sender emits Start, Continue, and Stop on transport mode transitions

The sender SHALL emit `0xFA` (Start), `0xFB` (Continue), or `0xFC` (Stop) to every selected connected output in response to `useTransport()` mode and timecode transitions:

| From | To | Condition | Message |
|---|---|---|---|
| `idle` | `play` | `timecodeMs === 0` | `0xFA` Start |
| `idle` | `play` | `timecodeMs > 0` | `0xFB` Continue |
| `play` | `idle` | — | `0xFC` Stop |
| any → `record` or `record` → any | — | — | no transport message |

Transport messages SHALL be sent with `timestamp: 0` (send immediately, per Web MIDI spec). Each transport message SHALL be sent to every selected connected output in a single tight loop.

When `enabled === false`, no transport message SHALL be emitted regardless of mode transitions.

When the user calls `setEnabled(true)` mid-session with `mode === 'play'` and `timecodeMs > 0`, the sender SHALL emit a `0xFB` Continue to every selected connected output exactly once, before resuming `0xF8` emission. When `setEnabled(true)` is called with `mode === 'play'` and `timecodeMs === 0`, the sender SHALL emit a `0xFA` Start exactly once.

#### Scenario: Start from idle with zero timecode

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a'])`, `mode === 'idle'`, `timecodeMs === 0`
- **WHEN** `useTransport().play()` is called
- **THEN** `out-a` SHALL receive exactly one `0xFA` message
- **AND** the message SHALL be sent before the next `0xF8` pulse

#### Scenario: Continue from idle with non-zero timecode

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a'])`, `mode === 'idle'`, `timecodeMs === 5000`
- **WHEN** `useTransport().play()` is called
- **THEN** `out-a` SHALL receive exactly one `0xFB` message
- **AND** SHALL NOT receive a `0xFA`

#### Scenario: Stop from play

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a'])`, `mode === 'play'`
- **WHEN** `useTransport().pause()` is called (transitioning to `idle`)
- **THEN** `out-a` SHALL receive exactly one `0xFC` message

#### Scenario: Record mode emits no transport messages

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a'])`
- **WHEN** `mode` transitions from `idle` to `record` and back to `idle`
- **THEN** `out-a` SHALL NOT receive any `0xFA`, `0xFB`, or `0xFC` message attributable to those transitions

#### Scenario: Enabling mid-play emits Continue

- **GIVEN** `enabled === false`, `mode === 'play'`, `timecodeMs === 8000`, `selectedOutputIds === Set(['out-a'])`
- **WHEN** the user calls `setEnabled(true)`
- **THEN** `out-a` SHALL receive exactly one `0xFB` message
- **AND** subsequent `0xF8` pulses SHALL follow

### Requirement: useMidiClockSend exposes a Sync action that emits a slave-realignment bundle

`useMidiClockSend()` SHALL additionally expose a `sync(): void` action. When called with `enabled === true` AND at least one selected output is currently connected, the provider SHALL emit the following byte sequence to **every** selected connected output, in this exact order, with `timestamp: 0` (send immediately):

1. `0xFC` Stop — one byte
2. `0xF2 lsb msb` Song Position Pointer — three bytes, where:
   - `sppBeats = clamp(floor(useTransport().playheadTicks / (DEFAULT_MIDI_TPQ / 4)), 0, 16383)` (count of sixteenth notes from session start, 14-bit clamped)
   - `lsb = sppBeats & 0x7F`
   - `msb = (sppBeats >>> 7) & 0x7F`
3. Either `0xFA` Start (when `useTransport().playheadTicks === 0`) OR `0xFB` Continue (when `playheadTicks > 0`) — one byte

The three messages SHALL be emitted in a single synchronous loop with no `await`, `setTimeout`, or microtask boundary between them, to preserve byte order on each output.

The internal `0xF8` scheduler SHALL NOT pause during the sync emission. `txPulse` SHALL NOT advance as a side-effect of `sync()` (the sync bundle is not a clock pulse).

When `enabled === false` OR no selected output is currently connected, `sync()` SHALL be a no-op (no bytes emitted, no exception thrown).

`sync()` SHALL NOT mutate any state (`enabled`, `selectedOutputIds`, `txPulse`, `gridAlignment`) and SHALL NOT dispatch any transport action.

#### Scenario: Sync at position 0 emits Stop + SPP(0) + Start

- **GIVEN** `enabled === true`, one connected selected output `out-a`, `useTransport().playheadTicks === 0`
- **WHEN** the user calls `sync()`
- **THEN** `out-a.send(...)` SHALL have been called exactly three times with byte arrays equal to:
  - `[0xFC]`
  - `[0xF2, 0x00, 0x00]`
  - `[0xFA]`
- **AND** the three calls SHALL have been issued in that order with no microtask boundary between them

#### Scenario: Sync mid-song emits Stop + SPP + Continue

- **GIVEN** `enabled === true`, one connected selected output `out-a`, `playheadTicks === DEFAULT_MIDI_TPQ * 8` (8 quarter notes = 32 sixteenths)
- **WHEN** the user calls `sync()`
- **THEN** `out-a.send(...)` SHALL have been called with byte arrays:
  - `[0xFC]`
  - `[0xF2, 0x20, 0x00]` (32 = 0x20 in LSB, 0 in MSB)
  - `[0xFB]`

#### Scenario: SPP value clamps at 14-bit maximum

- **GIVEN** `enabled === true`, one connected selected output, `playheadTicks` corresponds to `sppBeats === 30000` (above the 14-bit max of 16383)
- **WHEN** `sync()` is called
- **THEN** the SPP message SHALL be `[0xF2, 0x7F, 0x7F]` (16383 = 0x3FFF)

#### Scenario: Sync emits to every selected connected output

- **GIVEN** `enabled === true`, `selectedOutputIds === Set(['out-a', 'out-b'])`, both connected
- **WHEN** `sync()` is called
- **THEN** `out-a.send(...)` SHALL have been called exactly three times
- **AND** `out-b.send(...)` SHALL have been called exactly three times
- **AND** the disconnected port (if any) SHALL NOT have been called

#### Scenario: Sync is a no-op when disabled

- **GIVEN** `enabled === false`
- **WHEN** the user calls `sync()`
- **THEN** no `send(...)` call SHALL have been issued to any output

#### Scenario: Sync is a no-op when no outputs selected

- **GIVEN** `enabled === true`, `selectedOutputIds === Set()`
- **WHEN** the user calls `sync()`
- **THEN** no `send(...)` call SHALL have been issued to any output

#### Scenario: Sync does not interrupt clock emission

- **GIVEN** the internal scheduler is running at 120 BPM with one selected output
- **WHEN** the user calls `sync()` in the middle of a 100ms observation window
- **THEN** the count of `0xF8` bytes emitted in that window SHALL be within `±2` of `48 * 0.1 = 4.8` (i.e., the scheduler kept ticking)
- **AND** the three sync bytes SHALL be interleaved with the clock bytes

### Requirement: useMidiClockSend exposes Grid Alignment trigger config and emission

`useMidiClockSend()` SHALL additionally expose:

```
type GridAlignmentMessage =
  | { kind: 'note'; channel: number; note: number; velocity: number }
  | { kind: 'cc';   channel: number; cc: number;   value: number };

type GridAlignmentBoundary = 'bar' | 'phrase' | 'manual';

type GridAlignmentConfig = {
  enabled: boolean;
  outputId: string | null;
  message: GridAlignmentMessage;
  boundary: GridAlignmentBoundary;
  phraseBars: number;
};

interface MidiClockSendValue {
  gridAlignment: GridAlignmentConfig;
  setGridAlignment(patch: Partial<GridAlignmentConfig>): void;
  fireGridAlignment(): void;
}
```

The initial value of `gridAlignment` SHALL be `{ enabled: false, outputId: null, message: { kind: 'note', channel: 1, note: 60, velocity: 127 }, boundary: 'bar', phraseBars: 8 }`. The config SHALL NOT persist across reloads.

`setGridAlignment(patch)` SHALL merge `patch` into the current config. Invalid values SHALL be clamped: `channel` to 1..16, `note`/`cc`/`velocity`/`value` to 0..127, `phraseBars` to 1..32.

**Automatic firing.** While `gridAlignment.enabled === true` AND `gridAlignment.outputId` resolves to a connected output AND `useTransport().mode === 'play'`, the provider SHALL emit the configured message on every boundary tick:

- `boundary === 'bar'`: emit on every tick where `playheadTicks % (DEFAULT_MIDI_TPQ * beatsPerBar) === 0`, where `beatsPerBar` is the numerator of `useTransport().sig` parsed as a fraction (e.g. `"4/4"` → `4`, `"7/8"` → `7`).
- `boundary === 'phrase'`: emit on bar boundaries where `barNumber % phraseBars === 0`, with `barNumber = floor(playheadTicks / (DEFAULT_MIDI_TPQ * beatsPerBar))`.
- `boundary === 'manual'`: automatic firing SHALL NOT occur; only `fireGridAlignment()` triggers emission.

Boundary detection SHALL be exact in both clock modes:

- Internal mode: a `useEffect` watching `useTransport().playheadTicks` against a `prev` ref, firing when `prev < boundaryTick <= curr`.
- External mode: a pulse counter subscribed via `useMidiClock().onPulse(...)`, firing when the counter is divisible by `24 * beatsPerBar` (bar mode) or `24 * beatsPerBar * phraseBars` (phrase mode). The counter SHALL reset to `0` on each accepted `0xFA` Start.

**Emission.** When fired (automatic or manual), the provider SHALL emit on the resolved output `MIDIOutput`:

- `kind === 'note'`: a Note On `[0x90 | (channel - 1), note, velocity]` immediately, followed by a Note Off `[0x80 | (channel - 1), note, 0]` exactly 50 ms later (scheduled via `setTimeout(..., 50)`).
- `kind === 'cc'`: a single Control Change `[0xB0 | (channel - 1), cc, value]`. No paired companion.

`fireGridAlignment()` SHALL emit regardless of `gridAlignment.enabled` (manual override). It SHALL be a no-op when `outputId === null` OR no connected output matches.

The Grid Alignment emission SHALL be independent of `useMidiClockSend().enabled` — disabling clock send SHALL NOT disable Grid Alignment, and vice versa.

#### Scenario: Default config

- **WHEN** the provider mounts
- **THEN** `useMidiClockSend().gridAlignment` SHALL equal `{ enabled: false, outputId: null, message: { kind: 'note', channel: 1, note: 60, velocity: 127 }, boundary: 'bar', phraseBars: 8 }`

#### Scenario: setGridAlignment merges and clamps

- **GIVEN** the default config
- **WHEN** the user calls `setGridAlignment({ message: { kind: 'note', channel: 99, note: 200, velocity: -5 } })`
- **THEN** `gridAlignment.message` SHALL be `{ kind: 'note', channel: 16, note: 127, velocity: 0 }` (clamped)
- **AND** `gridAlignment.boundary` SHALL still be `'bar'` (unchanged)

#### Scenario: Auto-fire at bar boundary in internal mode

- **GIVEN** `gridAlignment === { enabled: true, outputId: 'out-a', message: { kind: 'note', channel: 1, note: 60, velocity: 127 }, boundary: 'bar', phraseBars: 8 }`, `out-a` is connected, `useTransport().sig === '4/4'`, `mode === 'play'`, `clockSource === 'internal'`
- **WHEN** `playheadTicks` advances from `(DEFAULT_MIDI_TPQ * 4) - 1` to `DEFAULT_MIDI_TPQ * 4` (crosses bar 2 boundary)
- **THEN** `out-a.send([0x90, 60, 127], 0)` SHALL have been called exactly once
- **AND** 50 ms later `out-a.send([0x80, 60, 0], 0)` SHALL have been called exactly once

#### Scenario: Auto-fire at phrase boundary in external mode

- **GIVEN** `gridAlignment === { enabled: true, outputId: 'out-a', message: { kind: 'cc', channel: 1, cc: 20, value: 64 }, boundary: 'phrase', phraseBars: 4 }`, `out-a` is connected, `sig === '4/4'`, `mode === 'play'`, `clockSource === 'external-clock'`, the pulse counter reset by a recent `0xFA`
- **WHEN** the active master sends exactly `24 * 4 * 4 = 384` `0xF8` pulses (= 4 bars)
- **THEN** `out-a.send([0xB0, 20, 64], 0)` SHALL have been called exactly once
- **AND** no Note On/Off SHALL have been emitted (CC kind has no companion)

#### Scenario: Manual fire works even when disabled

- **GIVEN** `gridAlignment.enabled === false` and `outputId === 'out-a'` (connected)
- **WHEN** the user calls `fireGridAlignment()`
- **THEN** the configured message SHALL have been emitted exactly once to `out-a`

#### Scenario: Manual fire is no-op when no output resolves

- **GIVEN** `gridAlignment.outputId === null`
- **WHEN** the user calls `fireGridAlignment()`
- **THEN** no `send(...)` call SHALL have been issued

#### Scenario: Grid Alignment is independent of clock-send enabled

- **GIVEN** `useMidiClockSend().enabled === false`, `gridAlignment === { enabled: true, outputId: 'out-a', message: {...}, boundary: 'bar', ... }`, `out-a` connected, `mode === 'play'`
- **WHEN** the playhead crosses a bar boundary
- **THEN** the configured message SHALL still be emitted on `out-a`
- **AND** no `0xF8` SHALL have been emitted on `out-a` (clock send is off)

#### Scenario: Manual boundary disables auto-fire

- **GIVEN** `gridAlignment.boundary === 'manual'`, all other fields suitable for emission
- **WHEN** the playhead crosses multiple bar boundaries
- **THEN** no automatic emission SHALL have occurred
- **WHEN** the user calls `fireGridAlignment()`
- **THEN** exactly one emission SHALL occur

#### Scenario: Pulse counter resets on Start

- **GIVEN** external mode, `boundary === 'bar'`, `sig === '4/4'`, the pulse counter at `47` (one pulse shy of bar boundary)
- **WHEN** the active master sends `0xFA` Start
- **THEN** the pulse counter SHALL reset to `0`
- **AND** the next bar boundary firing SHALL require another `96` pulses

### Requirement: Sender does not interfere with non-clock MIDI output

The sender SHALL emit only the byte families enumerated by its own requirements: System Real-Time (`0xF8`, `0xFA`, `0xFB`, `0xFC`), Song Position Pointer (`0xF2`) as part of the Sync bundle, and Note On / Note Off / Control Change as part of the Grid Alignment trigger. It SHALL NOT emit any other byte. It SHALL NOT clear or override any other handler, queue, or send schedule on the selected `MIDIOutput` ports.

Other capabilities (e.g. `midi-playback`, DJ output mapping in `dj-action-tracks`) MAY share the same `MIDIOutput` ports concurrently. The sender SHALL NOT cancel, replace, or reorder any messages those callers send.

#### Scenario: Sender does not send unspecified bytes

- **WHEN** the sender is exercised through every action (clock emission, transport messages, Sync, Grid Alignment)
- **THEN** every emitted byte sequence SHALL match one of the patterns enumerated by this capability's requirements
- **AND** no other status byte (e.g. `0xF0` sysex, `0xFE` active sensing) SHALL be emitted

#### Scenario: Concurrent playback is not affected

- **GIVEN** `useMidiPlayback` is sending Note On/Off messages to `out-a` and `useMidiClockSend()` is also sending `0xF8` to `out-a`
- **WHEN** the user observes the byte stream on `out-a`
- **THEN** the playback Note On/Off bytes SHALL appear unchanged
- **AND** the Clock bytes SHALL appear interleaved with them
