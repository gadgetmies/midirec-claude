## RENAMED Requirements

- FROM: `### Requirement: Format radio offers Standard MIDI File and NDJSON`
- TO: `### Requirement: Format radio offers Standard MIDI File and JSON Lines`

- FROM: `### Requirement: Save toast describes the resolved export`
- TO: `### Requirement: Save outcomes by format`

## MODIFIED Requirements

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
- **AND** `{M}` SHALL equal the count of currently-checked rows in the Tracks list
- **AND** `{K}` SHALL equal the count of export tally events in the resolved range whose source row is checked: channel notes (`t ∈ [t0,t1)`), optional lane points per Include CC lanes, plus DJ action events (`t ∈ [t0,t1)`, pitch in `actionMap`, subject to track/row mute and solo visibility rules mirrored from the DJ timeline)
- **AND** `{N}` SHALL equal `(resolvedRangeT1 - resolvedRangeT0) / 4` rounded to one decimal (4 beats per bar)

### Requirement: Format radio offers Standard MIDI File and JSON Lines

The dialog body SHALL render a Format field as a 2-column grid containing two `.mr-fmt-card` elements:

1. **Standard MIDI File** — title `Standard MIDI File`, subtitle `.mid · type 1`, default selected.
2. **JSON Lines** — title `JSON Lines`, subtitle `.jsonl · raw events`.

The selected card SHALL carry `data-on="true"` and SHALL be styled with `border: 1px solid var(--mr-accent); background: var(--mr-accent-soft)`. The non-selected card SHALL carry `data-on="false"` (or no `data-on` attribute) and SHALL be styled with `border: 1px solid var(--mr-line-2); background: transparent`.

Clicking a card SHALL set it as the selected format. The selection SHALL be local to the dialog component (via `useState`) and SHALL reset to `Standard MIDI File` each time the dialog re-opens.

The format selection SHALL update the default filename extension (`.mid` for Standard MIDI File, `.jsonl` for JSON Lines) only if the user has not manually edited the filename input.

#### Scenario: Default format is Standard MIDI File

- **WHEN** the dialog opens
- **THEN** the `.mr-fmt-card` for Standard MIDI File SHALL have `data-on="true"`
- **AND** the `.mr-fmt-card` for JSON Lines SHALL NOT have `data-on="true"`

#### Scenario: Clicking a format card switches selection

- **WHEN** the user clicks the JSON Lines `.mr-fmt-card`
- **THEN** the JSON Lines card SHALL transition to `data-on="true"`
- **AND** the Standard MIDI File card SHALL transition to `data-on="false"`
- **AND** the filename input value SHALL change its extension from `.mid` to `.jsonl` (only if the user has not manually edited the filename)

### Requirement: Filename input is editable text with a sensible default

The dialog body SHALL render a Filename field as a `.mr-row` containing a `<span class="mr-row-lbl">Filename</span>` label and an `<input class="mr-input" type="text">` element. The `.mr-input` rules SHALL live in `src/styles/forms.css` (the existing forms primitives file from Slice 6a).

The default filename SHALL be `session-${YYYY-MM-DD}.${ext}` where `${YYYY-MM-DD}` is the local-clock date on dialog mount (zero-padded) and `${ext}` is `mid` or `jsonl` based on the selected format. The input SHALL have `flex: 2` to fill the row; the label SHALL have a fixed minimum width matching other `.mr-row-lbl` instances.

#### Scenario: Filename defaults to today's date

- **WHEN** the dialog opens on date `2026-05-10`
- **THEN** the filename input value SHALL equal `session-2026-05-10.mid`

#### Scenario: User-edited filenames persist across format changes

- **WHEN** the user has edited the filename to `my-take.mid` AND switches the format to JSON Lines
- **THEN** the filename input value SHALL remain `my-take.mid` (no automatic extension switch on user-edited filenames)

### Requirement: Range radio offers Whole session, Selection, and Loop region

The dialog body SHALL render a Range field as a `.mr-row` containing a `<span class="mr-row-lbl">Range</span>` label and three radio options in a row:

