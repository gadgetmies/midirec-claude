## Why

Every MIDI device list in the app is stubbed today — the Sidebar's `MIDI Inputs` and `MIDI Outputs` panels, the Routing matrix's input/output column labels, and `useStatusbar().lastInput` all read from hardcoded `const` arrays inside `Sidebar.tsx` and `useStatusbar.ts`. None of those values reflect the user's actual hardware, so nothing downstream (record, play, route) can work. This change replaces the stubs with live data from the Web MIDI API and is the first of three core slices that close the end-to-end record → playback loop.

## What Changes

- Introduce a new `midi-runtime` capability that wraps `navigator.requestMIDIAccess({ sysex: false })` as a singleton (`src/midi/access.ts`), tracks permission state (`unsupported | requesting | granted | denied`), subscribes to `statechange` (hotplug), and exposes two hooks — `useMidiInputs()` and `useMidiOutputs()` — that return live device arrays plus the permission state.
- Add a `<MidiPermissionBanner />` component (owned by `midi-runtime`) that renders when permission state is not `granted`. The Sidebar mounts it as its first child, above `<InputMappingPanel />`. Granted-state transitions surface a one-time toast via the existing `useToast()`.
- **MODIFIED**: The Sidebar's `MIDI Inputs` panel renders one `.mr-dev` row per entry in `useMidiInputs().inputs` (instead of the three hardcoded rows). Empty state shows a "No MIDI inputs" hint.
- **MODIFIED**: The Sidebar's `MIDI Outputs` panel renders one `.mr-dev` row per entry in `useMidiOutputs().outputs`. Empty state shows a "No MIDI outputs" hint.
- **MODIFIED**: The Sidebar's Routing matrix derives its input column and output column labels from the same hooks. Until per-channel routing lands (a later slice), the grid's selection cells stay hardcoded — only the row/column device labels become live.
- **MODIFIED**: The "Sidebar fixtures are hardcoded inside Sidebar.tsx" rule narrows — the device fixtures (`INPUTS`, `OUTPUTS`, and the routing matrix's `inputs`/`outputs` label arrays) leave `Sidebar.tsx`; the filter switches, channel chips, and routing-grid selection cells remain hardcoded.
- `useStatusbar().lastInput` is **not** changed in this slice — `lastInput` reports the most recent *incoming MIDI event*, which requires the message-listener wiring that lands in the next slice (recording). The stub stays until then; the statusbar spec is untouched.

This slice does not record, play, route audio, or interpret incoming MIDI messages. It only enumerates devices.

## Capabilities

### New Capabilities

- `midi-runtime`: Web MIDI access lifecycle — permission state, the `requestMIDIAccess` singleton, `statechange` (hotplug) subscription, the `useMidiInputs` / `useMidiOutputs` hooks that expose live device arrays, and the `<MidiPermissionBanner />` component that surfaces unsupported / requesting / denied states.

### Modified Capabilities

- `sidebar`: `MIDI Inputs panel renders three device rows with LEDs and active stripe`, `MIDI Outputs panel renders two device rows`, `Routing panel renders a 3-input by 3-output checkbox matrix`, and `Sidebar fixtures are hardcoded inside Sidebar.tsx` all change to source device data from `useMidiInputs` / `useMidiOutputs`. A new requirement adds the permission banner mount point.

## Impact

- **New code**: `src/midi/access.ts` (singleton + `subscribe`), `src/hooks/useMidiInputs.ts`, `src/hooks/useMidiOutputs.ts`, `src/components/midi-runtime/MidiPermissionBanner.tsx` + `.css`. Possibly a `MidiRuntimeProvider` in `App.tsx` mirroring `StageProvider` / `TransportProvider` so the singleton state is shared.
- **Modified code**: `src/components/sidebar/Sidebar.tsx` (drops `INPUTS`, `OUTPUTS`, and the `inputs`/`outputs` arrays inside `ROUTING`; consumes the new hooks; mounts the banner). `src/hooks/useStatusbar.ts` is untouched.
- **Browser API surface**: First use of `navigator.requestMIDIAccess`. Permission prompt fires once at app load (only in browsers that support it; Safari and Firefox without the flag fall to the `unsupported` state).
- **Dependencies**: No new npm dependencies. Web MIDI types come from `@types/webmidi` if not already in `lib.dom.d.ts` — verify during implementation.
- **Tests**: Hooks read `navigator.requestMIDIAccess`; JSDOM tests need a mock. Banner rendering and the hotplug refresh are unit-testable with a fake `MIDIAccess`.
- **Spec deltas**: One new capability spec (`midi-runtime`), one modified capability spec (`sidebar`).
