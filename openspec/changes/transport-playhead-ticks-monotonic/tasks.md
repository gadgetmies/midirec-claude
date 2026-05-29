## 1. Failing tests for the new contract

- [x] 1.1 In `src/hooks/useTransport.externalClock.test.tsx`, add a test that `applyExternalPulse` advances `playheadTicks` by exactly `DEFAULT_MIDI_TPQ / 24` per pulse across bpm jitter (120 → 125 → 119).
- [x] 1.2 Add a test that `applyExternalPulse` does NOT advance `playheadTicks` when `mode === 'idle'`.
- [x] 1.3 Add a test that the external playhead is strictly monotonic across a downward bpm swing (24 pulses at bpm 120, then one at bpm 100 — `playheadTicks` strictly increases).
- [x] 1.4 Run the file; verify the three new tests fail with `expected … undefined` (no `playheadTicks` field yet) and the existing 9 tests still pass.

## 2. Transport reducer wires playheadTicks

- [x] 2.1 In `src/hooks/useTransport.tsx`, import `DEFAULT_MIDI_TPQ` and define `TICKS_PER_PULSE = DEFAULT_MIDI_TPQ / 24`.
- [x] 2.2 Add `playheadTicks: number` to `TransportState`, `InternalState`, and `initialState` (initial = 0).
- [x] 2.3 In `stop`, set `playheadTicks: 0` (matches `timecodeMs: 0`).
- [x] 2.4 In `record`, set `playheadTicks: state.mode === 'idle' ? 0 : state.playheadTicks` (matches the `timecodeMs` rule).
- [x] 2.5 In `seek`, set `playheadTicks` derived from `(ms/1000) * (bpm/60) * tpq` so seeking stays coherent.
- [x] 2.6 In the internal `tick` reducer (the non-external branch), advance `playheadTicks` by `(deltaMs/1000) * (bpm/60) * tpq` alongside `timecodeMs`.
- [x] 2.7 In `applyExternalPulse`, advance `playheadTicks` by `TICKS_PER_PULSE` when `mode !== 'idle'` (independent of the carried `bpm`).
- [x] 2.8 Expose `playheadTicks` in the memoized `TransportValue`.
- [x] 2.9 Re-run the test file; all 12 tests pass.

## 3. useStage reads playheadTicks from transport

- [x] 3.1 In `src/hooks/useStage.tsx`, drop the `playheadTicksFromTimecodeMs` import.
- [x] 3.2 Replace `const { timecodeMs, bpm } = useTransport();` with `const { playheadTicks } = useTransport();`.
- [x] 3.3 Remove the local `const playheadTicks = playheadTicksFromTimecodeMs(timecodeMs, bpm);` line.
- [x] 3.4 Confirm no other consumers of `useStage` need adjustment (`playheadT` still derives from `playheadTicks` via `sessionTicksToBeats`).

## 4. Verification

- [x] 4.1 `yarn tsc --noEmit` clean.
- [x] 4.2 Run the clock / transport / stage / playhead-follow test files together — all pass.
- [x] 4.3 Run the full suite; only pre-existing failures remain (`DJValueEditor.height.test.ts` localStorage issue, unrelated).
