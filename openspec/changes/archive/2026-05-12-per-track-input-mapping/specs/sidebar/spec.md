## ADDED Requirements

### Requirement: Sidebar hosts TrackInputMappingPanel

The codebase SHALL mount `TrackInputMappingPanel` from `src/components/sidebar/` inside `<Sidebar>` per the `track-input-mapping` capability (placement relative to `MidiPermissionBanner`, `InputMappingPanel`, and existing panels). The panel SHALL use the same `Panel` primitive and visual tokens (`--mr-*`) as other sidebar panels unless a dedicated compact layout is specified in implementation tasks.

#### Scenario: Sidebar contains the panel component

- **WHEN** the app renders `Sidebar`
- **THEN** the React tree SHALL include `TrackInputMappingPanel`
