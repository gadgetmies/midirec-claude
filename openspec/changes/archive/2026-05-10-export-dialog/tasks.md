## 1. Reconnaissance & primitive consolidation

- [x] 1.1 Findings: `.mr-btn` lives at `Inspector.css:202-229` (4 rules) plus `.mr-insp-bulk-grid > .mr-btn` override at `:192-196`. Other primitives (`.mr-input`, `.mr-dialog*`, `.mr-fmt-card`, `.mr-tool`) not defined anywhere in `src/`. Confirmed.
- [x] 1.2 Plan locked in (executed in §6): hoist 4 `.mr-btn` rules to `forms.css`; keep `.mr-insp-bulk-grid > .mr-btn` override in `Inspector.css`; add `.mr-btn[data-primary="true"]` (+ hover) and `.mr-input` rules new in `forms.css`.
- [x] 1.3 All required tokens already in `tokens.css`: `--mr-bg-overlay:18`, `--mr-z-dialog:142`, `--mr-z-toast:143`, `--mr-shadow-lg:115`, `--mr-h-control-md:122`, `--mr-r-3:104`, `--mr-bw-1:109`, `--mr-text-on-accent:31`, `--mr-accent-hover:35`, `--mr-bg-input:14`, `--mr-fw-semibold:83`. No additions needed.
- [x] 1.4 `AppShell.tsx:34` shows `<span className="mr-stub">Toolstrip</span>`. Stub confirmed.

## 2. Stage state additions

- [x] 2.1 Added `dialogOpen`, `openExportDialog`, `closeExportDialog` to `StageState`.
- [x] 2.2 Added `useState<boolean>(false)` and `useCallback` actions inside `useStage`.
- [x] 2.3 Wired into returned object — initial `dialogOpen === false`.
- [x] 2.4 Greps confirm no existing reader/writer of `dialogOpen` — fresh field.

## 3. Toolstrip component

- [x] 3.1 Created `Toolstrip.tsx` rendering a single `<button class="mr-tool">` with the download glyph; click → `openExportDialog`.
- [x] 3.2 Created `Toolstrip.css` with `.mr-tool` rules (28px control height, 8px padding, transparent → panel-2 hover, focus ring).
- [x] 3.3 Added `DownloadIcon` to `icons/transport.tsx` (12×12, currentColor, strokeWidth 1.2).
- [x] 3.4 `AppShell.tsx` now imports and mounts `<Toolstrip />` in `.mr-toolstrip`. Stub gone.

## 4. ExportDialog component

- [x] 4.1 Created `dialog/ExportDialog.tsx` and `Dialog.css` co-located; reads all state from `useStage`.
- [x] 4.2 Local state for `format`, `filename`, `userEdited`, `range`, `tracksOn`, `quantize`, `includeCC`. Resets per mount (dialog unmounts on close).
- [x] 4.3 `computeRange` and `countEventsInRange` helpers at top of file; derived `resolvedRange`, `eventCount`, `bars`, `tracksCheckedCount` via `useMemo`.
- [x] 4.4 `.mr-dialog-scrim` click handler closes the dialog only when target === currentTarget; `.mr-dialog` carries `role="dialog" aria-modal="true" aria-labelledby="mr-dialog-title"`.
- [x] 4.5 Header renders `<h3>Export recording</h3>` + sub-line. Note: also added `loopRegion: LoopRegion | null` field to `useStage` (defaulting to `null`) since the session-model spec defines it but no source code had wired it yet — this slice is the first consumer per the session-model proposal.
- [x] 4.6 Body renders Format grid, Filename row, Range row, Tracks row (with `.mr-row--top` modifier), Quantize switch, Include CC switch — in that order.
- [x] 4.7 Footer renders Cancel + `Save · ⌘S` (data-primary, disabled when `!canSave`).
- [x] 4.8 Save handler emits toast `Exported "${filename}" · ${eventCount} events` then `closeExportDialog()`. No file I/O.
- [x] 4.9 Document-level `keydown` listener handles `Escape` (close), `Cmd/Ctrl+S` (save with `preventDefault`), `Tab`/`Shift+Tab` (wrap).
- [x] 4.10 Focus trap captures `document.activeElement` on mount, focuses the first focusable child of the dialog, restores on unmount. Inline helper (no third-party).

## 5. Dialog CSS

