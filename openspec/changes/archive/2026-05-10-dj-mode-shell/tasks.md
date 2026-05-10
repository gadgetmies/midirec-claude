## 1. Reconnaissance

- [x] 1.1 Confirm `mr-djtrack*` classes are not yet defined anywhere in `src/`. Confirm `DJActionTrack` / `useDJActionTracks` / `djActionTracks` are not yet referenced anywhere in `src/`.
- [x] 1.2 Tokens confirmed present in `tokens.css`. Note: `--mr-w-keys` does not exist as a token; the codebase uses the exported constant `KEYS_COLUMN_WIDTH = 56` from `src/components/piano-roll/PianoRoll.tsx`. The new CSS will use `56px` literal matching `Track.css:143`'s existing `width: 56px` for the same purpose, with an inline comment pointing to the constant.
- [x] 1.3 Prototype re-read: `dj.jsx:10-77` data tables (verbatim port targets), `dj.jsx:342-521` is 7b's body reference, `components.jsx:756-790` is the lanesMode-actions branch we are NOT porting.
- [x] 1.4 Track/Channel header conventions confirmed: `.mr-*__hdr` (height 22px, panel-2 bg, hover lift, cursor pointer, position relative z-1) with three children — sticky `__hdr-left` (panel-2 bg, gap 8px, padding 0 8px), flex `__hdr-spacer`, sticky `__hdr-right` (padding 0 10px 0 8px). Click handler `event.stopPropagation()`. `data-track-collapsed`/`data-muted`/`data-soloed`/`data-audible` attrs on the row. The session-global solo dim selector lives in `ChannelGroup.css:105-108` and matches `[data-audible="false"]` inside `.mr-track`/`.mr-param-lane`; we'll extend it to cover `.mr-djtrack`.
- [x] 1.5 `design/real-time-correctness.md` re-read. `useDJActionTracks` is for slow-changing track config only. No MIDI message processing, no `Date.now()`, no `setState`-per-message.

## 2. DJ data port

- [x] 2.1 Created `src/data/dj.ts` with the three union types and `ActionMapEntry`.
- [x] 2.2 Exported `DJ_CATEGORIES`, `DJ_DEVICES`, `DEFAULT_ACTION_MAP` verbatim. `DJ_DEVICES` uses `as const satisfies Record<DeviceId, …>` for literal-narrowing + structural check; `DJ_CATEGORIES` is typed as `Record<CategoryId, { label: string }>` with `as const`.
- [x] 2.3 Exported `devColor` / `devShort` / `devLabel` (via a `deviceOrGlobal` internal helper) and `pitchLabel`. Octave numbering matches the prototype (middle C = C4).
- [x] 2.4 `yarn typecheck` clean.

## 3. DJ action track types and hook

- [x] 3.1 Types defined in `src/hooks/useDJActionTracks.ts` with the TODO comment.
- [x] 3.2 Hook returns the expected shape.
- [x] 3.3 Default seed in `seedDefault()` populates a 4-entry `actionMap` (pitches 48/56/60/71 spanning 3 devices) from `DEFAULT_ACTION_MAP`. `actionMap` is the set of actions configured on this track, not a catalog reference — the picker source remains `DEFAULT_ACTION_MAP` in `src/data/dj.ts`.
- [x] 3.4 Single `flip(id, field)` callback drives all three toggles; `findIndex` short-circuit guarantees no-op for unknown ids.
- [x] 3.5 `yarn typecheck` clean.

## 4. Stage integration

- [x] 4.1 `useDJActionTracks` composed into `useStage`; four new fields added to `StageState`.
- [x] 4.2 `soloing` flag now uses `anySoloed(channels) || anyDJTrackSoloed(djTracks.djActionTracks)`. Manual verification deferred to §9.
- [x] 4.3 `yarn typecheck` clean. Runtime regression check deferred to §9 manual steps.

## 5. DJActionTrack component

- [x] 5.1 Created `src/components/dj-action-tracks/DJActionTrack.tsx`. Props include `audible: boolean` for the data-attribute, calculated in AppShell to avoid a circular dep on stage-state shape.
- [x] 5.2 Renders `.mr-djtrack` with all four data attributes. `data-audible` is passed in from AppShell.
- [x] 5.3 Header structure mirrors `<Track>` with sticky-left/spacer/sticky-right zones. Added a small color-swatch (matching `.mr-channel__swatch` convention) since dj-action-tracks have a `color` field but no channel-level wrapper.
  - `.mr-djtrack__hdr` (clickable — toggles collapse on header click outside the M/S chip).
  - `.mr-djtrack__hdr-left` (sticky-left, `position: sticky; left: 0; z-index: 1`):
    - `.mr-djtrack__chev` (▾ rotated -90deg when collapsed).
    - `.mr-djtrack__name` text from `track.name`.
    - `.mr-djtrack__sub` text "{Object.keys(track.actionMap).length} actions".
  - `.mr-djtrack__hdr-spacer` (flex-grow filler).
  - `.mr-djtrack__hdr-right` (sticky-right, `position: sticky; right: 0; z-index: 1`):
    - `<MSChip muted={track.muted} soloed={track.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed} />`.
