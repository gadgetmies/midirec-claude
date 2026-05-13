## 1. Helpers and CC-output predicate

- [x] 1.1 Add a small helper (e.g. `resolvedOutputCc(track, pitch)` or reuse/align with `midi-playback`) that returns the effective CC number for a row when playback would emit CC, else `undefined`.
- [x] 1.2 Unit-test the helper against `outputMap` overrides and `defaultMixerOutputCc` for at least one mixer action id.

## 2. ActionRoll rendering

- [x] 2.1 In `ActionRoll.tsx`, branch event rendering: CC-output rows → new automation element (root `.mr-djtrack__cc`); else keep existing `renderNote` path.
- [x] 2.2 Implement CC strip visuals (discrete bars / param-lane-style) using `event.t`, `event.dur`, `event.vel`, and `devColor(action.device)`; set `data-audible` and `data-selected` to match note behavior.
- [x] 2.3 Add or extend `ActionRoll.css` for `.mr-djtrack__cc` (layout, selected state if needed).

## 3. Interaction and styling parity

- [x] 3.1 Wire the same click handlers as `.mr-djtrack__note` for `.mr-djtrack__cc` (stop propagation, `setDJEventSelection`, `setDJActionSelection`).
- [x] 3.2 Extend row audibility / dimming CSS so `[data-audible="false"]` dims `.mr-djtrack__cc` as well as notes (per spec delta).

## 4. Tests and verification

- [x] 4.1 Update or add component tests for `ActionRoll` / `DJActionTrack`: mixer/CC row events render `.mr-djtrack__cc`, not `.mr-djtrack__note--velocity`; deck rows unchanged.
- [x] 4.2 Update any hook or integration tests that count note-only DOM nodes for DJ demo fixtures.
- [x] 4.3 Run the project test suite and fix regressions.

## 5. Spec archive follow-up (after implementation)

- [x] 5.1 When implementation is complete, archive this change so `openspec/specs/dj-action-tracks/spec.md` absorbs the delta (via project archive workflow).
