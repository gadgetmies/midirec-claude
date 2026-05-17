## ADDED Requirements

### Requirement: Chrome regions preserve timeline-domain selections

A `pointerdown` whose target is inside any of the five chrome region root elements — `.mr-titlebar`, `.mr-toolstrip`, `.mr-sidebar`, `.mr-inspector`, or `.mr-statusbar` — SHALL NOT clear any timeline-domain selection state. Timeline-domain selections include `selectedTimelineTrack`, `djActionSelection`, `djEventSelection`, and the user-driven roll-note selection (`interactiveRollSel`).

The chrome-exemption check SHALL match by ancestor: if any ancestor of the click target carries one of the five chrome class names, the click SHALL be treated as chrome-region.

This requirement does NOT change how selections are *created* (still via clicks on track headers, action rows, or roll notes) and does NOT alter intentional clear paths inside `.mr-timeline` (clicks on empty ruler space or lane gutters still clear).

#### Scenario: Click on titlebar does not clear timeline-track selection

- **WHEN** `selectedTimelineTrack !== null` and the user pointerdowns on any element inside `.mr-titlebar`
- **THEN** `selectedTimelineTrack` SHALL be unchanged on the next render

#### Scenario: Click on toolstrip does not clear DJ action selection

- **WHEN** `djActionSelection !== null` and the user pointerdowns on any element inside `.mr-toolstrip`
- **THEN** `djActionSelection` SHALL be unchanged on the next render
- **AND** `djEventSelection` SHALL be unchanged on the next render

#### Scenario: Click on sidebar does not clear any timeline-domain selection

- **WHEN** any of `selectedTimelineTrack`, `djActionSelection`, `djEventSelection`, or `interactiveRollSel` is non-empty, and the user pointerdowns on a non-interactive area inside `.mr-sidebar` (i.e. one that does not itself dispatch a selection mutation)
- **THEN** all of those selections SHALL be unchanged on the next render

#### Scenario: Click on inspector does not clear any timeline-domain selection

- **WHEN** any timeline-domain selection is non-empty, and the user pointerdowns on a non-interactive area inside `.mr-inspector`
- **THEN** that selection SHALL be unchanged on the next render

#### Scenario: Click on statusbar does not clear any timeline-domain selection

- **WHEN** any timeline-domain selection is non-empty, and the user pointerdowns on any element inside `.mr-statusbar`
- **THEN** that selection SHALL be unchanged on the next render

#### Scenario: Click inside `.mr-timeline` on empty area still clears

- **WHEN** `selectedTimelineTrack !== null` and the user pointerdowns inside `.mr-timeline` on an element that is NOT inside `.mr-channel__hdr`, `.mr-track__hdr`, `.mr-djtrack__hdr`, or `.mr-roll`
- **THEN** `selectedTimelineTrack` SHALL be `null` on the next render