- [x] 5.1 `.mr-dialog-scrim` added to `Dialog.css` (absolute, inset 0, overlay bg, blur 2px, flex center, z-index `var(--mr-z-dialog)`).
- [x] 5.2 `.mr-dialog` (480px width — bumped from prototype's 420px to fit Range + Tracks + Filename rows comfortably), `.mr-dialog__hd`, `.mr-dialog__body`, `.mr-dialog__ft` ported.
- [x] 5.3 `.mr-fmt-card` + `[data-on="true"]` + `__title` + `__sub` rules added. Class-based (no inline styles).
- [x] 5.4 `.mr-fmt-grid` 2-column rule added.
- [x] 5.5 `.mr-trk-list` + `.mr-trk-row` rules added. Layout: checkbox · swatch · name · count.
- [x] 5.6 `.mr-trk-swatch` (8×8 circle, `--ch-color` custom property) added.
- [x] 5.7 `.mr-range-radios` + `.mr-range-radio` + `[data-disabled="true"]` rules added. `data-disabled` set on the `<label>` from the radio component (more reliable than `:has(:disabled)` cross-browser).

## 6. forms.css and Inspector.css edits

- [x] 6.1 Moved `.mr-btn`, `.mr-btn:hover`, `.mr-btn[data-danger="true"]`, `.mr-btn[data-danger="true"]:hover` from `Inspector.css` to `forms.css`. Added a `:focus-visible` ring and a `[disabled]` opacity rule for completeness.
- [x] 6.2 Added `.mr-btn[data-primary="true"]` + hover to `forms.css`.
- [x] 6.3 Added `.mr-input` rules to `forms.css` (28px control, panel input bg, accent focus ring).
- [x] 6.4 Replaced the moved block in `Inspector.css` with a 2-line comment pointing to `forms.css`. The `.mr-insp-bulk-grid > .mr-btn` size override stays (inspector-specific). Updated the file's top-of-file comment to reflect the hoist.

## 7. AppShell integration

- [x] 7.1 `AppShell.tsx` now renders `{stage.dialogOpen && <ExportDialog />}` as the last child of `.mr-shell`, after `<ToastViewport />`.
- [x] 7.2 Toolstrip stub replaced (also covered in §3).
- [x] 7.3 `AppShell.css` unchanged — `.mr-shell` `position: relative` is in place from Slice 0.

## 8. Spec sync and design-doc updates

- [x] 8.1 Added deviation #13 to `design/deviations-from-prototype.md` and a row to the summary table.
- [x] 8.2 No-op — `design/README.md` only references the deviations file (no duplicate table).
- [x] 8.3 `openspec validate export-dialog --strict` clean.

## 9. Verification

- [x] 9.1 `yarn typecheck` clean.
- [x] 9.2 `yarn test --run` — 13/13 passing.
- [x] 9.3 Manual visual check — user verified the dialog opens on Toolstrip Export click (after the StageProvider fix in §10.1c). Remaining sub-checks (format card switch, filename default, Range disabled state, Tracks counts, switches, Cancel/Save toast) are still user-verifiable but not blocking archive.
- [ ] 9.4 Manual keyboard check — deferred to user.
- [ ] 9.5 Manual reset-on-reopen check — deferred to user.
- [x] 9.6 `grep -rn 'mr-stub' src/components/shell/` returns only `Statusbar` (in `AppShell.tsx:81`) and the `.mr-stub` class def in `AppShell.css:125`. Toolstrip stub gone.
- [x] 9.7 `grep -rn '^\.mr-btn\s*{' src/` returns exactly one match: `src/styles/forms.css:89`. `.mr-insp-bulk-grid > .mr-btn` is a distinct compound selector in `Inspector.css` (unchanged).

## 10. Pre-archive cleanup

- [x] 10.1 Re-read proposal: all `What Changes` bullets shipped. Three implementation refinements worth recording: (a) added `loopRegion: LoopRegion | null` to `useStage` (defaults to `null`) — the session-model spec defined the shape but no source had wired it; this slice is the first consumer per the session-model proposal. The dialog reads it and shows the Loop region radio as disabled, matching the spec. (b) Dialog widened to 480px (up from prototype's 420px) to fit the Range and Tracks rows comfortably; recorded in deviation #13. (c) Converted `useStage` from a plain hook to a Context-backed hook (`StageProvider` + `useContext` reader) — the original hook gave each caller its own `useState`, so `dialogOpen` set by Toolstrip never reached AppShell. `useStage.ts` is now `useStage.tsx`; `App.tsx` wraps `<AppShell />` in `<StageProvider>`. Pattern matches the existing `useTransport`/`useToast` Providers. Verified by user — clicking Export opens the dialog.
- [x] 10.2 `openspec validate export-dialog --strict` clean.
- [x] 10.3 Handed off to `/opsx:archive` — moves change into `openspec/changes/archive/2026-05-10-export-dialog/` and syncs `openspec/specs/`.
