## Context

The app is at the end of its visual-mockup phase. Every MIDI surface has been built against hardcoded fixtures: the Sidebar's input and output panels (`Sidebar.tsx:13` and `:19`), the Routing matrix's device columns (`Sidebar.tsx:42`), and `useStatusbar().lastInput` (`useStatusbar.ts:12`). Nothing reads `navigator.requestMIDIAccess`. The next three slices — this one, then recording, then playback — together close the end-to-end loop. This slice is the foundation: a clean device-enumeration layer that every later slice can depend on.

Existing hook conventions in the codebase:

- `useStage` and `useTransport` follow a context-provider pattern (Provider mounted in `App.tsx`, hook throws if used outside its provider). Toast uses the same pattern (`Toast.tsx:33`).
- The `useStatusbar` hook is the outlier — a plain function returning a constant stub, no provider. It will stay an outlier for one more slice (`lastInput` requires the message-listener wiring that lands in recording).

Existing toast surface: `useToast().show(message, { kind, durationMs, shortcut })` (`Toast.tsx:48`). Single-toast-at-a-time semantics.

The backlog entry's literal text references `useStatusbar().inputs`, which does not currently exist on the hook. We treat that as a forward-looking sketch and introduce dedicated hooks instead (see Decision 2 below).

## Goals / Non-Goals

**Goals:**

- Replace every hardcoded MIDI device list in the app with a live `MIDIAccess`-backed list.
- Surface the permission lifecycle (unsupported, requesting, granted, denied) clearly enough that a user understands why their devices are or aren't appearing.
- Survive hotplug — plug or unplug a device while the app is running and the device lists refresh without a page reload.
- Keep the surface area small enough that the next two slices (recording, playback) drop in cleanly: they want subscribe-to-message and send-message APIs against a known `MIDIInput` / `MIDIOutput`, both of which fall out of this design.

**Non-Goals:**

- Subscribing to MIDI messages (the LED `active` flag, `lastInput`, recording capture). Lands in the recording slice.
- Sending MIDI messages or scheduling output. Lands in the playback slice.
- A picker UX for choosing the selected input or output. Lands in the pickers slice.
- Per-channel routing being live. The matrix's selection cells stay hardcoded until per-channel routing lands; only the device-name labels become live here.
- SysEx access (`sysex: false` for now; revisit when a SysEx use case appears).

## Decisions

### Decision 1: Singleton `MIDIAccess` accessed through a provider

The wrapper in `src/midi/access.ts` calls `navigator.requestMIDIAccess({ sysex: false })` at most once per page load, caches the resulting `MIDIAccess`, and exposes a small synchronous shape:

```ts
type MidiRuntimeState =
  | { status: 'unsupported' }
  | { status: 'requesting' }
  | { status: 'granted'; access: MIDIAccess }
  | { status: 'denied'; error: Error };
```

A new `MidiRuntimeProvider` (mounted in `App.tsx`, sibling to the existing providers) owns this state in a `useReducer`, kicks off the request in an effect on mount, and forwards a `subscribe(listener)` for `statechange`. `useMidiInputs()` / `useMidiOutputs()` read from the provider's context and re-render the consumer when the underlying list mutates.

**Alternative considered**: a module-level singleton with `useSyncExternalStore`. Cleaner conceptually but inconsistent with the existing `StageProvider` / `TransportProvider` / `ToastProvider` pattern — three providers already, adding a fourth keeps the codebase coherent. Reuse beats novelty.

### Decision 2: Two dedicated hooks (`useMidiInputs`, `useMidiOutputs`), not a single bag

The backlog text refers to `useStatusbar().inputs`. We don't follow that wording verbatim. Reasons:

- `useStatusbar` is documented as "the most recent incoming MIDI event" surface (statusbar/spec.md). Conflating device enumeration into the same hook mixes two responsibilities — the cluster doesn't need the input list, and the input list doesn't need `lastInput`.
- The Sidebar's two panels and the Routing matrix all want the device list but none of them want `lastInput`.
- A future pickers slice that anchors a picker to the Statusbar cluster can either call `useMidiInputs()` directly (cleanest) or have `useStatusbar` forward the list — that's a decision for that slice, not this one.

So this slice introduces `useMidiInputs()` returning `{ status, inputs }` and `useMidiOutputs()` returning `{ status, outputs }`, leaves `useStatusbar` untouched, and lets the pickers slice decide whether to forward.

