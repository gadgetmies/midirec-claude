## ADDED Requirements

### Requirement: Note tab renders a DJ track output mapping panel when a DJ timeline track is selected

When the active tab is `Note` AND `useStage().djActionSelection === null` AND `useStage().selectedTimelineTrack !== null` AND `selectedTimelineTrack.kind === 'dj'`, the Inspector body SHALL render a **DJ track output mapping panel** for the track `id === selectedTimelineTrack.trackId`.

The panel SHALL:

- Wrap its root in an element carrying `data-mr-dj-selection-region="true"`.
- Render a track header (name / color consistent with existing Inspector styling conventions) and a **track default** `.mr-kv` row for **MIDI output** whose `<select>` lists all outputs from `useMidiOutputs()` (or equivalent hook), bound to `setDJTrackDefaultMidiOutputDevice`, including a sentinel option for “default / system” when `defaultMidiOutputDeviceId` is empty.
- List **one block per pitch** in `track.actionMap` sorted ascending by pitch. Each block SHALL identify the action (`entry.label`, `devColor(entry.device)` swatch) and SHALL expose:
  - MIDI **output** `<select>` with “Track default” (or equivalent) when the row has no `outputMap[pitch].midiOutputDeviceId`, else the specific port id; changes commit via `setOutputMapping` merging the existing mapping.
  - **Channel** `1..16` bound to `outputMap[pitch].channel` with fallback to `track.midiChannel` when no `outputMap[pitch]` exists, same auto-save behavior as the single-row Output panel.
  - **Pitch** (note number `0..127`) when the row’s effective playback mode is **note** (not CC-out per `dj-action-tracks` / `defaultMixerOutputCc` / pressure rules).
  - **CC#** `0..127` when the row’s effective playback mode is **CC-out**, matching the visibility rules of the existing per-row Output panel.

The panel SHALL NOT render when `djActionSelection !== null` (row-level Action panel takes precedence).

#### Scenario: Track panel appears when timeline DJ track is focused

- **WHEN** `selectedTimelineTrack === { kind: 'dj', trackId: 'dj1' }`, `djActionSelection === null`, and the Note tab is active
- **THEN** the Inspector body SHALL contain a region with `data-mr-dj-selection-region="true"`
- **AND** that region SHALL list one mapping block per key in `actionMap` for `dj1`

#### Scenario: Row selection hides the track panel

- **WHEN** `djActionSelection !== null` for the same `trackId` as `selectedTimelineTrack`
- **THEN** the Inspector body SHALL render the single-row Output / Action panel instead of the track-level list panel

## MODIFIED Requirements

### Requirement: Output panel and channel/roll Note panel are mutually exclusive

When `djActionSelection !== null`, the Inspector SHALL NOT render the channel/roll Note panel content (none/single/multi). When `djActionSelection === null` AND `selectedTimelineTrack?.kind === 'dj'`, the Inspector SHALL render the **DJ track output mapping panel** (see "Note tab renders a DJ track output mapping panel when a DJ timeline track is selected") instead of the `resolvedSelection`-driven channel Note panel, even if `resolvedSelection` would otherwise show single/multi content. When `djActionSelection === null` AND `selectedTimelineTrack` is **not** a DJ track selection, the Output panel SHALL NOT render — the inspector reverts to the existing `resolvedSelection`-driven Note panel.

This rule preserves the Slice 5 contract for channel/roll selection and does not change the three-tab strip's behavior.

#### Scenario: DJ selection suppresses channel-roll Note panel

- **WHEN** `useStage().djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `useStage().resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the Output panel (row-level)
- **AND** the Inspector body SHALL NOT contain the single-select channel/roll header rows for the channel note (no `Start` / `Length` `.mr-kv` rows from that panel)

#### Scenario: Clearing DJ selection restores channel-roll Note panel

- **WHEN** `djActionSelection` transitions from `{ trackId: 'dj1', pitch: 56 }` to `null` AND `resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the single-select channel/roll Note panel (four `.mr-kv` rows: `Start`, `Length`, `Velocity`, `Channel`)
- **AND** the Inspector body SHALL NOT contain the `Device` / `Channel` / `Pitch` inputs from the row-level Output panel

#### Scenario: DJ timeline track suppresses channel-roll Note panel without row selection

- **WHEN** `djActionSelection === null` AND `selectedTimelineTrack === { kind: 'dj', trackId: 'dj1' }` AND `resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the DJ track output mapping panel
- **AND** the Inspector body SHALL NOT contain the single-select channel/roll Note panel rows (`Start`, `Length`, etc.)
