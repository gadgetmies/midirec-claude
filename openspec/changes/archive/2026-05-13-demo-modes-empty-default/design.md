## Context

Session bootstrap today is split across `useStage` → `useChannels(totalT, demoClean)` and `useDJActionTracks()`. `demo=clean` empties instrument notes and lanes but leaves the DJ fixture always-on. Without any flag, instrument channels load `makeNotes` fixtures and param lanes; the DJ hook always runs `seedDefault()`. Specs still describe this combined showroom as “default seed”.

## Goals / Non-Goals

**Goals:**

- Bare `/` (no `demo` query) loads an **empty** timeline: empty rolls, no param lanes, **no** DJ tracks in `djActionTracks`, while keeping the existing two MIDI channels (`Lead`, `Bass`) as structural anchors (same as today’s `demo=clean` channel list).
- `?demo=instrument` restores today’s non-clean instrument fixtures (notes + channel-1 lanes).
- `?demo=dj` restores today’s `seedDefault()` DJ track (`dj1`, action map subset, synthetic `events`).
- Allow `demo=instrument` and `demo=dj` **together** (repeat query keys or multiple assignments) to recreate the legacy all-in-one session.
- Keep `demo=marquee` and `demo=note` behaviors; **`demo=marquee` or `demo=note` SHALL automatically enable the instrument fixture** (same channel/roll/lane seed as `demo=instrument`) so deep links stay short (`/?demo=marquee` works without also passing `instrument`).
- Centralize parsing of `window.location.search` once in `useStage` (or a tiny helper) and pass boolean flags into `useChannels` / `useDJActionTracks` initializers instead of scattering `includes('demo=…')`.

**Non-Goals:**

- Redesigning the sidebar, persistence, file import, or “new project” flows.
- Removing `makeNotes` / `DEFAULT_ACTION_MAP` tables — only **when** they seed state changes.

## Decisions

1. **Parsing `demo` values**  
   Use `URLSearchParams` with **`getAll('demo')`** so `?demo=instrument&demo=dj` works. Normalize by trimming and comparing case-sensitively to `instrument`, `dj`, `marquee`, `note`, and `clean`. Ignore unknown tokens.

2. **`demo=clean` vs bare URL**  
   Make **bare URL identical to `demo=clean`** for channel/lane/instrument seed (already empty). For DJ tracks, **`demo=clean` also clears DJ fixtures** OR `demo=clean` is interpreted as “empty everything” matching the new baseline. Prefer **single baseline**: neither flag → empty; **`demo=clean` becomes a deprecated alias** that resolves to the same baseline (no extra behavior). **Rationale**: one mental model; bookmarks using `demo=clean` keep working.

3. **`selectedChannelId` with `demo=clean`**  
   Today `demoClean` forces `selectedChannelId = 1`. For a true blank slate, **default `selectedChannelId` to `null`** unless `demo=marquee`, `demo=note`, or an explicit future flag requires a channel. Aligns with `piano-roll` spec’s “Neither flag → `selectedChannelId = null`”. **Trade-off**: changes pixels for anyone relying on demo=clean pre-selecting channel 1 — note in migration.

4. **Hook signatures**  
   - `useChannels(totalT, { instrumentSeed: boolean })` (or positional) — **`true`** iff the query includes any of **`instrument`**, **`marquee`**, or **`note`** demo tokens (OR of those flags for seeding Lead/Bass fixtures).  
   - `useDJActionTracks({ djDemo: boolean })` — `true` iff `demo=dj`. Initial `useState`/reducer seed from derived flags; `useMemo` dependencies must include flags so SSR/hydration tests stay deterministic (or read search only once on mount like today’s `demoClean`).

5. **`demo=clean` vs marquee/note/instrument**  
   If **`demo=clean`** is ever combined with **`demo=marquee`**, **`demo=note`**, or **`demo=instrument`**, **marquee/note/instrument win for channel seed**: selection demos cannot run on an empty Lead roll. `demo=clean` alone stays the empty baseline alias.

## Risks / Trade-offs

- **[Risk] Spec/tests assume one DJ track always exists** → **Mitigation**: grep for `dj1` / `djActionTracks[0]` in tests and update guards.
- **[Risk] Playhead wrapping** (`piano-roll` spec mentions `% totalT`) may diverge from implementation** → Out of scope unless tests fail; do not refactor transport in this change.
- **[Risk] Breaking deep links** → **Mitigation**: document `?demo=instrument&demo=dj` as replacement for old default; keep `demo=clean` as alias for empty.

## Migration Plan

1. Land code + spec deltas in one change (or spec-first per OpenSpec apply).
2. Manually verify: `/`, `/?demo=instrument`, `/?demo=dj`, combined, **`/?demo=marquee`** and **`/?demo=note`** (each auto-loads instrument data), redundant pairs such as **`/?demo=instrument&demo=marquee`**, legacy **`/?demo=clean`**.
3. Rollback: revert hook seed flags to prior boolean.

## Open Questions

- Whether product wants **zero channels** on empty load instead of Lead/Bass shells — current scope keeps two channels per `demo=clean` parity.
- Exact marquee rectangle if note grid is `makeNotes(22, 7)` instead of an older 38-note spec; implementation should preserve “7 notes selected” if that remains a screenshot contract.
