## 1. URL and stage wiring

- [x] 1.1 Extend `ParsedDemoFlags` in `src/session/demoQuery.ts` with `djAutomationDemo` and set it when `demo` includes `dj-automation`
- [x] 1.2 Ensure `djAutomationDemo` is ignored unless `djDemo && djDemoMessages` (document in JSDoc; enforce in `useStage` / hook args)
- [x] 1.3 Thread the flag from `useStage` into `useDJActionTracks` (add parameter after existing demo booleans or pass a small options object)

## 2. Seeded events

- [x] 2.1 Add `SEEDED_EVENTS_AUTOMATION_DECK1`, `_DECK2`, `_MIXER` (or a builder) implementing deck beats and mixer stepped CC per `design.md`
- [x] 2.2 Branch `seedDefault` / initializer in `useDJActionTracks` to use automation arrays when the automation flag is true; otherwise keep current `SEEDED_EVENTS_*`
- [x] 2.3 Confirm Deck 1/2 `actionMap` pitches include 89, 90, 76, 77, 65 where required (extend `DEMO_DECK*_PITCHES` if any pitch is missing)

## 3. Tests

- [x] 3.1 Add `demoQuery` tests for `?demo=dj&demo=dj-automation`, `dj-empty` interaction, and token-alone behavior
- [x] 3.2 Add focused test that seeds tracks with automation flag and asserts mixer pitch **82** event count **17** and deck **76** event at `t===1` has velocity **127**

## 4. Verification

- [x] 4.1 Manual: load `?demo=dj&demo=dj-automation`, play from transport, spot-check MIDI/log or UI that ramps advance and beat-jump taps fire near beats 1–4
- [x] 4.2 Run `yarn typecheck` and `yarn test`
