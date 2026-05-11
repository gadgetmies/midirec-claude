# midi-runtime Specification

## Purpose
TBD - created by archiving change web-midi-access. Update Purpose after archive.
## Requirements
### Requirement: Singleton MIDIAccess wrapper

The codebase SHALL expose a module at `src/midi/access.ts` that wraps `navigator.requestMIDIAccess({ sysex: false })` as a singleton. The wrapper SHALL call `navigator.requestMIDIAccess` at most once per page load and cache the resulting `MIDIAccess` for subsequent reads. The wrapper SHALL also expose a `subscribe(listener)` function that registers the listener for `statechange` events on the cached `MIDIAccess` and returns an unsubscribe function.

The wrapper SHALL NOT call `requestMIDIAccess` with `sysex: true` in this slice.

#### Scenario: Wrapper requests access at most once

- **WHEN** two components both invoke the wrapper's request entry point during the same page load
- **THEN** `navigator.requestMIDIAccess` SHALL have been called exactly once
- **AND** both callers SHALL receive the same `MIDIAccess` instance (or the same terminal state)

#### Scenario: Subscribe registers and unregisters statechange listeners

- **WHEN** a caller invokes `subscribe(listener)` after the wrapper has resolved to `granted`
- **THEN** the listener SHALL receive every subsequent `statechange` event from the cached `MIDIAccess`
- **AND** calling the returned unsubscribe function SHALL stop further deliveries to that listener

### Requirement: MidiRuntimeProvider exposes permission state and live device lists

The codebase SHALL expose a `MidiRuntimeProvider` React component (exported alongside its hooks from `src/midi/`). `App.tsx` SHALL mount exactly one `MidiRuntimeProvider` wrapping `<AppShell />`, as a sibling of the existing `StageProvider`, `TransportProvider`, and `ToastProvider`. The provider SHALL hold a state value of shape:

```
type MidiRuntimeState =
  | { status: 'unsupported' }
  | { status: 'requesting' }
  | { status: 'granted'; access: MIDIAccess }
  | { status: 'denied'; error: Error };
```

On mount, the provider SHALL determine support (`navigator.requestMIDIAccess` defined) and either set `status: 'unsupported'` synchronously or set `status: 'requesting'` and call the wrapper. On resolution it SHALL transition to `granted` (with the `MIDIAccess`) or `denied` (with the rejection error). The provider SHALL re-render its consumers when `statechange` fires.

The provider SHALL expose three hooks:

- `useMidiRuntime()` returning `{ state: MidiRuntimeState; retry: () => void }`. `retry` is a no-op when status is `granted` or `unsupported`; otherwise it transitions to `requesting` and re-invokes the wrapper.
- `useMidiInputs()` returning `{ status: MidiRuntimeState['status']; inputs: MidiDevice[] }`. When status is not `granted`, `inputs` SHALL be `[]`.
- `useMidiOutputs()` returning `{ status: MidiRuntimeState['status']; outputs: MidiDevice[] }`. When status is not `granted`, `outputs` SHALL be `[]`.

`MidiDevice` SHALL be defined as:

```
type MidiDevice = {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
};
```

`MidiDevice` SHALL be derived from a `MIDIInput` / `MIDIOutput` via a `toMidiDevice(port)` helper. `name` SHALL fall back to `'(unnamed device)'` when `port.name` is empty; `manufacturer` SHALL fall back to `''`.

Each hook SHALL throw with a clear error message ("`useMidiInputs` must be used inside `<MidiRuntimeProvider>`" or similar) when invoked outside the provider.

#### Scenario: Provider starts in unsupported state when Web MIDI is missing

- **WHEN** the provider mounts in an environment where `navigator.requestMIDIAccess` is `undefined`
- **THEN** the provider state SHALL be `{ status: 'unsupported' }` synchronously on first render
- **AND** the provider SHALL NOT call `navigator.requestMIDIAccess`

#### Scenario: Provider resolves to granted with live device arrays

- **WHEN** the provider mounts in an environment where `navigator.requestMIDIAccess` resolves successfully with two connected inputs and one connected output
- **THEN** the provider state SHALL transition to `{ status: 'granted', access: <MIDIAccess> }`
- **AND** `useMidiInputs().inputs` SHALL contain exactly two `MidiDevice` entries whose `id` values match the two `MIDIInput` ports
- **AND** `useMidiOutputs().outputs` SHALL contain exactly one `MidiDevice` entry whose `id` matches the `MIDIOutput` port

