## Purpose

Define the Titlebar/Transport bar: the recording/playback transport buttons, the timecode display, the meta-row (Bar / BPM / Clk / Sig), the loop/metronome toggles, the quantize widget, the right-edge status cluster (transport-mode LED + activity-driven MIDI IN LED), and the `useTransport` hook that backs all of them.
## Requirements
### Requirement: Titlebar renders the full transport bar

The Titlebar region SHALL render the transport bar matching `prototype/components.jsx` `Transport` and `prototype/app.css` lines ~37–215. The visible elements, in left-to-right order, SHALL be:

1. **Brand block** — 22px gradient mark + `MIDI Recorder` (display font, semibold) + version subtitle (mono, `var(--mr-text-3)`), separated by a 1px right divider.
2. **Transport group A** — five buttons in this order: rewind / play (toggles to pause icon + accent state when playing or recording) / cue / record / fast-forward. The Stop button is intentionally absent; its prior role of "stop playback or recording" is split between Play-Pause (temporary pause) and Cue (terminal stop with jump to cue point). The Cue button renders the literal text `CUE` (small uppercase mono) rather than an icon, distinguishing it visually as a mode-switching control rather than a transport-direction icon.
3. **Timecode** — `MM:SS.FFF` at `var(--mr-fs-20)` size, mono, tabular-nums, with the milliseconds segment in `var(--mr-text-3)`.
4. **Meta row** — four columns each with a 9px uppercase label (`Bar`, `BPM`, `Clk`, `Sig`) and a mono value (`13.2.1`, `124`, `Int`, `4/4`). The `Clk` cell SHALL appear directly after `BPM` and before `Sig`. The `Clk` value SHALL render as a compact 3-letter code derived from `useTransport().clockSource`: `'internal'` → `Int`, `'external-clock'` → `Ext`, `'external-mtc'` → `MTC`. The `BPM` cell value SHALL render `useTransport().bpm` rounded to the nearest integer (the source of truth for `bpm` is already the transport — when external clock is active, `useTransport().bpm` mirrors the smoothed incoming BPM per the `midi-clock` capability, so no separate display branch is needed here).
5. **Transport group B** — loop button + metronome button.
6. **Quantize widget** — `Q` label + power-toggle button + grid-value chip showing the current grid (e.g. `1/16`), followed by an `A` label + power-toggle button (the Snap Absolute chip). The `A` chip SHALL sit immediately to the right of the grid-value chip and SHALL share the chip styling and click-to-toggle behavior of the `Q` chip.
7. **Spacer** consuming remaining horizontal space.
8. **Status cluster** — beat LED + middot + recording/playing LED + `REC` / `PLAY` / `IDLE` text + middot + activity-driven MIDI-in LED + `MIDI IN` text. The beat LED is the leftmost LED in the cluster; it pulses on each incoming clock beat (see the dedicated requirement below).

#### Scenario: All transport elements present

- **WHEN** the app is rendered
- **THEN** the Titlebar SHALL contain a `.mr-transport` element with the eight subregions above, in order
- **AND** each transport button SHALL render the corresponding inline SVG icon from the prototype's icon set, except the Cue button which SHALL render the literal text `CUE`
- **AND** transport group A SHALL contain exactly five `.mr-tbtn` buttons in the order rewind / play / cue / record / fast-forward
- **AND** transport group A SHALL NOT contain a Stop button
- **AND** the meta row SHALL contain exactly four `.mr-meta` cells with labels `Bar`, `BPM`, `Clk`, `Sig` in that DOM order
- **AND** the status cluster SHALL contain a beat LED as its leftmost LED, followed by the existing mode LED and the existing MIDI IN LED

#### Scenario: Clk cell shows source code from useTransport

- **WHEN** `useTransport()` reports `clockSource === 'internal'`
- **THEN** the `Clk` meta cell's value SHALL render the text `Int` in `var(--mr-font-mono)`
- **WHEN** `useTransport()` reports `clockSource === 'external-clock'`
- **THEN** the `Clk` meta cell's value SHALL render `Ext`
- **WHEN** `useTransport()` reports `clockSource === 'external-mtc'`
- **THEN** the `Clk` meta cell's value SHALL render `MTC`

#### Scenario: BPM cell reflects external BPM when slaved

- **GIVEN** `useTransport().clockSource === 'external-clock'` and `useTransport().bpm === 128`
- **WHEN** the Titlebar renders
- **THEN** the `BPM` meta cell's value SHALL render `128`
- **WHEN** `useTransport().clockSource` reverts to `'internal'` and `useTransport().bpm` reverts to `124`
- **THEN** the `BPM` meta cell's value SHALL render `124`

#### Scenario: A chip is present next to the Q chip

- **WHEN** the app is rendered
- **THEN** the Quantize widget subregion SHALL contain, in DOM order, the `Q` label + Q power-toggle + grid-value chip + `A` label + A power-toggle
- **AND** the `A` power-toggle SHALL share the same chip class/styling as the `Q` power-toggle

### Requirement: Transport exposes snapAbsoluteOn state and toggleSnapAbsolute action

`useTransport()` SHALL expose `snapAbsoluteOn: boolean` (defaulting to `false` at hook initialization) and `toggleSnapAbsolute(): void`. Calling `toggleSnapAbsolute()` SHALL flip the boolean and SHALL NOT affect any other transport field. The flag SHALL be in-memory only — it SHALL NOT persist across reloads.

#### Scenario: Default value is false

- **WHEN** the `TransportProvider` mounts for the first time
- **THEN** `useTransport().snapAbsoluteOn` SHALL be `false`

#### Scenario: Toggle flips the flag

- **WHEN** the user calls `useTransport().toggleSnapAbsolute()` once
- **THEN** `useTransport().snapAbsoluteOn` SHALL be `true`
- **WHEN** the user calls it a second time
- **THEN** `useTransport().snapAbsoluteOn` SHALL return to `false`

#### Scenario: Toggle does not affect quantizeOn or quantizeGrid

- **WHEN** the user calls `toggleSnapAbsolute()` while `quantizeOn === true` and `quantizeGrid === '1/16'`
- **THEN** `quantizeOn` SHALL still be `true`
- **AND** `quantizeGrid` SHALL still be `'1/16'`

