## Why

Slice 6 of `IMPLEMENTATION_PLAN.md` packages "Browser Sidebar + Export Dialog" as a single half-day fill; the Sidebar half shipped on 2026-05-10 (`archive/2026-05-10-browser-sidebar/`) and explicitly deferred the dialog to a separate Slice 6b. Today the Toolstrip is the last empty region in the app shell — `<span class="mr-stub">Toolstrip</span>` per `AppShell.tsx:34` — and there is no surface for the user to act on a recording (export, save, or otherwise). Without the dialog there is also nowhere for the session-model's `Loop region` range option to land: `design/session-model.md:26` and the archived `session-model` proposal both name the export dialog as the consumer that resolves `loopRegion` to a bounded export range. Screenshot 05 in `design_handoff_midi_recorder` is the design source.

## What Changes

- Mount a new `<ExportDialog>` overlay component matching the prototype's `ExportDialog()` in `design_handoff_midi_recorder/prototype/components.jsx` lines 1024–1075. The dialog renders inside a `.mr-dialog-scrim` (a fixed full-shell overlay with `var(--mr-bg-overlay)` backdrop and `--mr-z-dialog`) and shows a 420px-wide `.mr-dialog` card with header (`Export recording` + sub-line `Choose format · N bars · M tracks · K events`), body (Format radio, Filename, Range, Tracks, Quantize, Include CC lanes), and footer (`Cancel` / `Save · ⌘S`).
- Add **Format** as two radio "cards" — `Standard MIDI File (.mid · type 1)` selected by default, `NDJSON (.ndjson · raw events)` as the alternative — converted from the prototype's inline-styled `<label>` blocks to class-based `.mr-fmt-card` rules co-located with the dialog (consistent with Slice 6a's rejection of inline styles for the routing matrix).
- Add **Range** as a radio group with three options — `Whole session`, `Selection`, `Loop region` — disabled-when-unavailable per the session-model contract (`Selection` disabled when `resolvedSelection === null`; `Loop region` disabled when `loopRegion === null`). The dialog reads `loopRegion` and `resolvedSelection` from `useStage` to drive the disable rule and the events-count summary in the header sub-line.
- Add **Tracks** as a checkbox list reading from `state.channels` (one row per channel: swatch + name + count of `notes + lane points`). All checkboxes default to checked. Implements the impl plan's "export's `Tracks` checkbox list" — the previously-deferred consumer of the `tracks` capability.
- Filename input (`.mr-input`), Quantize switch (default off), Include CC lanes switch (default on) — all three are visual stubs for now; their state lives in `useState` inside `<ExportDialog>` and is logged-but-discarded when the user clicks Save.
- Toolstrip gains its first functional control: a single `Export` button (download glyph from `Icon.download` in the prototype, `mr-tool` class). Clicking it sets `dialogOpen = true` on `useStage`, which in turn renders `<ExportDialog>` as a child of `.mr-shell` so the scrim covers everything including the titlebar. Pressing `Escape` while the dialog is open, clicking the scrim outside the dialog card, or clicking `Cancel` closes it; clicking `Save · ⌘S` (or pressing `⌘S` while the dialog is focused) closes it AND emits a toast `Exported "<filename>" · <N> events`.
- Hoist `.mr-btn` (currently slice-local in `Inspector.css` lines 192–227) and add `.mr-input` to `src/styles/forms.css` — the existing forms primitives file from Slice 6a. The dialog footer's `Save` button uses `mr-btn[data-primary="true"]`; the existing Inspector buttons use the same primitive without the `data-primary` attribute. This is the second consumer of `.mr-btn`, matching the Slice 6a hoist-on-second-consumer convention.
- Add `.mr-dialog-scrim`, `.mr-dialog`, `.mr-dialog__hd`, `.mr-dialog__body`, `.mr-dialog__ft`, `.mr-fmt-card`, `.mr-fmt-card[data-on="true"]` rules to a new `src/components/dialog/Dialog.css`. The dialog component itself lives at `src/components/dialog/ExportDialog.tsx`.
- Stub Save behaviour: clicking Save closes the dialog and emits the toast described above. No file is downloaded. Real serialisation (Standard MIDI File type 1 + NDJSON) is Slice 10's audio-engine concern — the dialog is the visual + state contract.
- Record the prototype-vs-impl-plan deviations encountered (the impl plan describes Range/Tracks vaguely; the prototype has Format/Filename/Quantize/Include-CC but no Range or Tracks today) as a new entry in `design/deviations-from-prototype.md`. This change ships the union: the prototype's controls plus Range and Tracks added per the impl plan and the session-model contract.

## Capabilities

### New Capabilities

- `export-dialog`: Owns the `<ExportDialog>` overlay component, the `.mr-dialog-scrim` + `.mr-dialog` card chrome, the open/close state hook surface (`dialogOpen`, `openExportDialog`, `closeExportDialog`), the format/range/tracks/quantize/include-CC fields, the keyboard shortcuts (`Escape` to cancel, `⌘S` to save), the focus-trap and aria semantics, and the Save → toast emission. Real file serialisation is explicitly NOT in this capability — the Save action is a stub that emits a toast describing what would have been exported.

### Modified Capabilities

- `app-shell`: Drop Toolstrip from the empty-regions rule (matching Slice 6a's treatment of Sidebar). Add a scenario asserting the Toolstrip MAY contain functional `<button>` elements (specifically the Export button); add a scenario asserting the dialog overlay renders as a child of `.mr-shell` and covers all six regions when `dialogOpen === true`.

## Impact

- **Code**:
  - new `src/components/dialog/ExportDialog.tsx` and `Dialog.css`.
  - edits to `src/components/shell/AppShell.tsx` (mount `<ExportDialog>` conditionally; replace Toolstrip stub with an Export button).
  - edits to `src/styles/forms.css` (add `.mr-btn`, `.mr-btn[data-primary="true"]`, `.mr-input`); edits to `src/components/inspector/Inspector.css` (remove the slice-local `.mr-btn` rules and import comment pointing to `forms.css`).
  - edits to `src/hooks/useStage.ts` (add `dialogOpen`, `openExportDialog`, `closeExportDialog` state + actions).
  - possibly a small new `src/components/icons/transport.tsx` addition for the download glyph if not already present (the prototype's `Icon.download` SVG path is in `prototype/components.jsx:31`).
- **Specs**: ADDED `export-dialog/spec.md`. MODIFIED `app-shell/spec.md` (Toolstrip empty-region rule + dialog overlay scenarios).
- **Design docs**: edits to `design/deviations-from-prototype.md` (new entry recording Range + Tracks added to the prototype's dialog) and the summary table.
- **Out of scope** (explicitly): real `.mid` / `.ndjson` serialisation (Slice 10), real file download (`Blob` + `URL.createObjectURL` is part of Slice 10), drag-to-resize the dialog, multi-format export presets, recently-used filename history, the Action Map editor for DJ mode (Slice 8), per-track export filters beyond the on/off checkbox.
- **Dependencies**: depends on `session-model`'s `loopRegion` shape (already shipped) and `tracks`/`channels` capabilities (already shipped). No new runtime dependencies.
- **Risk**: low. The dialog is a self-contained overlay; closing it returns the app to its prior state. The only cross-cutting edits are the `.mr-btn` hoist (mitigated by reading the Inspector's current rules byte-for-byte and verifying nothing changes after the move) and the `dialogOpen` field on `useStage` (mitigated by initialising to `false` so existing pages render unchanged).
