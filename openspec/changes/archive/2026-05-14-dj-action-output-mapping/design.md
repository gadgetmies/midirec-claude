## Context

The app already models DJ playback routing through `OutputMapping` (`device`, `channel`, `pitch`, optional `cc`) and resolves note vs. CC from that shape plus `defaultMixerOutputCc` / pressure rules (`src/midi/scheduler.ts`, `src/data/dj.ts`). The Inspector **Note** tab shows a per-row **Output** form when `djActionSelection` is set (`ActionPanel` in `Inspector.tsx`). Timeline focus uses `selectedTimelineTrack` (`{ kind: 'dj', trackId }` vs channel) from `useStage`, but that selection does not yet drive a dedicated inspector mode. Playback currently binds **one** `MIDIOutput` at `play()` time (`outputs[0]` from `useMidiOutputs()`), so all channel rolls and DJ events share the same physical port regardless of mapping.

## Goals / Non-Goals

**Goals:**

- When the user selects a **DJ action track** in the timeline (`selectedTimelineTrack.kind === 'dj'`), show a **right-hand (Inspector) panel** that lists **every action row** on that track and lets them edit output routing: **Web MIDI output port**, **channel**, and **note pitch vs. CC#** consistent with each row’s effective output mode.
- Introduce a **track-level default MIDI output port** (`defaultMidiOutputDeviceId`, parallel to the existing input default). Per-row controls default to “use track output” until the user sets an override on `outputMap[pitch].midiOutputDeviceId` (or equivalent field name settled in implementation).
- **Persist** port ids alongside existing DJ track state in `useDJActionTracks` so mappings survive rerenders and match other DJ fields.
- **Playback** resolves `MIDIOutput.send` per DJ event: channel rolls keep today's behavior; DJ events use the resolved port for that row (track default → row override → global fallback).

**Non-Goals:**

- Changing how `OutputMapping.device` (`DJ_DEVICES` logical id) is used for **colors/labels** in the timeline unless the UI refactor naturally consolidates; the track panel may keep logical device for swatches while adding **hardware port** as a separate control.
- Multi-port mixing for **channel piano-roll** notes in this change (unless trivially shared via the same `resolveOutput` helper).
- Session persistence to disk / project files beyond what the existing in-memory demo hooks already do.

## Decisions

1. **Where the panel lives** — Implement inside the existing `.mr-inspector` / `Inspector` **Note** tab to match “panel on the right” without new shell regions. **Precedence:** if `djActionSelection !== null`, keep the current single-row **Action + Output** panel (and pressure section) so fine-grained editing stays one click away. If `djActionSelection === null` and `selectedTimelineTrack?.kind === 'dj'`, render the new **track output mapping** list. Clear interaction with `resolvedSelection`-driven channel note views: DJ row selection still wins; otherwise DJ timeline track vs. channel note panel follows normal `resolvedSelection` rules (if both could show, document that row/track DJ focus takes precedence over channel selection—mirroring existing `djActionSelection` precedence).

2. **Data model** — Add `defaultMidiOutputDeviceId: string` on `DJActionTrack`. Extend `OutputMapping` with optional `midiOutputDeviceId?: string` (empty string clears override; normalize in `normalizeOutputMapping`). Reuse Web MIDI port id strings from `MIDIOutput.id` / `useMidiOutputs()` ordering already used elsewhere.

3. **Defaulting UX** — Each row’s port `<select>` shows a first option like “Track default” when `midiOutputDeviceId` is absent on the mapping. Editing the track default updates all rows that use the default (no per-row key). Port override on a row persists in `outputMap[pitch]`.

4. **Scheduler architecture** — Replace “single `output` passed to `createScheduler`” with a resolver `getOutput(portId: string | undefined): SchedulerOutput | null` backed by `MIDIAccess.outputs` and the same granted-runtime guard. For each DJ emit, compute `portId` from row mapping, fetch output, call `.send`. **Panic / active note tracking:** keys must include `outputId` (verify `activeNoteOns` keys). Channel rolls continue using the fallback port list’s first device (current behavior) unless a future change aligns them.

5. **Row panel alignment** — Optionally add the same MIDI port `<select>` to the existing per-row `ActionPanel` so editing one surface updates the other via shared state; if timeboxed, ship track panel first and fold row panel in the same PR when trivial.

**Alternatives considered:**

- **Per-track only, no per-row port** — Simpler, but users often route cues to one interface and mixer CC to another; per-row override is justified.
- **New right sidebar** — Duplicates layout tokens; Inspector already hosts DJ output editing.

## Risks / Trade-offs

- **Port disappears between play and tick** — Risk: user unplugs interface mid-play → `outputs.get(id)` returns undefined. **Mitigation:** treat as no-op for that message; optional toast (reuse channel-roll “no output” pattern sparingly to avoid spam).
- **Performance** — Risk: map lookup per event vs. single output. **Mitigation:** small fan-out; cache `portId → output` reference per rAF tick in a local Map inside the scheduler loop.
- **Spec / code drift** — Risk: OpenSpec baseline text lags live `DJActionTrack` fields. **Mitigation:** align new fields with live `useDJActionTracks.ts`; update types and seeded fixtures in the same implementation pass.

## Migration Plan

1. Land data shape + normalization + stage setters (backward compatible: new fields default to `''`).
2. Inspector track panel + wiring to `selectedTimelineTrack`.
3. Scheduler multi-output resolution + extend tests in `scheduler.test.ts` for two logical ports / mocked outputs.
4. Manual verify: `demo=dj`, select track header, edit mappings, play, observe correct device in Web MIDI browser or mock.

**Rollback:** revert scheduler + UI branches; persisted in-memory state resets on reload in dev.

## Open Questions

- Should the track panel expose bulk **“reset all rows to track default channel/pitch”** actions, or is per-row editing enough for v1?
- Exact copy for the **track default** sentinel in the `<select>` (product wording).