### Requirement: A chip reflects snapAbsoluteOn and is disabled when quantize is off

The `A` power-toggle in the Quantize widget SHALL bind its active state to `useTransport().snapAbsoluteOn` and its click handler to `useTransport().toggleSnapAbsolute()`. When `useTransport().quantizeOn === false`, the `A` chip SHALL render with a `data-disabled="true"` attribute and SHALL NOT invoke `toggleSnapAbsolute()` on click.

#### Scenario: A chip activates when snapAbsoluteOn is true

- **WHEN** `useTransport()` reports `snapAbsoluteOn: true` and `quantizeOn: true`
- **THEN** the `A` power-toggle SHALL render with `data-on="true"`
- **AND** SHALL NOT carry `data-disabled="true"`

#### Scenario: A chip click toggles the flag

- **WHEN** `quantizeOn === true` and `snapAbsoluteOn === false`, and the user clicks the `A` chip
- **THEN** `toggleSnapAbsolute()` SHALL be invoked exactly once
- **AND** on the next render, `snapAbsoluteOn` SHALL be `true` and the `A` chip SHALL carry `data-on="true"`

#### Scenario: A chip is disabled when quantize is off

- **WHEN** `useTransport()` reports `quantizeOn: false`
- **THEN** the `A` power-toggle SHALL carry `data-disabled="true"`
- **AND** clicking it SHALL NOT invoke `toggleSnapAbsolute()`
- **AND** its title/tooltip SHALL communicate that quantize must be enabled to use Snap Absolute

#### Scenario: A chip inactive state

- **WHEN** `useTransport()` reports `snapAbsoluteOn: false` and `quantizeOn: true`
- **THEN** the `A` power-toggle SHALL NOT carry `data-on="true"`
- **AND** SHALL NOT carry `data-disabled="true"`
- **AND** SHALL be clickable

### Requirement: Recording state visually pulses

When `recording === true`, the record button SHALL render with the `mrPulse` keyframe animation (1.4s ease-in-out, alternating between a 12px and 22px outer glow at `--mr-rec-glow`) and a 1px ring at `--mr-rec`.

#### Scenario: Rec button pulses while armed

- **WHEN** `useTransport()` reports `recording: true`
- **THEN** the rec button SHALL have `data-rec="true"` and `data-on="true"`
- **AND** its computed `animation-name` SHALL be `mrPulse` with `animation-duration: 1.4s`
- **AND** its `box-shadow` at the keyframe peak SHALL include a 22px glow at `--mr-rec-glow`

#### Scenario: Rec button is static when idle

- **WHEN** `useTransport()` reports `recording: false`
- **THEN** the rec button SHALL NOT have `data-on="true"`
- **AND** SHALL NOT animate

### Requirement: Timecode color flips when recording

When `recording === true`, both the seconds segment and the milliseconds segment of the timecode SHALL render in `var(--mr-rec)`.

#### Scenario: Recording flips timecode color

- **WHEN** `useTransport()` reports `recording: true`
- **THEN** the `.mr-timecode` element SHALL carry `data-recording="true"`
- **AND** the computed `color` of `.mr-timecode__big` SHALL be `var(--mr-rec)`

#### Scenario: Idle timecode uses default text color

- **WHEN** `useTransport()` reports `recording: false`
- **THEN** the `.mr-timecode` element SHALL NOT carry `data-recording="true"`
- **AND** the computed `color` of the seconds segment SHALL be `var(--mr-text-1)`
- **AND** the computed `color` of the milliseconds segment SHALL be `var(--mr-text-3)`

### Requirement: Timecode format is MM:SS.FFF

The Titlebar timecode SHALL render the current `timecodeMs` in the format `MM:SS.FFF` (zero-padded minutes, seconds, and milliseconds — three milliseconds digits).

#### Scenario: Zero state renders as 00:00.000

- **WHEN** `timecodeMs === 0`
- **THEN** the rendered timecode SHALL be exactly `00:00.000`

#### Scenario: 83456 ms renders as 01:23.456

- **WHEN** `timecodeMs === 83456`
- **THEN** the rendered timecode SHALL be exactly `01:23.456`

### Requirement: Status LEDs reflect transport mode

The Titlebar SHALL render a status LED whose `data-state` attribute reflects the transport mode: `rec` when recording, `play` when playing, `idle` otherwise. Adjacent text SHALL read `REC`, `PLAY`, or `IDLE` accordingly. The `rec` state SHALL animate via the `mrLed` keyframe (1.2s ease-in-out, opacity 1.0 ↔ 0.45).

A second LED labeled `MIDI IN` SHALL render to the right of the middot. Its `data-state` attribute SHALL bind to `useStatusbar().active`: when `active === true`, the LED SHALL carry `data-state="midi"` (lit, with the `mrLed` blink animation per the shared `.mr-led[data-state="midi"]` rule); when `active === false`, the LED SHALL NOT carry the `data-state` attribute (it renders dim with no animation). The `MIDI IN` text label SHALL remain regardless of activity state.

A third LED — the **beat LED** — SHALL render to the LEFT of the mode LED inside the status cluster, as the cluster's first child. Its visual contract:

- When `useMidiClock().present === false`, the beat LED SHALL NOT carry a `data-state` attribute (rendered dim, no animation). No label text is rendered next to the beat LED; it is icon-only.
- When `useMidiClock().present === true`, the beat LED SHALL carry `data-state="beat"`. It SHALL NOT animate via a CSS keyframe driven by `animation-duration`. Instead, on each increment of `useMidiClock().beat`, the LED SHALL receive an `is-pulse` class for exactly 80 ms, then the class SHALL be removed. The `is-pulse` class SHALL apply a brief brightness boost (full opacity, slightly enlarged glow) for that 80 ms window. The cadence of the flash SHALL be driven by the React state increment, not by a CSS keyframe duration — so the flash aligns to the actual incoming `0xF8` pulse that completed the 24-pulse quarter-note rather than a CSS-timed approximation.

The beat LED SHALL be separated from the mode LED by a middot (`·`) consistent with the existing separator between mode LED and MIDI IN LED.

#### Scenario: Recording state lights the rec LED with mrLed animation

- **WHEN** `useTransport()` reports `recording: true`
- **THEN** the mode status LED SHALL have `data-state="rec"`
- **AND** its computed `animation-name` SHALL be `mrLed` with `animation-duration: 1.2s`
- **AND** the adjacent text SHALL read `REC` in `var(--mr-rec)`

