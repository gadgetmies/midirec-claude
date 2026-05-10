## 1. Pure helpers (`summary.ts` + tests)

- [x] 1.1 Create `src/components/inspector/summary.ts` exporting `formatBBT`, `formatPitch`, `summarizeSelection`, plus the `InspectorSummary` type.
- [x] 1.2 Implement `formatBBT(t, sig?)` with default `4/4` time signature; bar = `floor(t/sig.num)+1` (zero-padded to 2 digits), beat = `floor(t%sig.num)+1`, sixteenth = `floor((t%1)*4)+1`.
- [x] 1.3 Implement `formatPitch(midi)` using sharp accidentals (`C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B`) and octave numbering where MIDI 60 = C4. Check whether `pitchLabel` already exists in `src/components/piano-roll/notes.ts`; if yes, reuse it (re-export or move); if no, add it there and import from `summary.ts`. **Note**: `pitchLabel` existed but used ASCII `#`; updated `NOTE_NAMES` in `notes.ts` to unicode `♯` (only caller is `PianoKeys.tsx`, which renders C-naturals only — change is invisible). `formatPitch` re-exports `pitchLabel`.
- [x] 1.4 Implement `summarizeSelection(notes, indexes, channelLabel)` returning `{ count, range: {t0, t1}, pitches: number[] (distinct, sorted), velocity: { mean, mixed }, length: { uniform: number|null, range: [min, max] }, channelLabel }`. `range.t1` is `max(note.t + note.dur)` (inclusive end). `velocity.mixed` is `true` when any pair of selected velocities differs by more than `1/127`. `length.uniform` is non-null only when all `dur` values are within `0.001` of each other.
- [x] 1.5 Create `src/components/inspector/summary.test.ts` covering: `formatBBT(0)` → `01.1.1`, `formatBBT(4)` → `02.1.1`, `formatBBT(6.5)` → `02.3.3`; `formatPitch(60)` → `C4`, `formatPitch(63)` → `D♯4`; `summarizeSelection` mixed-velocity detection; `summarizeSelection` uniform-length detection; `summarizeSelection` distinct-pitch ordering. **Note**: also added Vitest setup (devDep + `test` script in package.json) — no test runner existed.
- [x] 1.6 Run `yarn test` (or whichever test runner is configured); confirm all summary tests pass. **13/13 passing.**

## 2. `useStage` extension and `?demo=note` URL flag

- [x] 2.1 Add `resolvedSelection: { channelId, indexes } | null` to the `StageState` interface in `src/hooks/useStage.ts`.
- [x] 2.2 Add a `demoNote` constant alongside `demoMarquee`, derived from `window.location.search.includes('demo=note')`. Make `demoMarquee` win when both are present (compute `demoNote = ... && !demoMarquee`).
- [x] 2.3 Branch the marquee/selectedIdx/selectedChannelId values: `demoMarquee` → existing values; `demoNote` → `marquee = null, selectedIdx = [<idx>], selectedChannelId = 1` where `<idx>` is a deterministic index pointing to a recognisable note (suggest `idx = 3` or whichever index has a clean BBT start); else default values. **Used `DEMO_NOTE_IDX = 3`.**
- [x] 2.4 Compute `resolvedSelection` per the spec: non-empty `selectedIdx` wraps verbatim; `marquee + selectedChannelId` runs `notesInMarquee(roll.notes, marquee)`; otherwise null. Find the roll via `channels.rolls.find(r => r.channelId === selectedChannelId)`.
- [x] 2.5 Return `resolvedSelection` from `useStage()`.
- [x] 2.6 Verify in the browser: `/` → `resolvedSelection === null`; `/?demo=marquee` → `resolvedSelection.indexes.length === 7`; `/?demo=note` → `resolvedSelection.indexes.length === 1`; `/?demo=marquee&demo=note` → `resolvedSelection.indexes.length === 7` (marquee wins). **Logic verified by inspection of `useStage.ts` source; visual confirmation deferred to user.**

## 3. Inspector component skeleton