1. **Whole session** — always enabled. Resolves to `[0, hi)` where `hi` is the maximum ending beat across (a) all notes `t + dur`, (b) all lane points `t`, and (c) all DJ action events `t + dur`, across visible session data (`session-model`). When none of these layers carry timing data (`hi <= 0`), resolves to `[0, 0]`.
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

- **WHEN** the Range is `Whole session` AND the timeline contains DJ action events ending at beat `42.5`
- **THEN** the resolved upper bound SHALL be ≥ `42.5` regardless of instrument roll emptiness
- **AND** the bounds used by the toast and tally SHALL extend at least `[0, 42.5)` for counting those events

### Requirement: Tracks checkbox list lets the user pick channels to export

The dialog body SHALL render a Tracks field as a `.mr-row` containing a `<span class="mr-row-lbl">Tracks</span>` label and a vertical list of checkbox rows. Rows SHALL comprise:

1. **Instrument channels:** one row per qualifying channel in ascending `Channel.id` order **only if** `(channelHasContent)` OR `djActionTracks` is empty. When `djActionTracks.length > 0`, channels without notes and without lane points SHALL NOT appear unless the instrument session later gains lane/note data requiring their presence (same predicate re-evaluates each dialog open).

2. **DJ action tracks:** one row per `useStage().djActionTracks` entry in array order, always when the array is non-empty. Each DJ row SHALL use `track.color` for the swatch, `track.name` as label, mono summary `z actions · q events`, where `z = Object.keys(actionMap).length` and `q = events.length`.

Each checkbox row SHALL contain:

- A `<input type="checkbox">`, default checked for every rendered row once the filtered list is computed.
- A small color swatch (8×8) using `color`.
- Label text (`name`).
- The mono tally fields described above (`n notes · m points` channels; DJ variant as specified).

Toggling a checkbox SHALL update the dialog's local tracks-set state. The header sub-line `${tracks}` and `${events}` SHALL update reactively when checkboxes toggle.

If every rendered row is unchecked, the Save button SHALL become disabled.

#### Scenario: Tracks list contains one row per channel

- **WHEN** the dialog opens AND `useStage().channels` contains 2 channels AND both have seeded notes plus `djActionTracks` is empty
- **THEN** the Tracks field SHALL contain exactly 2 checkbox rows referencing those channels

#### Scenario: DJ demo hides empty instrument scaffolding

- **WHEN** the dialog opens AND `demo=dj` seeded state has empty instrument rolls/lanes BUT one DJ track with events
- **THEN** the Tracks field SHALL NOT list Lead/Bass scaffolding rows absent note/lane counts
- **AND** SHALL list exactly one row for that DJ track

#### Scenario: Unchecking all tracks disables Save

- **WHEN** every rendered track checkbox becomes unchecked
- **THEN** the Save button SHALL be `disabled`
- **AND** clicking the Save button SHALL NOT close the dialog or emit success output

#### Scenario: Header sub-line updates when tracks toggle

- **WHEN** the user unchecks a DJ row that contributes 11 counted events inside the resolved range
- **THEN** the header sub-line's `${events}` count SHALL decrease by exactly `11`
- **AND** the `${tracks}` count SHALL decrease by `1`

### Requirement: Footer Cancel and Save buttons

The dialog footer SHALL contain two buttons in this order, right-aligned:

1. **Cancel** — `.mr-btn` (no `data-primary`). Clicking calls `useStage().closeExportDialog()`.
2. **Save · ⌘S** — `.mr-btn` with `data-primary="true"`. Clicking performs the Save action (see Requirement: Save outcomes by format).