#### Scenario: Idle state shows IDLE label and inert LED

- **WHEN** `useTransport()` reports `mode === 'idle'`
- **THEN** the mode status LED SHALL NOT have `data-state` set to `rec` or `play`
- **AND** the adjacent text SHALL read `IDLE`
- **AND** the LED SHALL NOT animate

#### Scenario: MIDI IN LED lights when MIDI is flowing

- **WHEN** `useStatusbar()` returns `active: true`
- **THEN** the MIDI IN LED SHALL have `data-state="midi"`
- **AND** its computed `animation-name` SHALL be `mrLed`
- **AND** the adjacent text SHALL read `MIDI IN`

#### Scenario: MIDI IN LED goes dim when no MIDI is flowing

- **WHEN** `useStatusbar()` returns `active: false`
- **THEN** the MIDI IN LED SHALL NOT have a `data-state` attribute
- **AND** the LED SHALL NOT animate
- **AND** the adjacent `MIDI IN` text SHALL still render

#### Scenario: Beat LED is dim when no clock is present

- **WHEN** `useMidiClock().present === false`
- **THEN** the beat LED SHALL NOT carry a `data-state` attribute
- **AND** the LED SHALL NOT carry the `is-pulse` class
- **AND** the LED SHALL NOT animate via any CSS keyframe

#### Scenario: Beat LED lights when clock is present

- **WHEN** `useMidiClock().present === true`
- **THEN** the beat LED SHALL carry `data-state="beat"`

#### Scenario: Beat LED pulses on each beat increment

- **GIVEN** `useMidiClock().present === true` and `useMidiClock().beat` has just incremented from N to N+1
- **THEN** the beat LED SHALL carry the `is-pulse` class
- **AND** approximately 80 ms after the increment, the `is-pulse` class SHALL be removed
- **WHEN** `useMidiClock().beat` increments again to N+2
- **THEN** the `is-pulse` class SHALL be re-applied for another 80 ms window

#### Scenario: Beat LED cadence tracks incoming clock, not CSS

- **GIVEN** the active master sends 24-pulse beats at irregular intervals (e.g., 480 ms, then 520 ms, then 460 ms)
- **THEN** the beat LED's `is-pulse` flashes SHALL occur at those same irregular intervals (one flash per beat increment), NOT at a constant CSS-driven cadence

### Requirement: Play button toggles between play and pause icons

The play button SHALL render the `play` icon when `playing === false` and the `pause` icon when `playing === true`. While playing, it SHALL carry `data-on="true"` to receive the accent-soft background and accent text color from the prototype's `.mr-tbtn[data-on="true"]` rule.

#### Scenario: Playing state shows pause icon

- **WHEN** `useTransport()` reports `playing: true`
- **THEN** the play button SHALL contain the pause SVG
- **AND** SHALL have `data-on="true"`
- **AND** its computed `background-color` SHALL match `var(--mr-accent-soft)`

#### Scenario: Idle state shows play icon

- **WHEN** `useTransport()` reports `playing: false`
- **THEN** the play button SHALL contain the play SVG
- **AND** SHALL NOT have `data-on="true"`

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

### Requirement: Record button disabled when input or channel is missing

The record button in the Titlebar transport group SHALL be `disabled` only when `useMidiInputs().inputs.length === 0` (no MIDI input device available — runtime ungranted, unsupported, or zero connected inputs).

When disabled, the button's tooltip SHALL read `No MIDI input available`.

When enabled, clicking SHALL dispatch `record()` as today; the `mrPulse` animation engages while recording, and the timecode color flips to `var(--mr-rec)`.

#### Scenario: No input available disables the record button with tooltip

- **WHEN** `useMidiInputs().inputs.length === 0`
- **THEN** the record button SHALL carry the `disabled` attribute
- **AND** its tooltip / `title` SHALL read `No MIDI input available`
- **AND** clicking it SHALL NOT dispatch `record()`

#### Scenario: Input available enables record without channel selection

- **WHEN** `useMidiInputs().inputs.length > 0` AND `useStage().selectedChannelId === null`
- **THEN** the record button SHALL NOT carry `disabled`
- **AND** clicking it SHALL dispatch `record()` (transitioning `mode` to `'record'`)

#### Scenario: Input available with selected channel still enables record

- **WHEN** `useMidiInputs().inputs.length > 0` AND `useStage().selectedChannelId !== null`
- **THEN** the record button SHALL NOT carry `disabled`

### Requirement: Transport stylesheet ports prototype rules

The Titlebar component SHALL ship a stylesheet containing the rules from `design_handoff_midi_recorder/prototype/app.css` for `.mr-transport`, `.mr-brand`, `.mr-brand__mark`, `.mr-brand__name`, `.mr-brand__ver`, `.mr-tgroup`, `.mr-tbtn` (with all `[data-on]`, `[data-rec]`, `:hover`, `:active` variants), `.mr-timecode`, `.mr-timecode__big`, `.mr-meta-row`, `.mr-meta`, `.mr-meta__lbl`, `.mr-meta__val`, `.mr-spacer`, `.mr-status`, `.mr-led` (with all `data-state` variants), `.mr-quant`, plus the `@keyframes mrPulse` and `@keyframes mrLed` definitions. All visual values SHALL resolve through `var(--mr-*)` tokens; one documented exception is the `.mr-transport` background, which the prototype defines with two hex literals — the codebase SHALL substitute a flat `var(--mr-bg-panel)` until tokens for the gradient are added upstream.

#### Scenario: Animations resolve

- **WHEN** the rendered DOM is inspected
- **THEN** the document SHALL define `@keyframes mrPulse` and `@keyframes mrLed`
- **AND** an element with `[data-rec="true"][data-on="true"]` SHALL have `animation-name: mrPulse`

#### Scenario: No new hex literals

- **WHEN** any new CSS file added by this change is grepped for `#[0-9a-fA-F]{3,8}` outside `tokens.css`
- **THEN** the search SHALL return zero matches
- **AND** the only documented deviation from the prototype's hex literals (the titlebar gradient) SHALL be a flat `var(--mr-bg-panel)` substitution