- [x] 3.1 Create `src/components/inspector/Inspector.tsx`. The component takes no props; calls `useStage()` internally for `resolvedSelection`, `channels`, `rolls`. **Note**: `useStage()` is called inside `NotePanel` (not the outer `Inspector` wrapper) since the wrapper only needs the `activeTab` local state.
- [x] 3.2 Render the tab strip: `.mr-insp-tabs` containing three `.mr-insp-tab` spans labelled `Note`, `Pressure`, `Channel`. Use a `useState<'Note' | 'Pressure' | 'Channel'>('Note')` for the active tab; the active tab carries `data-on="true"`. Click handlers update the state. **Used `<button>` instead of `<span>` for tab role + keyboard accessibility.**
- [x] 3.3 Render the body container only when active tab is `Note`. For Pressure or Channel, render an empty body div (no children). **Body div always renders for layout consistency; only its content is conditional on `activeTab === 'Note'`.**
- [x] 3.4 Compute `state: 'none' | 'single' | 'multi'` from `resolvedSelection` and the indexes length. Switch on it for the body content.

## 4. Single-select Note panel

- [x] 4.1 In the `single` branch, look up the selected note: `const roll = rolls.find(r => r.channelId === resolvedSelection.channelId); const note = roll.notes[resolvedSelection.indexes[0]];`.
- [x] 4.2 Render a header row containing a 28×28px `var(--mr-note-sel)` swatch and a label group with `formatPitch(note.pitch)` on top and `note <note.pitch>` (mono, `--mr-text-3`) below.
- [x] 4.3 Render four `.mr-kv` rows: Start (BBT + tick offset), Length (`<dur.toFixed(3)>s`), Velocity (slider with width = `note.vel*100%` + mono integer `Math.round(note.vel*127)`), Channel (`CH ` + `resolvedSelection.channelId`). **Tick offset = `Math.round((note.t % 1) * 480)` (480 PPQ).**
- [x] 4.4 Verify visually with `/?demo=note` that the panel renders as expected. **Dev server up at http://localhost:5176/?demo=note — visual confirmation deferred to user.**

## 5. Multi-select Note panel

- [x] 5.1 In the `multi` branch, compute the selected notes array and call `summarizeSelection(notes, indexes, channelLabel)` to get the summary.
- [x] 5.2 Render the hatched-swatch header row with `<count> notes selected` on top and `multi · <K> pitches · <M> bars` mono subtitle. (`K` = `summary.pitches.length`; `M` = `Math.ceil((summary.range.t1 - summary.range.t0) / sig.num)`, default 4 beats per bar.) **Singular `bar` for M==1.**
- [x] 5.3 Render five `.mr-kv` rows: Range (`formatBBT(t0) → formatBBT(t1)`), Pitches (joined by ` · `), Velocity (slider + mono value, with `data-mixed="true"` when `summary.velocity.mixed`), Length (uniform value or `mixed (a – bs)`), Channel.
- [x] 5.4 Render a 1px `var(--mr-line-1)` divider, an `.ds-eyebrow` (or local equivalent) labelled `BULK ACTIONS`, and a 2-column button grid: Quantize, Nudge ←→, Transpose, Velocity ±, Duplicate (full-width), Delete <count> (full-width, `data-danger="true"`). **Used local `.mr-insp-eyebrow` and `.mr-insp-bulk-grid` classes; ported `.mr-btn` from prototype.**
- [x] 5.5 All bulk-action buttons get `onClick={() => {}}` (or no onClick); they MUST not mutate stage state. **All 6 buttons use a shared `noop` handler.**
- [x] 5.6 Verify visually with `/?demo=marquee` that the panel renders as expected and matches screenshot 04 within tolerance. **Dev server up at http://localhost:5176/?demo=marquee — visual confirmation deferred to user.**

## 6. CSS port + swatch class

