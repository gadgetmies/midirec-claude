## Context

`ActionRoll` paints every `track.events` entry with `renderNote()` using `actionMode()` from `src/data/dj.ts`. Mixer template rows use `pad: true` without `pressure`, so they classify as **velocity-sensitive** and draw wide note-like bars (`mr-djtrack__note--velocity`). Playback and `OutputMapping` already treat many of those rows as **Control Change** emitters (`outputMap[pitch].cc` or defaults via `defaultMixerOutputCc`). The UI therefore mis-represents CC automation as note hits.

## Goals / Non-Goals

**Goals:**

- Identify **CC-output rows** deterministically from the same data playback uses: resolved output CC for `(track, pitch)` — i.e. `track.outputMap[pitch]?.cc` when set, otherwise `defaultMixerOutputCc(action.id)` when that yields a number (and any future single source of truth the implementer adds if `midi-playback` centralizes resolution).
- Render events on those rows as **CC / automation strips** (value-over-time, not trigger/velocity note glyphs): distinct element type and classes from `.mr-djtrack__note`, aligned to `event.t` / `event.dur` / `event.vel` (normalized 0–1 for height or opacity).
- Preserve **selection**, **row audibility dimming**, and **click-to-select** behavior for DJ event selection; CC strips participate in the same interaction model as notes where it still makes sense (e.g. pressure editor may be N/A for pure CC rows — non-goal to add editor scope here unless already shared).

**Non-Goals:**

- Replacing `<ParamLane>` or duplicating its full header/collapse UX inside DJ rows (keys column already provides row identity).
- Changing MIDI playback semantics, `ActionEvent` schema, or recording routing — display-only plus DOM/class contract for tests.
- Pitch bend / channel aftertouch as separate lane kinds unless they already map cleanly to the same `OutputMapping` CC path (today’s ask is CC).

## Decisions

1. **Predicate `rowIsCcOutput(track, pitch)`** — Implemented next to existing output-resolution helpers or inline in `ActionRoll` using `track.outputMap`, `track.actionMap[pitch]`, and `defaultMixerOutputCc`. Matches user expectation: “what the row sends as CC” drives visualization.

2. **Visual language** — Reuse the **discrete vertical bar** idiom from param lanes (filled column cells over event width) for coherence with the rest of the timeline, implemented as a self-contained block in `ActionRoll` (or a tiny child component) to avoid coupling `dj-action-tracks` to `channels` state. **Alternative considered:** thin line graph — rejected as higher effort and less consistent with existing CC lanes.

3. **DOM contract** — Use a root class such as `.mr-djtrack__cc` (or `.mr-djtrack__ccevent`) for automation elements so specs and CSS do not overload `.mr-djtrack__note`. Click handlers and `data-selected` / `data-audible` mirror notes.

4. **Mode precedence** — **CC-output overrides `actionMode`** for that row: even `pad: true` mixer rows render as CC strips, not velocity-sensitive notes. **Pressure-bearing** rows that also have CC output are unlikely in current data; if both applied, **pressure-bearing** remains primary (hot cues) unless product decides otherwise — document in Open Questions if demo data forces a tie-break.

## Risks / Trade-offs

- **Demo seed events** — Seeded mixer events must still produce visible CC strips; if `vel`/`dur` are not meaningful, visuals may look flat → **Mitigation:** use same fields as today; adjust seed only if tests require richer demonstration.

- **Test churn** — Many scenarios count `.mr-djtrack__note` elements → **Mitigation:** update counts; add scenarios asserting `.mr-djtrack__cc` (or chosen class) for mixer/CC rows.

- **Spec / CSS drift** — Row dimming currently targets `.mr-djtrack__note` → **Mitigation:** extend selector to CC automation elements under `.mr-djtrack__lane`.

## Migration Plan

No data migration. Ship as a UI-only change; verify DJ demo and tests in CI.

## Open Questions

- Should rows with **incoming** `midiInputKind === 'cc'` but **no** resolved output CC still render as CC strips? **Default for implementation:** tie display to **output** CC only unless product specifies otherwise.

- If `defaultMixerOutputCc` returns a CC but the user clears override in `outputMap` in a way that removes CC at playback, renderer must stay aligned with **actual** playback resolution — confirm against `midi-playback` helper if one centralizes this.
