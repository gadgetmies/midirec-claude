## Context

The Export Dialog is the second half of Slice 6, packaged as a standalone change after the Browser Sidebar shipped on 2026-05-10. The Toolstrip remains the only visible empty region in the app shell — `<span class="mr-stub">Toolstrip</span>` per `AppShell.tsx:34`. The dialog is the natural Toolstrip-button consumer: clicking the strip's first functional control opens the dialog as an overlay. Once shipped, only Statusbar will be left empty (Slice 10).

Three upstream realities shape the slice:

1. **The session-model contract is settled.** The `session-model` capability already defines `loopRegion: { start, end } | null` and prescribes that `Whole session` resolves to `[0, max(n.t + n.dur))` computed on demand. The dialog's `Range` radio is the first user-visible consumer of this contract; the data shape needs no new work.

2. **Save is a stub in this slice.** Real `.mid` and `.ndjson` serialisation are explicitly Slice 10 concerns (audio engine wiring). The dialog ships the visual + state contract. Clicking Save closes the dialog and emits a toast describing what would have been exported, with the resolved range and event count. Same convention as M/S chips, the `+ Add Lane` button, and the Inspector's bulk-action buttons.

3. **The prototype's dialog is incomplete vs. the impl plan.** The prototype has Format / Filename / Quantize / Include CC, but no Range or Tracks (`design_handoff_midi_recorder/prototype/components.jsx:1024-1075`). The impl plan and the session-model proposal both describe Range and Tracks as part of Slice 6's scope. We ship the union and log the deviation, matching the precedent set by Slice 6a (which followed the prototype against the impl plan's `Devices / Files / Markers` sketch when the prototype was the more-realised source — the situation is reversed here, but the principle is the same: the codebase ships the more-realised contract and logs the divergence).

## Goals / Non-Goals

**Goals:**

- Fill the Toolstrip with at least one functional control — the Export button — so the region is no longer in the empty-regions rule.
- Mount a `<ExportDialog>` overlay matching the prototype's structure, ordering, and visual language, plus the impl plan's Range and Tracks fields.
- Resolve `Range` per the session-model contract: `Whole session` → `[0, max(n.t + n.dur))` computed on demand; `Selection` → `[min(n.t), max(n.t + n.dur))` over `resolvedSelection`; `Loop region` → `[loopRegion.start, loopRegion.end]`. Disable options whose source is null/empty.
- Hoist `.mr-btn` from `Inspector.css` to the shared `forms.css` (the dialog footer is the second consumer); add `.mr-input` to `forms.css`.
- Wire keyboard semantics: `Escape` closes, `⌘S` saves, focus traps inside the dialog while it's open, focus returns to the Export button on close.
- Emit a toast on Save describing the resolved range and event count, so the user gets the same "I clicked the thing and something happened" feedback the rest of the app provides.

**Non-Goals:**

- Real `.mid` (Standard MIDI File type 1) or `.ndjson` serialisation. (Slice 10.)
- File download via `Blob` + `URL.createObjectURL`. (Slice 10.)
- Drag-to-resize the dialog, multiple-format export presets, recently-used filename history.
- The Action Map editor for DJ mode (Slice 8).
- Persistence of the dialog's last-used field values across sessions.
- Per-track or per-CC-lane fine-grained export filters beyond the Tracks on/off checkbox list and the global Include CC lanes switch.

## Decisions

### Decision 1: Render the dialog as a sibling of `.mr-shell`'s body, not portaled

**Choice:** `<ExportDialog>` is rendered as a conditional child of `<div class="mr-shell">` in `AppShell.tsx`, positioned `absolute; inset: 0` via `.mr-dialog-scrim`. It does NOT use a React portal.

**Why:** The shell is already a single `.mr-shell` div containing every visible region; the scrim's `position: absolute; inset: 0` covers the entire shell when its parent is `.mr-shell` with `position: relative` (already true today via `App.css`). A portal adds a second mount point, complicates the focus trap (escape-out-via-Tab to the body would land on document.body, not back into the shell), and gains nothing — the shell's stacking context is the right one for a dialog scrim. The toast viewport already uses the same convention.

**Alternatives considered:**

- *Portal into `document.body`.* Rejected — buys nothing here. The shell IS the only mounted UI; portaling out of it just means the portal target is `document.body` which is structurally identical to `.mr-shell`.

### Decision 2: `dialogOpen` lives on `useStage`, not in `AppShell` local state

**Choice:** Add `dialogOpen: boolean`, `openExportDialog(): void`, `closeExportDialog(): void` to the `StageState` interface and `useStage` hook.

**Why:** The Toolstrip's Export button (a child of `<AppShell>`) and the dialog itself (also a child of `<AppShell>`) both need access. The Inspector's bulk-action buttons and the future Action Map editor's "Export action map" affordance will also want to open the dialog — keyboard shortcut handlers on the document level (e.g. `⌘S` to save when the dialog is open, `⌘E` to open it from anywhere — future work) will need access too. Lifting state higher than `AppShell` (to `useStage`, the single-source-of-truth) avoids prop-drilling and makes "is the dialog open right now" derivable anywhere in the tree.

**Implementation note:** `useStage` was a plain hook before this slice — every caller (`AppShell`, `Inspector`, and now `Toolstrip`/`ExportDialog`) got its own `useState`/`useReducer` instance. Adding `dialogOpen` exposed the latent bug: Toolstrip's `openExportDialog()` flipped its local copy, but AppShell's `dialogOpen` stayed `false`. This slice introduces `<StageProvider>` and converts `useStage` to read from `StageContext`, mirroring the existing pattern used by `useTransport` and `useToast`. `App.tsx` wraps `<AppShell />` in `<StageProvider>`. This silently fixes a latent bug where `Inspector` would not have seen mute/solo/collapse toggles dispatched from `AppShell` — invisible today because Inspector only reads immutable fields, but real once Inspector starts reacting to mutable state.

**Alternatives considered:**

- *Local `useState` in `AppShell`.* Rejected — couples the dialog's open/close to the Toolstrip's button via prop-drilling, and blocks future remote callers (keyboard shortcut listeners, the Inspector, the Action Map editor) from opening the dialog without lifting state again.
- *Dedicated dialog context (`<DialogProvider>` like `<ToastProvider>`).* Rejected — premature; the dialog is one boolean. If a second dialog appears later (Action Map editor, settings, etc.), revisit and consolidate then.

### Decision 3: Dialog field state is local to `<ExportDialog>`, not on `useStage`

**Choice:** `<ExportDialog>` holds its own `useState` for: format (radio), filename (string), range (radio), tracks (checkbox set), quantize (boolean), includeCC (boolean). State resets to defaults each time the dialog reopens.

**Why:** Field state is purely transient — the user pulls up the dialog, picks options, hits Save (toast emitted, state thrown away) or Cancel (state thrown away). No persistence, no cross-component access. Keeping the state local to the dialog component matches how the prototype models it (the prototype's `ExportDialog()` takes no props). Filename defaults to `session-${YYYY-MM-DD}.mid` computed on mount.

**Alternatives considered:**

- *Persist field state on `useStage`.* Rejected — the user has no expectation that re-opening the dialog will restore last-used values. If they do, it's a Slice 10 feature (alongside real export).

### Decision 4: Range disabled-when-unavailable rule reads from `useStage`

**Choice:** The dialog calls `useStage()` once on mount and reads `loopRegion`, `resolvedSelection`. The Range radio's `Selection` option is `disabled` when `resolvedSelection === null`. The `Loop region` option is `disabled` when `loopRegion === null`. The `Whole session` option is always enabled.

**Why:** The session-model contract makes the unavailability case meaningful: a user with no selection and no loop region defined should NOT be able to pick a range that would resolve to nothing. The disabled-state visual (lower opacity + `cursor: not-allowed`) signals "set up a selection or a loop region first."

**Alternatives considered:**

- *Hide unavailable options instead of disabling.* Rejected — hiding makes the dialog's structure depend on stage state, and a user who's used the dialog before would notice options going missing rather than seeing the disabled state with a tooltip.
- *Default to whichever option is available, picking `Loop region` > `Selection` > `Whole session`.* Rejected — a default of `Whole session` is unsurprising and doesn't depend on transient state. The user can pick another option if they want.

### Decision 5: Save action emits a toast and closes the dialog; no file output

**Choice:** Clicking Save (or pressing `⌘S` while the dialog is open) computes the resolved range `[t0, t1)` and the event count over the selected tracks (`notes + lane points` whose `t` is in the range), then closes the dialog and calls `toast.show("Exported \"<filename>\" · <N> events")`.

**Why:** The slice ships the visual + state contract, not the serialisation. The toast gives the user feedback that the action fired and surfaces what the dialog computed (resolved range, event count) — useful as a sanity check during the slice, and useful as a smoke test once Slice 10 plugs in real serialisation (the toast can stay or be replaced by the real export's success/failure feedback).

**Alternatives considered:**

- *Save is a no-op (button does nothing).* Rejected — feels broken; user sees no feedback that the click registered.
- *Save downloads a JSON file describing the export config.* Rejected — would make the dialog look like it's "working" when it isn't, setting a wrong expectation. The toast's `Exported "<filename>" · <N> events` text is honest about being a stub.

### Decision 6: Format radio cards use class-based CSS, not the prototype's inline styles

**Choice:** The prototype's two `<label style={...}>` blocks (`components.jsx:1035-1053`) are converted to `.mr-fmt-card` and `.mr-fmt-card[data-on="true"]` rules in `Dialog.css`. The selected card has `border: 1px solid var(--mr-accent); background: var(--mr-accent-soft)`; the unselected card has `border: 1px solid var(--mr-line-2)`.

**Why:** Same rationale as Slice 6a's routing-matrix decision (D5 in `archive/2026-05-10-browser-sidebar/design.md`): inline styles in the prototype are a design-canvas convenience; production code wants classes for theme-token cascading. The pattern is small (~15 lines).

**Alternatives considered:**

- *Port inline-styles verbatim.* Rejected — same as Slice 6a, breaks the codebase convention.

### Decision 7: Hoist `.mr-btn` to `src/styles/forms.css`; replace `Inspector.css`'s slice-local rules with a comment pointing there

**Choice:** Move `.mr-btn`, `.mr-btn:hover`, `.mr-btn[data-danger="true"]`, `.mr-btn[data-danger="true"]:hover` from `Inspector.css` lines 192–227 into `src/styles/forms.css`. Add `.mr-btn[data-primary="true"]`, `.mr-btn[data-primary="true"]:hover` rules new (the dialog footer needs them; the Inspector doesn't use them today). Add `.mr-input` rules new (no prior consumer). Replace `Inspector.css`'s `.mr-btn` block with a comment `/* .mr-btn rules live in src/styles/forms.css */`. Verify byte-for-byte that the moved rules are unchanged.

**Why:** Follows the Slice 6a hoist-on-second-consumer convention (`tasks.md` task 1.3 in the archived browser-sidebar change). The dialog's footer is the second `.mr-btn` consumer. Co-locating the rule with `Inspector.css` would mean two places to keep in sync — and the next consumer (Action Map editor in Slice 8) would be a third.

**Alternatives considered:**

- *Duplicate the `.mr-btn` rules in `Dialog.css`.* Rejected — drift risk (the Slice 6a docs explicitly call out "we already lost an afternoon to this on `.mr-chev` getting redefined three times").
- *Keep `.mr-btn` in `Inspector.css`, import it into `Dialog.css`.* Rejected — CSS doesn't `import` cleanly across components, and Vite's module graph would conflate Inspector and Dialog stylesheets in unexpected ways.

### Decision 8: Focus management — trap inside the dialog while open, return to Export button on close

**Choice:** While the dialog is open, `Tab` and `Shift+Tab` cycle through the dialog's focusable children only (the format radios, filename input, range radios, track checkboxes, switches, Cancel button, Save button); attempting to tab past the last/first wraps around. On `dialogOpen: false`, focus returns to the Toolstrip's Export button via a `useEffect` that captures the previously-focused element on open and restores it on close.

**Why:** Standard dialog accessibility. The patterns are well-established (see WAI-ARIA Authoring Practices "Modal Dialog"); we implement them inline rather than pulling in a focus-trap library because the dialog is small and we control every focusable child. Pressing `Escape` closes the dialog, calling `closeExportDialog()` (with no `event.stopPropagation()` — global handlers like the toast viewport's dismiss can still receive it).

**Alternatives considered:**

- *Skip the focus trap, rely on the scrim's pointer-event blocking alone.* Rejected — keyboard users can tab past the dialog into the timeline below it, which is a clear bug (the timeline is visually inert, but its buttons are still reachable).
- *Pull in `focus-trap-react`.* Rejected — extra dependency for ~20 lines of behaviour we can author ourselves.

### Decision 9: Toolstrip ships only the Export button in this slice

**Choice:** `<Toolstrip>` becomes a small component at `src/components/toolstrip/Toolstrip.tsx` containing one `<button class="mr-tool" title="Export">` with the download SVG glyph. The `mr-tool` class definition lives in `src/components/toolstrip/Toolstrip.css` (new file). All other tool buttons in the prototype's `Toolstrip()` (select arrow, transpose, quantize, etc.) are NOT ported in this slice — they belong to a future "Toolstrip primary actions" slice that has its own design pass.

**Why:** Scope discipline. Slice 6b is the export dialog; the Toolstrip is the dialog's launch point, not the slice's subject. Porting all 10+ tools from the prototype would be a half-day on its own, and most of them have no current consumer (transpose has no edit hook, quantize has no algorithm). Ship the one button that's needed and leave the rest for when they have functioning consumers.

**Alternatives considered:**

- *Port the entire prototype's Toolstrip.* Rejected — out of scope; the other buttons would be visual stubs without consumers, fattening the change for no behavioral gain.
- *Inline the Export button in `AppShell.tsx` without a `<Toolstrip>` component.* Rejected — the next Toolstrip consumer (DJ mode toggle in Slice 7, or any Slice-10 transport addition) will need a component anyway. Cleaner to introduce the component now with one child.

## Risks / Trade-offs

- **[Risk] Hoisting `.mr-btn` from `Inspector.css` to `forms.css` could break the Inspector's existing rendering.** → Mitigation: read the Inspector's current `.mr-btn` rules byte-for-byte (lines 202–230 of `Inspector.css`), copy them verbatim into `forms.css`, then delete from `Inspector.css`. Verify in DevTools that the Inspector's bulk-action buttons render identically before and after. The same mitigation Slice 6a used for `.mr-led` (Titlebar.css → leds.css) and `.mr-row`/`.mr-chip`/`.mr-switch` (new in `forms.css`) — has a clean precedent.
- **[Risk] The dialog's scrim covers the toast viewport, so a Save-emitted toast won't be visible.** → Mitigation: the toast viewport is a sibling of `<ExportDialog>` (both children of `.mr-shell`), and the toast viewport has `--mr-z-toast: 300` while the dialog has `--mr-z-dialog: 200`. Toast renders ABOVE the dialog. Confirmed by reading `tokens.css:142` and the toast CSS — the layering is correct. But: the Save action closes the dialog first, THEN emits the toast (sequential), so the dialog isn't actually visible when the toast appears regardless of z-order. Belt-and-braces.
- **[Risk] `loopRegion` and `resolvedSelection` are computed each render in `useStage`; reading them in `<ExportDialog>` adds another consumer.** → Mitigation: `useStage` already memoises both fields (`useMemo` for `resolvedSelection`, direct lookup for `loopRegion`); adding the dialog as a consumer doesn't change render frequency. The dialog only needs them on mount and on field-change, both of which already trigger renders.
- **[Risk] Filename default `session-${YYYY-MM-DD}.mid` uses the local clock, which may not match the user's session timezone.** → Acceptable: the filename is editable, and the user notices on Save. If timezone-correctness matters for real export, Slice 10 can revisit.
- **[Trade-off] No keyboard shortcut to OPEN the dialog (e.g. `⌘E`) in this slice.** → Acceptable: the Toolstrip's Export button is reachable via Tab from the titlebar, and `⌘S` only works while the dialog is already open. A global `⌘E` opener belongs to a future "Keyboard shortcuts" slice that also handles the rest of the app's shortcut-set.
- **[Trade-off] No "Recently exported" history in the dialog.** → Acceptable: out of scope for the slice. Real export is Slice 10's concern; history would only be meaningful once exports actually happen.
- **[Trade-off] The Tracks checkbox list shows ALL channels, including ones with no notes and no lane points.** → Acceptable: matches the user's mental model (channels in `state.channels` are channels they've explicitly added; an empty channel might still be selected for export to indicate "yes, the .mid file should reserve track N for this channel"). If this is the wrong default, the future "explicit-membership channel visibility" backlog item will reshape it.

## Open Questions

- **Should the Save button be disabled when the resolved range is empty (e.g., Whole session selected on an empty session)?** Probably yes — saving an empty file is a footgun. Resolved during implementation: disable the Save button when `resolvedRangeT0 === resolvedRangeT1` OR when the selected-tracks set is empty. The toast text in the disabled case is N/A (the button can't fire).
- **Should the dialog remember whether the user last picked Standard MIDI File or NDJSON?** Probably no — Decision 3 says field state is per-open. If users complain, revisit in Slice 10 alongside real export.
- **Should the events-count summary in the header sub-line update LIVE as the user changes Range / Tracks / Include CC?** Probably yes — the sub-line is `Choose format · ${bars} bars · ${tracksOn} tracks · ${events} events` and recomputing on field change is cheap. Resolve during implementation by deriving the sub-line from the dialog's local state in the render path.
