## MODIFIED Requirements

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

## ADDED Requirements

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
