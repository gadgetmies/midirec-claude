## Context

The MIDI Recorder authoring state lives across three React providers — `TransportProvider` (BPM, time-signature, swing, quantize, clock source, loop region), `StageProvider` (selection, UI flags, scroll-derived horizon), and the in-stage hooks `useChannels` (channels, piano-roll rolls, param lanes, points) and `useDJActionTracks` (DJ tracks, action map, output map, events, CC interpolation). MIDI-learn mappings live alongside in `useChannels`/`useDJActionTracks` reducers. Nothing persists across reload: each provider seeds from constants (or the `?demo=` query) and discards state on unmount.

The wider codebase already has the conventions this change needs:

- A versioned tick-axis session model (`session-model` spec — ticks at `DEFAULT_MIDI_TPQ`) defines what counts as authoritative timing data.
- The Export dialog (`export-dialog` spec) and the spine CLI already emit JSON-shaped representations of the same datums — proof that the in-memory shape can be serialised — but their output is *one-way* (download), not round-trippable into the editor.
- The Sidebar (`sidebar` spec) hosts collapsible panels with a documented pattern (`<Panel>` primitive, `data-open`, local-only collapse state). Selection-blur predicates (BACKLOG entry "Scope selection-blur to inside the timeline") already require chrome panels to preserve selection when clicked.

There is no central reducer that owns the whole authoring state — every domain owns its own. That shapes how rehydration has to work.

## Goals / Non-Goals

**Goals:**

- Round-trip the **whole authoring session** (channels, rolls, lanes, points, DJ tracks/events/maps, transport-authoring fields, MIDI-learn mappings) through a typed JSON payload.
- Persist payloads in the browser keyed by a user-chosen **name**, surviving reload and explicit reopen.
- Surface save / load / list / delete / new through a single Sidebar panel with predictable toast feedback.
- Schema-tag every payload so future migrations are possible; refuse to load incompatible versions cleanly rather than corrupt state.
- Keep the existing setters as the single mutation path — rehydration drives them, never bypasses them.

**Non-Goals:**

- Cloud sync, sharing, or multi-device storage.
- Schema migration from older saved versions (only "current version loads" in this slice).
- Cross-tab conflict resolution (last-writer-wins; no broadcast).
- Auto-save / autosave-on-edit (the user always saves explicitly).
- Export of saved timelines to disk — the existing Export dialog covers MIDI/JSONL artifact export; this change is about *editor-session* persistence.
- Persisting transient UI state (selection, scroll, marquee, hover, dialog open flags, current transport mode/playhead).

## Decisions

### Decision 1: IndexedDB, not localStorage

**Choice**: Back the store with IndexedDB (`midirec` database, `timelines` object store, key = `name`, value = versioned payload).

**Rationale**:

- A whole timeline can run into hundreds of KB (notes + CC points + DJ events). localStorage caps at ~5 MB total *across all keys* and forces JSON-string round-trips. IndexedDB handles structured payloads natively and has GB-scale quotas.
- Async API maps cleanly to React's effect model — no synchronous blocking on a large `JSON.parse`.
- Same primitive every modern DAW-style web app uses for project persistence.

**Alternatives**:

- *localStorage*: rejected for size cap and synchronous I/O on the main thread.
- *Origin Private File System (OPFS)*: more powerful but overkill, less universally supported, and worse fit for keyed lookup by name.
- *In-memory only*: doesn't survive reload, which is the entire point.

**Fallback**: if `indexedDB.open` fails (private mode, quota error, missing API), fall back to an in-memory `Map` and toast once at startup ("Storage unavailable — saved timelines won't survive reload"). The rest of the API continues to function so the user can still organise multiple takes within a session.

### Decision 2: Payload is plain JSON with a `version` integer, no migrations yet

**Choice**: Every payload carries `{ version: number, appVersion: string, name: string, savedAt: number, session: SessionPayload }`. The current `STORAGE_SCHEMA_VERSION = 1`. On load, `version !== STORAGE_SCHEMA_VERSION` → reject with a "saved in incompatible version" toast; do NOT attempt to coerce.

**Rationale**:

