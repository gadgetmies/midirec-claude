## Purpose

Define the Titlebar/Transport bar: the recording/playback transport buttons, the timecode display, the meta-row (Bar / BPM / Clk / Sig), the loop/metronome toggles, the quantize widget, the right-edge status cluster (transport-mode LED + activity-driven MIDI IN LED), and the `useTransport` hook that backs all of them.
## Requirements
### Requirement: Titlebar renders the full transport bar

The Titlebar region SHALL render the transport bar matching `prototype/components.jsx` `Transport` and `prototype/app.css` lines ~37–215. The visible elements, in left-to-right order, SHALL be:

1. **Brand block** — 22px gradient mark + `MIDI Recorder` (display font, semibold) + version subtitle (mono, `var(--mr-text-3)`), separated by a 1px right divider.
2. **Transport group A** — six buttons in this order: rewind / cue / play (toggles to pause icon + accent state when playing) / stop / record / fast-forward.
3. **Timecode** — `MM:SS.FFF` at `var(--mr-fs-20)` size, mono, tabular-nums, with the milliseconds segment in `var(--mr-text-3)`.
4. **Meta row** — four columns each with a 9px uppercase label (`Bar`, `BPM`, `Clk`, `Sig`) and a mono value (`13.2.1`, `124`, `Int`, `4/4`). The `Clk` cell SHALL appear directly after `BPM` and before `Sig`. The `Clk` value SHALL render as a compact 3-letter code derived from `useTransport().clockSource`: `'internal'` → `Int`, `'external-clock'` → `Ext`, `'external-mtc'` → `MTC`. The `BPM` cell value SHALL render `useTransport().bpm` rounded to the nearest integer (the source of truth for `bpm` is already the transport — when external clock is active, `useTransport().bpm` mirrors the smoothed incoming BPM per the `midi-clock` capability, so no separate display branch is needed here).
5. **Transport group B** — loop button + metronome button.
6. **Quantize widget** — `Q` label + power-toggle button + grid-value chip showing the current grid (e.g. `1/16`), followed by an `A` label + power-toggle button (the Snap Absolute chip). The `A` chip SHALL sit immediately to the right of the grid-value chip and SHALL share the chip styling and click-to-toggle behavior of the `Q` chip.
7. **Spacer** consuming remaining horizontal space.
8. **Status cluster** — beat LED + middot + recording/playing LED + `REC` / `PLAY` / `IDLE` text + middot + activity-driven MIDI-in LED + `MIDI IN` text. The beat LED is the leftmost LED in the cluster; it pulses on each incoming clock beat (see the dedicated requirement below).

#### Scenario: All transport elements present

- **WHEN** the app is rendered
- **THEN** the Titlebar SHALL contain a `.mr-transport` element with the eight subregions above, in order
- **AND** each transport button SHALL render the corresponding inline SVG icon from the prototype's icon set
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

The `Clk` meta cell in the meta row SHALL render as a `<button type="button">` (replacing the prior plain `<span>` for the value). Clicking the button SHALL toggle a dropdown menu rendered immediately below the cell, listing — in this order — `Auto`, `Internal`, and one row per connected `MIDIInput` (label = `MidiDevice.name`, value passed to `setSelection` = `MidiDevice.id`).

The currently-selected row (matched against `useMidiClock().selection`) SHALL render with `data-on="true"` and `aria-selected="true"`, reusing the styling of the existing `.mr-quant__menu-row[data-on='true']` rule (accent-soft background + accent text). Clicking a row SHALL invoke `useMidiClock().setSelection(<value>)` and close the menu. Clicking outside the menu or pressing Escape SHALL close the menu without changing selection.

When `useMidiInputs().inputs.length === 0`, the menu SHALL still render the `Auto` and `Internal` rows; no device rows are added.

The Clk cell's visible value text SHALL continue to render the 3-letter code derived from `useTransport().clockSource` (`Int` / `Ext` / `MTC`) — the cell shows the ACTUAL clock state, not the user's selection. The selection is only visible by opening the menu.

The button SHALL carry `aria-haspopup="listbox"` and `aria-expanded={menuOpen}` for accessibility. The menu's root element SHALL carry `role="listbox"`; each row SHALL carry `role="option"`.

#### Scenario: Clk cell is rendered as a clickable button

- **WHEN** the Titlebar is rendered
- **THEN** the `Clk` meta cell SHALL contain a `<button>` element with `type="button"`, `aria-haspopup="listbox"`, and `aria-expanded="false"` initially
- **AND** the button's visible text SHALL include the 3-letter code from `useTransport().clockSource`

#### Scenario: Clicking the Clk cell opens the menu with Auto, Internal, and each device

- **GIVEN** `useMidiInputs().inputs` returns two devices `{ id: 'a', name: 'Korg' }` and `{ id: 'b', name: 'MicroFreak' }`
- **WHEN** the user clicks the Clk button
- **THEN** a `[role="listbox"]` SHALL be rendered
- **AND** it SHALL contain exactly four rows with labels (in DOM order) `Auto`, `Internal`, `Korg`, `MicroFreak`
- **AND** the Clk button's `aria-expanded` SHALL be `"true"`

#### Scenario: Selected row reflects current selection

- **GIVEN** `useMidiClock().selection === 'auto'` and the menu is open
- **THEN** the `Auto` row SHALL carry `data-on="true"` and `aria-selected="true"`
- **AND** no other row SHALL carry `data-on="true"`
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

#### Scenario: Menu still renders Auto and Internal when no devices are connected

- **GIVEN** `useMidiInputs().inputs.length === 0`
- **WHEN** the user clicks the Clk button
- **THEN** the menu SHALL render exactly two rows: `Auto` and `Internal`