- [x] 6.1 Create `src/components/inspector/Inspector.css`. Port from `prototype/app.css` lines ~905–1001: `.mr-insp-tabs`, `.mr-insp-tab`, `.mr-insp-tab[data-on="true"]`, `.mr-kv`, `.mr-kv__k`, `.mr-kv__v`, `.mr-slider`, `.mr-slider__fill`, `.mr-slider__thumb`, `.mr-slider[data-mixed="true"] .mr-slider__fill`. Skip the `.mr-inspector` rule itself if `AppShell.css` already covers it (verify by grep before pasting). **Skipped `.mr-inspector` (already in AppShell.css; extended that rule with `display: flex; flex-direction: column; min-height: 0` to support the body's overflow).**
- [x] 6.2 Add a new `.mr-insp-swatch--multi` rule capturing the prototype's inline `repeating-linear-gradient` hatched fill plus the accent box-shadow.
- [x] 6.3 Import the CSS file at the top of `Inspector.tsx`.
- [x] 6.4 Confirm `grep -E '#[0-9a-fA-F]{3,8}|oklch\\(' src/components/inspector/Inspector.css` returns at most the `#fff` thumb literal and any `rgba(...)` literals already present in the prototype's same lines. **Returns only `background: #fff` (slider thumb). `rgba(0, 0, 0, 0.4)` and `rgba(0, 0, 0, 0.6)` are also present, both prototype-sourced (lines 999–1000).**

## 7. AppShell mount + stub removal

- [x] 7.1 In `src/components/shell/AppShell.tsx`, replace `<aside className="mr-inspector"><span className="mr-stub">Inspector</span></aside>` with `<aside className="mr-inspector"><Inspector /></aside>`.
- [x] 7.2 Add the import for `Inspector` at the top of the file.
- [x] 7.3 Verify the rendered DOM no longer contains the `.mr-stub` element inside `.mr-inspector`. **`grep -r 'mr-stub' src/components/shell/` returns only Sidebar/Toolstrip/Statusbar entries; no Inspector residue.**

## 8. Design-doc deviations

- [x] 8.1 Add a new entry to `design/deviations-from-prototype.md` for the tab-label deviation (`Note / Pressure / Channel` vs prototype `Note / Track / File`), with rationale that the implementation plan supersedes prototype labels for forward-looking content (Pressure tab reserved for Slice 9). **Added as deviation #11.**
- [x] 8.2 Add a row to `design/README.md`'s deviations table referencing the new entry. **Note**: `design/README.md` doesn't actually have a deviations table (its only table is the file-index "What's in here"). The deviations table lives in `deviations-from-prototype.md` and was extended with row #11 as part of 8.1. No README edit needed.

## 9. Verification

- [x] 9.1 Run `yarn typecheck`; confirm clean. **Clean.**
- [x] 9.2 Run `yarn test` for the new summary tests; confirm all pass. **13/13 passing.**
- [x] 9.3 Run `openspec validate --strict inspector-note-panel`; confirm clean. **Clean.**
- [x] 9.4 Manual browser check at viewport ~1440×900: **Confirmed by user during archive.**
   - [x] 9.4.1 `/` → Inspector shows tab strip (Note active), empty body. No `.mr-stub`.
   - [x] 9.4.2 `/?demo=note` → Inspector shows the single-select panel with pitch label, BBT start, length, velocity slider matching the note's velocity, channel `CH 1`.
   - [x] 9.4.3 `/?demo=marquee` → Inspector shows the multi-select panel with `7 notes selected`, derived range/pitches/velocity/length/channel, divider, BULK ACTIONS eyebrow, and 6 buttons including a `Delete 7` danger button. Visual diff vs `screenshots/04-marquee-selection.png` within ±1px tolerance.
   - [x] 9.4.4 Click each bulk-action button → no toast, no DOM change, no console error.
   - [x] 9.4.5 Click Pressure tab → tab activates, body empties; click Channel tab → same; click Note tab → panel reappears.
- [x] 9.5 Run `grep -r 'mr-stub' src/components/shell/` and confirm only non-Inspector regions still carry stubs. **Returns Sidebar/Toolstrip/Statusbar only — no Inspector entries.**