### Requirement: Clk cell is a clickable picker for the MIDI clock source

The `Clk` meta cell in the meta row SHALL render as a `<button type="button">` (replacing the prior plain `<span>` for the value). Clicking the button SHALL toggle a dropdown menu rendered immediately below the cell, listing — in this order — `Auto`, `Internal`, one row per connected `MIDIInput` (label = `MidiDevice.name`, value passed to `setSelection` = `MidiDevice.id`), and finally a **Strict Start toggle row** (always last, see below).

The currently-selected row (matched against `useMidiClock().selection`) SHALL render with `data-on="true"` and `aria-selected="true"`, reusing the styling of the existing `.mr-quant__menu-row[data-on='true']` rule (accent-soft background + accent text). Clicking a selection row SHALL invoke `useMidiClock().setSelection(<value>)` and close the menu. Clicking outside the menu or pressing Escape SHALL close the menu without changing selection.

When `useMidiInputs().inputs.length === 0`, the menu SHALL still render the `Auto`, `Internal`, and `Strict Start` rows; no device rows are added.

The Clk cell's visible value text SHALL continue to render the 3-letter code derived from `useTransport().clockSource` (`Int` / `Ext` / `MTC`) — the cell shows the ACTUAL clock state, not the user's selection. The selection is only visible by opening the menu.

The button SHALL carry `aria-haspopup="listbox"` and `aria-expanded={menuOpen}` for accessibility. The menu's root element SHALL carry `role="listbox"`; each selection row SHALL carry `role="option"`.

**Strict Start row.** The last row of the Clk menu SHALL be visually separated from the rows above by a 1px `var(--mr-line-1)` divider. It SHALL contain:

- A left label `Strict Start` (mono, `var(--mr-text-1)`, `var(--mr-fs-11)`) with a sublabel beneath it reading `rewind to 0 on incoming Start` (mono, `var(--mr-fs-11)`, color `var(--mr-text-3)`).
- A right-aligned mini-rocker styled as a `role="switch"` toggle with `aria-checked={useMidiClock().strictStart}`.

Clicking anywhere on the Strict Start row (or directly on its rocker) SHALL invoke `useMidiClock().setStrictStart(!useMidiClock().strictStart)`. The menu SHALL remain open after this click (unlike the selection rows). The row SHALL render with `data-on="true"` when `useMidiClock().strictStart === true`.

#### Scenario: Clk cell is rendered as a clickable button

- **WHEN** the Titlebar is rendered
- **THEN** the `Clk` meta cell SHALL contain a `<button>` element with `type="button"`, `aria-haspopup="listbox"`, and `aria-expanded="false"` initially
- **AND** the button's visible text SHALL include the 3-letter code from `useTransport().clockSource`

#### Scenario: Clicking the Clk cell opens the menu with Auto, Internal, devices, and Strict Start

- **GIVEN** `useMidiInputs().inputs` returns two devices `{ id: 'a', name: 'Korg' }` and `{ id: 'b', name: 'MicroFreak' }`
- **WHEN** the user clicks the Clk button
- **THEN** a `[role="listbox"]` SHALL be rendered
- **AND** it SHALL contain (in DOM order) the selection rows `Auto`, `Internal`, `Korg`, `MicroFreak`, followed by the Strict Start row (`role="switch"`)
- **AND** the Clk button's `aria-expanded` SHALL be `"true"`

#### Scenario: Selected row reflects current selection

- **GIVEN** `useMidiClock().selection === 'auto'` and the menu is open
- **THEN** the `Auto` row SHALL carry `data-on="true"` and `aria-selected="true"`
- **AND** no other selection row SHALL carry `data-on="true"`
- **WHEN** `setSelection('internal')` is invoked and the menu reopens
- **THEN** only the `Internal` row SHALL carry `data-on="true"`

#### Scenario: Clicking a row invokes setSelection and closes the menu

- **GIVEN** the menu is open and `useMidiClock().selection === 'auto'`
- **WHEN** the user clicks the `Internal` row
- **THEN** `useMidiClock().setSelection('internal')` SHALL have been invoked exactly once
- **AND** the menu SHALL be closed (no `[role="listbox"]` in the DOM)
- **AND** `useTransport().clockSource` SHALL be `'internal'`

#### Scenario: Clicking a device row passes the device id to setSelection

- **GIVEN** the menu is open and the row for device `{ id: 'b', name: 'MicroFreak' }` is visible
- **WHEN** the user clicks the `MicroFreak` row
- **THEN** `useMidiClock().setSelection('b')` SHALL have been invoked exactly once

#### Scenario: Outside click and Escape close the menu without changing selection

- **GIVEN** the menu is open and `useMidiClock().selection === 'auto'`
- **WHEN** the user clicks anywhere outside the menu
- **THEN** the menu SHALL be closed
- **AND** `useMidiClock().selection` SHALL remain `'auto'`
- **WHEN** the user reopens the menu and presses Escape
- **THEN** the menu SHALL close and `selection` SHALL remain unchanged

#### Scenario: Menu still renders Auto, Internal, Strict Start when no devices are connected

- **GIVEN** `useMidiInputs().inputs.length === 0`
- **WHEN** the user clicks the Clk button
- **THEN** the menu SHALL render exactly three rows: `Auto`, `Internal`, and the `Strict Start` toggle

#### Scenario: Strict Start row reflects state

- **GIVEN** `useMidiClock().strictStart === false`
- **WHEN** the Clk menu is opened
- **THEN** the Strict Start row's rocker SHALL have `aria-checked="false"`
- **AND** the row SHALL NOT carry `data-on="true"`
- **WHEN** `setStrictStart(true)` is invoked and the menu remains open
- **THEN** the Strict Start row's rocker SHALL have `aria-checked="true"`
- **AND** the row SHALL carry `data-on="true"`

#### Scenario: Clicking Strict Start row toggles strictStart and keeps menu open

- **GIVEN** the Clk menu is open and `useMidiClock().strictStart === false`
- **WHEN** the user clicks the Strict Start row
- **THEN** `useMidiClock().setStrictStart(true)` SHALL have been invoked exactly once
- **AND** the menu SHALL still be open (Clk listbox still in DOM)
- **WHEN** the user clicks the row again
- **THEN** `setStrictStart(false)` SHALL have been invoked exactly once
- **AND** the menu SHALL still be open

