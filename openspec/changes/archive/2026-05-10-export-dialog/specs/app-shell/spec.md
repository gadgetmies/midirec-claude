## MODIFIED Requirements

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real param lane bars, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + channel groups) is populated by the `ruler`, `channels`, `tracks`, `piano-roll`, and `param-lanes` capabilities, the **Inspector** is populated by the `inspector` capability, the **Sidebar** is populated by the `sidebar` capability, the **Toolstrip** is populated by the `export-dialog` capability (which contributes the Export button as the first functional control of that region), and these regions are NOT subject to this rule. The remaining empty regions are: Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Statusbar region SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside the Statusbar SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Timeline may contain channel groups

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain one or more `<div className="mr-channel">` elements per the `channels` capability
- **AND** each `.mr-channel` MAY contain a `<Track>` (`tracks` capability) with its `<PianoRoll>` (`piano-roll` capability) and zero-or-more `<ParamLane>` elements (`param-lanes` capability)
- **AND** `.mr-timeline` MAY contain `<button>` elements inside channel headers, track headers, lane headers, and the `+ Add Lane` affordance

#### Scenario: Timeline may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability, inside the sticky-top `.mr-ruler` element

#### Scenario: Inspector may contain tabs and panel content

- **WHEN** the app is rendered
- **THEN** the `.mr-inspector` aside MAY contain `.mr-insp-tabs` and `.mr-insp-tab` elements per the `inspector` capability
- **AND** the `.mr-inspector` aside MAY contain `<button>` elements (bulk-action buttons in the multi-select Note panel)
- **AND** the `.mr-inspector` aside SHALL NOT contain a `.mr-stub` placeholder element

#### Scenario: Sidebar may contain panels and form controls

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside MAY contain `.mr-panel` elements per the `sidebar` capability
- **AND** each `.mr-panel` MAY contain `.mr-panel__head` (a clickable element toggling collapse), `.mr-panel__body`, `.mr-dev` rows, `.mr-row` form rows, `.mr-switch` toggles, `.mr-chip` channel chips, and a `.mr-routing` matrix
- **AND** the `.mr-sidebar` aside MAY contain `<button>` elements (panel heads, channel chips)
- **AND** the `.mr-sidebar` aside SHALL NOT contain a `.mr-stub` placeholder element

#### Scenario: Toolstrip may contain functional controls

- **WHEN** the app is rendered
- **THEN** the `.mr-toolstrip` region MAY contain `<button>` elements per the `export-dialog` capability (specifically the Export button)
- **AND** the `.mr-toolstrip` region SHALL NOT contain a `.mr-stub` placeholder element

## ADDED Requirements

### Requirement: Dialog overlays render as direct children of `.mr-shell`

When an overlay dialog is open (specifically the Export Dialog from the `export-dialog` capability), its scrim element (`.mr-dialog-scrim`) SHALL render as a direct child of `.mr-shell`, positioned `absolute; inset: 0` so it covers all six regions of the shell. The shell's stacking context (`.mr-shell` carries `position: relative`) SHALL be the dialog's positioning context; React portals SHALL NOT be used.

The dialog scrim's `z-index` SHALL resolve from `var(--mr-z-dialog)` (computed value `200`), which is below `var(--mr-z-toast)` (computed value `300`). Toasts emitted while a dialog is open SHALL render visually above the dialog.

While a dialog is open, pointer events on the six shell regions SHALL be blocked by the scrim (the scrim's `background: var(--mr-bg-overlay)` carries non-zero opacity AND `pointer-events: auto` by default). Pointer events on the dialog card itself SHALL continue to work.

#### Scenario: Dialog scrim covers all shell regions

- **WHEN** the Export Dialog is open
- **THEN** the `.mr-shell` element SHALL contain a direct-child `.mr-dialog-scrim` element with `position: absolute` and `inset: 0`
- **AND** the scrim's bounding rect SHALL match the shell's bounding rect (modulo subpixel rounding)
- **AND** the Titlebar, Sidebar, Toolstrip, Timeline, Inspector, and Statusbar regions SHALL all be visually under the scrim

#### Scenario: Toast renders above an open dialog

- **WHEN** the Export Dialog is open AND a toast is shown via `useToast().show(...)`
- **THEN** the toast's `.mr-toast-viewport` element's computed `z-index` SHALL be greater than the dialog scrim's computed `z-index`
- **AND** the toast SHALL be visually above the dialog scrim
