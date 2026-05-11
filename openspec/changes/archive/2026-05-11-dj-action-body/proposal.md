## Why

Slice 7a (`dj-mode-shell`) established the dj-action-track as a renderable entity in the timeline — header (chevron + swatch + name + count + M/S) plus an empty body containing one row per pitch in `actionMap` with a centered "Action body — Slice 7b" placeholder. The body has no keys, no lanes, no notes, and no per-row controls.

Slice 7b fills that placeholder. After this slice, the dj-action-track stops being a placeholder and starts being a usable visual surface — each configured action shows its label, an event lane with beat ticks, action-event notes rendered in their proper mode (trigger / velocity-sensitive / pressure-bearing), and per-row mute/solo controls. The seeded "DJ" track in the demo session becomes the first demoable end-to-end DJ-mode surface in the codebase.

## What Changes

- New `ActionEvent` type and `events: ActionEvent[]` field on `DJActionTrack`. Shape: `{ pitch: number; t: number; dur: number; vel: number }`. The seeded "DJ" track ships with ~12 synthetic demo events spanning the 3 devices in its 4-entry `actionMap`. Real-input-derived events (via `inputRouting`) are deferred to the routing-UI slice; per-track synthetic events are sufficient for the visual contract and demo. The shape matches `Note` from `src/components/piano-roll/notes.ts` so a future unified event store can be a 1-line renderer change.
- New `<ActionKeys>` component at `src/components/dj-action-tracks/ActionKeys.tsx`. Renders a 56px-wide sticky-left column with one `.mr-actkey` per pitch in `actionMap`, in ascending pitch order. Each row shows the action label truncated to **5 characters + ellipsis** (e.g. `Play…`, `Hot C…`, `Cross…`) followed by an always-visible compact M/S chip. No color stripe — device color lives only in rendered notes.
- New `<ActionRoll>` component at `src/components/dj-action-tracks/ActionRoll.tsx`. Renders the lane side of the body — one `.mr-djtrack__lane` per row (matching the keys' pitch order), beat ticks (same convention as the channel-track piano roll), and one `<ActionNote>` per event whose `pitch` matches a row.
- New `<ActionNote>` component (or inlined renderer) implementing the three rendering modes verbatim from the prototype:
  - **trigger** — `action.cat ∈ {transport, cue, hotcue}` AND `!action.pressure` → 6px-wide bright rect, device-color background, soft glow.
  - **velocity-sensitive** — `action.pad === true` (and not trigger) → variable-width bar, opacity ∝ velocity (`color-mix` in oklab from the device color), single white velocity tick at the left edge.
  - **pressure-bearing** — `action.pressure === true` → wider bar with an inner SVG of synthesized pressure cells and an "AT" badge at the top-right (when wide enough). Pressure curves are synthesized at render time from a deterministic seed; the real pressure data model is Slice 9.
- New compact M/S chip variant (`<RowMSChip>` or `<MSChip size="xs">`) used inside `<ActionKeys>` rows. The existing `<MSChip>` in `src/components/ms-chip/MSChip.tsx` is sized for track / lane headers (~24–28px combined width) and is too wide to share a 56px row with a truncated label. The variant uses smaller single-letter buttons with reduced chrome (~16–18px combined). It SHALL fire the same `onMute` / `onSolo` callbacks and use the same `data-on` styling tokens.
- Per-row M/S state on `DJActionTrack`:
  - `mutedRows: number[]` — list of pitches whose rows are muted within this track.
  - `soloedRows: number[]` — list of pitches whose rows are soloed within this track.
  - Two new actions on `useDJActionTracks` / `useStage`: `toggleDJTrackRowMuted(trackId, pitch)` and `toggleDJTrackRowSoloed(trackId, pitch)`. Each flips the pitch's membership in the corresponding array. No-op for unknown ids or pitches not present in `actionMap`.
  - **Row-mute is local** — only that row's events stop / dim within the track. No other tracks or rows are affected.
  - **Row-solo is session-wide** — any row solo folds into `useStage().soloing`. When `soloing` is true, every non-soloed track AND every non-soloed row within tracks dims via `data-audible="false"`. This extends the existing `Soloing flag combines channel and dj-action-track solo` requirement in `dj-action-tracks/spec.md` to also fold in row solo.
- Audibility model extends to action rows:
  - A row is `audible` when no row is soloed in the session, OR the row itself is soloed (and is not muted, and its containing track is audible).
  - The lane element for a muted-or-not-soloed-during-session-solo row carries `data-audible="false"` and dims under the existing solo-dim treatment used for tracks.
- The `dj-action-tracks` spec gains requirements for: the `ActionEvent` shape, the seeded events count, the `ActionKeys` row content (5-char truncation, always-visible M/S, no color stripe), the three note-rendering modes, the beat-ticks rendering, the per-row M/S data shape and actions, and the updated session-wide solo predicate.
- The `dj-action-tracks` spec MODIFIES its existing `DJActionTrack component renders header and placeholder body` requirement: the placeholder caption is removed; the body now hosts `<ActionKeys>` + `<ActionRoll>` instead of empty rows. The header structure is unchanged.
- New CSS: `.mr-actkey` (matching the prototype's class name) + nested `.mr-actkey__label`, `.mr-actkey__ms`, `[data-row-muted="true"]`, `[data-row-soloed="true"]`, `[data-audible="false"]`. New `.mr-djtrack__lane`, `.mr-djtrack__lanes`, `.mr-djtrack__lane[data-mapped]`, `.mr-djtrack__tick`. New `.mr-djtrack__note`, `.mr-djtrack__note--trigger`, `.mr-djtrack__note--pressure`. All values via design tokens — no hex literals, no `oklch(` literals in component CSS.
- The seeded "DJ" track in `useDJActionTracks` gains its synthetic `events` array (~12 events, deterministic, spanning all 3 devices). Pitches in the events SHALL match pitches in the seeded `actionMap` so every event has a row to render in.

## Capabilities

### New Capabilities

(none — this slice extends existing capabilities)

### Modified Capabilities

- `dj-action-tracks`: substantial extension. New requirements: `ActionEvent` data shape; seeded events on the default track; `<ActionKeys>` row content (5-char truncated label + compact M/S, no color stripe); `<ActionRoll>` lanes, ticks, and note rendering with the three modes; per-row M/S data shape (`mutedRows` / `soloedRows`) and toggle actions; row audibility predicate. MODIFIED requirements: the body-renders-placeholder requirement loses its placeholder; the soloing-flag requirement extends to include row solo.

## Impact

- **Code**:
  - extend `src/hooks/useDJActionTracks.ts` — add `events: ActionEvent[]`, `mutedRows: number[]`, `soloedRows: number[]` to the `DJActionTrack` interface; seed synthetic events; add `toggleRowMuted(id, pitch)` and `toggleRowSoloed(id, pitch)` actions via the same `flip`-style callback pattern used today.
  - extend `src/hooks/useStage.tsx` — expose the two new actions; extend the `soloing` predicate to include `djActionTracks.some(t => t.soloedRows.length > 0)`.
  - new `src/components/dj-action-tracks/ActionKeys.tsx` and `ActionKeys.css`.
  - new `src/components/dj-action-tracks/ActionRoll.tsx` and `ActionRoll.css`.
  - new `src/components/dj-action-tracks/RowMSChip.tsx` (compact M/S variant) OR a size variant on the existing `MSChip` — decision deferred to design.md.
  - extend `src/components/dj-action-tracks/DJActionTrack.tsx` — replace the placeholder rows + caption with `<ActionKeys>` + `<ActionRoll>`. Header structure unchanged.
  - extend `src/components/dj-action-tracks/DJActionTrack.css` — drop the `.mr-djtrack__placeholder` rules; add audibility / row-mute / row-solo dim rules consistent with the existing track-level rules.
  - extend `src/components/shell/AppShell.tsx` — wire `onToggleRowMuted` and `onToggleRowSoloed` callbacks through to `<DJActionTrack>` so they can be threaded down to `<ActionKeys>`.
  - reuse `pxPerBeat` constant (or equivalent shared constant) from the channel-track timeline so beat ticks land at consistent x-coordinates across both kinds of tracks. If no shared constant exists, hoist one.
- **Specs**: MODIFIED `dj-action-tracks/spec.md` with multiple new and modified requirements. No new capabilities; no other specs touched.
- **Design docs**:
  - `design/deviations-from-prototype.md` — record (a) the keys-column width deviation (56px vs prototype 192px), (b) the row content deviation (5-char truncated label + always-visible compact M/S vs prototype's full label + short code + per-row M/S only on Deck 1), (c) the dropped color stripe (prototype's `borderLeft: 3px solid devColor` is dropped from the keys row; device color survives only in rendered notes).
  - `design/README.md` — table row updates per the new entries.
  - `design/real-time-correctness.md` — no change; synthetic events are static state, not message-driven.
- **Out of scope** (explicitly):
  - "+ Add Track" picker (lets users create additional dj-action-tracks). Deferred to a follow-up slice once a popover primitive lands.
  - Sidebar `ActionMapPanel` from the prototype. Deferred.
  - Inspector "Action" tab. Deferred.
  - Routing configuration UI (`inputRouting` / `outputRouting` editors). Deferred to the routing-UI slice.
  - Routing-derived events (replace synthetic per-track events with events derived from channel-track notes via `inputRouting`). Deferred to the routing-UI slice.
  - Real pressure data model (`pressure: number[]` on `ActionEvent`). Slice 9's Pressure Editor owns this. 7b synthesizes pressure curves at render time from a deterministic seed.
  - Real action-note interaction (click-to-select an event, drag-to-move, marquee-select within a dj-action-track). Deferred — selection within dj-action-tracks is its own slice.
  - "Map note" inline editor (the prototype's `MapNoteEditor`). Slice 8.
  - Reordering rows within a track (drag-to-reorder pitch order). Deferred. Rows are sorted by ascending pitch.
  - Multi-track marquee that spans channel-tracks AND dj-action-tracks. Deferred — listed in `BACKLOG.md` as a future cross-kind selection slice.
- **Dependencies**: builds on 7a (`dj-mode-shell`) — the `DJActionTrack` component, `useDJActionTracks` hook, and `dj-action-tracks` capability spec are all assumed to exist and be wired into `AppShell` / `useStage` per the archived slice.
- **Risk**: medium-low. The visual surface is bigger than 7a (per-row notes can be dense — the prototype's `ActionRollUnit` generates 2–4 events per row across 28 rows = up to ~110 note elements per unit). React reconciliation for 110 nodes is fine, but if a future slice swaps synthetic events for routing-derived events from a high-volume channel-track, the per-event element approach may need a `<canvas>` swap. The renderer-as-DOM choice in 7b is consistent with the channel-track piano-roll's choice, so the migration path (if ever needed) is the same problem in both places.
