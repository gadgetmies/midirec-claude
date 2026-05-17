## Context

Channel **note** rolls render through `PianoRoll` embedded in `Track`. Selection today is wired only from **demo/query** flags in `useStage()` (`demo=marquee`, `demo=note`): `selectedChannelId`, `marquee`, and `selectedIdx` are not updated by user gestures on `.mr-note` elements. DJ **action** rolls (`ActionRoll`) already implement pointer-driven selection (`djActionSelection`, `djEventSelection`) with a consistent accent treatment: **`data-selected="true"`** drives an inset **`var(--mr-accent)`** border plus outer glow (see `.mr-djtrack__note[data-selected="true"]` in `ActionRoll.css`). Piano-roll highlights currently flatten selected notes with **`var(--mr-note-sel)`** (`--mr-note-sel` branch in `PianoRoll.tsx`), which diverges from the DJ interaction language.

## Goals / Non-Goals

**Goals:**

- Single primary interaction: **click** a `.mr-note` on an expanded instrument roll selects that note index for its channel and assigns visual chrome **matching the DJ action note selection** (same token-driven shadows as `.mr-djtrack__note[data-selected="true"]`).
- Keep **velocity / track tint** visible on selected notes (same idea as DJ notes keeping `color-mix` fills under the accent ring).
- Persist selection in stage state alongside existing `resolvedSelection` derivation so Inspectors/consumers keep using one resolved shape.
- Clearing rules consistent with timeline focus: switching channel focus or clicking empty lane space should follow existing patterns used elsewhere (e.g. clarify interaction with marquee when implemented).

**Non-Goals:**

- Full DAW marquee drag implementation if it does not exist yet (only integrate with whichever marquee pipeline already passes `selectedIdx`/`marquee`).
- Multi-note shift/meta-click matrices beyond what existing selection model already supports unless trivially free.
- Changing DJ action-track behavior.

## Decisions

1. **Accent chrome parity** — Reuse the **exact layered `box-shadow` values** from `.mr-djtrack__note[data-selected="true"]` on `.mr-note[data-selected="true"]` inside `PianoRoll.css`, factoring duplication only if trivial (prefer copy-first to avoid coupling DJ CSS import order). Selected notes drop the exclusive `--mr-note-sel` flat fill path so the hue reads like DJ lanes.
2. **State ownership** — Hold interactive `selectedChannelId` / `selectedIdx` in **`useStage()`** next to demo-derived defaults: when demos are inactive, mutations come from piano-roll callbacks bubbling through `Track`/`ChannelGroup`/`AppShell`. Document precedence: **`selectedIdx` when provided still wins marquee-derived indexes** (`Selection resolution` stays as-is).
3. **Propagation** — `PianoRoll` stays mostly presentational: add an optional **`onNoteSelect(noteIndex: number)`** (or equivalent) invoked with `stopPropagation` on `.mr-note` `pointerdown`/`click`. Parent guarantees `channelId` from the enclosing roll.
4. **Focus coupling** — Clicking a note SHOULD set **`selectedChannelId`** to that roll's channel **and** set **timeline/header focus** to that channel (`setSelectedTimelineTrack({ kind: 'channel', … })` if that's the app's notion of timeline focus — align with DJ row click semantics).
5. **Demos** — Keep `demo=marquee` / `demo=note` behavior deterministic; interactive selection applies when demos are **not** driving those fields OR define explicit precedence (recommended: demos override stale interactive selection on first load only; after load, user clicks win — alternatively freeze demos strictly for URL sessions; pick the simpler MVP: interactive state works on `/`; demo URLs keep current snapshot semantics until cleared).

## Risks / Trade-offs

- **Spec vs implementation drift** — `openspec/specs/piano-roll/spec.md` still documents legacy single-stage `PianoRoll` wording in places; deltas only touch behaviors we are changing.

  [Mitigation] Update tests and scenarios when removing the `--mr-note-sel`-only background assertion.

- **Marquee coexistence** — Explicit `selectedIdx` already wins over marquee-derived indexes; merging or clearing marquee on click stays a follow-up unless trivial.

- **Collapsed rolls** — Clicks apply only when the roll is expanded; the minimap has no hit targets in this slice (acceptable).

## Migration Plan

- Ship as a normal client change; rollback is reverting the commit.

- Sanity-check Inspectors consuming `resolvedSelection` when transitioning between null and non-null.

## Open Questions

- Should clicking empty lane background clear piano-roll note selection?

- Should `demo=` URL modes freeze selection or allow overriding by clicks after load?
