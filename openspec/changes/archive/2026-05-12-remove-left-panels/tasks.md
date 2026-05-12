## 1. Sidebar implementation

- [x] 1.1 Remove the four `.mr-panel` blocks (MIDI Inputs, MIDI Outputs, Record Filter, Routing) and all helper components / constants that exist only for them (`RoutingMatrix`, `RoutingRow`, `DeviceRow`, `EmptyDeviceHint`, `FILTERS`, `CHANNEL_CHIPS`, `countString`) from `src/components/sidebar/Sidebar.tsx`.
- [x] 1.2 Remove unused imports from `Sidebar.tsx` (icons and hooks that are only referenced by the deleted panels).
- [x] 1.3 Delete unused rules from `src/components/sidebar/Sidebar.css` (device rows, routing grid, and any sidebar-only styles that no longer have markup), without breaking shared imports used by `TrackInputMappingPanel` / `InputMappingPanel` / other appshell regions.

## 2. Verification

- [x] 2.1 Run the full test suite (`npm test` or project default) and fix any failures tied to sidebar structure or copy.
- [x] 2.2 Manually smoke-test the app: sidebar still shows permission banner, Track input, and Map Note (when a DJ cell is selected); confirm no `MIDI INPUTS` / `MIDI OUTPUTS` / `RECORD FILTER` / `ROUTING` panel heads appear.

## 3. OpenSpec

- [x] 3.1 After implementation, run `/opsx:apply` archive or the project's archive step so `openspec/specs/sidebar/spec.md` and `openspec/specs/dj-map-editor/spec.md` merge these deltas when the change is complete.
