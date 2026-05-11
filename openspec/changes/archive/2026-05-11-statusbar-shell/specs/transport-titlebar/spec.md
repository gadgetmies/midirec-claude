## MODIFIED Requirements

### Requirement: Titlebar renders the full transport bar

The Titlebar region SHALL render the transport bar matching `prototype/components.jsx` `Transport` and `prototype/app.css` lines ~37–215. The visible elements, in left-to-right order, SHALL be:

1. **Brand block** — 22px gradient mark + `MIDI Recorder` (display font, semibold) + version subtitle (mono, `var(--mr-text-3)`), separated by a 1px right divider.
2. **Transport group A** — six buttons in this order: rewind / cue / play (toggles to pause icon + accent state when playing) / stop / record / fast-forward.
3. **Timecode** — `MM:SS.FFF` at `var(--mr-fs-20)` size, mono, tabular-nums, with the milliseconds segment in `var(--mr-text-3)`.
4. **Meta row** — four columns each with a 9px uppercase label (`Bar`, `BPM`, `Clk`, `Sig`) and a mono value (`13.2.1`, `124`, `Int`, `4/4`). The `Clk` cell SHALL appear directly after `BPM` and before `Sig`. The `Clk` value SHALL render as a compact 3-letter code derived from `useTransport().clockSource`: `'internal'` → `Int`, `'external-clock'` → `Ext`, `'external-mtc'` → `MTC`.
5. **Transport group B** — loop button + metronome button.
6. **Quantize widget** — `Q` label + power-toggle button + grid-value chip showing the current grid (e.g. `1/16`).
7. **Spacer** consuming remaining horizontal space.
8. **Status cluster** — recording/playing LED + `REC` / `PLAY` / `IDLE` text + middot + activity-driven MIDI-in LED + `MIDI IN` text.

#### Scenario: All transport elements present

- **WHEN** the app is rendered
- **THEN** the Titlebar SHALL contain a `.mr-transport` element with the eight subregions above, in order
- **AND** each transport button SHALL render the corresponding inline SVG icon from the prototype's icon set
- **AND** the meta row SHALL contain exactly four `.mr-meta` cells with labels `Bar`, `BPM`, `Clk`, `Sig` in that DOM order

#### Scenario: Clk cell shows source code from useTransport

- **WHEN** `useTransport()` reports `clockSource === 'internal'`
- **THEN** the `Clk` meta cell's value SHALL render the text `Int` in `var(--mr-font-mono)`
- **WHEN** `useTransport()` reports `clockSource === 'external-clock'`
- **THEN** the `Clk` meta cell's value SHALL render `Ext`
- **WHEN** `useTransport()` reports `clockSource === 'external-mtc'`
- **THEN** the `Clk` meta cell's value SHALL render `MTC`

### Requirement: Status LEDs reflect transport mode

The Titlebar SHALL render a status LED whose `data-state` attribute reflects the transport mode: `rec` when recording, `play` when playing, `idle` otherwise. Adjacent text SHALL read `REC`, `PLAY`, or `IDLE` accordingly. The `rec` state SHALL animate via the `mrLed` keyframe (1.2s ease-in-out, opacity 1.0 ↔ 0.45).

A second LED labeled `MIDI IN` SHALL render to the right of the middot. Its `data-state` attribute SHALL bind to `useStatusbar().active`: when `active === true`, the LED SHALL carry `data-state="midi"` (lit, with the `mrLed` blink animation per the shared `.mr-led[data-state="midi"]` rule); when `active === false`, the LED SHALL NOT carry the `data-state` attribute (it renders dim with no animation). The `MIDI IN` text label SHALL remain regardless of activity state. This binding replaces the prior behavior where the LED was hardcoded to `data-state="midi"` always.

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

#### Scenario: MIDI IN LED lights when MIDI is flowing

- **WHEN** `useStatusbar()` returns `active: true`
- **THEN** the MIDI IN LED SHALL have `data-state="midi"`
- **AND** its computed `animation-name` SHALL be `mrLed`
- **AND** the adjacent text SHALL read `MIDI IN`

#### Scenario: MIDI IN LED goes dim when no MIDI is flowing

- **WHEN** `useStatusbar()` returns `active: false`
- **THEN** the MIDI IN LED SHALL NOT have a `data-state` attribute
- **AND** the LED SHALL NOT animate
- **AND** the adjacent `MIDI IN` text SHALL still render (the label is persistent regardless of activity)

### Requirement: useTransport hook is the single source of transport state

The codebase SHALL expose a `useTransport()` hook returning a `TransportState` object and action functions (`play`, `pause`, `stop`, `record`, `toggleLoop`, `toggleMetronome`, `toggleQuantize`, `seek`, `setLoopRegion`, `clearLoopRegion`). The hook SHALL be backed by a React context provider so multiple consumers see the same state. The internal clock SHALL advance `timecodeMs` while `mode !== 'idle'` using `requestAnimationFrame`. Calling `stop()` SHALL set `mode` to `'idle'` and reset `timecodeMs` to `0`. Calling `pause()` SHALL set `mode` to `'idle'` without resetting `timecodeMs`.

`TransportState` SHALL include a `loopRegion: { start: number; end: number } | null` field, where `start` and `end` are session-time beat values with the invariant `end > start` when non-null. The default value SHALL be `null` (no loop region defined).

`setLoopRegion(start, end)` SHALL set `loopRegion` to `{ start, end }`. If `end <= start`, the implementation SHALL either swap the endpoints or no-op the call — it SHALL NOT store an invalid region. `clearLoopRegion()` SHALL set `loopRegion` back to `null`.

When `mode !== 'idle'` AND `looping === true` AND `loopRegion != null`, the rAF tick reducer SHALL check whether the playhead, expressed in beats as `(timecodeMs / 1000) * (bpm / 60)`, has crossed `loopRegion.end`, and if so SHALL set `timecodeMs` to the millisecond equivalent of `loopRegion.start * (60000 / bpm)`. When `looping === false` OR `loopRegion === null`, `timecodeMs` SHALL advance indefinitely without wrapping — there SHALL be no implicit modular wrap at any non-loop boundary.

`TransportState` SHALL include a `clockSource: 'internal' | 'external-clock' | 'external-mtc'` field. The default value SHALL be `'internal'`. No public action for changing `clockSource` is required in this slice (real clock-source switching lands with the MIDI runtime); the field SHALL be exposed on the returned value so the Titlebar can read it.

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
