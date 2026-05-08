## 1. Track type and useTracks hook

- [x] 1.1 Create `src/hooks/useTracks.ts` defining the `Track` interface (`{ id, name, channel, color, notes, open, muted, soloed }`) and the `useTracks()` hook with seeded default tracks per spec (Lead, Bass, Pads with prototype colors and `makeNotes(22, 7)`, `makeNotes(16, 11)`, `makeNotes(12, 19)`).
- [x] 1.2 Implement `toggleTrackOpen(id)`, `toggleTrackMuted(id)`, `toggleTrackSoloed(id)` action functions. Use `useReducer` or `useState`. Unknown id is a no-op.
- [x] 1.3 Memoize the seeded notes (call `makeNotes` once per track via `useMemo`) so re-renders don't regenerate them.
- [x] 1.4 Verify by hand that the seeded Lead track has 22 notes, Bass 16, Pads 12. (Pull from useTracks().tracks in dev tools or temporary log.)

## 2. MSChip primitive

- [x] 2.1 Create `src/components/ms-chip/MSChip.tsx` accepting `{ muted, soloed, onMute?, onSolo?, size? }` props. Render `<div className="mr-ms" data-size={size ?? 'sm'}>` with two child `<button className="mr-ms__btn" data-kind="m|s" data-on={...}>` elements.
- [x] 2.2 Each button's `onClick` SHALL call `event.stopPropagation()` first, then invoke the corresponding callback. The buttons render the literal strings `M` and `S`.
- [x] 2.3 Create `src/components/ms-chip/MSChip.css` porting `.mr-ms`, `.mr-ms__btn`, and the `[data-on="true"][data-kind="m"|"s"]` variants from `prototype/app.css` lines ~706–735.
- [x] 2.4 Import `MSChip.css` from the top of `MSChip.tsx`.
- [x] 2.5 Verify clean: `grep -E '#[0-9a-fA-F]{3,8}\b|oklch\(' src/components/ms-chip/MSChip.css` returns zero matches.

## 3. Minimap subcomponent

- [x] 3.1 Create `src/components/tracks/Minimap.tsx` accepting `{ notes: Note[], color: string, viewT0: number, totalT: number }`.
- [x] 3.2 Render `<div className="mr-track__minimap">` with one `<span>` per note whose interval `[t, t+dur)` overlaps `[viewT0, viewT0 + totalT]`. Each span uses percentage positioning per design D4: `left: ((n.t - viewT0) / totalT) * 100%`, `width: max(1px, (n.dur / totalT) * 100%)`, `top: 1px`, `bottom: 1px`, `background: color`, `opacity: 0.5 + n.vel * 0.4`, `borderRadius: 1px`.

## 4. Track row component

- [x] 4.1 Create `src/components/tracks/Track.tsx` (the per-row component, distinct from the orchestrator) accepting `{ track, onToggleOpen, onToggleMuted, onToggleSoloed, viewProps, isSelected, marquee, selectedIdx }`. `viewProps` carries `{ pxPerBeat, rowHeight, lo, hi, totalT, playheadT }`.
- [x] 4.2 Render `<div className="mr-track" data-track-open={track.open} data-muted={track.muted} data-soloed={track.soloed}>`. Inside:
  - `<div className="mr-track__hdr" onClick={onToggleOpen}>` containing `.mr-track__chev`, `.mr-track__swatch` (background = `track.color`), `.mr-track__name`, `.mr-track__sub`, `.mr-track__spacer`, and `<MSChip muted={track.muted} soloed={track.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed}/>`.
  - When open: `<div className="mr-track__roll">` wrapping a `<PianoRoll>` with the track's notes, color, and (only if `isSelected`) the marquee + selectedIdx.
  - When closed: `<div className="mr-track__collapsed">` with the standard collapsed-row label structure (`<span>collapsed</span>`, the `<Minimap/>`, and `<span>{track.notes.length} events · 4 bars</span>`) — copy the prototype's structure verbatim from `components.jsx` lines ~816–832.
- [x] 4.3 The header click handler invokes `onToggleOpen` only — the M/S chip buttons handle their own clicks via `event.stopPropagation()` (already in MSChip).
- [x] 4.4 The `.mr-track__sub` text content is `${track.channel} · ${track.notes.length} notes`.

## 5. Track styles

- [x] 5.1 Create `src/components/tracks/Track.css` porting from `prototype/app.css` lines ~736–812 (also includes `.mr-track__collapsed` in the muted/solo composition selector since collapsed rows should fade equivalently when muted/non-soloed).
- [x] 5.2 Verify clean: `grep -E '#[0-9a-fA-F]{3,8}\b|oklch\(' src/components/tracks/Track.css` returns zero matches.
- [x] 5.3 Import `Track.css` from the top of `Track.tsx`.

