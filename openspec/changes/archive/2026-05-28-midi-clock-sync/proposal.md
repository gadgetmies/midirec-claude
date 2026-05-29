## Why

The transport already declares a `clockSource: 'internal' | 'external-clock' | 'external-mtc'` field and the Titlebar's `Clk` meta cell already renders `Int / Ext / MTC` — but nothing actually listens to incoming MIDI clock. A DJ slaving this tool to a master clock (mixer, DAW, hardware sequencer) cannot keep playback or BPM aligned with the rest of their rig, which is the whole point of clocking in a MIDI-only setup. This change wires the receive path: parse incoming clock + transport real-time messages, derive BPM, drive the transport tick from the external pulse, and surface a visible beat indicator so the user can confirm at a glance that lock is healthy.

## What Changes

- Add a MIDI clock receiver module that subscribes to every connected `MIDIInput` and parses the System Real-Time message family: Clock (`0xF8`), Start (`0xFA`), Continue (`0xFB`), Stop (`0xFC`). Song Position Pointer (`0xF2`) is out of scope for this slice.
- Expose receiver state via a new hook `useMidiClock()` returning `{ present: boolean; bpm: number | null; pulse: number; running: boolean; beat: number }`, where `pulse` advances on every `0xF8` and `beat` increments every 24 pulses (quarter-note).
- Compute incoming BPM by smoothing the interval between the last N clock pulses (rolling window). Mark `present: false` if no clock has arrived in the last ~500ms so the indicator returns to dim.
- Make `useTransport` honor external clock when `clockSource === 'external-clock'`:
  - The rAF tick SHALL NOT advance `timecodeMs` while in external clock mode; instead the receiver SHALL advance the playhead by the per-pulse duration derived from the smoothed BPM, applied at each pulse.
  - `useTransport().bpm` SHALL mirror the smoothed external BPM (rounded to the nearest integer for display) when in external clock mode; `useTransport().bpm` SHALL remain the user-set value in internal clock mode.
  - Incoming Start SHALL trigger `play()`; Continue SHALL resume from current `timecodeMs`; Stop SHALL trigger `pause()`. Record mode is unaffected by transport real-time messages in this slice (recording is driven by the user's record button, not the master clock).
- Auto-switch `clockSource` to `'external-clock'` the first time a clock pulse arrives in this session; revert to `'internal'` if clock disappears for >2 seconds. The user-facing `Clk` cell continues to read `Int / Ext` without UI changes.
- Add a "beat LED" to the Titlebar status cluster (immediately to the left of the existing transport-mode LED) that pulses once per quarter-note beat when external clock is `present`, and is dim otherwise. Animation is a brief flash on `beat` increment — not a continuous keyframe — so the visual cadence matches the actual incoming clock, not a CSS-timed approximation.
- Make the `Clk` meta cell click-to-open a dropdown listing `Auto` / `Internal` / one entry per connected MIDI input. `Auto` (default) preserves the first-wins auto-detect behavior described above. `Internal` forces `clockSource` to `'internal'` and ignores all incoming clock pulses regardless of source. Selecting a specific device locks the active master to that input; pulses from other inputs are discarded, and if the locked device goes silent the transport stays in `'external-clock'` mode with `bpm` frozen at the last value until the user picks `Internal` (no auto-fallback). Changing the selection always resets the smoother and the pulse / beat / running state for a fresh window.

## Capabilities

### New Capabilities
- `midi-clock`: receiver for incoming MIDI System Real-Time messages (Clock, Start, Continue, Stop), BPM smoothing, beat counter, and the `useMidiClock()` hook backing the Titlebar beat LED and transport sync.

### Modified Capabilities
- `transport-titlebar`: add the beat LED to the status cluster and bind its blink to `useMidiClock().beat`; have the BPM meta cell display the smoothed external BPM when `clockSource === 'external-clock'`.
- `midi-runtime`: do NOT change the provider's contract; this slice only consumes the already-exposed `MIDIInput` ports via `useMidiInputs()` and attaches `onmidimessage` handlers from the clock receiver. Listed here only because the clock receiver is a sibling consumer of the same runtime — no requirement deltas needed.

## Impact

- New files:
  - `src/midi/clockReceiver.ts` — pulse parser + BPM smoother
  - `src/midi/MidiClockProvider.tsx` — context + hook + selection state
  - `src/components/transport-titlebar/BeatLed.tsx` — Titlebar beat LED
  - `src/components/transport-titlebar/ClockSourceMenu.tsx` (or co-located in `Titlebar.tsx`) — dropdown rendered when the `Clk` cell is clicked
- Modified files:
  - `src/hooks/useTransport.tsx` — gate rAF tick on `clockSource`, accept external pulses as the tick driver
  - `src/components/transport-titlebar/StatusCluster.tsx` (or equivalent) — add beat LED to the cluster
  - `src/components/titlebar/Titlebar.tsx` / `Titlebar.css` — `Clk` cell becomes a clickable button + dropdown menu (reusing the quantize chip's menu pattern)
  - `src/App.tsx` — mount `<MidiClockProvider>` alongside the existing providers
- No new dependencies. No persistence changes (`clockSource` remains in-memory only per the existing transport spec).
- No audio code. Per project memory, this is a MIDI-only tool — the beat LED is purely visual feedback derived from incoming MIDI; there is no metronome audio tied to it.
