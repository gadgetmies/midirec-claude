## REMOVED Requirements

### Requirement: Slice 0 ships zero functionality

**Reason**: The "Slice 0" framing is no longer accurate after this change populates the Titlebar region. The same intent — "regions ship empty until their slices populate them" — is preserved by the ADDED requirement below, which also explicitly carves out the now-functional Titlebar.

**Migration**: Replaced by the new requirement *"Empty regions ship empty until their slices populate them"* (in this same change). No code migration is required; the substantive behavior is preserved for all regions other than the Titlebar.

## ADDED Requirements

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no ruler ticks, no notes, no real CC lane bars, no inspector tabs, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability and is no longer subject to this rule. The remaining empty regions are: Sidebar, Toolstrip, Ruler, Stage, CC Lanes (slots), Inspector, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Sidebar, Toolstrip, Ruler, Stage, CC Lane slots, Inspector, and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability
