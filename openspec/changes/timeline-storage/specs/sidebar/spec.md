## ADDED Requirements

### Requirement: Sidebar hosts a Storage panel below the Routing panel

The Sidebar (`Sidebar.tsx`) SHALL mount a `<StoragePanel>` (defined by `timeline-storage`) inside a `<Panel>` with title "Storage" and a disk-style icon. The panel SHALL appear as the last entry in the Sidebar's panel stack, below the existing Routing panel.

The Storage panel SHALL use the Sidebar's existing `<Panel>` primitive (`.mr-panel`, `.mr-panel__head`, `.mr-panel__body`, `data-open` collapse) — no new chrome class names. Its collapse state SHALL be component-local, following the same rule as every other Sidebar panel.

The Storage panel's root element (`.mr-panel` wrapping `<StoragePanel>`) SHALL participate in the Sidebar's selection-blur exclusion mechanism: a `pointerdown` anywhere inside it SHALL NOT clear timeline selections (`djActionSelection`, `djEventSelection`, piano-roll selection, or any future selection introduced by the timeline). This applies whether the panel is open or collapsed.

#### Scenario: Storage panel is the last panel in the stack

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside's panel sequence SHALL end with exactly one `<Panel>` whose title text reads "Storage"
- **AND** the Storage panel SHALL render below every other panel (MIDI Inputs, MIDI Outputs, Record Filter, Routing, plus any other panel introduced before this change)

#### Scenario: Storage panel collapse state is local

- **WHEN** the user collapses the Storage panel
- **THEN** the other Sidebar panels' `data-open` values SHALL remain unchanged
- **AND** no `useStage` action SHALL be dispatched for the collapse

#### Scenario: Clicking inside the Storage panel preserves timeline selection

- **GIVEN** `useStage().djActionSelection !== null`
- **WHEN** the user clicks the Storage panel's head, body, name input, Save affordance, any saved-list row, or the "New session" button
- **THEN** `djActionSelection` SHALL remain non-null
- **AND** every other live timeline selection SHALL remain unchanged
