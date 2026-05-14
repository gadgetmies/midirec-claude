## Context

DJ demo seeding lives in `useDJActionTracks`: `seedDefault(djDemoMessages)` builds three tracks (Deck 1, Deck 2, Mixer) with `DEFAULT_ACTION_MAP` slices and optional `SEEDED_EVENTS_*`. URL flags come from `parseDemoQueryFlags` via `useStage`. MIDI playback maps each `ActionEvent` to note or CC: CC-out rows use `outputMap[p].cc` and one **Control Change** per event with value `round(vel × 127)`. There is **no** continuous interpolation of CC across `dur` today, so long ramps must be **sampled** as many short events.

## Goals / Non-Goals

**Goals:**

- One optional URL mode that loads the exact scripted sequence from the proposal (beat jumps, Deck 2 play, mixer CC ramps).
- Deterministic, reviewable data (constant arrays or a small generator committed in source).
- Default `?demo=dj` / `?demo=dj-empty` behavior unchanged when the new token is absent.

**Non-Goals:**

- Extending the scheduler to linearly interpolate CC over `event.dur`.
- Changing hardware mapping or `DEFAULT_ACTION_MAP` semantics.
- File-based session import or user-visible “automation lane” authoring.

## Decisions

1. **URL shape** — Require **`demo=dj`** (or `demo=dj-empty` is explicitly out: no messages on empty demo) **and** **`demo=dj-automation`** to select the preset. Easiest contract: automation applies only when `djDemoMessages === true` (same as full DJ demo), so `?demo=dj&demo=dj-automation`. **Alternative** considered: standalone token without `demo=dj` — rejected to avoid re-specifying action maps.

2. **Beat index → `ActionEvent.t`** — User language “beat *k*” maps to **`t = k − 1`** in session **beats** (`session-model` convention). Example: fourth beat → `t = 3`.

3. **Discrete vs continuous automation** — Generate **one `ActionEvent` per integer beat** on each ramp interval with `dur` small (e.g. `1/128` or `0.05` beats), `vel = midiValue/127`. **Rationale**: matches existing scheduler; ramps appear as stair-steps audibly/MIDI-wise. **Alternative**: interpolate in scheduler — deferred.

4. **Linear formulas** (MIDI integers 0–127, inclusive endpoints):

   - **Ch 1 volume** pitch `81`, beats `t = 4..20`:  
     `midi(t) = round((t − 4) / (20 − 4) × 127)`.

   - **Ch 2 volume** pitch `82`, `t = 34..68`:  
     `midi(t) = round((68 − t) / (68 − 34) × 127)`.

   - **Ch 2 EQ low** pitch `88`: one event at `t = 4` with `midi = 0`; for `t = 26..34`:  
     `midi(t) = round((t − 26) / (34 − 26) × 63)`.

   - **Ch 1 EQ low** pitch `85`, `t = 26..34`:  
     `midi(t) = round((34 − t) / (34 − 26) × 63)`.

5. **Data placement** — Add named constants (e.g. `SEEDED_EVENTS_AUTOMATION_DECK1`) next to existing `SEEDED_EVENTS_*` and a branch in `seedDefault` or a `selectSeedEvents(flags)` helper to avoid duplicating track shell metadata.

6. **`parseDemoQueryFlags`** — Add boolean `djAutomationDemo` (or equivalent) set when `demo` list includes `dj-automation`; document interaction: **ignored unless** `djDemo && djDemoMessages`.

7. **Ch 2 Volume CC** — Default `defaultMixerOutputCc('ch2_vol')` is **8** (Ch 1 Volume remains CC **7**).

## Risks / Trade-offs

- **Stepped CC vs “true” linear** — Ramp is piecewise constant per beat → Mitigation: document in spec; shorten step (e.g. sixteenth-beat) later if needed.

- **Event count** — Mixer array grows (~17 + 35 + …); still small → Mitigation: lazy init once.

- **Conflict with future `demo=` tokens** — New token string must stay unique → Mitigation: `dj-automation` substring unlikely to collide.

## Migration Plan

Ship behind URL only; no migration. Rollback by removing the flag branch.

## Open Questions

- Whether beat-jump **note** events should use a fixed short `dur` (e.g. `0.1`) matching current deck seeds — **default: yes** for visual consistency.
