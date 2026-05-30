## MODIFIED Requirements

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

## ADDED Requirements

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
