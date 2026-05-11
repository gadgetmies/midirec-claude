## 1. Placeholder hook

- [x] 1.1 Reshape `src/hooks/useStatusbar.ts`: dropped `ClockSource` and the BPM/clock fields; exports `MidiInput`, `StatusbarValue`, `useStatusbar()` returning `{ lastInput: MidiInput | null; active: boolean }`, and the `formatChannel` helper.
- [x] 1.2 Stub returns `lastInput = { id: "korg-minilogue-xd", name: "Korg minilogue xd", channel: 1 }` and `active: true`.
- [x] 1.3 Dropped the `formatBpm` helper — Titlebar already renders BPM via its existing mono meta cell; no formatting helper needed.
- [x] 1.4 Hook contains no reference to `navigator.requestMIDIAccess`, `WebMidi`, or any platform MIDI API (verified via `grep`).

## 2. Transport hook — clockSource field

- [x] 2.1 Added `ClockSource = 'internal' | 'external-clock' | 'external-mtc'` type; added `clockSource: ClockSource` to `InternalState`; initial value `'internal'`.
- [x] 2.2 `clockSource` surfaced on `TransportState` and on the value returned by `useTransport()`.
- [x] 2.3 No new actions — `clockSource` is read-only state in this slice. Switching lands with real-MIDI work.

## 3. Statusbar component

- [x] 3.1 `Statusbar.tsx` renders a single `.mr-statusbar__cluster` (no spacer, no second cluster, no BPM, no clock).
- [x] 3.2 The cluster's content is wrapped in `<button type="button" data-pickable="false" tabIndex={-1}>`.
- [x] 3.3 Active state: `.mr-led[data-state="midi"]` when `active`, no attribute when idle; device name at `var(--mr-text-2)`; `.mr-statusbar__ch` chip via `formatChannel(channel)`.
- [x] 3.4 Empty state when `lastInput === null`: idle LED + `Awaiting MIDI` at `var(--mr-text-3)`, no channel chip.

## 4. Statusbar styles

- [x] 4.1 `Statusbar.css` reshaped to single-cluster layout: `__l` / `__r` / `__spacer` / `__bpm` rules dropped; `__cluster` added.
- [x] 4.2 `.mr-statusbar__cluster` is `display: inline-flex; align-items: center`.
- [x] 4.3 `.mr-statusbar__btn` inert — no border, transparent background, `cursor: default`, no hover/focus affordance (`:hover` / `:focus` / `:focus-visible` reset to transparent + no outline + no box-shadow).
- [x] 4.4 `.mr-statusbar__name` is `--mr-fs-11`; color via `data-active="true|false"` → `var(--mr-text-2)` / `var(--mr-text-3)`.
- [x] 4.5 `.mr-statusbar__ch` mirrors `.mr-dev__ch` (mono, `--mr-fs-10`, `var(--mr-text-3)`).
- [x] 4.6 No `.mr-led` rules added — shared selector from `src/styles/leds.css` is reused.

## 5. Titlebar — Clk meta cell + activity-driven MIDI IN LED

- [x] 5.1 Added a fourth `.mr-meta` cell `Clk` directly after BPM, before Sig. Value renders via the `CLOCK_LABEL` map: `internal → Int`, `external-clock → Ext`, `external-mtc → MTC`.
- [x] 5.2 Imported `useStatusbar` in Titlebar; the MIDI IN LED's `data-state` binds to `active` (`data-state="midi"` when `true`, omitted when `false`).
- [x] 5.3 The `MIDI IN` text label is unchanged — renders regardless of activity state.

## 6. AppShell wiring

- [x] 6.1 `<Statusbar />` mounted inside the existing `<footer class="mr-statusbar">`, replacing the `.mr-stub` placeholder.
- [x] 6.2 `.mr-stub` rule removed from `AppShell.css`.
- [x] 6.3 `grep -r 'mr-stub' src/` returns zero matches.

## 7. Deviation log

- [x] 7.1 Updated deviation #20 in `design/deviations-from-prototype.md` to reflect the final shape (three-surface reshape: Statusbar = live incoming-MIDI cluster; Titlebar gains Clk cell; MIDI IN LED becomes activity-driven). Summary table row 20 updated.

## 8. Verification

- [x] 8.1 `yarn typecheck` — clean.
- [x] 8.2 `openspec validate statusbar-shell --strict` — `Change 'statusbar-shell' is valid`.
- [x] 8.3 `yarn test --run` — 77 / 77 passing.
- [x] 8.4 Manual visual: load the app, confirm the Titlebar meta-row reads `Bar 1.1.1 · BPM 124 · Clk Int · Sig 4/4`; the Titlebar's MIDI IN LED is lit (active state); the bottom strip shows `● Korg minilogue xd  CH·1`. Verified in browser.
- [x] 8.5 Manual visual: temporarily flip the hook stub to `active: false` and confirm both the Titlebar MIDI IN LED and the Statusbar's LED go dim (but the text "Korg minilogue xd CH·1" stays — last input is sticky). Revert. Verified in browser.
- [x] 8.6 Manual visual: temporarily flip the hook stub to `lastInput: null, active: false` and confirm the Statusbar shows `Awaiting MIDI` with an idle LED and no channel chip. Revert. Verified in browser.
- [x] 8.7 Manual visual: temporarily flip `useTransport`'s seeded `clockSource` to `'external-clock'` and confirm the Titlebar's Clk cell shows `Ext`. Revert. Verified in browser.
- [x] 8.8 Keyboard: Tab through the app and confirm focus skips the Statusbar button. Verified in browser.
- [x] 8.9 Click the Statusbar button — confirm no observable effect. Verified in browser.
