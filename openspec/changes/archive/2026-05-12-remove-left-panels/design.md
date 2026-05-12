## Context

The left `.mr-sidebar` currently composes `MidiPermissionBanner`, `TrackInputMappingPanel`, `InputMappingPanel`, and four legacy `.mr-panel` sections (MIDI Inputs, MIDI Outputs, Record Filter, Routing) implemented in `Sidebar.tsx`. Device rows and the routing matrix pull from `useMidiInputs` / `useMidiOutputs` but do not drive scheduler routing; the record filter is an inert fixture. Track-level input mapping already gives users device and channel control in context.

## Goals / Non-Goals

**Goals:**

- Remove the four legacy panels from `Sidebar` markup and delete dead helpers (`RoutingMatrix`, `RoutingRow`, `DeviceRow`, `EmptyDeviceHint`, `FILTERS`, `CHANNEL_CHIPS`, `countString`) from `Sidebar.tsx`.
- Drop `useMidiInputs` / `useMidiOutputs` from `Sidebar.tsx` if they are only referenced by the removed panels (child components keep their own hook usage).
- Remove Sidebar-only CSS for device rows and the routing grid from `Sidebar.css` when no remaining import needs it; avoid deleting shared rules consumed from `src/styles` or other components.
- Align OpenSpec `sidebar` and `dj-map-editor` deltas with the slimmer surface.

**Non-Goals:**

- Implementing a replacement global device list, wiring record filters to the engine, or per-track output routing (backlog items remain separate).
- Changing Web MIDI permission, status bar pickers, or scheduler behavior.

## Decisions

- **Delete in place vs. relocate panels.** Remove the UI entirely rather than moving panels to the inspector; the user asked to drop them from the left side, not to re-home them.
- **CSS scope.** Prune `.mr-dev`, `.mr-routing`, and related rules from `Sidebar.css` after confirming no other module depends on those class names from this file (`.mr-led` basis styles already live in `src/styles/leds.css`).
- **Spec strategy.** Use `sidebar` and `dj-map-editor` deltas: remove requirements tied to the deleted panels; add an explicit “no legacy panel titles” requirement if needed for test clarity; update Map Note placement wording.

## Risks / Trade-offs

- **Discoverability** — Users who only looked at the sidebar for plug-and-play device lists lose that view → Mitigation: document that track input and other regions still expose devices; consider status bar copy in a future change if UX testing shows confusion.
- **Test churn** — Assertions keyed to four panels or routing DOM → Mitigation: update or delete those tests in the same apply pass as the UI.

## Migration Plan

Not applicable for end users (web app). Developers: merge spec deltas when archiving; run the test suite after UI deletion.

## Open Questions

- None blocking implementation; confirm with product if any analytics or screenshots referenced the old panels.