- [x] 5.4 Body renders sticky-left keys-spacer (56px literal, comment points to `KEYS_COLUMN_WIDTH`) + a `.mr-djtrack__rows` column with one empty `.mr-djtrack__row` per pitch in the action map, plus an absolutely-positioned `.mr-djtrack__placeholder` overlay with the "Action body — Slice 7b" caption (pointer-events: none so it doesn't block future row interactions).
- [x] 5.5 Body unmounts when collapsed (`!track.collapsed && <body>`).
- [x] 5.6 `MSChip` reused from `../ms-chip/MSChip`.
- [x] 5.7 Header click handler invokes `onToggleCollapsed`; `MSChip` already does `event.stopPropagation()` on its buttons.

## 6. CSS

- [x] 6.1 Created `src/components/dj-action-tracks/DJActionTrack.css` with all the listed rules. Also added `.mr-djtrack__swatch` (8px circle, matching `.mr-channel__swatch` convention) and `.mr-djtrack__keys-spacer` (sticky-left 56px panel-2 strip mirroring `.mr-track__keys-spacer`). Mute combines `opacity: 0.4` with `filter: grayscale(0.6)` matching `.mr-track__roll`'s mute treatment.
- [x] 6.2 No hex literals, no `oklch(` literals in DJActionTrack.css. Verified via grep.
- [x] 6.3 Visual continuity verified by file inspection — header height, panel-2 surfaces, sticky zone padding, chevron rotation, hover tint all match `.mr-channel__hdr` / `.mr-track__hdr`. Manual visual check deferred to §9.

## 7. AppShell integration

- [x] 7.1 Added `stage.djActionTracks.map(...)` after the channel-groups iteration inside `.mr-timeline__inner`.
- [x] 7.2 Callbacks wired; `audible` computed via `isDJTrackAudible(track, stage.soloing)`.
- [x] 7.3 By construction, both stacks live inside the same `.mr-timeline__inner` and share its scroll axis; structural verification deferred to §9.3 manual check.
- [x] 7.4 `stage.soloing` now folds in dj-action-track solo (verified in §4); `data-soloing` on `.mr-timeline` is bound to `stage.soloing`, so the chain is wired. Manual verification at §9.6.

## 8. Spec sync and design-doc updates

- [x] 8.1 Added deviation entries #14 (per-track-kind reframing of DJ mode) and #15 (single default seeded "DJ" track vs six prototype units), plus summary-table rows.
- [x] 8.2 No-op — `design/README.md` references the deviations file; no duplicate edits needed.
- [x] 8.3 `openspec validate dj-mode-shell --strict` clean.

## 9. Verification

- [x] 9.1 `yarn typecheck` clean.
- [x] 9.2 `yarn test --run` — 13/13 passing.
- [ ] 9.3 Manual: open the app — channel groups render unchanged at the top of the timeline. Below them, a single dj-action-track header reads "DJ · 4 actions" with chevron + M/S chip. Body shows 4 empty placeholder rows + a centered "Action body — Slice 7b" caption. **Deferred to user.**
- [ ] 9.4 Manual: click the dj-action-track header outside the M/S chip — body collapses; click again — body re-expands. **Deferred to user.**
- [ ] 9.5 Manual: click the M/S chip M button — track header carries `data-muted="true"`, body dims. **Deferred to user.**
- [ ] 9.6 Manual: click the M/S chip S button — track header carries `data-soloed="true"`, `.mr-timeline` carries `data-soloing="true"`, channel groups dim per the existing `[data-soloing] [data-audible="false"]` rule. **Deferred to user.**
- [ ] 9.7 Manual: solo a channel-track — `.mr-timeline` carries `data-soloing="true"`, dj-action-track dims (its `data-audible="false"`). **Deferred to user.**
- [x] 9.8 `grep -rn 'lanesMode' src/` returns zero matches.
- [x] 9.9 `grep -rn 'mr-djtrack' src/` returns the new CSS rules and the component's JSX usages.

## 10. Pre-archive cleanup

- [x] 10.1 Re-read proposal: all `What Changes` bullets shipped. Implementation refinements worth recording:
  - (a) `DJActionTrack` component takes `audible: boolean` as a prop computed by AppShell (`isDJTrackAudible(track, stage.soloing)`), rather than the component itself reading from `useStage`. Keeps the component pure and avoids re-rendering on unrelated stage changes.
  - (b) The session-global solo-dim rule was extended in `ChannelGroup.css` (alongside the existing `.mr-track[data-audible="false"]` and `.mr-param-lane[data-audible="false"]` selectors) rather than duplicated in `DJActionTrack.css`. The dim rule still belongs to the channels capability — it owns the audibility predicate.
  - (c) `useDJActionTracks` uses `useState` with a single `flip(id, field)` callback driving all three toggles, rather than the reducer pattern of `useChannels`. Simpler — one state array, three toggle types, no cross-field actions.
  - (d) `DJ_DEVICES` is declared `as const satisfies Record<DeviceId, {...}>` — `as const` preserves literal types, `satisfies` enforces the shape without widening. Cleaner than declaring twice.
  - (e) `DJActionTrack.tsx` sorts the placeholder rows by pitch ascending (matching the prototype's `ActionRollUnit` row order), so when 7b plugs in the action keys, the row layout is already correct.
- [x] 10.2 `openspec validate dj-mode-shell --strict` clean.
- [ ] 10.3 Hand off to archive — moves change into `openspec/changes/archive/<date>-dj-mode-shell/` and syncs `openspec/specs/`. **Deferred to user / `/opsx:archive` invocation after manual verification.**