### Requirement: useTransport exposes cuePointTicks state

`useTransport()` SHALL expose `cuePointTicks: number` on its returned value. The initial value SHALL be `0` at hook initialization (a "cue at start of timeline" default). The field SHALL be present alongside `timecodeMs` and `playheadTicks` on the `TransportState` interface. `cuePointTicks` SHALL persist across reloads via the `transport-authoring` hydrate slice (see "useTransport.hydrate resets runtime fields and writes cuePointTicks" below).

#### Scenario: Default cuePointTicks is 0

- **WHEN** the `TransportProvider` mounts for the first time
- **THEN** `useTransport().cuePointTicks` SHALL be `0`

#### Scenario: cuePointTicks is independent of timecode

- **GIVEN** `useTransport().cuePointTicks === 0` and `useTransport().playheadTicks === 1920`
- **WHEN** the user dispatches `seek(2000)` (which moves the playhead)
- **THEN** `useTransport().cuePointTicks` SHALL still be `0` (seek does not change the cue point)

### Requirement: useTransport exposes a rewind action

`useTransport()` SHALL expose `rewind(): void`. Calling `rewind()` SHALL be equivalent in effect to calling `seek(0)`: `timecodeMs` becomes `0` and `playheadTicks` becomes `0`. `mode`, `bpm`, `clockSource`, `recordingStartedAt`, and `cuePointTicks` SHALL be unchanged.

#### Scenario: Rewind from idle resets position only

- **GIVEN** `mode === 'idle'`, `timecodeMs === 5000`, `playheadTicks === 9600`, `recordingStartedAt === null`, `cuePointTicks === 480`
- **WHEN** the user calls `useTransport().rewind()`
- **THEN** `timecodeMs` SHALL be `0`
- **AND** `playheadTicks` SHALL be `0`
- **AND** `mode` SHALL be `'idle'`
- **AND** `cuePointTicks` SHALL still be `480`

#### Scenario: Rewind during play preserves mode

- **GIVEN** `mode === 'play'` and `playheadTicks === 5000`
- **WHEN** the user calls `useTransport().rewind()`
- **THEN** `mode` SHALL still be `'play'`
- **AND** `playheadTicks` SHALL be `0`
- **AND** subsequent rAF ticks (internal clock) SHALL advance `playheadTicks` from `0` forward

#### Scenario: Rewind during record preserves mode and recording session

- **GIVEN** `mode === 'record'`, `playheadTicks === 5000`, and `recordingStartedAt === 12345`
- **WHEN** the user calls `useTransport().rewind()`
- **THEN** `mode` SHALL still be `'record'`
- **AND** `playheadTicks` SHALL be `0`
- **AND** `recordingStartedAt` SHALL still be `12345`

### Requirement: useTransport exposes a cue action with mode-dependent behavior

`useTransport()` SHALL expose `cue(): void`. The reducer SHALL branch on `mode`:

- When `mode === 'idle'`, calling `cue()` SHALL set `cuePointTicks` to the current `playheadTicks`. No other field SHALL change.
- When `mode === 'play'` or `mode === 'record'`, calling `cue()` SHALL set `mode` to `'idle'`, SHALL set `playheadTicks` to `cuePointTicks`, SHALL set `timecodeMs` to the millisecond equivalent of `cuePointTicks` at the current `bpm`, and SHALL set `recordingStartedAt` to `null`. `cuePointTicks` itself SHALL be unchanged.

The millisecond equivalent of a tick count `t` at BPM `b` SHALL be computed as `(t / DEFAULT_MIDI_TPQ) * (60 / b) * 1000`.

#### Scenario: Cue while idle stores current position

- **GIVEN** `mode === 'idle'`, `playheadTicks === 1920`, `cuePointTicks === 0`
- **WHEN** the user calls `useTransport().cue()`
- **THEN** `cuePointTicks` SHALL be `1920`
- **AND** `playheadTicks` SHALL still be `1920`
- **AND** `mode` SHALL still be `'idle'`

#### Scenario: Cue while playing stops and jumps to cue point

- **GIVEN** `mode === 'play'`, `playheadTicks === 5000`, `cuePointTicks === 1920`, `bpm === 120`
- **WHEN** the user calls `useTransport().cue()`
- **THEN** `mode` SHALL be `'idle'`
- **AND** `playheadTicks` SHALL be `1920`
- **AND** `timecodeMs` SHALL be approximately `2000` (±0.1 ms; one bar at 120 BPM = 2000 ms for `cuePointTicks === 1920` with `DEFAULT_MIDI_TPQ === 480`)
- **AND** `cuePointTicks` SHALL still be `1920`

#### Scenario: Cue while recording stops, jumps, and clears the take

- **GIVEN** `mode === 'record'`, `playheadTicks === 5000`, `cuePointTicks === 1920`, `recordingStartedAt === 12345`
- **WHEN** the user calls `useTransport().cue()`
- **THEN** `mode` SHALL be `'idle'`
- **AND** `playheadTicks` SHALL be `1920`
- **AND** `recordingStartedAt` SHALL be `null`

#### Scenario: Cue from idle does not modify cuePointTicks of an empty session

- **GIVEN** a freshly mounted provider where `playheadTicks === 0` and `cuePointTicks === 0`
- **WHEN** the user calls `useTransport().cue()`
- **THEN** `cuePointTicks` SHALL still be `0` (set to the current playhead, which is `0`)

### Requirement: pause preserves recordingStartedAt to support resume-from-record

`useTransport().pause()` SHALL set `mode` to `'idle'` and SHALL NOT modify `recordingStartedAt`, `timecodeMs`, `playheadTicks`, or any other field. In particular, when invoked while `mode === 'record'`, the existing `recordingStartedAt` SHALL be preserved so the take session can be resumed.

#### Scenario: Pause from play preserves all other fields

- **GIVEN** `mode === 'play'`, `recordingStartedAt === null`, `timecodeMs === 5000`, `playheadTicks === 9600`
- **WHEN** the user calls `useTransport().pause()`
- **THEN** `mode` SHALL be `'idle'`
- **AND** `recordingStartedAt` SHALL still be `null`
- **AND** `timecodeMs` SHALL still be `5000`
- **AND** `playheadTicks` SHALL still be `9600`

