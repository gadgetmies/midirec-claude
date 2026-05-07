## Why

Slice 0 left the Titlebar as a 44px stub with a placeholder label. The next visible deliverable in `IMPLEMENTATION_PLAN.md` (Slice 1) populates the Titlebar with the transport cluster, timecode, project meta, status LEDs, and the `mrPulse` / `mrLed` animations — i.e. the first piece of the UI a user actually interacts with. Without this, the design package can't be demoed at all.

A real audio engine doesn't arrive until Slice 10, but the visual states for `recording` / `playing` / `idle` are needed *now* to validate the design (and to drive every later slice that must react to transport state). A placeholder `useTransport()` hook returning fake state is the lowest-risk way to do this.

Screenshots 02 (recording) and 03 (playing + toast) are the acceptance bar.

## What Changes

- **New `Titlebar` component** rendering the full transport bar exactly as in `prototype/components.jsx` and `prototype/app.css`:
  - Brand mark (`MIDI Recorder · v0.4.2`), 1-rule divider.
  - Transport `mr-tgroup` 1: `rew` / `cue` / `play` (toggles to pause icon when playing) / `stop` / `rec` / `ffw` — all six buttons even though the README text emphasizes "Rec / Stop / Play / Loop". The screenshots show all six.
  - Timecode `MM:SS.FFF` with the milliseconds segment in `--mr-text-3`. Tabular numerals (already enforced via `.mr-mono` from Slice 0). When `recording === true`, the digits flip to `--mr-rec`.
  - Meta row: `Bar 13.2.1 · BPM 124 · SIG 4/4`.
  - Transport `mr-tgroup` 2: `loop` (off) / `metro` (on by default).
  - Quantize widget: `Q` label, power toggle, grid value chip (`1/16`) — static for now (the popover is later).
  - Spacer pushing status to the right.
  - Status cluster: `mr-led` + `REC|PLAY|IDLE` text + middot + `mr-led data-state="midi"` + `MIDI IN`.
- **New `useTransport()` hook** returning placeholder state: `{ mode, recording, playing, looping, timecode, bar, bpm, sig }` plus `start/stop/record/toggleLoop` setters that flip flags and (when playing/recording) advance the timecode locally via `requestAnimationFrame`. No real MIDI/audio. The hook is the contract Slice 10 will replace with the real audio runtime.
- **`mrPulse` and `mrLed` animations** become live — the rules already exist verbatim in `tokens.css` consumers (`prototype/app.css`), but our codebase doesn't have them yet because Slice 0 only wrote the AppShell stylesheet. Add them as part of the new transport stylesheet.
- **`Toast` component + `useToast()` hook** — minimal toast layer. Single visible toast at a time, 2s default duration, fade-out via `--mr-dur-base`. Shown at the bottom-center of the app (`.mr-toast`). After pressing Play, a toast `Started · 124 BPM` appears (per README §Playback). After pressing Stop while recording, a toast `Recording saved · 1.4 MB · 1,238 events` appears (per screenshot 03 — values are placeholders synthesized from current fake state). The keyboard-shortcut hint chip (`⌘Z`) is rendered as static text next to the message; binding the actual shortcut is out of scope.
- **Update `app-shell` spec**: the existing requirement *"Slice 0 ships zero functionality"* must be modified to scope its zero-functionality clause to regions that haven't been filled yet (Sidebar, Toolstrip, Ruler, Stage, CC Lanes, Inspector, Statusbar). The Titlebar is now functional.

## Capabilities

### New Capabilities
- `transport-titlebar`: Renders the Titlebar region with the full transport cluster (rew/cue/play-pause/stop/rec/ffw + loop/metro + quantize widget), tabular-numeral timecode, project-meta row, status LEDs, and the `mrPulse` / `mrLed` keyframes. Provides `useTransport()` as the React-side state contract that the audio engine will satisfy in a later capability.
- `toast`: Ephemeral confirmation messages anchored at the bottom-center of the app shell. Provides `useToast()` returning a `show(message, kind)` and a `dismiss()`. Single-toast-at-a-time policy in this slice; queueing is non-goal.

### Modified Capabilities
- `app-shell`: Relax the *"Slice 0 ships zero functionality"* requirement so it applies only to regions other than the Titlebar. The Titlebar requirement now points at `transport-titlebar` for behavior. No layout changes — the shell's grid, surface tokens, and dividers are unchanged.

## Impact

- **New files**: `src/hooks/useTransport.ts`, `src/hooks/useToast.tsx`, `src/components/titlebar/Titlebar.tsx`, `src/components/titlebar/Titlebar.css`, `src/components/toast/Toast.tsx`, `src/components/toast/Toast.css`, `src/components/icons/transport.tsx` (inline SVG components for play/pause/stop/rec/rew/ffw/cue/loop/metro/chev).
- **Modified files**: `src/components/shell/AppShell.tsx` (replace the titlebar stub with `<Titlebar />`, mount the `<ToastViewport />`), `src/App.tsx` (provide `ToastProvider` context wrapping the shell). `src/components/shell/AppShell.css` may shed the titlebar-specific styles now owned by Titlebar.css.
- **No new runtime deps**. Animation is pure CSS keyframes; the timecode advance uses `requestAnimationFrame`.
- **No audio runtime**. Pressing Rec/Play/Stop only updates the React state; the timecode advance is a fake clock. Slice 10 replaces the hook implementation.
- **Architectural lock-in (small)**: `useToast()` becomes the toast contract for every later slice (export confirm, mute toggle, save, etc.). Worth getting right now since the API surface is tiny.
