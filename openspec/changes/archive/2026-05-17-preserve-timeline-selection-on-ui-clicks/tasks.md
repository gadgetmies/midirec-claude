## 1. Shared chrome-exempt predicate

- [x] 1.1 Add `isSelectionPreservingChrome(target: Element | null): boolean` helper alongside `useStage.tsx` (or in a sibling `selectionChrome.ts`); it SHALL return `true` iff `target.closest('.mr-titlebar, .mr-toolstrip, .mr-sidebar, .mr-inspector, .mr-statusbar')` is non-null
- [x] 1.2 Unit test the predicate against synthetic DOM trees for each of the five class names plus a negative case (element inside `.mr-timeline`)

## 2. Wire the predicate into the existing pointerdown effects

- [x] 2.1 In `src/hooks/useStage.tsx`, update the `selectedTimelineTrack` outside-click effect (~L190–209) to early-return when `isSelectionPreservingChrome(target)` is `true`, in addition to the existing `.mr-timeline` scope check
- [x] 2.2 In `src/hooks/useStage.tsx`, update the DJ-selection outside-click effect (~L219–231) to early-return when `isSelectionPreservingChrome(target)` is `true`, before the existing `.mr-djtrack` / `[data-mr-dj-selection-region]` checks
- [x] 2.3 If `interactiveRollSel` is cleared anywhere as a side effect of pointerdown (verify in `useStage.tsx`), gate that path with the same predicate

## 3. Component / integration tests

- [x] 3.1 Add a test that seeds `selectedTimelineTrack` and dispatches a `pointerdown` on each of `.mr-titlebar`, `.mr-toolstrip`, `.mr-sidebar`, `.mr-inspector`, `.mr-statusbar`; assert `selectedTimelineTrack` is unchanged after each
- [x] 3.2 Add the same matrix of tests for `djActionSelection` / `djEventSelection` (single test that asserts both stay non-null after each chrome-region click)
- [x] 3.3 Add a regression test that the intentional clear path still works: with `selectedTimelineTrack !== null`, a `pointerdown` inside `.mr-timeline` but outside `.mr-channel__hdr` / `.mr-track__hdr` / `.mr-djtrack__hdr` / `.mr-roll` clears the selection
- [x] 3.4 Add a regression test that `[data-mr-dj-selection-region]` opt-in still preserves DJ selection when the element is inside `.mr-timeline` (i.e. the data attribute is not redundantly handled by the chrome predicate)

## 4. Spec + docs sync

- [x] 4.1 Run `openspec validate preserve-timeline-selection-on-ui-clicks` and resolve any reported issues
- [ ] 4.2 Manually verify in the running app: select a channel header → click a toolstrip button → selection persists; select a DJ action row → click in the inspector chrome → selection persists; click on empty ruler → selection clears

## 5. Cleanup

- [x] 5.1 If any `data-mr-dj-selection-region` attribute is now strictly redundant (its element lives entirely inside a chrome region), leave it in place but note in the code comment that the chrome predicate already covers it — do not delete attributes that other code/tests reference
- [x] 5.2 Confirm no behavior change for `Escape`-driven clearing or for programmatic selection mutations (search `setSelectedTimelineTrack`, `setDJActionSelection` call sites to confirm none rely on outside-click as the only clear path)