#### Scenario: Pause from record preserves the take handle

- **GIVEN** `mode === 'record'` and `recordingStartedAt === 12345`
- **WHEN** the user calls `useTransport().pause()`
- **THEN** `mode` SHALL be `'idle'`
- **AND** `recordingStartedAt` SHALL still be `12345`

### Requirement: record action treats idle entry as resume when recordingStartedAt is set

`useTransport().record()` SHALL behave according to the current `mode` and `recordingStartedAt`:

- `mode === 'idle'` and `recordingStartedAt === null` (fresh take): `mode` SHALL become `'record'`, `timecodeMs` SHALL be set to `0`, `playheadTicks` SHALL be set to `0`, and `recordingStartedAt` SHALL be set to `performance.now()`.
- `mode === 'idle'` and `recordingStartedAt !== null` (resume): `mode` SHALL become `'record'`, `timecodeMs` and `playheadTicks` SHALL be unchanged, and `recordingStartedAt` SHALL be unchanged.
- `mode === 'play'`: `mode` SHALL become `'record'`, `timecodeMs` and `playheadTicks` SHALL be unchanged, and `recordingStartedAt` SHALL be set to `performance.now()` (a play-to-record transition starts a new take at the current position).
- `mode === 'record'`: state SHALL be unchanged (the action is a no-op).

#### Scenario: Fresh take from idle resets position

- **GIVEN** `mode === 'idle'`, `recordingStartedAt === null`, `playheadTicks === 5000`
- **WHEN** the user calls `useTransport().record()`
- **THEN** `mode` SHALL be `'record'`
- **AND** `timecodeMs` SHALL be `0`
- **AND** `playheadTicks` SHALL be `0`
- **AND** `recordingStartedAt` SHALL be a positive number (the current `performance.now()`)

#### Scenario: Resume take after pause preserves position and take handle

- **GIVEN** `mode === 'idle'`, `recordingStartedAt === 12345`, `playheadTicks === 5000` (the post-pause-from-record state)
- **WHEN** the user calls `useTransport().record()`
- **THEN** `mode` SHALL be `'record'`
- **AND** `playheadTicks` SHALL still be `5000`
- **AND** `recordingStartedAt` SHALL still be `12345`

#### Scenario: Play-to-record stamps a new take at current position

- **GIVEN** `mode === 'play'`, `recordingStartedAt === null`, `playheadTicks === 5000`
- **WHEN** the user calls `useTransport().record()`
- **THEN** `mode` SHALL be `'record'`
- **AND** `playheadTicks` SHALL still be `5000`
- **AND** `recordingStartedAt` SHALL be a positive number (the current `performance.now()`)

### Requirement: useTransport does not expose a stop action

The `useTransport()` value SHALL NOT include a `stop` property. The 'stop' action type SHALL NOT appear in the reducer's Action union. Callers that previously dispatched `stop()` SHALL use one of the following replacements, depending on intent:

- **Temporary halt that preserves the take:** `pause()`. Mode → `'idle'`; `recordingStartedAt`, `timecodeMs`, `playheadTicks`, and `cuePointTicks` are preserved.
- **Terminal halt that jumps to the cue point:** `cue()` from a non-idle mode. Mode → `'idle'`; playhead snaps to `cuePointTicks`; `recordingStartedAt` is cleared.
- **Swap to a different session:** `hydrate(slice)`. Atomically resets `mode` to `'idle'`, `timecodeMs` to `0`, `playheadTicks` to `0`, and `recordingStartedAt` to `null`, then writes the authoring slice (including `cuePointTicks`).
- **Pre-serialize flush during save (commit buffered recorder events without losing position):** `pause()`.

#### Scenario: stop is undefined on the transport value

- **WHEN** the `TransportProvider` mounts
- **THEN** the value returned by `useTransport()` SHALL NOT have a `stop` property
- **AND** a dispatch of `{ type: 'stop' }` SHALL be untyped at the TypeScript level (the Action union no longer includes it)

### Requirement: useTransport.hydrate resets runtime fields and writes cuePointTicks

`useTransport().hydrate(slice)` SHALL atomically (in the same reducer dispatch) perform both of the following:

1. Write the authoring slice. The `TransportAuthoringHydrateSlice` SHALL include the fields `{ bpm, sig, quantizeOn, quantizeGrid, snapAbsoluteOn, looping, metronomeOn, clockSource, cuePointTicks }`. Each field in the slice SHALL overwrite the corresponding `TransportState` field.
2. Reset the transport runtime: `mode` SHALL become `'idle'`, `timecodeMs` SHALL become `0`, `playheadTicks` SHALL become `0`, and `recordingStartedAt` SHALL become `null`. The `userBpm` SHALL mirror the new `bpm` so a subsequent revert-to-internal restores the loaded BPM.

This consolidates session-swap semantics into a single action: callers that previously dispatched `stop()` before `hydrate()` (the four call sites in `useTimelineStorage`) SHALL drop the `stop()` call and rely on `hydrate`'s atomic reset.

#### Scenario: Hydrate writes the authoring slice including cuePointTicks

- **GIVEN** `TransportProvider` is mounted at default state
- **WHEN** `hydrate({ bpm: 140, sig: '7/8', quantizeOn: false, quantizeGrid: '1/8', snapAbsoluteOn: true, looping: true, metronomeOn: false, clockSource: 'external-clock', cuePointTicks: 1920 })` is dispatched
- **THEN** `useTransport().bpm` SHALL be `140`
- **AND** `useTransport().sig` SHALL be `'7/8'`
- **AND** `useTransport().cuePointTicks` SHALL be `1920`
- **AND** `useTransport().clockSource` SHALL be `'external-clock'`

#### Scenario: Hydrate resets runtime fields atomically

- **GIVEN** `mode === 'record'`, `timecodeMs === 5000`, `playheadTicks === 9600`, `recordingStartedAt === 12345`
- **WHEN** `hydrate(emptyTransportAuthoringSlice)` is dispatched (where `emptyTransportAuthoringSlice.cuePointTicks === 0`)
- **THEN** `useTransport().mode` SHALL be `'idle'`
- **AND** `useTransport().timecodeMs` SHALL be `0`
- **AND** `useTransport().playheadTicks` SHALL be `0`
- **AND** `useTransport().recordingStartedAt` SHALL be `null`
- **AND** `useTransport().cuePointTicks` SHALL be `0`

