## Why

Slice 7b shipped DJ action tracks with a body that renders one row per entry in the track's `actionMap`, but there is no way for a user to edit, add, or remove those bindings from the UI, and no surface for declaring what MIDI output should fire when an action plays back. Slice 8 closes that loop by routing the per-row mapping work to the two side panels — recording-style **input mapping** on the left (which incoming pitch maps to which action) and **output mapping** on the right (which MIDI message the action emits) — both keyed off a single `djActionSelection` state.

## What Changes

- Introduce a new `dj-map-editor` capability that owns the Sidebar's "Map Note" panel — the form for editing the **input binding** of the currently-selected DJ action row.
- Extend `inspector`: when a DJ action row is selected, the right-aside replaces its channel/roll Note panel with the **Output mapping** form (Device / Channel / Pitch).
- Extend `dj-action-tracks`: clicking an action row in `ActionKeys` sets `djActionSelection`. The mapping panels read off this state; closing the selection blurs both panels.
- Add a `trigger?: 'momentary' | 'toggle'` field to `ActionMapEntry` (absent reads as `'momentary'`) so the input form's Trigger select has a persistence target.
- Add a new `OutputMapping` type and `outputMap: Record<number, OutputMapping>` field on every `DJActionTrack`. Output mappings are keyed by the input pitch.
- Add hook actions on `useDJActionTracks`: `setActionEntry(trackId, pitch, entry)`, `deleteActionEntry(trackId, pitch)`, `setOutputMapping(trackId, pitch, mapping)`, `deleteOutputMapping(trackId, pitch)`. All are deterministic, no-op on unknown ids, and `deleteActionEntry` also prunes the matching `outputMap` entry and row M/S state.
- Add a `djActionSelection: { trackId, pitch } | null` state on `useStage`, plus a global outside-click handler that blurs the selection when the user clicks outside the DJ track and the mapping panels.
- The mapping forms **auto-save** — every field change commits immediately via the hook actions. There is no Done/Cancel button; matches how the rest of the app's stateful UI behaves (collapse, mute, solo).

## Capabilities

### New Capabilities

- `dj-map-editor`: The Sidebar's "Map Note" panel for editing the input binding (category, action, device, trigger) of the currently-selected DJ action row. Owns the form layout, auto-save semantics, and the per-row Delete affordance.

### Modified Capabilities

- `dj-action-tracks`: requirements added for (a) `djActionSelection` state on the stage, (b) `setActionEntry`, `deleteActionEntry`, `setOutputMapping`, `deleteOutputMapping` actions, (c) the `ActionMapEntry` type gaining an optional `trigger` field, (d) the new `OutputMapping` type and `outputMap` field, (e) clicking an action row sets the selection (with keyboard activation + `data-selected` styling).
- `inspector`: requirement added for the Action panel — when a DJ action row is selected, the Note tab body renders the Output mapping form instead of the channel/roll Note content.

## Impact

- `src/data/dj.ts`: `ActionMapEntry` gains optional `trigger?: TriggerMode`. New `OutputMapping` type.
- `src/hooks/useDJActionTracks.ts`: adds `outputMap` to `DJActionTrack`, four new actions (set/delete for both maps), four new pure helpers (`applySetActionEntry`, `applyDeleteActionEntry`, `applySetOutputMapping`, `applyDeleteOutputMapping`).
- `src/hooks/useStage.tsx`: adds `djActionSelection` state, `setDJActionSelection` setter, output-mapping actions, and a global pointerdown listener that blurs the selection on outside-click.
- `src/components/dj-action-tracks/ActionKeys.tsx` + `.css`: rows become click-targets that set the selection, with keyboard activation and `data-selected` styling.
- `src/components/sidebar/InputMappingPanel.tsx` (new): the Map Note form, wrapped in a `Panel` at the top of the Sidebar.
- `src/components/sidebar/Sidebar.tsx` + `.css`: mounts the new panel; new `.mr-map-form__*` styles.
- `src/components/inspector/Inspector.tsx` + `.css`: the existing Action panel is rewritten as the Output mapping form (Device select, Channel input, Pitch input + readout).
- No new dependencies. No design-token changes.
