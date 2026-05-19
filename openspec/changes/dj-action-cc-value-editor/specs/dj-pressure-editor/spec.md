## REMOVED Requirements

### Requirement: PressurePoint and PressureRenderMode types are exported

**Reason**: Migrated verbatim into the `dj-value-editor` capability (same wording, same scenarios). The types still live in `src/data/dj.ts`; only the requirement's owning capability changes.

**Migration**: Consumers reading the type-contract requirement SHALL read it from `dj-value-editor`'s spec. No code change.

### Requirement: Pressure helpers are pure and unit-tested

**Reason**: The surviving helpers (`synthesizePressure`, `rasterizePressure`, `smoothPressure`, `flattenPressure`) are migrated into the `dj-value-editor` capability. The retired helpers (`summarizePressure`, `clearPressure`) are removed from `src/data/pressure.ts`; callers that need an empty pressure array SHALL pass `[]` directly to `setEventPressure`.

**Migration**: Update imports from `src/data/pressure.ts` if you previously named `summarizePressure` or `clearPressure`; both are gone. The remaining helpers' signatures and behavior are unchanged.

### Requirement: Pressure section renders inside ActionPanel when an event is selected on a pressure-bearing action

**Reason**: The Inspector pressure section is removed entirely. Pressure editing now happens in the dedicated DJ value editor (`dj-value-editor` capability) mounted as a global sticky footer above the Statusbar, keyed off `djEventSelection`.

**Migration**: Tests asserting the presence of `.mr-pressure` inside the Inspector SHALL be removed or rewritten to assert against `.mr-dj-value-editor` instead. The `data-mr-dj-selection-region="true"` attribute previously carried by `.mr-pressure` is no longer needed for outside-click handling because the new editor is not inside the Inspector aside.

### Requirement: Pressure bar-graph editor renders 16 rasterised bins

**Reason**: Replaced by the `dj-value-editor` capability's AT-mode canvas rendering requirement. The 16-bin rasterise via `rasterizePressure` is preserved (with the same `synthesizePressure` fallback for `event.pressure === undefined`); the DOM shape changes from `.mr-pressure__graph svg` to `.mr-dj-value-editor`'s canvas, and the `data-mode` attribute is no longer needed because the editor mode is derived from selection state rather than persisted per-graph.

**Migration**: Tests asserting against `.mr-pressure__graph` SHALL be removed.

### Requirement: Pressure summary readout shows event count, peak, and average

**Reason**: The summary readout is dropped — the new editor surfaces value via bar height directly, and the bulk-op chips don't need the count/peak/avg readout to be discoverable. `summarizePressure` is removed from `src/data/pressure.ts` accordingly.

**Migration**: Tests asserting `.mr-pressure__summary` text content SHALL be removed.

### Requirement: Smooth button materialises and smooths stored pressure

**Reason**: The Smooth chip moves into the `dj-value-editor` capability, where it operates on the current edit range (event span in AT mode, viewport in CC/PB mode). The AT-mode call-site behavior is preserved: clicking Smooth dispatches `setEventPressure(trackId, pitch, eventIdx, smoothPressure(currentPressurePoints))` where `currentPressurePoints` is `event.pressure` (or `synthesizePressure(event)` when undefined).

**Migration**: Tests asserting the click handler SHALL be moved to test against the new editor's chip.

### Requirement: Flatten button replaces stored pressure with the mean

**Reason**: The Flatten chip moves into the `dj-value-editor` capability. AT-mode behavior is preserved (`flattenPressure(currentPressurePoints)`).

**Migration**: Same as Smooth — re-target the chip test.

### Requirement: Clear button writes an empty pressure array

**Reason**: The Clear chip moves into the `dj-value-editor` capability. AT-mode behavior is preserved (`setEventPressure(..., [])`); the `clearPressure` indirection is removed because the call site can pass `[]` directly.

**Migration**: Re-target the chip test; remove any direct import of `clearPressure` from `src/data/pressure.ts`.

### Requirement: Curve and Step chips toggle pressureRenderMode

**Reason**: The Curve/Step mode chips are dropped. The new editor renders pressure bars in a single visual style; `pressureRenderMode` state on `useStage` SHALL be unaffected by this change (still toggle-able by other consumers, or also removed if no consumer remains — implementation decides at apply time). The lane-body rendering in `ActionRoll` continues to read `pressureRenderMode` for the synthetic curve.

**Migration**: If a consumer relied on the chips' DOM, re-implement as a separate menu or remove. The new editor does NOT expose a mode toggle.

### Requirement: Pressure section CSS uses tokens, no new hex literals

**Reason**: The pressure section CSS file `src/components/inspector/PressureEditor.css` is deleted. The new editor's CSS at `src/components/dj-value-editor/DJValueEditor.css` carries the equivalent "tokens-only" rule (see `dj-value-editor` capability, "Editor CSS uses design tokens only").

**Migration**: Delete `src/components/inspector/PressureEditor.css`; rely on the new editor's stylesheet for color-token discipline.