### Requirement: Titlebar Rewind button is wired to useTransport.rewind

The Rewind button (leftmost of the five transport-group-A buttons) SHALL invoke `useTransport().rewind()` on `onClick`. The button SHALL render the `RewIcon` and carry `aria-label="Rewind"` and a `title` describing the action (e.g. `"Rewind to start"`). The button SHALL be enabled in every transport mode.

#### Scenario: Click invokes rewind

- **GIVEN** the Titlebar is rendered in any mode
- **WHEN** the user clicks the Rewind button
- **THEN** `useTransport().rewind()` SHALL be invoked exactly once
- **AND** the observable transport state SHALL reflect `playheadTicks === 0` and `timecodeMs === 0` after the click

#### Scenario: Rewind button is always enabled

- **GIVEN** the Titlebar is rendered in `mode === 'idle'`, `'play'`, or `'record'`
- **THEN** the Rewind button SHALL NOT carry the `disabled` attribute

### Requirement: Titlebar Cue button is wired to useTransport.cue

The Cue button (third of the five transport-group-A buttons, between Play-Pause and Record) SHALL invoke `useTransport().cue()` on `onClick`. The button SHALL display the literal text `CUE` (rendered with the small-uppercase-mono `.mr-tbtn__text` styling) rather than an SVG icon, and SHALL carry `aria-label="Cue"`. The `title` SHALL describe the dual behavior (e.g. `"Set cue point / Stop and return to cue"`). The button SHALL be enabled in every transport mode.

#### Scenario: Click while idle sets the cue point

- **GIVEN** `mode === 'idle'` and `playheadTicks === 1920`
- **WHEN** the user clicks the Cue button
- **THEN** `useTransport().cuePointTicks` SHALL be `1920`
- **AND** `mode` SHALL still be `'idle'`

#### Scenario: Click while playing stops and jumps to cue

- **GIVEN** `mode === 'play'`, `playheadTicks === 5000`, `cuePointTicks === 1920`
- **WHEN** the user clicks the Cue button
- **THEN** `mode` SHALL be `'idle'`
- **AND** `playheadTicks` SHALL be `1920`

### Requirement: Titlebar Play-Pause button resumes recording when a take is paused

The Titlebar's Play-Pause button click handler SHALL examine `useTransport().recordingStartedAt` when deciding what action to dispatch from a non-playing state:

- If `playing === true` (mode is `'play'` or `'record'`), the handler SHALL call `useTransport().pause()`.
- Else if `recordingStartedAt !== null` (a take is paused), the handler SHALL call `useTransport().record()` to resume the take.
- Else, the handler SHALL call `useTransport().play()` for fresh playback.

The button's visible icon SHALL continue to be the pause icon whenever `playing === true` (covering both `'play'` and `'record'` modes, matching today's behavior).

#### Scenario: Click while paused-from-play starts fresh play

- **GIVEN** `mode === 'idle'`, `recordingStartedAt === null` (post-pause-from-play state)
- **WHEN** the user clicks the Play-Pause button
- **THEN** `useTransport().play()` SHALL be invoked exactly once
- **AND** `useTransport().record()` SHALL NOT be invoked

#### Scenario: Click while paused-from-record resumes recording

- **GIVEN** `mode === 'idle'`, `recordingStartedAt === 12345` (post-pause-from-record state)
- **WHEN** the user clicks the Play-Pause button
- **THEN** `useTransport().record()` SHALL be invoked exactly once
- **AND** `useTransport().play()` SHALL NOT be invoked

#### Scenario: Click while recording pauses the take

- **GIVEN** `mode === 'record'`
- **WHEN** the user clicks the Play-Pause button
- **THEN** `useTransport().pause()` SHALL be invoked exactly once
- **AND** `recordingStartedAt` SHALL still equal its pre-click value after the call resolves

### Requirement: Snd cell is a clickable picker for MIDI clock send outputs

The titlebar's meta row SHALL render an additional `Snd` meta cell **immediately to the right of the existing `Clk` cell** and before the existing `Sig` cell. The cell SHALL follow the same `.mr-meta` / `.mr-meta__lbl` / `.mr-meta__val--btn` structural pattern used by the Clk cell.

The visible value text SHALL reflect `useMidiClockSend()`:

- `enabled === false` → text `Off` rendered in `var(--mr-text-3)`
- `enabled === true` AND `selectedOutputIds.size === 0` → text `No outs` rendered in `var(--mr-rec)` (config error)
- `enabled === true` AND `selectedOutputIds.size === 1` → the connected output's `MidiDevice.name`, truncated to 12 characters with ellipsis, rendered in `var(--mr-text-1)`
- `enabled === true` AND `selectedOutputIds.size >= 2` → text `<n> outs` rendered in `var(--mr-text-1)`

An LED dot element matching `.mr-led[data-state='tx']` SHALL render immediately to the right of the button, inside the same `.mr-meta--snd` container. While `enabled === true`, the LED SHALL briefly opacity-pulse each time `useMidiClockSend().txPulse` advances; while `enabled === false` OR no pulse has been observed in the last 500 ms, the LED SHALL render with the dim base color (`var(--mr-text-4)`).

Clicking the button SHALL toggle a dropdown menu rendered immediately below the cell. The button SHALL carry `aria-haspopup="listbox"` and `aria-expanded={menuOpen}`; the menu's root element SHALL carry `role="listbox"`. The menu SHALL contain, in this DOM order:

1. A single `role="switch"` row labelled `Enable send`. Clicking it SHALL invoke `useMidiClockSend().setEnabled(!enabled)`. The row SHALL carry `aria-checked={enabled}`. When `enabled === true` the row SHALL render with `data-on="true"`.
2. One `role="option"` row per `useMidiOutputs().outputs` entry. The row SHALL render `[checkbox-glyph] [device name]`, where the checkbox glyph reflects `selectedOutputIds.has(device.id)`. The row SHALL carry `aria-checked` and `data-on` set to that boolean. Clicking the row SHALL invoke `useMidiClockSend().toggleOutput(device.id)` and SHALL NOT close the menu.
3. A footer row containing two ghost buttons, `Select all` and `Clear`. Clicking `Select all` SHALL invoke `setSelectedOutputs(outputs.map(o => o.id))`. Clicking `Clear` SHALL invoke `setSelectedOutputs([])`. Neither click SHALL close the menu.

