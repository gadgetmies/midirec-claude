## Why

The Titlebar's transport bar has six buttons (Rewind / Cue / Play-Pause / Stop / Record / Fast-forward). Only Play-Pause and Record have working behavior today; Rewind, Cue, Stop, and Fast-forward are rendered but inert. The transport semantics also have a subtle defect: pausing during a recording clears `recordingStartedAt`, so a user who taps Play-Pause to pause mid-take and taps it again gets fresh play (not resume-record) — losing the take's context. Stop's current behavior overlaps with Pause once the recording context is preserved, making a separate Stop button hard to justify.

We want a coherent transport model that lets the user record a take, pause and resume it, jump to a known position (cue point), and rewind to the start — with each button doing one distinct thing.

## What Changes

- **BREAKING** (in-app behavior): `useTransport().stop()` is removed. The Stop button is removed from the Titlebar. Callers that need "go to idle and clear the take" use `cue()` from a non-idle mode; callers that need a hard reset (e.g., MIDI Stop in record mode is already a no-op per `midi-clock` spec) are unaffected.
- **BREAKING** (in-app behavior): `useTransport().pause()` no longer clears `recordingStartedAt`. After pause-during-record, the take context is preserved.
- New `useTransport().rewind(): void` action — equivalent to `seek(0)`; preserves `mode`.
- New `useTransport().cue(): void` action — when `mode === 'idle'`, sets `cuePointTicks` to the current `playheadTicks`; when `mode === 'play' | 'record'`, sets `mode` to `'idle'`, restores playhead to the cue point (both `timecodeMs` and `playheadTicks`), and clears `recordingStartedAt`. Default cue point is `0` (start of timeline).
- New `cuePointTicks: number` field on `TransportState` (default `0`). Exposed so callers can render a cue marker on the timeline. `cuePointTicks` is **persisted** alongside the other transport-authoring fields — saved with the timeline and restored on load. `newTimeline()` resets it to `0` via the empty-session payload.
- **BREAKING** (in-app behavior): `useTransport().hydrate(slice)` now resets the runtime fields atomically with applying the slice — sets `mode` to `'idle'`, `timecodeMs` to `0`, `playheadTicks` to `0`, and `recordingStartedAt` to `null` — and writes the slice's `cuePointTicks` into state. This consolidates "swap session" semantics into one action so the session-swap callers in `useTimelineStorage` no longer need a separate halt action.
- `record` reducer treats `idle → record` differently based on `recordingStartedAt`: when set, the call is a resume (preserve position and `recordingStartedAt`); when null, the call starts a fresh take (reset position to 0, stamp `recordingStartedAt`).
- Titlebar `handlePlay` branches on `recordingStartedAt`: if non-null, dispatch `record()` to resume the take; otherwise dispatch `play()` for fresh play.
- Titlebar Rewind button gets `onClick={() => transport.rewind()}`.
- Titlebar Cue button gets `onClick={() => transport.cue()}` and an updated `title` ("Set cue / Cue stop").
- Titlebar Stop button is removed from the JSX (5-button transport row).
- Fast-forward button stays inert in this change (needs an end-of-content concept that does not exist yet).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `transport-titlebar`: the transport-bar row shrinks to five buttons; Rewind and Cue gain documented click behavior; the Stop button is removed; new requirements document the `rewind()`, `cue()`, `pause()` (preserves `recordingStartedAt`), and `record()` (resume-vs-fresh) reducer contracts that the Titlebar buttons depend on.

## Impact

- `src/hooks/useTransport.tsx` — adds `cuePointTicks` to `TransportState` and `InternalState`; adds `rewind` and `cue` to `TransportActions`; updates `pause` / `record` reducer cases; removes `stop` from `TransportActions` and the Action union, and from the reducer; extends `hydrate` to reset runtime fields and to write `cuePointTicks`.
- `src/hooks/useTransport.test.tsx` and `src/hooks/useTransport.externalClock.test.tsx` — update stop-related assertions (stop is gone); add rewind / cue / resume-record coverage.
- `src/hooks/useTransport.hydrate.test.tsx` — update the "does not touch runtime/transient" scenario to assert that hydrate now resets `mode`, `timecodeMs`, `playheadTicks`, `recordingStartedAt`, and writes `cuePointTicks`; drop the stop-based cleanup call.
- `src/components/titlebar/Titlebar.tsx` — replaces inert Rewind / Cue handlers, deletes the Stop button JSX, updates `handlePlay` to branch on `recordingStartedAt`, removes `handleStop` (its toast for "Recording saved" moves into the Record-toggle-off path and the Cue-from-record path).
- `src/components/titlebar/Titlebar.test.tsx` — drops Stop tests; adds Rewind / Cue / resume-record click tests.
- `src/hooks/useTimelineStorage.tsx` — replaces the four `transport.stop()` calls: in `saveCurrentTimeline`, with `pause()` (preserves position; mode transition out of record still flushes the recorder); in `loadTimeline` / `newTimeline` / `applyDeserializedSlices`, removes the call entirely (`hydrate` now performs the runtime reset).
- `src/storage/timelinePayload.ts` — adds `cuePointTicks` to `TransportAuthoringSlice`; serialize writes it; deserialize reads it (missing fields default to `0` for backward compatibility); `emptyTransportAuthoring()` returns `cuePointTicks: 0`.
- `src/storage/timelinePayload.test.ts` and `src/storage/timelineJsonl.test.ts` — extend coverage so `cuePointTicks` participates in serialise / deserialise round-trips; assert the missing-field default of `0`.
- `src/midi/MidiClockProvider.tsx` — the `onStop` callback currently calls `t.pause()` when `t.mode === 'play'`; behavior is preserved by the spec because pause's new "preserve recordingStartedAt" rule doesn't affect this path (record was already untouched per midi-clock spec).
- `openspec/specs/transport-titlebar/spec.md` — modify the transport-bar requirement to describe five buttons + Rewind / Cue behavior; remove Stop from the enumeration; add `cuePointTicks` + hydrate-reset requirements.
- `openspec/specs/midi-clock/spec.md` — the BPM-and-source-related scenarios are unaffected; only the "Real-time messages are ignored in record mode" continues to apply.

**Archive-order coupling:** the in-flight `timeline-storage` change currently spec'd a `transport.stop()`-before-hydrate scenario (in `specs/timeline-storage/spec.md`) and lists the transport-authoring persistable subset without `cuePointTicks` (in `specs/session-model/spec.md`). When `timeline-storage` is archived first, those scenarios will land in the main specs and become stale relative to this change. A small follow-up edit to drop the `stop()` mention and add `cuePointTicks` to the persistable subset should accompany this change's archive — or, if `transport-cue-and-rewind` archives first, the `timeline-storage` change author should pre-update those scenarios.
