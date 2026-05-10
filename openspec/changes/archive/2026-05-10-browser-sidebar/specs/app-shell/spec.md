## MODIFIED Requirements

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real param lane bars, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + channel groups) is populated by the `ruler`, `channels`, `tracks`, `piano-roll`, and `param-lanes` capabilities, the **Inspector** is populated by the `inspector` capability, the **Sidebar** is populated by the `sidebar` capability, and these regions are NOT subject to this rule. The remaining empty regions are: Toolstrip, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Toolstrip and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

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
