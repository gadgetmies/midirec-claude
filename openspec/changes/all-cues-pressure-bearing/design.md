## Context

`DEFAULT_ACTION_MAP` in `src/data/dj.ts` assigns each pitch an `ActionMapEntry` whose `pad` / `pressure` flags drive the four-mode classifier `actionMode()` (precedence: `pressure > pad > trigger > fallback`). Today the cue family is inconsistent with how DJ pad hardware behaves and with how the rest of the UI treats cues:

- `cue` (49) and `cue_b` (66) carry neither flag, so they resolve to `fallback`. `DJValueEditor` short-circuits to `hidden` whenever the selected row's mode is `trigger` or `fallback`, so a cue row can never reach the value editor.
- `hc1` / `hc1_b` carry `pad + pressure` (→ `pressure-bearing`).
- `hc2-4` / `hc2_b-4_b` carry only `pad` (→ `velocity-sensitive`), so their lane bodies render velocity ticks instead of pressure curves.

The user's intent is that every cue (cue + hot cues) is a velocity- and pressure-bearing pad. The data model is the only thing out of step — runtime code paths for pressure-bearing rows already exist and are exercised by HC1.

## Goals / Non-Goals

**Goals:**
- Every cue / hot-cue entry in `DEFAULT_ACTION_MAP` resolves to `actionMode === 'pressure-bearing'`.
- The change is purely a data update plus targeted test fixture repointing. No new runtime code paths.
- Tests that previously pinned to HC2 as a velocity-only fixture continue to verify velocity-sensitive rendering — via a synthetic entry that is independent of seeded-map drift.

**Non-Goals:**
- No retroactive migration of user-customised action maps already persisted in storage. A user who hand-edited a cue to be velocity-only keeps that.
- No changes to MIDI scheduler, output-mapping resolution, or storage serialisation. The `pressure` field already exists on `ActionMapEntry`.
- No expansion of pressure-bearing classification to other action families (load deck, mixer continuous, FX) — out of scope.

## Decisions

### Set both `pad: true` and `pressure: true` on every cue / hot-cue entry

Pressure alone would be enough for `actionMode()` to return `pressure-bearing` (pressure has highest precedence). We keep `pad: true` alongside it because:

1. `pad` semantically describes the physical control — a pad that responds to strike velocity. Stripping `pad: true` from HC1 (which already has both) would be a silent regression in `actionMode`'s ordering invariant.
2. `dj-map-editor` already preserves `pad` and `pressure` together when copying template fields onto a committed entry (`spec.md:95`), and a scenario explicitly asserts the picked Hot Cue 2 entry includes `pad === true`. Keeping `pad: true` keeps that assertion truthful for picks across the entire family.

Alternative considered: set only `pressure: true`. Rejected because it loses the "this is a pad" signal and forces every reader of the entry to infer pad-ness from the pitch number or category.

### Repoint velocity-only test fixtures to synthetic entries

Several tests reach into `DEFAULT_ACTION_MAP[57]` (HC2) specifically because, today, HC2 is the simplest "real" example of `pad: true` and no `pressure`. After this change HC2 becomes pressure-bearing, so those tests would either flip to a different real entry or detach from the seed.

Synthetic `make({ pad: true })` entries (in `dj.test.ts`) and the equivalent in `ActionRoll.test.tsx` decouple the tests from whichever seeded entry happens to be the simplest velocity-only example today. The mode-classifier and renderer contracts are what we want to verify; the seeded fixture identity is incidental.

Alternative considered: repoint to a remaining velocity-only seeded entry (`xfade_pos` 80). Rejected because that entry is `cat: 'mixer'` and `device: 'mixer'`, which is incidental to the property under test and would dilute future renames of the mixer category.

### Repoint `mode.test.ts` fallback fixture from pitch 49 to pitch 73

`mode.test.ts:36` uses `DEFAULT_ACTION_MAP[49]` (cue) as the canonical `fallback` example. After this change, pitch 49 is pressure-bearing. `load_a` (pitch 73) is already `fallback` (`browser` category, no pad, no pressure, not a trigger id), and the existing `dj.test.ts:54-58` test ("fallback for load-deck rows without pad/pressure") already documents this. Reusing pitch 73 keeps the fixture grounded in the seeded map.

## Risks / Trade-offs

- **[Risk] Persisted sessions with the old cue entry continue to read as fallback at runtime** → Mitigation: `actionMode()` is pure and re-derived each render, so the new seed picks up immediately for newly-created tracks. Tracks already saved to local storage with the old entry will not be rewritten — by design, since users may have intentionally customised. Documented in the proposal's Impact section.
- **[Risk] ActionRoll visual change for HC2-4** → The pressure-bearing renderer paints a curve and an "AT" badge instead of the velocity tick. This is the intended outcome but is a user-visible change. No mitigation needed beyond the change description; the new appearance matches HC1.
- **[Trade-off] DJ Value Editor mounts for cue rows where it previously stayed hidden** → Intentional. If a user does not want to author per-event pressure on cue, they can simply not select the row.

## Migration Plan

Single-PR change. No data migration. No flag gating: the new seed is loaded on next app boot; persisted tracks reading from local storage retain their existing entries (intentional).

Rollback is a one-commit revert of the data edits plus the test repoints.