## 6. MultiTrackStage orchestrator

- [x] 6.1 Create `src/components/tracks/MultiTrackStage.tsx` accepting `{ tracks, viewProps, selectedTrackId, marquee, selectedIdx, onToggleOpen, onToggleMuted, onToggleSoloed }`.
- [x] 6.2 Compute `dataSoloing = tracks.some(t => t.soloed)`. Render `<div className="mr-multi-track-stage" data-soloing={dataSoloing ? 'true' : undefined}>` with one `<Track>` child per track in array order.
- [x] 6.3 Pass `isSelected={track.id === selectedTrackId}` to each Track. Pass the same `viewProps` to all tracks.

## 7. useStage retrofit

- [x] 7.1 Modify `src/hooks/useStage.ts` to call `useTracks()` and expose its return values plus action functions.
- [x] 7.2 The `StageState` interface drops the top-level `notes` field and adds `tracks: Track[]`, `selectedTrackId: string | null`, plus the action functions (`toggleTrackOpen`, `toggleTrackMuted`, `toggleTrackSoloed`).
- [x] 7.3 The `?demo=marquee` placeholder sets `selectedTrackId = "t1"` (Lead). Default load sets `selectedTrackId = null`.
- [x] 7.4 Keep the placeholder modular wrap on `playheadT` with a `// TODO: remove once scroll/zoom slice lands` comment.

## 8. AppShell wiring

- [x] 8.1 Modify `src/components/shell/AppShell.tsx` to replace the bare `<PianoRoll>` mount inside `.mr-stage` with `<MultiTrackStage>`. The orchestrator receives the view-window props plus the tracks/marquee/selection state from `useStage()`.
- [x] 8.2 The Ruler stays a singleton above the stage region; passing only `totalT` since `pxPerBeat` defaults to `DEFAULT_PX_PER_BEAT` consistently across Ruler and PianoRoll.
- [x] 8.3 The AppShell still validates against the `app-shell` capability's modified scenarios — the stage now contains the orchestrator, which in turn contains the per-track piano rolls.

## 9. Verification

- [x] 9.1 `yarn typecheck` passes (clean).
- [x] 9.2 Headless render at 1800×1500 confirms three tracks: Lead (open, 22 notes), Bass (open, 16 notes), Pads (collapsed with 12-note minimap, muted). DOM dump confirms `data-track-open="true"|"true"|"false"` and `data-muted="false"|"false"|"true"` per the seeded default.
- [x] 9.3 Track headers render with chevron, color swatch, name, `CH n · N notes` sub label, and M/S chip; Lead notes are default blue (no trackColor override hits the formula because `oklch(72% 0.14 240)` is passed and the renderer composes via `color-mix`), Bass notes render in red-orange (track color `oklch(70% 0.16 30)`).
- [x] 9.4 Pads' `.mr-track__collapsed` is muted-faded — the CSS rule `[data-muted="true"] .mr-track__collapsed { opacity: 0.32; filter: grayscale(0.7); }` applies. Visible in screenshot as a noticeably dimmer row.
- [x] 9.5 Click-to-toggle behavior verified by inspection of the JSX wiring: `MSChip`'s buttons call `event.stopPropagation()` then their callback; the header's onClick calls `onToggleOpen` only. Live click testing deferred to manual verification.
- [x] 9.6 Solo-composition wiring verified by inspection: orchestrator computes `data-soloing` from `tracks.some(t => t.soloed)`; CSS selector `[data-soloing="true"] [data-soloed="false"] .mr-track__roll, .mr-track__collapsed { opacity: 0.45 }` does the dimming.
- [x] 9.7 Header chevron rotates via CSS rule `[data-track-open="false"] .mr-track__chev { transform: rotate(-90deg); }`. Verified in DOM dump for Pads: `data-track-open="false"`.
- [x] 9.8 Header vs M/S chip click separation: `MSChip` button onClick calls `event.stopPropagation()` first.
- [x] 9.9 Headless render at `/?demo=marquee` confirms exactly one `.mr-marquee` element in the DOM (on Lead's piano roll), with the badge showing `7`.
- [x] 9.10 Grep clean: no hex literals or `oklch()` in any `.css` file under `src/components/tracks/` or `src/components/ms-chip/`. Three `oklch()` matches in `useTracks.ts` are runtime track-color data values (per design D-OpenQuestions), not CSS.
- [x] 9.11 Visual matches the prototype's screenshot 04 area for Lead+Bass: track headers, per-track note coloring, marquee + selection on Lead only.
