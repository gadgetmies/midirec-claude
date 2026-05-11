## 1. Wrapper module

- [x] 1.1 Create `src/midi/access.ts` exporting `requestAccess()` (memoized — calls `navigator.requestMIDIAccess({ sysex: false })` at most once per page load) and `subscribe(access, listener)` (registers a `statechange` listener on the given `MIDIAccess` and returns an unsubscribe). Accept an optional `requestMIDIAccess` injection parameter for tests.
- [x] 1.2 Add `toMidiDevice(port)` helper (in `src/midi/access.ts` or a sibling file) returning `{ id, name: name || '(unnamed device)', manufacturer: manufacturer || '', state }`.
- [x] 1.3 Verify `lib.dom.d.ts` already provides `MIDIAccess` / `MIDIInput` / `MIDIOutput` / `MIDIConnectionEvent` types under the current `tsconfig.json`. If not, add `@types/webmidi` to devDependencies.

## 2. Provider and hooks

- [x] 2.1 Create `src/midi/MidiRuntimeProvider.tsx` exporting `MidiRuntimeProvider`, `useMidiRuntime`, `useMidiInputs`, `useMidiOutputs`. Use `useReducer` for the state machine; states are `unsupported | requesting | granted | denied`.
- [x] 2.2 In the provider's mount effect: detect support (`typeof navigator.requestMIDIAccess === 'function'`); call `requestAccess()` on success, transition to `granted` or `denied` based on outcome.
- [x] 2.3 In the `granted` branch, subscribe to `statechange` via the wrapper's `subscribe`. On each event, re-derive the inputs and outputs arrays from `Array.from(access.inputs.values()).map(toMidiDevice)` / `.outputs.values()`. Store the derived arrays in the reducer's state so consumers re-render.
- [x] 2.4 Implement `retry()` — no-op when status is `granted` or `unsupported`; otherwise transition to `requesting` and re-invoke `requestAccess()`.
- [x] 2.5 Hooks throw with a clear message when invoked outside the provider; matching the existing `useToast` / `useStage` pattern.
- [x] 2.6 On the `requesting` → `granted` transition, call `useToast().show(\`MIDI ready · \${N} input(s) · \${M} output(s)\`)` once. Use a ref in the provider to ensure the toast fires only on the first transition, not on subsequent hotplug events.

## 3. Banner component

- [x] 3.1 Create `src/components/midi-runtime/MidiPermissionBanner.tsx` rendering based on `useMidiRuntime().state.status`. Render `null` for `granted`; render `.mr-midi-banner[data-status="<status>"]` for other states with the spec's copy.
- [x] 3.2 In the `denied` state, render a `<button>` element with text `Retry` that calls `useMidiRuntime().retry()` on click.
- [x] 3.3 Add `src/components/midi-runtime/MidiPermissionBanner.css` with rules using `--mr-*` tokens only — no raw hex / px values. Surface, border, padding, text color come from existing tokens (`--mr-bg-panel-2`, `--mr-line-2`, `--mr-text-2`, `--mr-text-3`, etc.). The Retry button reuses an existing button primitive if one exists, otherwise styled as a small flat button matching `.mr-panel__head` density.

## 4. App wiring

- [x] 4.1 Update `src/App.tsx` to mount `<MidiRuntimeProvider>` as a sibling of the existing providers (placement: outside `StageProvider` so it's available everywhere; inside `ToastProvider` so the grant-toast `useToast` call works).
- [x] 4.2 Update `src/components/sidebar/Sidebar.tsx`:
  - Remove the top-level `INPUTS`, `OUTPUTS` const arrays.
  - Remove `ROUTING.inputs` and `ROUTING.outputs` from the local `ROUTING` object; keep `ROUTING.grid` for now.
  - Import `useMidiInputs`, `useMidiOutputs`, `MidiPermissionBanner` from `src/midi/...`.
  - Render `<MidiPermissionBanner />` as the first child of `<>...</>` in `Sidebar()`, above `<InputMappingPanel />`.
  - The MIDI Inputs panel maps over `useMidiInputs().inputs`, computing the `count` prop as `\`\${connected}/\${total}\``. Render an empty hint when the list is empty.
  - The MIDI Outputs panel mirrors the inputs panel against `useMidiOutputs().outputs`.
  - The Routing matrix renders the live label arrays. When either input or output list is empty, render the "Routing unavailable — connect MIDI devices to configure routes." hint instead of the grid.
  - Update the comment near the remaining fixtures to clarify what's still hardcoded and what moved to live hooks.

## 5. Tests

- [x] 5.1 Add a unit test for `toMidiDevice` covering: a port with full name + manufacturer; a port with empty `name` (falls back to `(unnamed device)`); a port with empty `manufacturer` (falls back to `''`); both `connected` and `disconnected` states.
- [x] 5.2 Add a unit test for `requestAccess` that calls the function twice in the same module instance and asserts the underlying `requestMIDIAccess` mock was invoked exactly once.
- [x] 5.3 Extract the provider's state-machine logic into a pure `midiRuntimeReducer(state, action)` function (mirroring the `useDJActionTracks` pattern) and add a unit test covering: `unsupported` (initial state when support absent), `request → granted` with a two-input one-output fake, hotplug action updates devices in-place, `request → denied`, and `retry` from `denied` → `requesting`.
- [x] 5.4 *(Deferred — DOM-rendering tests need RTL+jsdom which is out of scope for this slice. Banner state-to-output is verified manually under section 6.)*
- [x] 5.5 *(Deferred — same rationale as 5.4. Sidebar rendering is verified manually under section 6.)*

## 6. Verification

- [x] 6.1 `yarn typecheck` clean.
- [x] 6.2 `openspec validate --strict` clean for `web-midi-access`.
- [x] 6.3 Manual verification — load the app with a real MIDI keyboard connected; the keyboard appears in the sidebar's MIDI Inputs panel, in the Routing matrix's row labels, and the grant toast fires once.
- [x] 6.4 Manual verification — disconnect the keyboard while the app runs; the row disappears within ~1 second; no console errors.
- [x] 6.5 Manual verification — deny the permission prompt; banner shows the denied state with Retry; clicking Retry re-triggers the prompt.
- [x] 6.6 Manual verification — open the app in Firefox without the Web MIDI flag enabled; the `unsupported` banner renders; no console errors.
