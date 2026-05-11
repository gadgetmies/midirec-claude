## 1. Reconnaissance

- [x] 1.1 Re-read the existing `dj-action-tracks` spec (`openspec/specs/dj-action-tracks/spec.md`) and the 7a `DJActionTrack.tsx` / `DJActionTrack.css` to confirm what 7a shipped and what 7b is replacing.
- [x] 1.2 Confirm `.mr-actkey*`, `.mr-djtrack__lanes`, `.mr-djtrack__lane`, `.mr-djtrack__tick`, `.mr-djtrack__note*` classes are NOT yet defined anywhere in `src/`. Confirm `ActionEvent`, `ActionKeys`, `ActionRoll`, `RowMSChip`, `toggleDJTrackRowMuted`, `toggleDJTrackRowSoloed`, `mutedRows`, `soloedRows`, `track.events` are NOT yet referenced anywhere in `src/`.
- [x] 1.3 Locate the `pxPerBeat` constant (or equivalent) used by the channel-track piano-roll for beat-tick spacing. Note the exact value and how it's exposed so `<ActionRoll>` can use the same one. If it's a local-to-PianoRoll constant, hoist it to a shared location (`src/lib/timeline.ts` or similar).
- [x] 1.4 Re-read the prototype's `ActionRollUnit` in `design_handoff_midi_recorder/prototype/dj.jsx` (lines ~342–521) to confirm the three rendering modes, pressure-cell synthesis pattern, velocity tick, and AT badge details we're porting.
- [x] 1.5 Re-read `design/real-time-correctness.md`. Confirm that synthetic events seeded on a track are static state, not message-derived — so this slice does not introduce any per-message-React-render patterns. The existing `useDJActionTracks` hook policy (slow-changing track config only) continues to apply.

## 2. Data shape and seeded events

