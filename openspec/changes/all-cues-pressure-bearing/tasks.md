## 1. Data change

- [x] 1.1 In `src/data/dj.ts`, set `pad: true, pressure: true` on `DEFAULT_ACTION_MAP[49]` (`cue`)
- [x] 1.2 In `src/data/dj.ts`, set `pad: true, pressure: true` on `DEFAULT_ACTION_MAP[66]` (`cue_b`)
- [x] 1.3 In `src/data/dj.ts`, add `pressure: true` to `DEFAULT_ACTION_MAP[57]` (`hc2`), `[58]` (`hc3`), `[59]` (`hc4`)
- [x] 1.4 In `src/data/dj.ts`, add `pressure: true` to `DEFAULT_ACTION_MAP[70]` (`hc2_b`), `[78]` (`hc3_b`), `[79]` (`hc4_b`)
- [x] 1.5 Confirmed `DEFAULT_ACTION_MAP[56]` (`hc1`) and `[69]` (`hc1_b`) remain unchanged (already `pad: true, pressure: true`)

## 2. Test updates — `src/data/dj.test.ts`

- [x] 2.1 Replaced the "fallback for cue id" test — now asserts `actionMode(DEFAULT_ACTION_MAP[49]) === 'pressure-bearing'`
- [x] 2.2 Replaced the "velocity-sensitive when pad: true and no pressure" fixture with `make({ pad: true })`
- [x] 2.3 Added a test confirming `actionMode(DEFAULT_ACTION_MAP[57]) === 'pressure-bearing'`
- [x] 2.4 Verified — no other reference to those pitches in `dj.test.ts`

## 3. Test updates — `src/components/dj-value-editor/mode.test.ts`

- [x] 3.1 Repointed the `fallback` fixture constant to `DEFAULT_ACTION_MAP[73]` (`load_a`) and updated the inline comment; also updated the `fallback row produces hidden mode` test to use pitch 73 as the actionMap key for clarity
- [x] 3.2 No other tests use the `fallback` constant; the one test referencing it still asserts `'hidden'` as expected

## 4. Test updates — `src/components/dj-action-tracks/ActionRoll.test.tsx`

- [x] 4.1 Added a module-scope `velocityPad` synthetic entry and swapped both tests at the pad/velocity sites (lines ~120 and ~374) to use it instead of `DEFAULT_ACTION_MAP[57]!`
- [x] 4.2 Events still use pitch 57; the synthetic entry is keyed at pitch 57 in `actionMap`, so `setDJEventTTicks` expectations (incl. `('dj1', 57, 0, 480)`) remain valid

## 5. Test updates — `src/hooks/useDJActionTracks.test.ts`

- [x] 5.1 Inspected: references to pitch 57 are solo/mute tests (`isDJRowAudible`), independent of action mode
- [x] 5.2 No change needed — HC2 staying in `baseTrack.actionMap` as a pressure-bearing seed entry is fine for those tests

## 6. Verification

- [x] 6.1 `yarn tsc --noEmit` clean
- [x] 6.2 `yarn test --run`: 461/461 tests across 40 files passing
- [x] 6.3 `openspec validate all-cues-pressure-bearing --strict` passes
- [ ] 6.4 Manual: launch the app, load DJ demo, select a cue row and confirm `DJValueEditor` opens (was previously hidden); confirm HC2-4 events now render with the pressure-curve renderer in `ActionRoll` *(manual; not run by Claude)*
