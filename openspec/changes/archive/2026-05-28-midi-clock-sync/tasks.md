## 1. Clock receiver core

- [x] 1.1 Create `src/midi/clockReceiver.ts` with a pure-data parser: an `attachClockReceiver(input, onPulse, onStart, onContinue, onStop)` function that wraps `input.onmidimessage`, chains the prior handler, filters for `0xF8 / 0xFA / 0xFB / 0xFC`, and returns a detach function that restores the prior handler reference (mirror `src/midi/recorder.ts:413-525` pattern)
- [x] 1.2 Add unit tests at `src/midi/clockReceiver.test.ts` covering: handler chaining, prior-handler restoration on detach, ignoring non-real-time messages (Note On / CC / PB / AT), and that detach is idempotent when called twice
- [x] 1.3 Implement a `BpmSmoother` helper inside `clockReceiver.ts` (or sibling file): rolling window of 24 pulse intervals, returns `null` until 24 samples observed, returns `round(60000 / (mean * 24))` after
- [x] 1.4 Test `BpmSmoother`: returns null at <24 samples, converges to 120 BPM for 20.833 ms intervals, converges to 128 BPM for 19.531 ms intervals

## 2. MidiClockProvider + useMidiClock hook

- [x] 2.1 Create `src/midi/MidiClockProvider.tsx` with a React context exposing `MidiClockState = { present, bpm, pulse, beat, running }` and a `useMidiClock()` hook that throws when used outside the provider
- [x] 2.2 Inside the provider: read `useMidiInputs()`; when status is not `'granted'`, render children with a stub state and attach no handlers; otherwise iterate over inputs and call `attachClockReceiver` for each (effect cleanup detaches)
- [x] 2.3 Implement active-master tracking: store `activeMasterId` and `lastPulseAtByInputId`; ignore pulses from non-active inputs until active has been silent for 2000 ms; switch active master on the first pulse from a different input after that silence
- [x] 2.4 Implement `present` flag: `true` if active master has pulsed in last 500 ms (timer-driven via `setTimeout` that re-arms on each pulse); on transition to `false`, keep `bpm` at last value (don't reset to `null`)
- [x] 2.5 Implement `pulse` and `beat` counters; reset to 0 only when active master changes (fresh window)
- [x] 2.6 Implement `running` flag driven by Start / Continue (set true) / Stop (set false); ignore real-time transport messages when source is not yet detected (no active master)
- [x] 2.7 Mount `<MidiClockProvider>` in `src/App.tsx` nested inside `<MidiRuntimeProvider>` and wrapping `<TransportProvider>` (so the provider can dispatch transport actions via a ref-based callback or a sibling effect — pick whichever fits the existing provider chain in App.tsx)
- [x] 2.8 Tests at `src/midi/MidiClockProvider.test.ts`: bpm null until 24 pulses, converges at 120 BPM, pulse/beat monotonic, running follows Start/Stop, Continue preserves pulse count, second-master ignore behavior, active-master swap after 2000 ms silence, present flips false after 500 ms silence with bpm preserved, no-op when MIDI runtime not granted

## 3. Transport sync to external clock

- [x] 3.1 Extend `useTransport.tsx` reducer with an `externalTick` action that behaves like `tick` (advances `timecodeMs` by `deltaMs` when `mode !== 'idle'`); add a guard so the rAF `tick` action is a no-op when `clockSource === 'external-clock'`
- [x] 3.2 In `TransportProvider`, gate the existing `useEffect`-driven rAF loop on `state.clockSource === 'internal'` (in addition to the existing `mode === 'idle'` early-return) so rAF does not run while slaved
- [x] 3.3 Add a `setClockSource(source)` and `setExternalBpm(bpm)` action (internal-only, not exposed in the public `TransportActions` type) so the clock provider can dispatch them; OR expose `applyExternalPulse({ deltaMs, bpm, source })` as a single combined dispatch — choose whichever minimizes re-renders. Document the choice in a one-line comment in the reducer
- [x] 3.4 Wire `MidiClockProvider` to dispatch into `useTransport()`: on `present === true → false` flip source back to `'internal'`; on first pulse flip to `'external-clock'`; on each pulse dispatch `externalTick` with `deltaMs = meanIntervalMs` and the current smoothed bpm
- [x] 3.5 Wire Start / Continue → `useTransport().play()` when `mode === 'idle'`; Stop → `useTransport().pause()` when `mode === 'play'`; ignore all three when `mode === 'record'`
- [x] 3.6 Ensure source-switch mid-playback doesn't move `timecodeMs` backwards: the first `externalTick` after a source flip should pass `deltaMs` such that the new playhead value is `>=` the value at the moment of the flip (use a min-zero guard in the reducer)
- [x] 3.7 Tests at `src/hooks/useTransport.externalClock.test.tsx`: rAF does not advance timecode in external mode, externalTick advances by deltaMs, bpm field mirrors injected external bpm, source-switch mid-play doesn't regress timecode, Start/Continue/Stop dispatch correctly with mode === 'idle' / 'play', record-mode ignores real-time messages

## 4. Beat LED in Titlebar

- [x] 4.1 Locate the existing status cluster in the Titlebar (per `transport-titlebar` spec — see `prototype/components.jsx` `Transport` for the JSX shape). Add a beat LED as the cluster's first child, followed by a middot, before the existing mode LED
- [x] 4.2 Create `src/components/transport-titlebar/BeatLed.tsx` (or co-locate inline with the existing cluster component, whichever matches the file layout already in use) that reads `useMidiClock()` and renders `<span class="mr-led" data-state={present ? 'beat' : undefined} class={isPulse ? 'is-pulse' : ''} />`
- [x] 4.3 Implement the 80 ms `is-pulse` transient: a `useEffect` on `beat` increment sets `isPulse` to true, then a `setTimeout(80)` clears it; the effect cleanup clears any pending timeout to avoid stale flashes after unmount or beat regression
- [x] 4.4 Add `.mr-led[data-state="beat"]` and `.mr-led[data-state="beat"].is-pulse` rules to the Titlebar stylesheet using only `--mr-*` tokens (no new hex literals). The base state should be a dim accent color; `is-pulse` should boost opacity to 1.0 and add a small box-shadow glow at `--mr-accent-soft` or equivalent token
- [x] 4.5 Component test at `src/components/transport-titlebar/BeatLed.test.tsx`: renders dim with no `data-state` when `present === false`; renders `data-state="beat"` when `present === true`; receives `is-pulse` class on beat increment and loses it ~80 ms later (use fake timers); does not animate via a CSS keyframe — assert no `animation-name` is set on the element

## 5. Verification and integration

- [x] 5.1 Update `useTransport()` consumer that reads `bpm` (the Titlebar `BPM` meta cell) to confirm it now reflects the externally-mirrored value when slaved — should require no change because `useTransport().bpm` is the single source of truth; add a regression test that mounts the Titlebar with a mocked clock provider injecting bpm=128 and asserts the cell renders `128`
- [x] 5.2 Run the full test suite (`yarn test` or equivalent) and confirm no regressions in `useTransport.test.tsx`, `recorder.test.ts`, or any scheduler tests (the receiver's handler chaining must not break the recorder's existing handler chain)
- [ ] 5.3 Manual smoke test in the browser with a real MIDI clock source (any DAW with "Send MIDI Clock" enabled to an IAC bus on macOS, or a hardware sequencer): verify Clk cell flips to `Ext`, BPM cell reflects the master's tempo within ~1 second of starting clock, beat LED pulses on each quarter note, Start/Stop on the master drives transport play/pause, stopping the master for >2 s reverts Clk to `Int` _(requires user — cannot be performed from CLI)_
- [x] 5.4 Open `openspec validate midi-clock-sync` and confirm zero validation errors before handing off to `/opsx:apply`

## 6. Clock source selection picker

- [x] 6.1 Extend `MidiClockState` with `selection: 'auto' | 'internal' | string` (default `'auto'`) and `setSelection(sel)` action exposed via `useMidiClock()`
- [x] 6.2 In the receiver: gate pulse / Start / Continue / Stop acceptance on `selection`. `'auto'` keeps first-wins; `'internal'` discards everything and immediately dispatches `revertToInternalClock()`; `<deviceId>` only accepts messages whose `input.id === selection` and pins the active master to that device
- [x] 6.3 In the present-timer's silence callback: only dispatch `revertToInternalClock()` when `selection === 'auto'`. In `<deviceId>` (locked) mode, let `present` flip to `false` but leave `clockSource` and `bpm` frozen — recovery requires user-driven `setSelection('internal')`
- [x] 6.4 In `setSelection`: reset smoother, clear `activeMasterId`, clear `lastPulseAtByInputId`, clear the present timer, reset `pulse`/`beat`/`running`/`present` to defaults, set `bpm` to `null`, set `selection` to the new value, and dispatch `revertToInternalClock()` if `newSel === 'internal'`. No-op when `newSel === selection`
- [x] 6.5 Convert the Titlebar's `Clk` meta cell from a `<span>` value into a `<button type="button">` that toggles a dropdown menu. Reuse the `.mr-quant__menu` / `.mr-quant__menu-row` styling and the click-outside / Escape close patterns from the quantize grid widget at `Titlebar.tsx:84-101`
- [x] 6.6 Render menu rows in order: `Auto`, `Internal`, then one row per `useMidiInputs().inputs[*]` with label = device `name` and value = device `id`. Mark the row matching `useMidiClock().selection` with `data-on="true"` and `aria-selected="true"`. Clicking a row invokes `setSelection(value)` and closes the menu
- [x] 6.7 Update the existing `vi.mock` for `MidiClockProvider` in `src/components/titlebar/Titlebar.test.tsx` to return a `setSelection` spy so the new Clk-picker tests can assert it was called
- [x] 6.8 Tests at `src/midi/MidiClockProvider.test.tsx` (new describe block): default selection is `'auto'`; `setSelection('internal')` discards all subsequent pulses and dispatches `revertToInternalClock`; device-locked selection only honors pulses from that device; locked-device silence does not auto-revert (clockSource stays external, bpm frozen); `setSelection` resets state; `setSelection(<same>)` is a no-op
- [x] 6.9 Tests at `src/components/titlebar/Titlebar.test.tsx` (new describe block): Clk cell renders as a button with `aria-haspopup="listbox"`; clicking opens menu with `Auto` + `Internal` + each device row; selected row carries `data-on`; clicking a row calls `setSelection` with the expected value; outside click and Escape close the menu without changing selection; menu still shows Auto + Internal when no devices connected
- [x] 6.10 Run the full test suite and `openspec validate midi-clock-sync` — expect zero new failures
