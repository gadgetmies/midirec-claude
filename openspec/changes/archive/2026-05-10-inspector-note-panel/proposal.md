## Why

The Inspector aside is the last unpopulated region of the app shell — it ships as `<aside class="mr-inspector"><span class="mr-stub">Inspector</span></aside>` while every other slice has filled its slot. Without an Inspector, marquee-selected notes have no readout, no way to see pitch/velocity/length without hovering, and no path to bulk edits. Slice 5 of the implementation plan promises a half-day fill for the Note panel: tab strip + single-select view + multi-select view with bulk-actions block. Real click-to-select interaction lands in a later slice; this slice ships visual fidelity against the existing demo-driven selection state (`?demo=marquee`) plus a new `?demo=note` fixture.

## What Changes

- Mount a new `<Inspector>` React component in the `.mr-inspector` aside, replacing the stub.
- Render a tab strip with three tabs — `Note` (active by default), `Pressure`, `Channel`. Only the Note tab has body content in this slice.
- Render the Note panel in three states driven by the resolved selection:
  - **none** (no selection): tab strip only, empty body.
  - **single** (1 note selected): pitch swatch + label + KV rows for Start (BBT + ticks), Length (seconds + symbolic), Velocity (slider + value), Channel.
  - **multi** (2+ notes selected): hatched swatch + count + summary subtitle + KV rows for Range, Pitches, Velocity (mixed-aware slider), Length (single-or-mixed), Channel; followed by a divider, `BULK ACTIONS` eyebrow, and a button grid (Quantize, Nudge ←→, Transpose, Velocity ±, Duplicate, Delete N).
- All bulk-action buttons are visual-only no-ops (same convention as M/S chips and `+ Add Lane`).
- Add a new `?demo=note` URL flag that yields a single-note fixture (`selectedChannelId = 1, selectedIdx = [<fixed>]`); mutually exclusive with `?demo=marquee`, which wins if both are set.
- Extend `useStage()`'s return shape with a `resolvedSelection: { channelId, indexes } | null` field that pre-computes the effective selection (running `notesInMarquee` when needed), so the Inspector consumes a single resolved value instead of re-deriving.
- Multi-select summary values are **derived** from the resolved selection by new pure helpers in `src/components/inspector/summary.ts` (count, range BBT, pitch-set, mean velocity + mixed flag, length single-or-mixed). No hardcoded strings for screenshot fidelity.
- Port the Inspector CSS primitives (`.mr-insp-tabs`, `.mr-insp-tab`, `.mr-kv*`, `.mr-slider*` including `data-mixed` variant) from `prototype/app.css` lines ~905–1001 into a new `src/components/inspector/Inspector.css`.
- Record the tab-label deviation (impl plan `Note / Pressure / Channel` vs prototype `Note / Track / File`) in `design/deviations-from-prototype.md` and `design/README.md`.

## Capabilities

### New Capabilities

- `inspector`: The right-aside Inspector panel — tab strip and Note panel rendering for none/single/multi selection states. Reuses `useStage`'s resolved selection. Bulk actions are visual stubs in this slice.

### Modified Capabilities

- `app-shell`: Drop Inspector from the empty-regions rule; add a requirement that the `.mr-inspector` aside hosts the `<Inspector>` component.
- `piano-roll`: Extend the `useStage()` return contract with `resolvedSelection`, and add the `?demo=note` URL flag (mutually exclusive with `?demo=marquee`, marquee winning).

## Impact

- **Code**: new `src/components/inspector/Inspector.tsx`, `Inspector.css`, `summary.ts` (+ tests). Edits to `src/components/shell/AppShell.tsx` (mount Inspector). Edits to `src/hooks/useStage.ts` (add `resolvedSelection`, add `?demo=note` branch). Possibly a small addition to `src/components/piano-roll/notes.ts` (add `pitchLabel` helper if not already there).
- **Specs**: ADDED `inspector/spec.md`. MODIFIED `app-shell/spec.md` and `piano-roll/spec.md`.
- **Design docs**: edits to `design/deviations-from-prototype.md` and `design/README.md` for the tab-label deviation.
- **Out of scope** (explicitly): real click/drag selection, Pressure tab body (Slice 9), Channel tab body, bulk-action handlers, DJ-mode actions inspector, cross-channel selection (separate backlog item).
- **Dependencies**: none new. All work is internal.
- **Risk**: low. Slot is empty today, no existing behavior to preserve. The only contract change is `useStage()`'s return shape — a single new optional field, not a removal.
