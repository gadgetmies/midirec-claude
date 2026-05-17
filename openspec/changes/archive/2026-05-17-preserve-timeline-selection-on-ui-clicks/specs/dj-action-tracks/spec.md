## MODIFIED Requirements

### Requirement: Outside-click blurs the selection

While `djActionSelection !== null`, the stage SHALL register a window-level `pointerdown` handler that calls `setDJActionSelection(null)` when the click target is NONE of the following:

- inside a `.mr-djtrack` element, OR
- inside an element marked `[data-mr-dj-selection-region="true"]`, OR
- inside any of the chrome region roots: `.mr-titlebar`, `.mr-toolstrip`, `.mr-sidebar`, `.mr-inspector`, `.mr-statusbar` (per the app-shell "Chrome regions preserve timeline-domain selections" requirement).

The handler SHALL be detached when the selection becomes `null`, OR when the component unmounts.

Surfaces inside `.mr-timeline` that should retain the selection on clicks SHALL declare `data-mr-dj-selection-region="true"` on a wrapping element. Surfaces inside the chrome regions are exempt by class and do NOT need the data attribute. Known opt-in regions:

- The Sidebar's `<InputMappingPanel>` wrapper (the Map Note panel) — also covered by the `.mr-sidebar` chrome exemption.
- The Inspector's Output action panel wrapper — also covered by the `.mr-inspector` chrome exemption.

#### Scenario: Click outside all regions and outside any DJ track blurs selection

- **WHEN** `djActionSelection !== null` and the user clicks on the ruler element (which is not `.mr-djtrack`, not inside any `[data-mr-dj-selection-region]`, and not inside any chrome region)
- **THEN** the next render SHALL have `djActionSelection === null`

#### Scenario: Click inside a DJ track keeps selection

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and the user clicks on the DJ track's lane area (inside `.mr-djtrack` but not on an `.mr-actkey`)
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click inside the Map Note panel keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks on the Sidebar's Map Note panel (inside a `[data-mr-dj-selection-region]`)
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click inside the Inspector's Output panel keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks the Channel input in the Inspector's Output panel
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click on the titlebar keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks any element inside `.mr-titlebar`
- **THEN** `djActionSelection` SHALL be unchanged
- **AND** `djEventSelection` SHALL be unchanged

#### Scenario: Click on the toolstrip keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks any element inside `.mr-toolstrip`
- **THEN** `djActionSelection` SHALL be unchanged
- **AND** `djEventSelection` SHALL be unchanged

#### Scenario: Click on the sidebar outside any DJ-selection region keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks inside `.mr-sidebar` on an element that is NOT inside `[data-mr-dj-selection-region]`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click on the inspector outside any DJ-selection region keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks inside `.mr-inspector` on an element that is NOT inside `[data-mr-dj-selection-region]`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click on the statusbar keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks any element inside `.mr-statusbar`
- **THEN** `djActionSelection` SHALL be unchanged