#### Scenario: Provider resolves to denied when the user rejects

- **WHEN** the provider mounts in an environment where `navigator.requestMIDIAccess` rejects with an Error
- **THEN** the provider state SHALL transition to `{ status: 'denied', error: <Error> }`
- **AND** `useMidiInputs().inputs` SHALL be `[]`
- **AND** `useMidiOutputs().outputs` SHALL be `[]`

#### Scenario: Hotplug updates the device arrays

- **GIVEN** the provider has resolved to `granted` with one input
- **WHEN** a second input port is added and the cached `MIDIAccess` fires a `statechange` event for it
- **THEN** `useMidiInputs().inputs` SHALL contain two entries on the next render

#### Scenario: Retry re-requests access from a denied state

- **GIVEN** the provider state is `{ status: 'denied' }`
- **WHEN** a caller invokes `useMidiRuntime().retry()` and the next `requestMIDIAccess` call resolves successfully
- **THEN** the provider state SHALL transition through `{ status: 'requesting' }` and end at `{ status: 'granted' }`

#### Scenario: Hooks throw outside the provider

- **WHEN** any of `useMidiRuntime`, `useMidiInputs`, or `useMidiOutputs` is invoked from a component not nested inside a `MidiRuntimeProvider`
- **THEN** the hook SHALL throw an Error whose message names the missing provider

### Requirement: MidiPermissionBanner surfaces non-granted permission states

The codebase SHALL expose a `<MidiPermissionBanner />` component at `src/components/midi-runtime/MidiPermissionBanner.tsx` (or equivalent path under the `midi-runtime` namespace). The banner SHALL read `useMidiRuntime()` and render based on `state.status`:

- `unsupported` — banner with text `Web MIDI not available in this browser.` and no action button.
- `requesting` — banner with text `Requesting MIDI access…` and no action button.
- `denied` — banner with text `MIDI access denied.` and a `Retry` button that invokes `useMidiRuntime().retry()`.
- `granted` — banner renders `null`.

The banner's root element SHALL carry a class `mr-midi-banner` and a `data-status="<status>"` attribute so styling and tests can target the state. The banner SHALL resolve all colors, spacing, and typography through `--mr-*` tokens (no raw hex / px duplications of token values).

#### Scenario: Banner renders nothing when granted

- **WHEN** `useMidiRuntime().state.status === 'granted'`
- **THEN** `<MidiPermissionBanner />` SHALL render `null`
- **AND** the document SHALL contain zero `.mr-midi-banner` elements

#### Scenario: Banner renders unsupported state

- **WHEN** `useMidiRuntime().state.status === 'unsupported'`
- **THEN** the document SHALL contain exactly one `.mr-midi-banner` element with `data-status="unsupported"`
- **AND** the element's text SHALL include `Web MIDI not available in this browser.`
- **AND** the element SHALL NOT contain a `Retry` button

#### Scenario: Banner renders denied state with Retry

- **WHEN** `useMidiRuntime().state.status === 'denied'`
- **THEN** the banner SHALL contain a `<button>` element with text `Retry`
- **AND** clicking the Retry button SHALL invoke `useMidiRuntime().retry()`

### Requirement: Granted transition surfaces a one-time toast

When the provider transitions from `requesting` to `granted`, the runtime SHALL fire exactly one toast via `useToast().show(...)` summarising the device counts. The toast's message SHALL be of the form `MIDI ready · <N> input(s) · <M> output(s)` where `<N>` and `<M>` reflect the device counts at the moment of transition (`N = useMidiInputs().inputs.length`, `M = useMidiOutputs().outputs.length`).

The toast SHALL NOT fire on the `unsupported` → `granted` transition (impossible — unsupported is terminal) nor on `granted` → `granted` re-renders. Subsequent `statechange` events SHALL NOT fire additional toasts.

#### Scenario: Grant transition fires one toast

- **WHEN** the provider transitions from `requesting` to `granted` with one input and one output
- **THEN** `useToast().show` SHALL have been called exactly once with a message containing `MIDI ready · 1 input · 1 output`

#### Scenario: Hotplug does not fire additional toasts

- **GIVEN** the provider is in `granted` state and the grant toast has already fired
- **WHEN** a `statechange` event adds a second input
- **THEN** no additional toast SHALL fire

