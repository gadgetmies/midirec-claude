## Why

The AppShell's bottom strip currently renders only a `.mr-stub` placeholder — a leftover from Slice 0. Slice 10 of `IMPLEMENTATION_PLAN.md` is the last visual slice, but as written it bundles two unrelated concerns: a Statusbar UI and an audio engine. This project is a MIDI-only tool — it never synthesizes or plays back audio — so the audio engine portion is out of scope permanently, as are the prototype's CPU and RAM meters (which exist to report audio-engine load).

That leaves a finer question: what useful information *is* there to surface in a MIDI-only ambient row? A first pass put MIDI input device + channel AND clock source into the Statusbar, but the MIDI input cluster largely duplicated the Sidebar's "MIDI Inputs" panel and the clock source had a more natural home next to BPM in the Titlebar. Reshaped, the change does three things together:

1. **Statusbar** becomes the live "where is MIDI flowing from right now" readout — the device + channel of the most recent incoming MIDI message. Distinct from the Sidebar (which lists *all* enumerated inputs) and from the Titlebar's MIDI IN LED (which is binary on/off).
2. **Titlebar gains a clock-source field** next to BPM. Clock source (Internal / External MIDI Clock / MTC) belongs with BPM because the two are tied: external clock sources own BPM (it's derived, not user-set) and the user reads them together.
3. **Titlebar's MIDI IN LED becomes activity-driven** — it lights when MIDI messages are flowing and goes dim when they aren't. Today it's hardcoded to `data-state="midi"` (always lit), which is misleading.

## What Changes

- **Statusbar** (`src/components/statusbar/Statusbar.tsx` — new) renders a single cluster (no spacer, no right side):
  - Activity LED — lit when `useStatusbar().active === true` (MIDI currently flowing).
  - Device name + channel chip for `useStatusbar().lastInput` — the device the most recent MIDI message came from.
  - Empty state when no MIDI has arrived yet: idle LED + `Awaiting MIDI` in `var(--mr-text-3)`.
- **Titlebar meta-row** gains a fourth cell `Clk` after BPM, before Sig. Value is a compact 3-letter mono code: `Int` / `Ext` / `MTC`.
- **Titlebar MIDI IN LED** at the right of the status cluster now binds to `useStatusbar().active` — `data-state="midi"` only when MIDI is flowing; no `data-state` (dim) when idle. The "MIDI IN" text label remains.
- **`useStatusbar()` hook** (new at `src/hooks/useStatusbar.ts`) returns `{ lastInput: MidiInput | null, active: boolean }`. Stubbed for this slice to return one seeded `lastInput` (`Korg minilogue xd · CH 1`) and `active: true` so the LED visibly lights.
- **`useTransport()` hook** extends `TransportState` with `clockSource: 'internal' | 'external-clock' | 'external-mtc'`, defaulting to `'internal'`. No new actions in this slice.
- **EXCLUDED** (do not implement): CPU meter, RAM meter, sample rate, buffer size, audio output device, audio engine telemetry of any kind. Real Web MIDI / CoreMIDI wiring. Picker overlays for changing input or clock source. Pulse/decay timing for the activity LED (stub keeps the LED steady when `active: true`).

## Capabilities

### New Capabilities
- `statusbar`: Live readout of the MIDI input device + channel for the most recent incoming MIDI message. Activity LED tied to whether messages are flowing. Visual-only in this slice, fed by a placeholder hook.

### Modified Capabilities
- `transport-titlebar`: Add a `Clk` meta cell after BPM showing the clock source. Change the MIDI IN LED at the right-edge status cluster from a hardcoded `data-state="midi"` to an activity-driven state that reflects whether MIDI is currently flowing.

## Impact

- **New code**: `src/components/statusbar/Statusbar.tsx`, `src/components/statusbar/Statusbar.css`, `src/hooks/useStatusbar.ts`.
- **Modified code**: `src/components/shell/AppShell.tsx` (swap `.mr-stub` for `<Statusbar />`); `src/components/shell/AppShell.css` (drop `.mr-stub`); `src/components/titlebar/Titlebar.tsx` (add Clk meta cell, wire MIDI IN LED to `useStatusbar().active`); `src/hooks/useTransport.tsx` (add `clockSource` to state).
- **Specs**: new `openspec/specs/statusbar/spec.md`; delta on `openspec/specs/transport-titlebar/spec.md` (modify two requirements).
- **Design**: `design/deviations-from-prototype.md` gets one entry recording the MIDI-only Statusbar scope + Titlebar clock-source addition.
- **No data-model changes** to channels, tracks, lanes, sessions. No new design tokens. No third-party dependencies. No audio runtime touched.