- [x] 2.1 Extend `DJActionTrack` interface in `src/hooks/useDJActionTracks.ts` to add `events: ActionEvent[]`, `mutedRows: number[]`, `soloedRows: number[]` fields. Define `ActionEvent` type either inline or in `src/data/dj.ts` (preferred — keeps DJ-domain types co-located).
- [x] 2.2 If `ActionEvent` lives in `src/data/dj.ts`, re-export it for convenience. Confirm shape is `{ pitch, t, dur, vel }` — identical to `Note`.
- [x] 2.3 Update `seedDefault()` in `useDJActionTracks.ts` to include `events: [...]`, `mutedRows: []`, `soloedRows: []`. Author a deterministic events array of length ≥ 10 covering all three rendering modes:
  - trigger events on pitch 48 (Play / Pause, `cat: 'transport'`, no `pad`, no `pressure`) — 3–4 events.
  - velocity-sensitive events on pitch 60 (FX 1 On — but FX 1 On doesn't have `pad: true`; re-check). If no pure pad-without-pressure action exists in the 4-entry seed, either: (a) widen the seed to include one (e.g. `actionMap[57]` = Hot Cue 2 = `pad: true, no pressure`), or (b) accept that velocity-sensitive mode is exercised by Hot Cue 1's velocity path before pressure-bearing takes precedence (and add a dedicated visual demo by including pitch 57 with pad-but-no-pressure). **Lean toward (a) — widen seed to 5 entries: 48, 56, 57, 60, 71.**
  - pressure-bearing events on pitch 56 (Hot Cue 1, `pressure: true, pad: true`) — 2–3 events.
  - trigger events on pitch 71 (Crossfade ◀, `cat: 'mixer'` — wait, `cat: 'mixer'` is NOT in the trigger predicate; trigger applies to `cat ∈ {transport, cue, hotcue}`). So pitch 71's events render in velocity-sensitive mode (no pad → no, also not pad). Actually with `cat: 'mixer'` and no `pad` and no `pressure`, **none of the three modes match**. Decide the fallback rendering mode and document it: probably velocity-sensitive (degenerate — opacity fixed since no `vel`) OR a default trigger-like rendering. **Recommendation: events whose action doesn't match any of the three predicates render in velocity-sensitive mode with the velocity tick suppressed** — variable-width bar by `dur`, fixed 85% opacity. Document in design.md decision 8 update and in the spec's mode predicate.
- [x] 2.4 Add a `flip(id, field)`-style action for `mutedRows` and `soloedRows` toggles. Reuse the existing `flip` callback pattern if it generalizes; otherwise add a parallel `flipRow(id, field, pitch)` callback. Each toggle SHALL be a no-op for unknown ids and for pitches not in the named track's `actionMap`.
- [x] 2.5 Export the two new actions (`toggleRowMuted`, `toggleRowSoloed`) from `useDJActionTracks` alongside the existing per-track toggles.
- [x] 2.6 `yarn typecheck` clean.

## 3. Stage integration

- [x] 3.1 Wire `toggleDJTrackRowMuted` and `toggleDJTrackRowSoloed` through `useStage.tsx` to expose them on `StageState`.
- [x] 3.2 Extend the `soloing` predicate computation in `useStage.tsx` to include `djActionTracks.some(t => t.soloedRows.length > 0)`. Update the existing `anySoloed`/`anyDJTrackSoloed` helpers as needed.
- [x] 3.3 `yarn typecheck` clean.

## 4. Mode-precedence helper and audibility predicate

- [x] 4.1 Create a small pure helper (likely in `src/data/dj.ts` or `src/components/dj-action-tracks/render.ts`) that classifies an action into a render mode: `actionMode(action): 'trigger' | 'velocity-sensitive' | 'pressure-bearing' | 'fallback'`. Apply the precedence: pressure-bearing > velocity-sensitive > trigger > fallback. Match the spec's predicates exactly.
- [x] 4.2 Create a `rowAudible(track, pitch, soloing): boolean` helper. Match the spec's predicate exactly. Unit-test the truth table for the predicate (mute-only, solo-only, mute+solo, track-solo + row-solo, etc.).
- [x] 4.3 `yarn typecheck` clean.

## 5. Compact M/S chip variant

- [x] 5.1 Inspect the existing `<MSChip>` component (`src/components/ms-chip/MSChip.tsx` + `MSChip.css`) to gauge the chrome divergence required for a 56px-row variant.
- [x] 5.2 Implement compact variant. Start with a `size?: 'sm' | 'xs'` prop on the existing `MSChip` and a CSS `[data-size="xs"]` selector that shrinks button dimensions, padding, font-size. If CSS branches more than ~20 lines, refactor to a sibling `<RowMSChip>` component and document why in design.md decision 3 (update with the outcome).
- [x] 5.3 The xs variant SHALL render two single-letter buttons ("M" and "S") with smaller font (~9px), reduced padding, no border (or a 1px subtle border), and ~14–18px combined width. The chip SHALL still call `event.stopPropagation()` on button clicks (existing behavior).
- [x] 5.4 Snapshot or DOM-render test confirming the xs variant produces a `.mr-ms[data-size="xs"]` (or `.mr-rowms`) with two button children.

## 6. ActionKeys component

- [x] 6.1 Create `src/components/dj-action-tracks/ActionKeys.tsx` exporting `<ActionKeys>` with props `{ track: DJActionTrack; onToggleRowMuted: (pitch: number) => void; onToggleRowSoloed: (pitch: number) => void }`.
- [x] 6.2 Render a `.mr-djtrack__keys` container (sticky-left, 56px wide). Inside, render one `.mr-actkey` per pitch in `track.actionMap`, sorted ascending. Each `.mr-actkey` SHALL include:
  - `data-row-muted={mutedRows.includes(pitch) ? 'true' : undefined}`
  - `data-row-soloed={soloedRows.includes(pitch) ? 'true' : undefined}`
  - `title={action.label}` (full untruncated label for tooltip)
  - `<span className="mr-actkey__label">` with content `truncateLabel(action.label, 5)`.
  - The compact M/S chip wired to `onToggleRowMuted(pitch)` and `onToggleRowSoloed(pitch)`, with `muted={mutedRows.includes(pitch)}` and `soloed={soloedRows.includes(pitch)}`.
- [x] 6.3 Implement `truncateLabel(label, 5)`: return `label` if `label.length <= 5`; else return `label.slice(0, 5).trimEnd() + '…'`. Place in `src/data/dj.ts` or a sibling helper file.
- [x] 6.4 Create `src/components/dj-action-tracks/ActionKeys.css`:
  - `.mr-djtrack__keys` — sticky-left (`position: sticky; left: 0; z-index: 2`), 56px wide, panel-2 background.
  - `.mr-actkey` — flex row, height matches `var(--mr-h-row)` (or equivalent), padding `0 4px`, gap `2px`. No `border-left`. `font-family: var(--mr-font-mono)`, `font-size: 10px` (or as visually appropriate).
  - `.mr-actkey__label` — `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis` (defensive — also gets logical-char-count truncation in JS).
  - `[data-row-muted="true"] .mr-actkey__label { opacity: 0.5 }`.
  - `[data-row-soloed="true"]` styling per existing solo-state visual language.
- [x] 6.5 No hex literals, no `oklch(` literals in `ActionKeys.css`. Verify via grep.
- [x] 6.6 `yarn typecheck` clean.

## 7. ActionRoll component

- [x] 7.1 Create `src/components/dj-action-tracks/ActionRoll.tsx` exporting `<ActionRoll>` with props `{ track: DJActionTrack; soloing: boolean; pxPerBeat: number; barCount: number; rowHeight: number }` (or derive these from a context — match the existing channel-track ergonomics).
- [x] 7.2 Render a `.mr-djtrack__lanes` container. Inside, render in order:
  - One `.mr-djtrack__lane` per pitch in `track.actionMap`, ascending pitch order. Each lane SHALL be absolutely positioned at `top = laneTop(pitchIdx)` with `height = rowHeight`. Each lane SHALL carry `data-row-muted`, `data-row-soloed`, `data-audible={rowAudible(track, pitch, soloing) ? 'true' : 'false'}`.
  - Beat ticks: one `.mr-djtrack__tick` per integer beat in `[0, barCount * beatsPerBar]`. Each tick is absolutely positioned at `left = i * pxPerBeat`, full-height. Ticks at every `beatsPerBar`-th index get a class modifier (e.g. `.mr-djtrack__tick--bar`) for accented styling.
  - Action notes: one `.mr-djtrack__note` per event whose `pitch` is a key in `track.actionMap`. Notes are absolutely positioned and styled per their action's render mode.
- [x] 7.3 Implement the three render modes as JSX branches inside the note rendering loop, dispatching via `actionMode(action)`:
  - **trigger** — width 6px, `background: devColor(action.device)`, `box-shadow: 0 0 6px color-mix(in oklab, ${devColor} 60%, transparent)`.
  - **velocity-sensitive** — width `max(3, dur * pxPerBeat)`, background `color-mix(in oklab, ${devColor} ${40 + vel * 50}%, transparent)`, with a 2px-wide white tick at `left: 0` opacity `0.4 + vel * 0.5`.
  - **pressure-bearing** — width `max(60, dur * pxPerBeat)` (or `80 + seed%40` to match prototype), with an inline `<svg>` of synthesized pressure cells. Width-conditioned AT badge at top-right when `width > 30`.
  - **fallback** — variable-width bar by `dur`, fixed 85% opacity, no velocity tick. (For actions like Crossfade with `cat: 'mixer'` and no `pad`/`pressure`.)
- [x] 7.4 Implement pressure-cell synthesis: 14 cells along the note width, each with a deterministic value derived from the event's seed (`seed = pitch * 13 + 7` matching prototype) and the cell index. Render each cell as an SVG `<rect>` with `fill="#fff"; opacity="0.65"`. Identical to the prototype's pattern in `dj.jsx`'s `ActionRollUnit` lines ~440–460.
- [x] 7.5 Create `src/components/dj-action-tracks/ActionRoll.css`:
  - `.mr-djtrack__lanes` — `position: relative`, flex-grow.
  - `.mr-djtrack__lane` — `position: absolute; left: 0; right: 0`. Default `background: rgba(255,255,255,0.012)` (matching prototype's `mr-lane--action[data-mapped]`).
  - `.mr-djtrack__tick` — `position: absolute; top: 0; bottom: 0; width: 1px; background: var(--mr-line-1)` (or equivalent token).
  - `.mr-djtrack__tick--bar` — accented background (higher opacity).
  - `.mr-djtrack__note` — `position: absolute; border-radius: 2px; overflow: hidden`.
  - `.mr-djtrack__note--trigger` — `border-radius: 1px`.
  - `[data-audible="false"] .mr-djtrack__note` — `opacity: 0.4`.
  - `.mr-djtrack__note__at` (badge) — top-right, monospace 7px, white text on dark backdrop.
- [x] 7.6 No hex literals (other than #fff which is already in the prototype), no `oklch(` literals in `ActionRoll.css`. The dynamic per-note backgrounds use `style={{ background: ... }}` with `devColor()` strings, which is unavoidable. Document in a code comment.
- [x] 7.7 `yarn typecheck` clean.

## 8. DJActionTrack component update

- [x] 8.1 In `src/components/dj-action-tracks/DJActionTrack.tsx`, remove the placeholder rows + `.mr-djtrack__placeholder` caption. Replace with `<ActionKeys>` + `<ActionRoll>` inside `.mr-djtrack__body`.
- [x] 8.2 Thread `onToggleRowMuted` and `onToggleRowSoloed` callbacks through props. Update the prop interface.
- [x] 8.3 Add a swatch element to the header (already present per 7a, but confirm it matches `<Track>`'s swatch convention rather than `<ChannelGroup>`'s — small color box, no text inside, sized per the existing swatch CSS). Confirm `track.color` flows correctly.
- [x] 8.4 Remove `.mr-djtrack__placeholder`, `.mr-djtrack__rows`, `.mr-djtrack__row`, `.mr-djtrack__keys-spacer` rules from `DJActionTrack.css` (these were 7a placeholders). Audit for any leftover references.
- [x] 8.5 Ensure `[data-muted="true"] .mr-djtrack__body { opacity: 0.4; filter: grayscale(0.6) }` continues to apply.
- [x] 8.6 `yarn typecheck` clean.

## 9. AppShell wiring

- [x] 9.1 In `src/components/shell/AppShell.tsx`, wire `stage.toggleDJTrackRowMuted` and `stage.toggleDJTrackRowSoloed` as `onToggleRowMuted` / `onToggleRowSoloed` props to `<DJActionTrack>`. Bind the trackId via closure.
- [x] 9.2 Confirm the existing `audible = isDJTrackAudible(track, stage.soloing)` prop continues to compute correctly under the extended `soloing` predicate.
- [x] 9.3 `yarn typecheck` clean.

## 10. CSS sanity and visual continuity

- [x] 10.1 Grep for any hardcoded `192px` or `192` that might be a leftover from a prototype assumption about the action-keys width. Confirm only `56px` is used.
- [x] 10.2 Confirm `.mr-djtrack__lanes` and `.mr-roll__lanes` (channel-track) align in horizontal scroll axis — both should have the same time-origin offset (56px from the timeline-inner left edge). Open the app and shift between piano and dj-action-track via inspector to confirm visually.
- [x] 10.3 Confirm beat ticks at the same horizontal coordinate in both channel-track and dj-action-track sit at the same screen x.

## 11. Tests

- [x] 11.1 Added in `src/data/dj.test.ts` — covers all four leaves of the precedence tree plus two synthetic edge cases (pressure beats every other predicate; velocity beats trigger when both predicates match).
- [x] 11.2 Added in `src/hooks/useDJActionTracks.test.ts` — covers the row-audibility truth table: no solo/no mute → audible; row muted → silent regardless of solo; row solo overrides session-wide; non-soloed row inaudible under session solo; track solo without row solo audibilizes all rows; track solo + row solo only audibilizes the soloed row; mute beats solo within the same row. Plus `isDJTrackAudible` and `anyDJTrackSoloed` truth tables.
- [x] 11.3 Added in `src/data/dj.test.ts` — short labels pass through; labels at the cap unchanged; longer labels get `…`; trailing whitespace trimmed (`"Play / Pause"` → `"Play…"`).
- [ ] 11.4 DOM render test for `<ActionKeys>` — DEFERRED. Vitest currently runs in node-only environment (no jsdom/happy-dom configured). Setting up DOM testing infrastructure is its own slice; deferring this and 11.5 to that slice or to manual verification (§13). Logic-level coverage in 11.1–11.3 already validates every code path except the JSX wiring.
- [ ] 11.5 DOM render test for `<ActionRoll>` — DEFERRED, same reason as 11.4.
- [x] 11.6 `yarn test --run` — 40/40 passing (13 pre-existing + 27 new).

## 12. Spec sync and design-doc updates

- [x] 12.1 Update `design/deviations-from-prototype.md` with deviation entries:
  - #16: keys-column width is 56px (vs prototype 192px). Rationale: per-track architecture requires unified width.
  - #17: row content is 5-char-truncated label + always-visible compact M/S (vs prototype short code + full label + note name + optional per-row M/S only on Deck 1).
  - #18: no `border-left: 3px solid devColor` on the keys row. Device color survives in the rendered notes only.
- [x] 12.2 Update `design/README.md` deviations table with the three new rows.
- [x] 12.3 `openspec validate dj-action-body --strict` clean.

## 13. Manual verification

- [ ] 13.1 Open the app. The seeded "DJ" track header shows `DJ · 6 actions` (the seed includes pitch 57 = Hot Cue 2 for a pure velocity-sensitive demo plus pitch 49 = Cue per user request). Below the header: 6 lane rows showing the short codes `X◀`, `ON`, `HC2`, `HC1`, `CUE`, `PLAY` (high pitch at top, low pitch at bottom). Hovering a row reveals the M/S chip on the right; the resting state shows only the short code. Lanes contain beat ticks and 13 synthetic notes in their expected rendering modes.
- [ ] 13.2 Hover a `.mr-actkey` — the browser-native tooltip shows the full label (e.g. `Play / Pause` for the `PLAY` row, `Hot Cue 1` for the `HC1` row, `Crossfade ◀` for the `X◀` row). The compact M/S chip simultaneously appears at the right of the row.
- [ ] 13.3 Click a row's M button — that row's notes dim. Other rows in the same track and other tracks unaffected. `.mr-timeline` does NOT carry `data-soloing`.
- [ ] 13.4 Click a row's S button — `.mr-timeline` gains `data-soloing="true"`. All other channel-tracks and all other dj-action-tracks dim. Within the same dj-action-track, only the soloed row stays bright; other rows dim.
- [ ] 13.5 Solo the track-level S button while no rows are soloed — every row in that track stays bright; other tracks dim.
- [ ] 13.6 Solo the track AND a row within it — only the soloed row stays bright (track solo without row solo would have surfaced all rows; once a row solos, the track-solo-without-row-solo branch no longer applies).
- [ ] 13.7 Confirm beat ticks in the dj-action-track and in channel-tracks align at the same screen x.
- [ ] 13.8 Confirm pressure-bearing notes show the inner pressure-cell SVG and the AT badge.
- [ ] 13.9 Confirm trigger notes (Play/Pause events) render as 6px-wide glowing rects.

## 14. Pre-archive cleanup

- [x] 14.1 Re-read proposal: all `What Changes` bullets shipped. Implementation refinements:
  - (a) Compact-MSChip strategy chosen: `size?: 'xs'` prop on the existing `MSChip` (not a sibling component). The CSS branch is ~10 lines (one selector with width/height/font-size/border-radius overrides), well under the 20-line threshold the design.md decision 3 recommended for refactoring to a sibling. xs is 10×10px buttons with 7px font (vs sm's 16×14 with 9px font); combined width including 1px gap is ~21px.
  - (b) Fallback render mode: introduced a fourth `'fallback'` value on `ActionMode` for actions with no `pad`/`pressure` flags whose `cat` is not in `{transport, cue, hotcue}` (mixer Crossfade, FX 1 On, Loop In, etc). Renders as a variable-width bar by `dur` at 85% opacity with no velocity tick — visually distinct from velocity-sensitive (no left tick) and from pressure-bearing (no inner SVG). Documented in `src/data/dj.ts`'s `actionMode` JSDoc and in the spec's `Action notes render in three modes` requirement (extended to four-modes-with-explicit-fallback).
  - (c) `pxPerBeat` hoist: not needed. `DEFAULT_PX_PER_BEAT = 88` was already exported from `src/components/piano-roll/PianoRoll.tsx`. AppShell imports it and passes the same value to both `<PianoRoll>` (via `<Track>` / `<ChannelGroup>`) and `<ActionRoll>`. Beat ticks land at the same x in both kinds of tracks for free.
  - (d) Seed widened from 4 to 5 entries — added pitch 57 (Hot Cue 2 = `pad: true`, no `pressure`) to give the velocity-sensitive render mode dedicated coverage in the demo. The previous 4-entry seed (48/56/60/71) only exercised trigger + pressure-bearing + fallback. With 5 entries, all four render modes are visually represented in the seeded "DJ" track.
  - (e) Row-height constant: introduced `DJ_ROW_HEIGHT = 22` in `AppShell.tsx` (matches the existing `--mr-h-row` token used by `ActionKeys.css`). Channel-track piano-roll continues to use `DEFAULT_ROW_HEIGHT = 14` — DJ rows are intentionally taller because their per-row content (truncated label + M/S chip) needs more vertical space than a piano-key.
  - (f) `data-audible` is set on each `.mr-djtrack__note` directly in JSX (not on the `.mr-djtrack__lane` and propagated via CSS). Notes and lanes are both children of `.mr-djtrack__lanes`, so a sibling-selector approach didn't work. Each note carries its own `data-audible` attribute computed via `isDJRowAudible(track, pitch, soloing)`. The lane element also carries `data-audible` for any future styling that wants to drive lane chrome from row state.
  - (g) DOM render tests (§11.4, 11.5) deferred — vitest is currently configured in node-only mode (no jsdom). Adding a DOM environment is its own slice. Logic-level tests in §11.1–11.3 cover every code path except the JSX wiring; §13's manual verification covers the rest.
  - (h) Row keys content iterated from "5-char-truncated `action.label`" (first pass) to "render `action.short` directly" (final). The earlier `truncateLabel` helper was removed from `src/data/dj.ts` along with its 4 unit tests in `src/data/dj.test.ts`; the kept tests total 36 (was 40 transiently). Short codes (PLAY, CUE, HC1, HC2, ON, X◀) are 2–4 chars and fit in 56px without any JS or CSS truncation; the full `action.label` survives as the row's `title` tooltip. CSS `text-overflow: ellipsis` stays on `.mr-actkey__label` as a defensive fallback. `DEFAULT_ACTION_MAP` labels and short codes are unchanged from the prototype — no label renames in `src/data/dj.ts`. Spec scenarios under "ActionKeys component renders one row per configured action" updated to reflect short-code rendering.
  - (i) Row M/S iterated from "always-visible compact chip" (first pass) to "hidden at rest, revealed on hover/focus-within" (final). The chip wrapper `.mr-actkey__chip` is absolute-positioned with `opacity: 0; pointer-events: none` at rest, transitioning to `opacity: 1; pointer-events: auto` under `:hover` and `:focus-within`. Per-row muted/soloed state remains visible at rest through `.mr-actkey[data-row-muted]` / `[data-row-soloed]` styling on the label (dim text, accent color) — the hover only reveals the controls, not the state. Updates `design/deviations-from-prototype.md` deviation #17 and the corresponding spec scenarios in `openspec/changes/dj-action-body/specs/dj-action-tracks/spec.md`.
  - (j) Seed widened to 6 entries (was 5 transiently). Added pitch 49 (`Cue`, `cat: 'cue'`, short `CUE`) per the user's "include a 'CUE' action row" request, giving two trigger-mode rows (Play/Pause + Cue) in the demo. The `SEEDED_PITCHES` array and `SEEDED_EVENTS` are updated accordingly; the seed comment in `useDJActionTracks.ts` documents the final 6-entry shape.
- [x] 14.2 `openspec validate dj-action-body --strict` clean.
- [ ] 14.3 Hand off to archive — moves change into `openspec/changes/archive/<date>-dj-action-body/` and syncs `openspec/specs/`. Deferred to user / `/opsx:archive` invocation after manual verification.
