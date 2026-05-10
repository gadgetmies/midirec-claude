## ADDED Requirements

### Requirement: Toolstrip exposes an Export button as its first functional control

The codebase SHALL expose a `<Toolstrip>` React component at `src/components/toolstrip/Toolstrip.tsx`. `AppShell.tsx` SHALL mount exactly one `<Toolstrip>` element inside the `.mr-toolstrip` region, replacing the prior `<span class="mr-stub">Toolstrip</span>` placeholder.

The Toolstrip SHALL contain at minimum a single `<button class="mr-tool" title="Export">` element rendering the download SVG glyph (matching the prototype's `Icon.download` path in `design_handoff_midi_recorder/prototype/components.jsx:31`). Clicking this button SHALL call `useStage().openExportDialog()`.

Other Toolstrip controls (select arrow, transpose, quantize, etc. from the prototype's `Toolstrip()`) SHALL NOT be ported in this slice.

#### Scenario: Toolstrip replaces the stub

- **WHEN** the app is rendered
- **THEN** the `.mr-toolstrip` region SHALL contain exactly one Toolstrip component root element
- **AND** the `.mr-toolstrip` region SHALL NOT contain any `.mr-stub` element
- **AND** the prior placeholder text "Toolstrip" SHALL NOT appear

#### Scenario: Export button opens the dialog

- **WHEN** the user clicks the Toolstrip's Export button
- **THEN** `useStage().openExportDialog()` SHALL be called
- **AND** the `dialogOpen` field on stage state SHALL transition from `false` to `true`
- **AND** the `<ExportDialog>` overlay SHALL appear in the DOM as a child of `.mr-shell`

### Requirement: Stage exposes dialog open/close state and actions

The `StageState` interface returned by `useStage()` SHALL expose:

- `dialogOpen: boolean` — whether the Export Dialog is currently open. Defaults to `false` on initial render.
- `openExportDialog: () => void` — sets `dialogOpen` to `true`. No-op if already open.
- `closeExportDialog: () => void` — sets `dialogOpen` to `false`. No-op if already closed.

The dialog's open state SHALL NOT depend on URL search params, recording state, or any other field. It is purely user-driven via `openExportDialog` and `closeExportDialog`.

#### Scenario: Initial dialog state is closed

- **WHEN** the app first renders
- **THEN** `useStage().dialogOpen` SHALL be `false`
- **AND** no `<ExportDialog>` element SHALL exist in the DOM

#### Scenario: openExportDialog opens the dialog

- **WHEN** `useStage().openExportDialog()` is called while `dialogOpen` is `false`
- **THEN** the next render SHALL have `dialogOpen === true`
- **AND** the `<ExportDialog>` element SHALL exist in the DOM

#### Scenario: closeExportDialog closes the dialog

- **WHEN** `useStage().closeExportDialog()` is called while `dialogOpen` is `true`
- **THEN** the next render SHALL have `dialogOpen === false`
- **AND** the `<ExportDialog>` element SHALL be removed from the DOM

### Requirement: Export Dialog renders as a scrim-and-card overlay

When `dialogOpen === true`, the codebase SHALL render an `<ExportDialog>` component at `src/components/dialog/ExportDialog.tsx` as a direct child of `.mr-shell`. The dialog's outermost element SHALL be a `<div class="mr-dialog-scrim">` with `position: absolute; inset: 0; z-index: var(--mr-z-dialog); background: var(--mr-bg-overlay); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center`. Inside the scrim, a `<div class="mr-dialog">` card SHALL render with `width: 420px; max-width: 92%; background: var(--mr-bg-panel); border: var(--mr-bw-1) solid var(--mr-line-2); border-radius: var(--mr-r-3); box-shadow: var(--mr-shadow-lg); overflow: hidden`.

The dialog card SHALL contain three sections in this order:

1. `.mr-dialog__hd` — header with `<h3>Export recording</h3>` and a `<p>` sub-line `Choose format · ${bars} bars · ${tracks} tracks · ${events} events`.
2. `.mr-dialog__body` — body containing the form fields (Format, Filename, Range, Tracks, Quantize, Include CC lanes).
3. `.mr-dialog__ft` — footer with `Cancel` and `Save · ⌘S` buttons.

The body and footer styling SHALL match the prototype's `app.css` lines 1027–1100 (`.mr-dialog-scrim`, `.mr-dialog`, `.mr-dialog__hd`, `.mr-dialog__body`, `.mr-dialog__ft`).

#### Scenario: Dialog renders with three sections in order

- **WHEN** the Export Dialog is open
- **THEN** the DOM SHALL contain `.mr-dialog-scrim > .mr-dialog > (.mr-dialog__hd, .mr-dialog__body, .mr-dialog__ft)` in that order
- **AND** the dialog card's computed width SHALL be `420px` (or `92vw` on viewports narrower than ~457px)
- **AND** the header SHALL contain an `<h3>` with text content `Export recording`

#### Scenario: Header sub-line summarises the export

- **WHEN** the Export Dialog is open
- **THEN** the header SHALL contain a `<p>` element with text matching the pattern `Choose format · {N} bars · {M} tracks · {K} events`
- **AND** `{M}` SHALL equal the count of currently-checked tracks in the Tracks list
- **AND** `{K}` SHALL equal the count of notes-and-lane-points whose `t` is in the resolved range AND whose channel is in the checked-tracks set
- **AND** `{N}` SHALL equal `(resolvedRangeT1 - resolvedRangeT0) / 4` rounded to one decimal (4 beats per bar)

### Requirement: Format radio offers Standard MIDI File and NDJSON

The dialog body SHALL render a Format field as a 2-column grid containing two `.mr-fmt-card` elements:

1. **Standard MIDI File** — title `Standard MIDI File`, subtitle `.mid · type 1`, default selected.
2. **NDJSON** — title `NDJSON`, subtitle `.ndjson · raw events`.

The selected card SHALL carry `data-on="true"` and SHALL be styled with `border: 1px solid var(--mr-accent); background: var(--mr-accent-soft)`. The non-selected card SHALL carry `data-on="false"` (or no `data-on` attribute) and SHALL be styled with `border: 1px solid var(--mr-line-2); background: transparent`.

Clicking a card SHALL set it as the selected format. The selection SHALL be local to the dialog component (via `useState`) and SHALL reset to `Standard MIDI File` each time the dialog re-opens.

The format selection SHALL update the default filename extension (`.mid` for Standard MIDI File, `.ndjson` for NDJSON) only if the user has not manually edited the filename input.

#### Scenario: Default format is Standard MIDI File

- **WHEN** the dialog opens
- **THEN** the `.mr-fmt-card` for Standard MIDI File SHALL have `data-on="true"`
- **AND** the `.mr-fmt-card` for NDJSON SHALL NOT have `data-on="true"`

#### Scenario: Clicking a format card switches selection

- **WHEN** the user clicks the NDJSON `.mr-fmt-card`
- **THEN** the NDJSON card SHALL transition to `data-on="true"`
- **AND** the Standard MIDI File card SHALL transition to `data-on="false"`
- **AND** the filename input value SHALL change its extension from `.mid` to `.ndjson` (only if the user has not manually edited the filename)

### Requirement: Filename input is editable text with a sensible default

The dialog body SHALL render a Filename field as a `.mr-row` containing a `<span class="mr-row-lbl">Filename</span>` label and an `<input class="mr-input" type="text">` element. The `.mr-input` rules SHALL live in `src/styles/forms.css` (the existing forms primitives file from Slice 6a).

The default filename SHALL be `session-${YYYY-MM-DD}.${ext}` where `${YYYY-MM-DD}` is the local-clock date on dialog mount (zero-padded) and `${ext}` is `mid` or `ndjson` based on the selected format. The input SHALL have `flex: 2` to fill the row; the label SHALL have a fixed minimum width matching other `.mr-row-lbl` instances.

#### Scenario: Filename defaults to today's date

- **WHEN** the dialog opens on date `2026-05-10`
- **THEN** the filename input value SHALL equal `session-2026-05-10.mid`

#### Scenario: User-edited filenames persist across format changes

- **WHEN** the user has edited the filename to `my-take.mid` AND switches the format to NDJSON
- **THEN** the filename input value SHALL remain `my-take.mid` (no automatic extension switch on user-edited filenames)

### Requirement: Range radio offers Whole session, Selection, and Loop region

The dialog body SHALL render a Range field as a `.mr-row` containing a `<span class="mr-row-lbl">Range</span>` label and three radio options in a row:

1. **Whole session** — always enabled. Resolves to `[0, max(n.t + n.dur))` over all notes and lane points across all channels (computed on demand per the `session-model` capability). When the session is empty, resolves to `[0, 0]`.
2. **Selection** — disabled when `useStage().resolvedSelection === null`. Resolves to `[min(n.t), max(n.t + n.dur))` over the notes in `resolvedSelection.indexes`.
3. **Loop region** — disabled when `useStage().loopRegion === null`. Resolves to `[loopRegion.start, loopRegion.end]`.

The default selected option SHALL be `Whole session`. Disabled options SHALL render with `opacity: 0.5; cursor: not-allowed` and SHALL NOT be selectable. If the user opens the dialog with `Whole session` selected, then closes the dialog, sets up a selection or loop region, and re-opens the dialog, the default SHALL still be `Whole session` (per Decision 3 — field state resets per open).

#### Scenario: Selection option is disabled when no selection

- **WHEN** the dialog opens AND `useStage().resolvedSelection === null`
- **THEN** the Range `Selection` radio SHALL render with the `disabled` attribute
- **AND** clicking the `Selection` label SHALL NOT change the selected range

#### Scenario: Loop region option is disabled when no loop region

- **WHEN** the dialog opens AND `useStage().loopRegion === null`
- **THEN** the Range `Loop region` radio SHALL render with the `disabled` attribute
- **AND** clicking the `Loop region` label SHALL NOT change the selected range

#### Scenario: Whole session is always enabled

- **WHEN** the dialog opens
- **THEN** the Range `Whole session` radio SHALL render without the `disabled` attribute
- **AND** the `Whole session` radio SHALL be the default-selected option (`checked`)

#### Scenario: Whole session resolves to the full event span

- **WHEN** the Range is `Whole session` AND the session contains notes ending at `t + dur` values up to `13.25`
- **THEN** the resolved range used for the events count and toast SHALL be `[0, 13.25)`

### Requirement: Tracks checkbox list lets the user pick channels to export

The dialog body SHALL render a Tracks field as a `.mr-row` containing a `<span class="mr-row-lbl">Tracks</span>` label and a vertical list of checkbox rows — one per channel in `useStage().channels`, in numeric ascending order of `Channel.id`. Each checkbox row SHALL contain:

- A `<input type="checkbox">` element, default checked.
- A small color swatch (8×8) using the channel's `color` field as `background`.
- The channel's `name` field as a label.
- A small mono count `n notes · m points` showing the count of notes (from the channel's roll, if any) and lane points (from all of the channel's lanes), both unfiltered by range.

Toggling a checkbox SHALL update the dialog's local tracks-set state. The header sub-line's `${tracks}` count and `${events}` count SHALL update reactively when checkboxes toggle.

If the user unchecks every checkbox, the Save button SHALL become disabled (per the empty-export-prevention rule in Open Question 1 of `design.md`).

#### Scenario: Tracks list contains one row per channel

- **WHEN** the dialog opens AND `useStage().channels` contains 2 channels (Lead and Bass)
- **THEN** the Tracks field SHALL contain exactly 2 checkbox rows
- **AND** each row SHALL show the channel's swatch, name, and event count
- **AND** all rows SHALL be checked by default

#### Scenario: Unchecking all tracks disables Save

- **WHEN** the user unchecks every track checkbox in the dialog
- **THEN** the Save button SHALL be `disabled`
- **AND** clicking the Save button SHALL NOT close the dialog or emit a toast

#### Scenario: Header sub-line updates when tracks toggle

- **WHEN** the user unchecks a track that contains 12 notes inside the resolved range
- **THEN** the header sub-line's `${events}` count SHALL decrease by exactly 12
- **AND** the `${tracks}` count SHALL decrease by 1

### Requirement: Quantize and Include CC lanes switches

The dialog body SHALL render two `.mr-row` rows below the Tracks field:

1. **Quantize on export** — a `.mr-switch` with `data-on="false"` by default. Visual stub (no underlying quantize logic in this slice).
2. **Include CC lanes** — a `.mr-switch` with `data-on="true"` by default. Toggling to `false` SHALL exclude lane points from the events count in the header sub-line.

Both switches SHALL reuse the `.mr-switch` primitive from `src/styles/forms.css`. Both SHALL be implemented as `<button>` elements for keyboard accessibility (Enter/Space toggles), with `aria-pressed` reflecting the `data-on` value.

#### Scenario: Default switch states

- **WHEN** the dialog opens
- **THEN** the Quantize switch SHALL have `data-on="false"`
- **AND** the Include CC lanes switch SHALL have `data-on="true"`

#### Scenario: Toggling Include CC lanes updates the events count

- **WHEN** the user toggles Include CC lanes from `true` to `false`
- **THEN** the Quantize switch's state SHALL be unchanged
- **AND** the header sub-line's `${events}` count SHALL recompute, excluding lane points

### Requirement: Footer Cancel and Save buttons

The dialog footer SHALL contain two buttons in this order, right-aligned:

1. **Cancel** — `.mr-btn` (no `data-primary`). Clicking calls `useStage().closeExportDialog()`.
2. **Save · ⌘S** — `.mr-btn` with `data-primary="true"`. Clicking emits the success toast (see next requirement) and calls `closeExportDialog()`.

The `.mr-btn` rules SHALL live in `src/styles/forms.css` (hoisted from `Inspector.css`'s slice-local rules per Decision 7 of `design.md`). The `[data-primary="true"]` variant SHALL render with `background: var(--mr-accent); color: var(--mr-text-on-accent); border-color: var(--mr-accent); font-weight: var(--mr-fw-semibold)`.

The Save button SHALL be `disabled` when the resolved range is empty (`resolvedRangeT0 === resolvedRangeT1`) OR when no tracks are checked (per the Tracks requirement above).

#### Scenario: Cancel closes the dialog without emitting a toast

- **WHEN** the user clicks the Cancel button
- **THEN** `closeExportDialog()` SHALL be called
- **AND** no toast SHALL appear
- **AND** the dialog SHALL be removed from the DOM on the next render

#### Scenario: Save emits a toast and closes the dialog

- **WHEN** the user clicks the Save button while it is enabled
- **THEN** a toast with message matching the pattern `Exported "<filename>" · <N> events` SHALL appear via `useToast().show(...)`
- **AND** `closeExportDialog()` SHALL be called
- **AND** the dialog SHALL be removed from the DOM on the next render

#### Scenario: Save button is disabled when no events would export

- **WHEN** the resolved range is empty (e.g. Whole session on an empty session)
- **THEN** the Save button SHALL render with the `disabled` attribute
- **AND** clicking the Save button SHALL NOT close the dialog or emit a toast

### Requirement: Save toast describes the resolved export

When the Save action fires (button click or `⌘S` keyboard shortcut), the dialog SHALL compute the resolved range `[t0, t1)` per the Range requirement and the events count `N` (notes-and-lane-points whose `t` is in `[t0, t1)` AND whose channel is in the checked-tracks set, with lane points excluded if Include CC lanes is `false`). The toast emitted via `useToast().show(...)` SHALL have message `Exported "<filename>" · <N> events` and default options (`kind: 'ok'`, `durationMs: 2000`).

The dialog SHALL NOT emit a real file. No `Blob` is created, no `URL.createObjectURL` is called, no `<a download>` element is generated. Real serialisation is Slice 10's concern.

#### Scenario: Toast text reflects the filename and event count

- **WHEN** the user has set the filename to `my-take.mid`, picked Range = Whole session, all tracks checked, and the session contains 1238 events in `[0, max(n.t + n.dur))`
- **AND** the user clicks the Save button
- **THEN** the toast message SHALL equal `Exported "my-take.mid" · 1238 events`

#### Scenario: No file is downloaded

- **WHEN** the user clicks the Save button
- **THEN** no `Blob` SHALL be created via `new Blob(...)`
- **AND** no `URL.createObjectURL` call SHALL be made by the dialog
- **AND** no anchor `<a download>` element SHALL be inserted into the DOM by the dialog

### Requirement: Dialog supports keyboard semantics

The dialog SHALL implement modal-keyboard semantics while open. Specifically:

- Pressing `Escape` SHALL call `closeExportDialog()`. The Escape handler SHALL NOT call `event.stopPropagation()` so other global listeners (e.g. the toast viewport's dismiss) can still observe the key event.
- Pressing `⌘S` (Mac) or `Ctrl+S` (other platforms) SHALL trigger the Save action (equivalent to clicking the Save button) IF the Save button is enabled. The default browser save behaviour SHALL be prevented via `event.preventDefault()`.
- `Tab` and `Shift+Tab` SHALL cycle focus through the dialog's focusable children only — attempting to tab past the last focusable element SHALL wrap to the first; attempting to shift-tab past the first SHALL wrap to the last.
- Clicking on the `.mr-dialog-scrim` backdrop (outside the `.mr-dialog` card) SHALL call `closeExportDialog()` (treated as a Cancel).

When the dialog opens, focus SHALL move to the first focusable child (typically the Standard MIDI File format card or the filename input). When the dialog closes, focus SHALL return to the element that was focused before the dialog opened (typically the Toolstrip's Export button).

#### Scenario: Escape closes the dialog

- **WHEN** the dialog is open AND the user presses `Escape`
- **THEN** `closeExportDialog()` SHALL be called
- **AND** the dialog SHALL be removed from the DOM on the next render

#### Scenario: ⌘S triggers Save

- **WHEN** the dialog is open AND the Save button is enabled AND the user presses `⌘S` (or `Ctrl+S`)
- **THEN** the same toast SHALL be emitted as if the user clicked Save
- **AND** the browser's default save dialog SHALL NOT appear

#### Scenario: Tab wraps within the dialog

- **WHEN** the dialog is open AND focus is on the Save button (last focusable element)
- **AND** the user presses `Tab`
- **THEN** focus SHALL move to the first focusable element in the dialog (the Standard MIDI File format card)

#### Scenario: Click on scrim closes the dialog

- **WHEN** the dialog is open AND the user clicks on the `.mr-dialog-scrim` element (outside the `.mr-dialog` card)
- **THEN** `closeExportDialog()` SHALL be called

#### Scenario: Focus returns to Export button on close

- **WHEN** the dialog is closed via any path (Cancel, Save, Escape, scrim click)
- **AND** the Export button was the previously-focused element when the dialog opened
- **THEN** focus SHALL return to the Toolstrip's Export button after the dialog removes from the DOM

### Requirement: Dialog field state is local and resets on each open

The `<ExportDialog>` component SHALL hold the following state via `useState`:

- `format: 'mid' | 'ndjson'` — defaults to `'mid'`.
- `filename: string` — defaults to `session-${YYYY-MM-DD}.mid` computed on mount.
- `range: 'whole' | 'selection' | 'loop'` — defaults to `'whole'`.
- `tracksOn: Set<ChannelId>` — defaults to a Set containing every `id` from `useStage().channels`.
- `quantize: boolean` — defaults to `false`.
- `includeCC: boolean` — defaults to `true`.

This state SHALL NOT be persisted across dialog closes; each open initialises fresh state. The state SHALL NOT be lifted onto `useStage`.

#### Scenario: Field state resets across open/close cycles

- **WHEN** the user opens the dialog, edits the filename to `take-1.mid`, then closes via Cancel
- **AND** later re-opens the dialog
- **THEN** the filename input SHALL show the default `session-${YYYY-MM-DD}.mid` again, not `take-1.mid`
