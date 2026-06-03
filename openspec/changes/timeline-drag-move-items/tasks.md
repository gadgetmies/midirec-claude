## 1. Shared helper

- [x] 1.1 Add `quantizeGridToTicks(grid: QuantizeGrid, tpq?: number): number` in `src/midi/` (new file `quantizeGrid.ts` or appended to an existing module if a clear home exists)
- [x] 1.2 Re-export the helper from wherever it lands; ensure `QuantizeGrid` is importable without creating a circular dep with `useTransport`
- [x] 1.3 Unit test the four `'1/4' | '1/8' | '1/16' | '1/32'` mappings and the default-`tpq` fallback

## 2. PianoRoll drag-to-move

- [x] 2.1 Add an `onNoteMove?: (noteIndex: number, nextTTicks: number) => void` prop to `PianoRoll` (next to existing `onNoteSelect`)
- [x] 2.2 Add transport-snap props to `PianoRoll`: `quantizeOn: boolean`, `quantizeGrid: QuantizeGrid` (or pass them via a single `snapTicks: number | null` if the parent prefers to compute upstream — pick one approach and apply it consistently with `ActionRoll`)
- [x] 2.3 Implement the pointer state machine in `PianoRoll.tsx`: `useRef` for `{ pointerId, px0, tick0, noteIndex, mode: 'pre-click' | 'dragging' }`, `useState` for the live preview tick map
- [x] 2.4 On `pointerdown` on a `.mr-note`, capture pointer + initialize the ref; `e.stopPropagation()` remains as today
- [x] 2.5 On `pointermove`, compute `deltaPx`; transition to `dragging` once `abs(deltaPx) >= 3`; compute snapped preview tick; update preview state so the note re-renders at the new `left`
- [x] 2.6 On `pointerup`: if still `pre-click`, fire `onNoteSelect(idx)`; if `dragging`, fire `onNoteMove(idx, finalTick)`; reset preview state
- [x] 2.7 On `pointercancel`, reset preview state without firing either callback
- [x] 2.8 Tests: sub-threshold click, quantize-on snap, quantize-off raw conversion, negative clamp, pointer cancel, commit-once

## 3. ActionRoll drag-to-move (single events)

- [x] 3.1 Implement the same pointer state machine in `ActionRoll.tsx` for `.mr-djtrack__note` elements (all variants), reusing the same threshold + snapping math
- [x] 3.2 Pass `quantizeOn` / `quantizeGrid` down (mirror the PianoRoll prop choice in 2.2)
- [x] 3.3 On `pointerup` with `dragging`, call `setDJEventTTicks(trackId, event.pitch, originalIdx, finalTick)`
- [x] 3.4 Verify existing click-to-select (`setDJEventSelection` + conditional `setDJActionSelection`) only fires when the gesture stays in `pre-click`
- [x] 3.5 Tests: sub-threshold click preserves selection; trigger/velocity/pressure/fallback variants all draggable; quantize on/off; negative clamp; cancel

## 4. ActionRoll drag-to-move (CC groups)

- [x] 4.1 On `pointerdown` on a `.mr-djtrack__cc` element, capture group identity (`trackId`, `group.pitch`, `group.memberIndices`, `earliestMemberTTicks`)
- [x] 4.2 During drag, compute `groupDeltaTicks` from the earliest member (with snapping), then preview-render every member shifted by that delta
- [x] 4.3 On `pointerup`, dispatch `setDJEventTTicks` once per member with `originalTTicks + groupDeltaTicks`
- [x] 4.4 Verify the post-commit render regroups correctly (members still cluster — `buildCcMergedGroupsByMemberIndex` re-runs unchanged)
- [x] 4.5 Tests: 3-member group shift; CC group click-to-select still works; cancel mid-drag leaves the group untouched

## 5. Wire into useStage / AppShell

- [x] 5.1 If new props on `PianoRoll` / `ActionRoll` need data, surface `quantizeOn` / `quantizeGrid` from `useTransport()` to wherever the rolls are mounted
- [x] 5.2 Wire `onNoteMove` in the piano-roll mount site to call `updateNoteAt(channelId, idx, { tTicks: nextTTicks })`
- [x] 5.3 Sanity-check that `useStage()` already exposes `updateNoteAt` and `setDJEventTTicks` for the mount sites (it does today; just confirm no extra plumbing needed)

## 6. Manual verification

- [ ] 6.1 Start dev server; drag a piano-roll note with quantize on (`1/16`) — note snaps to 16th-note positions
- [ ] 6.2 Toggle quantize off; drag the same note — note moves smoothly with the pointer (no grid snap)
- [ ] 6.3 Repeat both checks on a DJ action trigger event
- [ ] 6.4 Drag a DJ CC group — every constituent message shifts together, spacing preserved
- [ ] 6.5 Click (no drag) a previously-unselected note/event — selection still works; Inspector populates
- [ ] 6.6 Drag past the left edge — item clamps at `tTicks=0`, does not produce negative ticks in state
- [ ] 6.7 Confirm Inspector start editor still works after a drag (and vice-versa)
