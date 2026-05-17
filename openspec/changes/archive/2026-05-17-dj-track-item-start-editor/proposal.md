## Why

Instrument-channel piano-roll notes can already have their start time edited from the Inspector via two synchronized fields (phrase·bar·beat and raw ticks). DJ action-track events carry the same tick-native `tTicks` field but their Inspector row panel offers no equivalent editor, so users have no numeric way to nudge a DJ event in time — only drag in the timeline. Bringing parity to the DJ row Output panel makes the two timeline kinds behave consistently and unblocks precise alignment of DJ cues against musical structure.

## What Changes

- Add the Start editor (BBT input + ticks input, mirroring `SingleNoteView`) to `ActionRowOutputPanel` in the Inspector when a DJ row is focused **and** a single `djEventSelection` references an existing event on that row.
- Editing either field commits `{ tTicks: <new> }` to the referenced event via a stage action analogous to `updateNoteAt`.
- Hide the editor entirely when no event is selected (track-level DJ panel keeps its current shape).
- **Modify** the existing `inspector` spec requirement *"DJ event timing editor inside Note tab Output region"* — replace its stale **three-field** wording (bar, beat, tick-within-beat) with the current **two-field** model (phrase·bar·beat + ticks) that already governs `SingleNoteView`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `inspector`: Tighten the DJ-event timing-editor requirement so it (a) matches the two-field BBT-plus-ticks editor actually shipped for instrument notes, and (b) prescribes the same commit-on-blur / commit-on-Enter behavior for DJ events.
- `dj-action-tracks`: Add a requirement that the session model exposes a tick-update mutator for DJ events so the Inspector can commit `tTicks` changes (parity with `updateNoteAt`).

## Impact

- **Code**: `src/components/inspector/Inspector.tsx` (`ActionRowOutputPanel`); stage layer (`src/state/...` — new `updateDjEventAt` action / equivalent); shared start-editor logic may be extracted into a small helper to keep `SingleNoteView` and the DJ panel in sync, or duplicated for now if extraction is premature.
- **Specs**: `openspec/specs/inspector/spec.md` (modify existing DJ timing-editor requirement); `openspec/specs/dj-action-tracks/spec.md` (add tick-mutator requirement).
- **No** changes to MIDI runtime, recording, playback, or routing — purely an Inspector + session-mutator surface change.
- **No** changes to DJ event data shape (`tTicks` already exists on `ActionEvent`).
