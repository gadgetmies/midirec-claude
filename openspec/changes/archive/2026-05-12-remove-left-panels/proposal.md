## Why

The left sidebar is crowded with legacy MIDI device lists, a non-functional record filter, and a decorative routing matrix while track-level input mapping already lives in dedicated panels. Removing those four surfaces simplifies the primary workflow and reduces visual noise without changing core recording or playback behavior today.

## What Changes

- Remove the **MIDI Inputs**, **MIDI Outputs**, **Record Filter**, and **Routing** collapsible panels from `<Sidebar>` (`Sidebar.tsx`).
- Delete supporting UI in the same module where it becomes dead code: `RoutingMatrix` / `RoutingRow`, device list rendering for those panels, and hardcoded `FILTERS` / `CHANNEL_CHIPS` fixtures used only by Record Filter.
- Trim **Sidebar-specific CSS** (e.g. routing grid, device rows) if nothing else references it; keep primitives still used elsewhere (e.g. Inspector) or by remaining sidebar panels.
- Update behavioral specs so the sidebar documents only what remains (permission banner, `TrackInputMappingPanel`, `InputMappingPanel`, and shared `Panel` behavior) and cross-capability references no longer promise the four removed panels.

## Capabilities

### New Capabilities

- _(none — behavioral updates are deltas to existing specs)_

### Modified Capabilities

- `sidebar`: Drop requirements for MIDI Inputs, MIDI Outputs, Record Filter, and Routing panels; drop routing-matrix-specific requirements; align purpose and panel inventory with the slimmer sidebar (mapping panels + shared primitives only).
- `dj-map-editor`: Replace references to the removed sections (mount order copy and scenarios that require the four legacy panels to remain).

## Impact

- **Code**: `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/Sidebar.css` (and any icons/imports only used by removed panels).
- **Specs**: `openspec/specs/sidebar/spec.md`, `openspec/specs/dj-map-editor/spec.md`; delta files under this change.
- **Tests**: Component tests or e2e assertions that expect panel titles (`MIDI Inputs`, etc.) or `.mr-routing` in the sidebar will need updating or removal.
- **User-visible**: **BREAKING** for users who relied on those panels for device visibility; device pickers elsewhere (e.g. status bar / inspector) remain the surfaces for that information if present in the app.
