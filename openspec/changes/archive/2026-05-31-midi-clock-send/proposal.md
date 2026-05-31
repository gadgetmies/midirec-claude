## Why

The app can already follow an *incoming* MIDI clock (via `midi-clock` / `MidiClockProvider`) and switch its transport to `external-clock`. There is no symmetric ability to *send* MIDI clock to downstream gear so external synths, drum machines, or DAWs can lock to this app's transport. Users running this tool as the master in a hardware setup currently have no way to drive their rig.

## What Changes

- Add a new `midi-clock-send` capability: a `MidiClockSendProvider` that emits System Real-Time messages — Clock (`0xF8`) at 24 PPQ, Start (`0xFA`), Continue (`0xFB`), Stop (`0xFC`) — on a user-selected set of MIDI output ports while sending is enabled.
- The sender SHALL derive `0xF8` cadence from `useTransport().bpm` when `useTransport().clockSource === 'internal'`, and SHALL bridge incoming pulses 1:1 when `clockSource === 'external-clock'` (so the app acts as a clock relay).
- The sender SHALL emit Start/Continue/Stop in response to `useTransport()` mode transitions: `idle → play` (with `timecodeMs === 0`) emits Start; `idle → play` (with `timecodeMs > 0`) emits Continue; `play → idle` emits Stop. Record mode SHALL NOT emit transport-state messages independently of play.
- Add a manual **Sync** action that emits a "panic-realign" bundle to all selected outputs in a tight burst — `0xFC Stop` + `0xF2 SPP` (computed from current `playheadTicks`) + `0xFB Continue` (or `0xFA Start` when at position 0) — so SPP-aware slaves jump to the right position and SPP-ignorant slaves restart on the next clock pulse. Exposed both as a button in the Inspector section and as a footer row in the Snd pill menu.
- Add a configurable **Grid Alignment trigger**: a user-defined MIDI Note On or CC message that fires on bar or phrase boundaries (or manually) on a user-chosen output. Drives Traktor mappings (e.g. mapped to "Master Clock Reset" or "Phase Sync") and any other slave that exposes a mappable downbeat input. Independent of the clock-send byte stream.
- Add a **strict-Start mode** to the incoming clock receiver: an opt-in toggle on `useMidiClock()` (`strictStart: boolean`, default `false`) that makes an incoming `0xFA` Start *also* rewind `useTransport()` to position 0 before play (true MIDI-spec semantics). When `false`, current behavior is preserved (Start resumes from current timecode). Surfaced as a row in the existing Clk dropdown menu.
- Extend the titlebar with a new pill — "Send" — placed immediately to the right of the existing "Clk" pill. The pill toggles the global send-enabled flag and visibly reflects the count of selected output ports (e.g. `Send · 2`).
- Add a new section to the Inspector — "MIDI Clock Send" — that lists every connected output port with a checkbox per port, plus a global enable/disable switch (mirroring the topbar pill), the Sync button, and the Grid Alignment configuration. This section is always visible regardless of timeline selection.
- The selected-output set, enabled flag, strict-Start flag, and grid-alignment config are **in-memory only** (no persistence across reloads), matching `useMidiClock().selection`'s ephemeral semantics. This keeps the persistable session surface unchanged for this slice.
- Frontend visual design for the topbar pill and Inspector section SHALL be produced via the `frontend-design` skill and captured in `design.md`.

## Capabilities

### New Capabilities
- `midi-clock-send`: System Real-Time emission on selected MIDI outputs; cadence derived from transport BPM or relayed from external master; Start/Continue/Stop driven by transport mode transitions; manual Sync bundle (Stop + SPP + Continue/Start); configurable Grid Alignment trigger (Note On or CC) on bar/phrase boundaries.

### Modified Capabilities
- `transport-titlebar`: adds a "Send" pill immediately right of the existing "Clk" pill, opening an output-selection menu and toggling the send-enabled flag; adds a "Strict Start (rewind to 0)" toggle row to the existing Clk dropdown menu.
- `inspector`: hosts a new "MIDI Clock Send" section listing connected outputs with per-port checkboxes and a global enable switch; a prominent Sync button; a configurable Grid Alignment subsection (boundary + message + output picker + manual fire). The section is always present (not selection-driven).
- `midi-clock`: adds `strictStart: boolean` state and `setStrictStart(b: boolean)` action to `useMidiClock()`; modifies the incoming-Start behavior so that when `strictStart === true` the receiver also rewinds the transport to position 0 before invoking `play()`.

## Impact

- **New code**: `src/midi/MidiClockSendProvider.tsx`, `src/midi/clockSender.ts` (raw byte emission + scheduling), `src/components/inspector/ClockSendPanel.tsx`.
- **Modified code**: `src/midi/MidiClockProvider.tsx` (adds `strictStart` state, `setStrictStart`, modifies the Start handler), `src/components/titlebar/Titlebar.tsx` (new pill + Strict Start row in Clk menu), `src/components/inspector/Inspector.tsx` (mount panel), `src/App.tsx` (mount new provider inside `MidiRuntimeProvider`, sibling of `MidiClockProvider` and `TransportProvider`).
- **Dependencies**: relies on existing `useMidiOutputs()` from `MidiRuntimeProvider` for port enumeration; relies on `useTransport()` for `bpm`, `mode`, `timecodeMs`, `clockSource`, `playheadTicks`, `sig` (for bar/phrase boundary computation), `rewind()`; relies on `useMidiClock()` for relay-mode pulse forwarding via the new `onPulse(...)` subscription.
- **No persistence changes**: `timeline-storage` and `session-model` are unaffected (all send-config including strict-Start and grid alignment is in-memory only this slice).
- **No new app-shell region**: the panel lives inside the existing `.mr-inspector` aside.
- **Performance**: emitting `0xF8` at 124 BPM ≈ 49.6 messages/sec/output; uses Web MIDI `MIDIOutput.send(data, timestamp)` with batched lookahead per the existing `src/midi/scheduler.ts` pattern. Sync bundle is a single one-shot ~4-byte burst; grid-alignment is one ~3-byte message per bar (≈0.5 msg/sec at 124 BPM).