- Tagging now means future migrations are straightforward (`migrate(payload, fromVersion)`); without the tag they'd be a guessing game.
- Refusing to load instead of best-effort coercion preserves the invariant that whatever state lives in the editor is structurally valid — half-migrated payloads cause hard-to-diagnose downstream bugs.
- "No migrations yet" keeps this slice scoped; the migration framework lands when the first breaking schema change ships.

**Alternatives**:

- *Auto-migrate on load*: deferred — requires a migration table and per-version transforms; out of scope.
- *Untagged*: rejected — once the schema changes once, every saved payload becomes ambiguous.

### Decision 3: Persist authoring-state datums; exclude transient UI state

**Persistable session surface** (whitelist, not blacklist):

- **Channels** (`Channel[]`): `id, name, color, collapsed, muted, soloed, inputSources`.
- **Piano-roll rolls** (`PianoRollTrack[]`): `channelId, notes, muted, soloed, collapsed`. `Note` already lives on the tick lattice (`tTicks, durTicks, pitch, velocity`).
- **Param lanes** (`ParamLane[]`): `channelId, kind, cc, name, color, points, muted, soloed, collapsed`.
- **DJ action tracks** (`DJActionTrack[]`): `id, name, color, midiChannel, actionMap, outputMap, events, inputRouting, outputRouting, collapsed, muted, soloed, mutedRows, soloedRows, defaultMidiInputDeviceId, defaultMidiOutputDeviceId`.
- **Transport-authoring fields** (subset of `TransportState`): `bpm, sig, quantizeOn, quantizeGrid, snapAbsoluteOn, looping, metronomeOn, clockSource`. **Explicitly excluded**: `mode, playing, recording, timecodeMs, bar, recordingStartedAt` — these are runtime/transient.
- **Loop region** (`LoopRegion | null`): from `StageState`.
- **MIDI-learn mappings**: whatever shape `midi-learn-mapping` currently persists in-memory.

**Excluded** (transient UI state — derivable or reset to defaults on load):

- `selectedChannelId, selectedIdx, resolvedSelection, marquee, dialogOpen, djActionSelection, djEventSelection, soloing`.
- Scroll position, hover state, transport play/record mode, current playhead time.
- The `sessionHorizonFloorBeats` / `layoutHorizonBeats` derived values (recomputed from content on load).

**Rationale**: keeping transient state out of the payload means a load behaves like opening a fresh editor on saved content — no ghost selections, no half-finished recordings, no dialog popping open. Anyone reading a saved payload to debug doesn't need to know which fields are noise.

### Decision 4: `hydrate(state)` boundary on each provider, not a single root reducer

**Choice**: Each provider — `useChannels`, `useDJActionTracks`, `useTransport`, `useStage` (for loop region) — exposes a single new dispatch action / setter: `hydrate(slice)`. `useTimelineStorage` orchestrates them: on load, it dispatches every slice in sequence. On `newTimeline()`, it dispatches the same with the empty-session default.

**Rationale**:

- Avoids a refactor to a global reducer. Each domain stays the owner of its shape and validation; the storage layer just hands it back its slice.
- Reuses existing reducer dispatch — the resulting state still goes through the reducer (which can enforce invariants like "rolls follow channels").
- A single `hydrate` action per provider is easier to test in isolation than "build the whole state from scratch."

**Alternatives**:

- *Add a root reducer*: rejected — large refactor, no other consumer needs it.
- *Reload the page with a query param*: rejected — terrible UX, breaks transport/MIDI state cleanly, requires the storage layer to push to URL.

**Boundary rule** added to `app-shell` spec: only `useTimelineStorage` is allowed to call `hydrate(...)`. Every other consumer SHALL use the regular per-domain mutators. Enforced by convention + a TS comment, not by access modifiers.

### Decision 5: Sidebar Storage panel, not a separate dialog

**Choice**: Storage lives as a `<Panel icon={<DiskIcon />} title="Storage">` block in the existing Sidebar, with this layout (top to bottom):

```
┌─ Storage ──────────────────────────┐
│ [ name input ............... ] [+] │   ← `+` = Save / Overwrite
│ ─────────────────────────────────  │
│ ◉ My take 1                  ⤴ 🗑 │
│ ◉ Demo with breakbeat        ⤴ 🗑 │
│ ◉ Cover sketch v2            ⤴ 🗑 │
│ ─────────────────────────────────  │
│ [ New session ]                    │
└────────────────────────────────────┘
```

