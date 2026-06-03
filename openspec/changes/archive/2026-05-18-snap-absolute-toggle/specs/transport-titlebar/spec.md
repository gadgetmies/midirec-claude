## MODIFIED Requirements

### Requirement: Titlebar renders the full transport bar

The Titlebar region SHALL render the transport bar matching `prototype/components.jsx` `Transport` and `prototype/app.css` lines ~37–215. The visible elements, in left-to-right order, SHALL be:

1. **Brand block** — 22px gradient mark + `MIDI Recorder` (display font, semibold) + version subtitle (mono, `var(--mr-text-3)`), separated by a 1px right divider.
2. **Transport group A** — six buttons in this order: rewind / cue / play (toggles to pause icon + accent state when playing) / stop / record / fast-forward.
3. **Timecode** — `MM:SS.FFF` at `var(--mr-fs-20)` size, mono, tabular-nums, with the milliseconds segment in `var(--mr-text-3)`.
4. **Meta row** — four columns each with a 9px uppercase label (`Bar`, `BPM`, `Clk`, `Sig`) and a mono value (`13.2.1`, `124`, `Int`, `4/4`). The `Clk` cell SHALL appear directly after `BPM` and before `Sig`. The `Clk` value SHALL render as a compact 3-letter code derived from `useTransport().clockSource`: `'internal'` → `Int`, `'external-clock'` → `Ext`, `'external-mtc'` → `MTC`.
5. **Transport group B** — loop button + metronome button.
6. **Quantize widget** — `Q` label + power-toggle button + grid-value chip showing the current grid (e.g. `1/16`), followed by an `A` label + power-toggle button (the Snap Absolute chip). The `A` chip SHALL sit immediately to the right of the grid-value chip and SHALL share the chip styling and click-to-toggle behavior of the `Q` chip.
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

#### Scenario: A chip is present next to the Q chip

- **WHEN** the app is rendered
- **THEN** the Quantize widget subregion SHALL contain, in DOM order, the `Q` label + Q power-toggle + grid-value chip + `A` label + A power-toggle
- **AND** the `A` power-toggle SHALL share the same chip class/styling as the `Q` power-toggle

## ADDED Requirements

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
