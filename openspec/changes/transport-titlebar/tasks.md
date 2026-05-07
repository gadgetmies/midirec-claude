## 1. Transport icon set

- [x] 1.1 Create `src/components/icons/transport.tsx` exporting `PlayIcon`, `PauseIcon`, `StopIcon`, `RecIcon`, `RewIcon`, `FfwIcon`, `CueIcon`, `LoopIcon`, `MetroIcon` — each rendering the exact SVG paths from `prototype/components.jsx` `Icon` (lines 11–34). Each icon accepts `width?: number` (default 14) and `className?`.
- [x] 1.2 Verify visually that each icon is identical to the prototype's by spot-checking SVG `viewBox` and path values.

## 2. Transport state hook

- [x] 2.1 Create `src/hooks/useTransport.ts` defining the `TransportMode`, `TransportState`, `TransportActions` types per design.md §D1.
- [x] 2.2 Define `transportReducer(state, action)` covering `play`, `pause`, `stop`, `record`, `toggleLoop`, `toggleMetronome`, `toggleQuantize`, `seek`, and a private `'tick'` action (delta-ms) used by the rAF loop.
- [x] 2.3 Initial state defaults: `mode: 'idle'`, `looping: false`, `metronomeOn: true`, `quantizeOn: true`, `quantizeGrid: '1/16'`, `timecodeMs: 0`, `bar: '1.1.1'`, `bpm: 124`, `sig: '4/4'`.
- [x] 2.4 Implement `play()`: mode → `'play'` (do not reset timecode). `pause()`: mode → `'idle'` (preserve timecode). `stop()`: mode → `'idle'`, `timecodeMs = 0`. `record()`: mode → `'record'` (start at 0 if currently idle; else preserve).
- [x] 2.5 Compute derived `playing` and `recording` from `mode` (do not store separately).
- [x] 2.6 Implement bar derivation: `bar = bbsFromMs(timecodeMs, bpm, sig)`. Format `B.B.S` where bars are 1-indexed, beats are 1-indexed within a bar, and the trailing digit is the 16th-note within the beat (1–4). For `4/4` this gives 16 sixteenths per bar. Pure-function helper, unit-testable on the side.
- [x] 2.7 Build a `TransportContext` (`createContext`) and `<TransportProvider>` component wrapping `useReducer`. The provider runs a `useEffect` that schedules a `requestAnimationFrame` loop while `state.mode !== 'idle'`, dispatching `{ type: 'tick', deltaMs }` on each frame. Cancel the rAF on cleanup and on idle transitions.
- [x] 2.8 Export `useTransport(): TransportState & TransportActions` reading from the context. Throw a clear error if used outside the provider.

## 3. Toast layer

- [x] 3.1 Create `src/components/toast/Toast.tsx`: `<ToastProvider>` storing `{ message, kind, shortcut, durationMs } | null` and the next-id-counter. Children render normally; a sibling `<ToastViewport />` is exposed via context or rendered inside the provider.
- [x] 3.2 `useToast()` returns `{ show(message, opts?), dismiss() }`. `show` replaces any existing toast and (if `durationMs > 0`) schedules a `setTimeout` to auto-dismiss. The latest call's id is tracked so a stale timeout cannot dismiss a newer toast.
- [x] 3.3 `<ToastViewport />` renders an absolute-positioned `.mr-toast-viewport` (full-bleed, `pointer-events: none`). When state is non-null, it renders `.mr-toast` inside.
- [x] 3.4 `.mr-toast` markup: `<div className="mr-toast"><span className="mr-toast__dot" data-kind={kind}/>{message}{shortcut && <kbd className="mr-toast__hint">{shortcut}</kbd>}</div>`.
- [x] 3.5 Create `src/components/toast/Toast.css`: viewport (`position: absolute; inset: 0; pointer-events: none; z-index: var(--mr-z-toast);`); `.mr-toast` rules ported from `prototype/app.css` lines 1004–1024 (`pointer-events: auto` added); `.mr-toast__dot[data-kind="ok"|"info"|"warn"]` background variants; `.mr-toast__hint` mono small chip with `var(--mr-text-3)` color and a thin `var(--mr-line-2)` border.

## 4. Titlebar component