**Alternative considered**: A single `useMidiDevices()` returning both. Rejected — every consumer in this slice cares about exactly one of the two arrays; splitting them keeps the render-trigger surface narrow (a hotplug on an output shouldn't re-render the inputs panel).

### Decision 3: Banner UI in the Sidebar, toast on grant transition

Permission state has three resting points the user may need to react to:

| State          | UI surface                                                              |
|----------------|-------------------------------------------------------------------------|
| `unsupported`  | Persistent banner: "Web MIDI not available in this browser."            |
| `requesting`   | Persistent banner: "Requesting MIDI access…" (transient, auto-resolves) |
| `denied`       | Persistent banner: "MIDI access denied" + "Retry" button.               |
| `granted`      | No banner. One-time toast on the transition: "MIDI ready · N inputs · M outputs." |

The banner mounts at the top of the Sidebar (above `<InputMappingPanel />`) so it sits next to the input/output panels it affects. A toast for the grant transition is enough — once devices show up in the panels, the success is self-evident.

**Alternative considered**: A modal asking the user to enable MIDI. Rejected as too intrusive for what is, on first load, a browser-driven permission flow that already shows its own dialog.

**Alternative considered**: A toast for every state. Rejected — `denied` and `unsupported` are persistent states the user should be able to see at any time, not ephemeral notifications.

### Decision 4: Hotplug — keep selection IDs stable

`statechange` fires for connects, disconnects, and state changes. The hooks always re-derive their arrays from `Array.from(access.inputs.values())` / `Array.from(access.outputs.values())` on each event; consumers see the new arrays and re-render.

No selection state is touched in this slice (selection lives in the pickers slice). The hooks expose the raw `MIDIInput` / `MIDIOutput` shape; consumers key by `id`. When the pickers slice lands and a selected device disappears, the picker hook clears its selection — that's a pickers-slice concern.

### Decision 5: Device shape conversion at the hook boundary

`useMidiInputs` and `useMidiOutputs` return arrays of `MidiDevice` objects (a tiny local shape), not raw `MIDIInput` / `MIDIOutput`:

```ts
type MidiDevice = {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
};
```

The conversion happens in a `toMidiDevice(port)` helper. This:

- Decouples consumers from the Web MIDI spec — UI tests can use plain objects without faking `MIDIInput`.
- Drops the `MessageEvent`-style subscribe API surface from consumers that don't need it (only the future recording slice does, and it can grab the raw `MIDIInput` by id from the runtime's `access.inputs.get(id)`).
- Lets us add derived fields (label massage, channel display) without re-baking against the raw port.

The raw `MIDIAccess` is still reachable through a separate `useMidiRuntime()` hook for the future recording/playback slices that need to call `.onmidimessage` / `.send()`.

### Decision 6: Sidebar mount order

Banner first, then existing children. Sidebar.tsx becomes:

```
<MidiPermissionBanner />   ← new
<InputMappingPanel />
<Panel "MIDI Inputs">      ← rows now from useMidiInputs
<Panel "MIDI Outputs">     ← rows now from useMidiOutputs
<Panel "Record Filter">    ← unchanged (filter switches stay hardcoded)
<Panel "Routing">          ← row/col labels now from hooks; cells stay hardcoded
```

The banner is conditional — it renders nothing when status is `granted`. The Sidebar's "four panels in fixed order" requirement is unaffected because the banner is not a `.mr-panel`.

## Risks / Trade-offs

- **First-load permission prompt is jarring** → Acceptable: the banner explains state if the user denies; a re-load with the page reuses the granted permission for the session (Chromium); the `Retry` button re-requests. We do not put the prompt behind a click in this slice — the cost of one extra interaction at load time is small, and putting it behind a button means the panels stay empty by default which is more confusing than the prompt.
- **Hotplug churn re-renders the whole Sidebar** → Acceptable for now: device lists are short (< 10 typical), the panels are not on the hot path. If profiling shows churn, memoize per-row.
- **Routing matrix's selection cells diverge from real device counts** → Mitigation: when input/output counts no longer match the hardcoded 3×3 grid (i.e. immediately, for most users), the matrix renders labels for the real devices but cells stay in the 3×3 pattern. We narrow the spec to "device labels are live; cell selection cells stay illustrative until per-channel routing lands" so reviewers don't expect cell behavior to match. This is the cleanest split between "label source" and "cell semantics" without bundling per-channel routing into this slice.
- **JSDOM tests need a `requestMIDIAccess` mock** → Mitigation: the wrapper accepts a `requestMIDIAccess` injection for tests; the singleton uses `navigator.requestMIDIAccess` by default.
- **Type support for Web MIDI** → Mitigation: `WebMIDI` types are part of `lib.dom.d.ts` for recent TS versions. If `tsc` rejects, add `@types/webmidi` as a dev dep. Verify during implementation.
- **`statechange` event semantics differ across browsers** → Mitigation: always re-derive arrays from the access object (don't try to patch incrementally); the array re-derivation is cheap and order-stable.

## Migration Plan

Single-PR change. No data migration. Rollback is a code revert. The stubs are removed but the visual fallback (empty panels with hint text) preserves the surface area, so reverting doesn't leave the UI in a half state.

## Open Questions

- Should the banner be dismissable? Probably yes for `unsupported` (the user can do nothing about it); no for `denied` (dismissing it would hide actionable retry). Default: not dismissable for now; revisit if it's annoying in practice.
- Banner copy — exact wording. Current proposed strings live in the spec; copy review can adjust without spec changes.
