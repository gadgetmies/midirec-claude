## Why

Changing where something sits on the timeline is tedious when users can only drag in the piano roll or other canvases; power users expect precise placement from the Inspector. Providing phrase·bar·beat and tick inputs in the right panel matches musical thinking and lattice-accurate editing without sacrificing the session’s tick-based source of truth.

## What Changes

- **Inspector:** For an applicable single selection on the timeline, the right panel SHALL expose editable controls for **start position**: a **phrase·bar·beat** field (normalized string form such as `1.1.1`, aligned with existing `formatBBT` numbering) and a **ticks** field for absolute fine adjustment on the session tick axis.
- **Behavior:** Editing either control SHALL commit an updated **start tick** (`tTicks` / equivalent field for the selected item type when supported) consistent with existing session TPQ rules; validation and coercion (invalid or empty input) SHALL be defined so the UI never leaves the model inconsistent.
- **Scope (initial):** At minimum **single-select MIDI notes** on a roll; extending the same pattern to other timeline layers (e.g. DJ action events, automation points) MAY follow the same Interaction pattern once note editing is proven.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `inspector`: Add right-panel editable **timeline position** for the selected timeline item — **phrase·bar·beat** text and **ticks** numeric/text input — wired to authoritative tick timing (`tTicks`) for supported selection kinds.

## Impact

- `src/components/inspector/` — new inputs, parsers, commits into stage/note mutations; tests for parsing and rounding.
- `useStage` / roll mutation pathways already used when moving notes — reuse rather than duplicate scheduling logic where possible.
- OpenSpec baseline `inspector` requirement deltas; no new top-level capability module unless product wants a separate `timeline-edit` slice later.