- [x] 4.1 Create `src/components/titlebar/Titlebar.tsx` rendering the `Brand`, transport group A (rew/cue/play/stop/rec/ffw), timecode, meta row (Bar/BPM/Sig), transport group B (loop/metro), quantize widget (Q label + power toggle + grid chip), spacer, and status cluster (LED + REC|PLAY|IDLE + middot + LED + MIDI IN). Markup mirrors `prototype/components.jsx` lines 50–121 exactly except for hooking `data-on` / `data-rec` to `useTransport()` state.
- [x] 4.2 Brand: render the gradient mark + `MIDI Recorder` + `v0.4.2` (hardcoded version is fine; comes from `prototype/components.jsx` Brand default).
- [x] 4.3 Play button: icon = `playing ? PauseIcon : PlayIcon`; `data-on={playing}`; `onClick = playing ? pause : play`.
- [x] 4.4 Stop button: `onClick = stop`.
- [x] 4.5 Rec button: `data-rec="true"`, `data-on={recording}`, `onClick = recording ? stop : record`.
- [x] 4.6 Loop button: `data-on={looping}`, `onClick = toggleLoop`. Metro button: `data-on={metronomeOn}`, `onClick = toggleMetronome`.
- [x] 4.7 Rew/Cue/Ffw buttons: render but no-op `onClick` for now (future slices will wire seek behavior); preserve hover state.
- [x] 4.8 Quantize widget: power toggle uses `data-on={quantizeOn}`, `onClick = toggleQuantize`; grid chip is a static `<button>` displaying `quantizeGrid`, `disabled` for now (popover comes later). Apply `data-dim={!quantizeOn}` per prototype.
- [x] 4.9 Timecode: `<div className="mr-timecode" data-recording={recording ? 'true' : undefined}>` with two child spans for `formatBig(timecodeMs)` and `.formatMs(timecodeMs)`. Pure-function helpers in the same file or a `format.ts` next to the hook.
- [x] 4.10 Meta row: render Bar / BPM / Sig from `useTransport()`.
- [x] 4.11 Status cluster: LED `data-state={recording ? 'rec' : playing ? 'play' : 'idle'}` (where `'idle'` is no `data-state`), text `REC`/`PLAY`/`IDLE` colored from `var(--mr-rec)` / `var(--mr-play)` / `var(--mr-text-2)`, then middot, then `<span className="mr-led" data-state="midi"/>`, then `MIDI IN`.
- [x] 4.12 Toast wiring: in `Titlebar.tsx`, wrap `play` to also `show('Started · {bpm} BPM')`, and wrap `stop` to detect *was-recording* state — if so, `show('Recording saved · {sizeKB} MB · {events} events', { shortcut: '⌘Z' })`. Synthesize size and events from `timecodeMs` (e.g. `events = Math.floor(timecodeMs / 67)`, `sizeMB = (events * 1.1 / 1024).toFixed(1)`) — they're placeholders.

## 5. Titlebar styles

- [x] 5.1 Create `src/components/titlebar/Titlebar.css` containing the rules from `prototype/app.css` lines 37–215 (`.mr-transport`, `.mr-brand*`, `.mr-tgroup`, `.mr-tbtn` and all `[data-*]` variants, `.mr-timecode*`, `.mr-meta*`, `.mr-spacer`, `.mr-status`, `.mr-led` and all `[data-state]` variants, `.mr-quant*` if used) and the `@keyframes mrPulse` and `@keyframes mrLed` blocks.
- [x] 5.2 Substitute the `.mr-transport` background gradient with `background: var(--mr-bg-panel);` (single flat color) and add a one-line comment noting the prototype uses a gradient defined with hex literals.
- [x] 5.3 Add `.mr-timecode[data-recording="true"] .mr-timecode__big { color: var(--mr-rec); }` so the recording-state color flip is data-attr-driven.
- [x] 5.4 Add `.mr-tbtn[data-rec="true"]` color/animation overrides (already present in prototype) and verify the chained selector `.mr-tbtn[data-rec="true"][data-on="true"]` triggers the pulse.
- [x] 5.5 Confirm no hex literals or new `oklch()` calls in this file: grep should be clean.

## 6. Wire up provider tree

- [x] 6.1 Modify `src/App.tsx`: wrap the shell in `<TransportProvider><ToastProvider><AppShell /></ToastProvider></TransportProvider>`. The toast viewport is rendered as part of `ToastProvider` (or inside `AppShell` — see 6.3).
- [x] 6.2 Modify `src/components/shell/AppShell.tsx`: replace the titlebar stub `<span className="mr-stub">Titlebar</span>` with `<Titlebar />`. Keep the `<header className="mr-titlebar">` wrapper.
- [x] 6.3 In `AppShell.tsx`, add `<ToastViewport />` as the last child of `.mr-shell` so it's a positioned-absolute child of the shell (the `.mr-shell` element gets `position: relative` if it doesn't already; verify).
- [x] 6.4 Modify `src/components/shell/AppShell.css`: ensure `.mr-shell { position: relative; }` for toast positioning. Strip any padding/flex from `.mr-titlebar` (transport now owns its layout via `.mr-transport`).

## 7. Verification

- [x] 7.1 `npm run typecheck` passes.
- [x] 7.2 `npm run dev` boots; titlebar renders in the dev URL.
- [x] 7.3 Click Rec — rec button animates with `mrPulse`; status LED switches to `data-state="rec"` and animates with `mrLed`; `REC` text renders in red; timecode color flips to red.
- [x] 7.4 Click Stop — pulse and red color stop; timecode resets to `00:00.000`; `Recording saved · …` toast appears at bottom-center for ~2s with `⌘Z` chip.
- [x] 7.5 Click Play — play button shows pause icon with accent-soft background; timecode advances; `Started · 124 BPM` toast appears.
- [x] 7.6 Click pause (formerly play) — timecode stops but does not reset; pause icon reverts to play icon.
- [x] 7.7 Click Loop / Metro — buttons toggle `data-on` and visually change.
- [x] 7.8 Visual compare against screenshots 02 (recording) and 03 (playing-with-toast). Note known deviations (the screenshots show the titlebar against a populated UI; only the titlebar+toast slice should match).
- [x] 7.9 Grep `src/` for `#[0-9a-fA-F]{3,8}\b|oklch\(` outside `tokens.css` — should remain zero.
- [x] 7.10 Two-consumer test (manual or temporary): mount a second small component reading `useTransport()` and confirm both reflect the same state on action dispatch. Remove the test component before commit.
