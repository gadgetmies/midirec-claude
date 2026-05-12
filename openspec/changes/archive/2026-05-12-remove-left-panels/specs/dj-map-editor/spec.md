## MODIFIED Requirements

### Requirement: Sidebar exposes a Map Note panel for the selected DJ action row

The codebase SHALL expose an `<InputMappingPanel>` React component at `src/components/sidebar/InputMappingPanel.tsx`. The component SHALL be mounted exactly once, from `Sidebar.tsx`, after `TrackInputMappingPanel` in the authored JSX order (below track-input surfaces).

The panel SHALL render only when ALL of the following hold:

1. `useStage().djActionSelection !== null`.
2. The referenced `trackId` resolves to a `DJActionTrack` in `useStage().djActionTracks`.
3. The referenced `pitch` is a key in that track's `actionMap`.

When any of the above fails, the component MUST return `null` (no DOM contribution).

The panel's outer wrapper element SHALL carry `data-mr-dj-selection-region="true"` so the global outside-click handler treats clicks inside it as "keep selection".

The panel SHALL use the existing `<Panel>` primitive (`src/components/sidebar/Panel.tsx`) with title text `Map Note`.

#### Scenario: Panel is absent when no selection

- **WHEN** `useStage().djActionSelection === null`
- **THEN** there SHALL be no element with class `.mr-map-form` anywhere in the Sidebar

#### Scenario: Panel mounts when a DJ action row is selected

- **WHEN** the user clicks the action row for pitch 56 on the seeded track `dj1` and `actionMap[56].label === 'Hot Cue 1'`
- **THEN** the Sidebar SHALL contain a `<Panel>` whose head text content includes `Map Note`
- **AND** the panel body SHALL contain exactly one `.mr-map-form` element
- **AND** the `.mr-map-form__hd-title` SHALL contain the text `Hot Cue 1`
- **AND** the `.mr-map-form__hd-sub` SHALL contain the text `G♯3 · note 56`

#### Scenario: Panel is absent when selection points to a missing entry

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` but `actionMap[56]` is `undefined` (e.g. just deleted)
- **THEN** the Sidebar SHALL contain no `.mr-map-form` element

#### Scenario: Outer wrapper carries the selection-region attribute

- **WHEN** the panel is rendered
- **THEN** an ancestor of `.mr-map-form` SHALL carry `data-mr-dj-selection-region="true"`
