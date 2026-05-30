## ADDED Requirements

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

## MODIFIED Requirements

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