- Name input is single-line, free-text (validated: non-empty, trimmed, max 80 chars, no surrogate halves).
- `+` saves under the input's name; if a row already exists with that name the row is overwritten and a "Overwrote *name*" toast confirms.
- Each row's `⤴` loads (with a confirm if the editor has unsaved changes — see Decision 6). Each row's `🗑` deletes with a confirm toast.
- The row label is the name; rows sort by `savedAt` descending (most recent first).
- "New session" wipes the editor to empty (with a confirm if unsaved changes).

**Rationale**:

- The Sidebar is already the home of session-level controls (inputs, outputs, routing) and is always visible — no extra click to open a dialog.
- The Export dialog precedent argues for keeping save/load *one* surface, but Export is one-way; persistence is round-trip and benefits from a live list.
- Reuses the existing `<Panel>` primitive, design tokens, and toast infrastructure.

**Alternatives**:

- *Modal dialog like Export*: rejected — adds friction for a frequent action.
- *Titlebar menu*: rejected — Titlebar is already at capacity per `transport-titlebar` spec.

### Decision 6: Dirty-tracking via a render-derived counter, not change-by-change

**Choice**: `useTimelineStorage` derives `isDirty` from a "current snapshot hash vs last-saved-snapshot hash" check, where the snapshot hash is computed lazily when one of the lifecycle actions (Save / Load / New) is invoked — not on every keystroke. On Load and New, if `isDirty === true`, show a confirmation toast with Confirm/Cancel before proceeding.

**Rationale**:

- Continuously tracking edits would require every reducer to notify the storage layer — too invasive.
- A lazy "snapshot equals last-saved snapshot" check at lifecycle moments is the cheapest correct version. The hash is `JSON.stringify(serializeTimeline(state))` (a few hundred KB → ~5 ms even at 60Hz; only computed at user-driven moments anyway).
- We can revisit if performance ever bites; the API doesn't change.

**Alternatives**:

- *Per-reducer dirty flag*: rejected as invasive and easy to forget.
- *No dirty tracking*: rejected — users lose work on accidental Load/New.

### Decision 7: Recording integration — saving while recording stops the recorder

**Choice**: `saveCurrentTimeline(name)` checks `transport.recording`; if `true`, it calls `transport.stop()` first (which commits the recording buffer to the relevant roll via existing recorder semantics) and only then serialises. Mirrors the existing transport-stop pattern users already know.

**Rationale**:

- Saving mid-record is the user's intent to checkpoint; the recorder's buffered (uncommitted) notes shouldn't be silently dropped.
- Forcing the same stop-then-commit path keeps the storage layer ignorant of recorder internals.

**Alternatives**:

- *Refuse to save while recording*: rejected — interrupts user flow.
- *Snapshot the buffer separately into the payload*: rejected — duplicates state and risks inconsistency with the committed roll.

## Risks / Trade-offs

- **[IndexedDB quota exhaustion]** → Catch `QuotaExceededError`, toast a clear message ("Storage full — delete a saved timeline to free space"), and leave the existing in-memory state untouched.
- **[Two tabs editing the same name]** → Last-writer-wins. Not solved in this slice; documented as a non-goal. Future enhancement: BroadcastChannel-based dirty notification.
- **[Large payloads slow on serialise/deserialise]** → Even with thousands of events the payload should stay under a few MB. `JSON.parse`/`stringify` on the main thread is fine at that scale; if it ever isn't, move to a Web Worker.
- **[Schema drift between code and saved payload]** → Hard-coded `STORAGE_SCHEMA_VERSION` plus a refusal to load mismatches. Migration framework is the next slice when the first breaking change ships.
- **[Hydrate action races with running recorder/scheduler]** → `useTimelineStorage.loadTimeline()` MUST call `transport.stop()` and clear the MIDI runtime's pending events *before* dispatching the per-provider `hydrate(...)` actions. Tested explicitly.
- **[A typo in the name input destroys a save]** → The overwrite confirmation toast (Decision 5) gives the user a chance to cancel; combined with the visible saved-list, accidental overwrites are unlikely.
- **[Browser deletes IndexedDB under storage pressure]** → Out of scope for in-browser-only storage. Documented; the next iteration's natural answer is download-to-disk as a backup, which slots in alongside `useTimelineStorage` without rework.
