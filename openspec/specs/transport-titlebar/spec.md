### Requirement: Titlebar renders the full transport bar

The Titlebar region SHALL render the transport bar matching `prototype/components.jsx` `Transport` and `prototype/app.css` lines ~37–215. The visible elements, in left-to-right order, SHALL be:

1. **Brand block** — 22px gradient mark + `MIDI Recorder` (display font, semibold) + version subtitle (mono, `var(--mr-text-3)`), separated by a 1px right divider.
2. **Transport group A** — six buttons in this order: rewind / cue / play (toggles to pause icon + accent state when playing) / stop / record / fast-forward.
3. **Timecode** — `MM:SS.FFF` at `var(--mr-fs-20)` size, mono, tabular-nums, with the milliseconds segment in `var(--mr-text-3)`.
4. **Meta row** — three columns each with a 9px uppercase label (`Bar`, `BPM`, `Sig`) and a mono value (`13.2.1`, `124`, `4/4`).
5. **Transport group B** — loop button + metronome button.
6. **Quantize widget** — `Q` label + power-toggle button + grid-value chip showing the current grid (e.g. `1/16`).
7. **Spacer** consuming remaining horizontal space.
8. **Status cluster** — recording/playing LED + `REC` / `PLAY` / `IDLE` text + middot + MIDI-in LED + `MIDI IN` text.

#### Scenario: All transport elements present

- **WHEN** the app is rendered
- **THEN** the Titlebar SHALL contain a `.mr-transport` element with the eight subregions above, in order
- **AND** each transport button SHALL render the corresponding inline SVG icon from the prototype's icon set

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

The Titlebar SHALL render a status LED whose `data-state` attribute reflects the transport mode: `rec` when recording, `play` when playing, `idle` otherwise. Adjacent text SHALL read `REC`, `PLAY`, or `IDLE` accordingly. The `rec` state SHALL animate via the `mrLed` keyframe (1.2s ease-in-out, opacity 1.0 ↔ 0.45). A second LED with `data-state="midi"` SHALL render to the right of the middot, labeled `MIDI IN`.

#### Scenario: Recording state lights the rec LED with mrLed animation

- **WHEN** `useTransport()` reports `recording: true`
- **THEN** the leftmost status LED SHALL have `data-state="rec"`
- **AND** its computed `animation-name` SHALL be `mrLed` with `animation-duration: 1.2s`
- **AND** the adjacent text SHALL read `REC` in `var(--mr-rec)`

#### Scenario: Idle state shows IDLE label and inert LED

- **WHEN** `useTransport()` reports `mode === 'idle'`
- **THEN** the leftmost status LED SHALL NOT have `data-state` set to `rec` or `play`
- **AND** the adjacent text SHALL read `IDLE`
- **AND** the LED SHALL NOT animate

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

- **WHEN** `useTransport()` is read on first mount
- **THEN** `loopRegion` SHALL be `null`

#### Scenario: setLoopRegion stores the region

- **WHEN** `setLoopRegion(4, 12)` is called
- **THEN** `loopRegion` SHALL equal `{ start: 4, end: 12 }`

#### Scenario: clearLoopRegion removes the region

- **WHEN** `loopRegion` is non-null and `clearLoopRegion()` is called
- **THEN** `loopRegion` SHALL be `null`

#### Scenario: setLoopRegion rejects invalid input

- **WHEN** `setLoopRegion(8, 4)` is called (end <= start)
- **THEN** either the call SHALL be a no-op
- **OR** the stored region SHALL be the swapped form `{ start: 4, end: 8 }`
- **AND** the stored region SHALL satisfy `end > start`

#### Scenario: Looping wraps the playhead at the loop end

- **WHEN** `looping === true`, `loopRegion === { start: 4, end: 8 }`, `bpm === 120`, and the playhead has just crossed beat 8 (i.e., `timecodeMs` ≈ `8 * 500 = 4000`)
- **THEN** on the next rAF tick, `timecodeMs` SHALL be set to `4 * 500 = 2000` (the ms equivalent of beat 4)

#### Scenario: Non-looping playback does not wrap

- **WHEN** `looping === false` (regardless of `loopRegion`)
- **AND** the playhead reaches any beat value
- **THEN** `timecodeMs` SHALL continue to advance without resetting at any boundary

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