Clicking the menu trigger again, clicking outside the menu, or pressing Escape SHALL close the menu without changing any state. When `useMidiOutputs().outputs.length === 0`, the menu SHALL still render the Enable row and the footer (with the footer buttons disabled), but no per-output rows.

#### Scenario: Snd cell is rendered as a clickable button

- **WHEN** the Titlebar is rendered
- **THEN** the `Snd` meta cell SHALL exist immediately to the right of the `Clk` meta cell in DOM order
- **AND** the cell SHALL contain a `<button>` element with `type="button"`, `aria-haspopup="listbox"`, and `aria-expanded="false"` initially
- **AND** the cell SHALL contain a `.mr-led[data-state='tx']` element

#### Scenario: Off state text

- **GIVEN** `useMidiClockSend().enabled === false`
- **THEN** the Snd button's visible text SHALL be `Off`

#### Scenario: No-outs error state

- **GIVEN** `useMidiClockSend().enabled === true` and `selectedOutputIds.size === 0`
- **THEN** the Snd button's visible text SHALL be `No outs`
- **AND** its computed color SHALL match the value of `--mr-rec`

#### Scenario: Multi-output count state

- **GIVEN** `useMidiClockSend().enabled === true` and `selectedOutputIds.size === 3` (with all three connected)
- **THEN** the Snd button's visible text SHALL be `3 outs`

#### Scenario: Single-output name state

- **GIVEN** `useMidiClockSend().enabled === true`, `selectedOutputIds === Set(['out-a'])`, and `outputs` contains `{ id: 'out-a', name: 'IAC Driver — Bus 1' }`
- **THEN** the Snd button's visible text SHALL be the device name truncated to at most 12 characters with ellipsis (e.g. `IAC Driver …`)

#### Scenario: Clicking the button opens the menu with Enable, outputs, footer

- **GIVEN** `useMidiOutputs().outputs` returns two devices `{ id: 'a', name: 'IAC' }` and `{ id: 'b', name: 'USB MIDI' }`
- **WHEN** the user clicks the Snd button
- **THEN** a `[role="listbox"]` SHALL render
- **AND** it SHALL contain (in DOM order): one `[role="switch"]` `Enable send` row, two `[role="option"]` device rows labelled `IAC` and `USB MIDI`, and a footer with `Select all` and `Clear` buttons
- **AND** the Snd button's `aria-expanded` SHALL be `"true"`

#### Scenario: Clicking Enable row toggles enabled

- **GIVEN** the menu is open and `useMidiClockSend().enabled === false`
- **WHEN** the user clicks the `Enable send` row
- **THEN** `setEnabled(true)` SHALL have been invoked exactly once
- **AND** the menu SHALL remain open

#### Scenario: Clicking a device row toggles its membership and keeps the menu open

- **GIVEN** the menu is open, `useMidiClockSend().selectedOutputIds === Set()`, and a device row for `out-a` is visible
- **WHEN** the user clicks the `out-a` row
- **THEN** `toggleOutput('out-a')` SHALL have been invoked exactly once
- **AND** the menu SHALL still be open
- **AND** the row's `aria-checked` SHALL update to `"true"` on the next render

#### Scenario: Select all and Clear footer buttons

- **GIVEN** the menu is open with three device rows for ids `a`, `b`, `c`
- **WHEN** the user clicks `Select all`
- **THEN** `setSelectedOutputs(['a', 'b', 'c'])` SHALL have been invoked exactly once
- **WHEN** the user then clicks `Clear`
- **THEN** `setSelectedOutputs([])` SHALL have been invoked exactly once

#### Scenario: Outside click and Escape close the menu without changing state

- **GIVEN** the menu is open and `useMidiClockSend().enabled === true`
- **WHEN** the user clicks anywhere outside the menu
- **THEN** the menu SHALL be closed
- **AND** `useMidiClockSend().enabled` SHALL remain `true`
- **WHEN** the user reopens the menu and presses Escape
- **THEN** the menu SHALL close and `enabled` SHALL remain unchanged

#### Scenario: Menu still renders Enable and footer when no outputs are connected

- **GIVEN** `useMidiOutputs().outputs.length === 0`
- **WHEN** the user clicks the Snd button
- **THEN** the menu SHALL render the `Enable send` row and the footer
- **AND** the footer's `Select all` and `Clear` buttons SHALL be disabled (`disabled` attribute present)
- **AND** no `[role="option"]` rows SHALL appear

### Requirement: TX LED in Snd cell pulses per emitted clock

The `.mr-led[data-state='tx']` element inside `.mr-meta--snd` SHALL render a brief opacity pulse (0.4 → 1.0 → 0.4 over 80 ms) each time `useMidiClockSend().txPulse` advances, achieved by toggling a CSS class via a `key`-reset trick or `useEffect` on the counter value.

When `useMidiClockSend().enabled === false`, the LED SHALL render with the base `var(--mr-text-4)` color and SHALL NOT pulse. When `enabled === true` but no pulse has been observed in the last 500 ms (e.g. `useTransport().mode === 'idle'` with internal clock and a sender that emits continuously — vacuously this case does not arise — OR external mode with a silent master), the LED SHALL also render with the dim base color.

The LED SHALL carry `aria-hidden="true"`. Status is also announced in the button text (`Off`, `No outs`, `<name>`, `<n> outs`).

#### Scenario: LED pulses when txPulse advances

- **GIVEN** `enabled === true` and the LED's class list contains no pulse class
- **WHEN** `useMidiClockSend().txPulse` advances by 1
- **THEN** within one animation frame the LED SHALL have a pulse class applied
- **AND** within 100 ms the pulse class SHALL be removed (animation ended)

#### Scenario: LED is dim when disabled

- **GIVEN** `enabled === false`
- **WHEN** the LED is rendered
- **THEN** its computed `background-color` SHALL match `var(--mr-text-4)`
- **AND** no pulse class SHALL be applied even if `txPulse` advances (which it should not, per the sender requirement)

#### Scenario: LED is accessibility-hidden

- **WHEN** the Snd LED is rendered
- **THEN** it SHALL carry `aria-hidden="true"`

