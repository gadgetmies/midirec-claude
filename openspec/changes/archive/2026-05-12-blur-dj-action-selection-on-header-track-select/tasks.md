## 1. Stage + shell

- [x] 1.1 Add `selectDJTimelineTrack(trackId)` on stage; set DJ timeline selection and clear `djActionSelection` + `djEventSelection`.
- [x] 1.2 Wire DJ track header in `AppShell.tsx` to `selectDJTimelineTrack(track.id)`.

## 2. Verification

- [x] 2.1 `npm run build` passes.
- [x] 2.2 Manual: select row/event → click same DJ header → Map Note / Inspector DJ UI close and highlights clear; Track input still targets DJ track.