The `.mr-btn` rules SHALL live in `src/styles/forms.css` (hoisted from `Inspector.css`'s slice-local rules per Decision 7 of `design.md`). The `[data-primary="true"]` variant SHALL render with `background: var(--mr-accent); color: var(--mr-text-on-accent); border-color: var(--mr-accent); font-weight: var(--mr-fw-semibold)`.

The Save button SHALL be `disabled` when the resolved range is empty (`resolvedRangeT0 === resolvedRangeT1`) OR when no checklist rows remain checked OR when the counted export events total zero.

#### Scenario: Cancel closes the dialog without emitting a toast

- **WHEN** the user clicks the Cancel button
- **THEN** `closeExportDialog()` SHALL be called
- **AND** no toast SHALL appear
- **AND** the dialog SHALL be removed from the DOM on the next render

#### Scenario: Save emits JSONL download with toast when JSON Lines chosen

- **WHEN** the user selects JSON Lines AND Save is enabled
- **AND** the user clicks Save
- **THEN** the browser SHALL download a `.jsonl` file reflecting checked rows
- **AND** `useToast().show(...)` SHALL fire with pattern `Exported "<filename>" · <N> events`
- **AND** `closeExportDialog()` SHALL run afterward

#### Scenario: Save emits toast-only when Standard MIDI remains unimplemented on disk

- **WHEN** Standard MIDI File is selected AND Save is enabled
- **THEN** clicking Save emits the acknowledgement toast matching the existing MID stub behaviour
- **AND** SHALL NOT synthesise downloadable JSON Lines

### Requirement: Save outcomes by format

When Save fires (`click` or `⌘S`/`Ctrl+S` while enabled), the dialog SHALL calculate resolved range `[t0, t1)` and counted events `N` per the Header sub-line rule.

If the selected format is **Standard MIDI File**, the dialog SHALL **not** create a downloadable file (Slice 10 still owns MIDI binary export). No `Blob` SHALL be instantiated for MIDI from this hook.

If the selected format is **JSON Lines**, the dialog SHALL synthesise newline-delimited JSON objects UTF-8 encoded and trigger a browser download (`Blob`/`URL.createObjectURL` permitted). Each exported DJ action event counted toward `N` SHALL produce one JSON object `kind: 'dj.action'`, numeric `version: 2`, `message` `'note'` or `'cc'` per row output semantics, numeric `tick` and `durationTicks` (notes only; CC rows omit duration) derived from beats using `beats × tpq`, integer `tpq` defaults to standard MIDI divisions per quarter (480), plus `midiChannel`, `trackId`, `trackName`, `actionId`. Note rows SHALL include `pitch`, `velocity` (and optional `pressure`); CC rows SHALL include `controller` and `value` (zero–127) instead of pitch/duration/velocity semantics.

The success toast MUST always read `Exported "<filename>" · <N> events` with default toast options whenever Save completes successfully.

#### Scenario: JSON Lines emits Blob for DJ demos

- **WHEN** JSON Lines chosen AND Whole session spanning DJ clips AND DJ row checked with content
- **AND** Save is invoked
- **THEN** execution SHALL instantiate `Blob`/`URL.createObjectURL` for UTF-8 JSON Lines
- **AND** at least one line SHALL parse as JSON referencing the DJ track identifier

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
- **THEN** the same Save outcome fires as clicking Save including JSON Lines download semantics when selected
- **AND** the browser's default save dialog unrelated to MIME download SHALL NOT appear

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

- `format: 'mid' | 'jsonl'` — defaults to `'mid'`.
- `filename: string` — defaults to `session-${YYYY-MM-DD}.mid` computed on mount.
- `range: 'whole' | 'selection' | 'loop'` — defaults to `'whole'`.
- `tracksOn` — defaults to selecting every checkbox row enumerated at open (channels gated per Tracks requirement + DJ tracks).
- `quantize: boolean` — defaults to `false`.
- `includeCC: boolean` — defaults to `true`.

This state SHALL NOT be persisted across dialog closes; each open initialises fresh state. The state SHALL NOT be lifted onto `useStage`.

#### Scenario: Field state resets across open/close cycles

- **WHEN** the user opens the dialog, edits the filename to `take-1.mid`, then closes via Cancel
- **AND** later re-opens the dialog
- **THEN** the filename input SHALL show the default `session-${YYYY-MM-DD}.mid` again, not `take-1.mid`
