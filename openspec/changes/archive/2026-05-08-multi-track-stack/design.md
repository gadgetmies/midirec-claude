## Context

Slice 2 mounts a single `PianoRoll` inside `.mr-stage`. Slice 3 lifts that mount into a multi-track stack — the prototype's piano-mode default state shows three tracks (Lead / Bass / Pads), each with its own header, optionally collapsed to a 6px minimap, with mute/solo composing across the whole stage. Reference implementations: `prototype/components.jsx` `Stage` (lines ~692–838), `prototype/app.css` lines ~706–812 (M/S chip, track stack, mute/solo composition).

The just-archived `session-model` capability commits to: tracks each carry `notes: Note[]` in beats; loop region is session-scope, not per-track; the renderer's view window is shared across tracks. This change builds on those commitments.

## Goals / Non-Goals

**Goals:**
- A `Track` data shape — `{ id, name, channel, color, notes, open, muted, soloed }` — that's the canonical per-track storage for Slices 4–6.
- A `MultiTrackStage` orchestrator component that renders the prototype's piano-mode multi-track layout pixel-accurately at any combination of `open` / `muted` / `soloed` per row, with the stage-root `data-soloing` flag derived correctly.
- A reusable `MSChip` primitive for mute/solo, used here in track headers and reused by Slice 4 (CC lane headers) and Slice 7 (DJ unit headers).
- A 6px minimap rendering for collapsed tracks, scaled to the lane area's width.
- The seeded default state matches the prototype's `Stage` default: three tracks (Lead/Bass/Pads) with the prototype's colors and per-track note seeds.
- The marquee/selection demo (`?demo=marquee`) renders only on the first track (Lead), matching the prototype.

**Non-Goals:**
- Track creation/deletion/reordering. Track list is fixed at the seeded default; mutating it is a session-management concern.
- Cross-track marquee. Selection lives on a single `selectedTrackId`; dragging across tracks is deferred.
- Real per-track muting in audio — `muted` is a visual state only (just like the rest of the placeholder transport model). Slice 10 wires it to the audio runtime.
- Per-track loop regions. Loop is session-scope per the session-model spec.
- Inspector multi-select count badge — out of scope (already in BACKLOG.md as a separate task).

## Decisions

### D1. `Track` is a flat record, no nesting

**Choice**: `Track = { id: string; name: string; channel: string; color: string; notes: Note[]; open: boolean; muted: boolean; soloed: boolean }`. Channel is `string` (e.g. `"CH 1"`) for now, not a numeric MIDI channel — the prototype displays it as a formatted string and the slice doesn't need numeric routing yet.

**Rationale**: A flat record is the smallest shape that satisfies the spec. `notes` lives on the track because each track has its own note stream; that's the prototype's structure and the export-dialog's "Tracks" checkbox list directly maps over it. Splitting `notes` into a separate `notesByTrackId: Record<string, Note[]>` map would buy nothing and complicate every read.

**Trade-off**: The flat shape doesn't carry per-track *transport* state (e.g., per-track recording-arm). When a future slice needs that, add fields — don't reshape.

### D2. Solo composition is CSS-driven via `[data-soloing]` on the stage root

**Choice**: When ANY track has `soloed === true`, the orchestrator sets `data-soloing="true"` on the `.mr-stage` (or equivalent root). Each track row carries `data-soloed="true|false"`. The CSS selector `[data-soloing="true"] [data-soloed="false"] .mr-track__roll { opacity: 0.45 }` does the dimming.

`[data-muted="true"]` independently fades the row to `opacity: 0.32 · grayscale(0.7)`. Mute and solo can both be set on the same row; both visual fades apply.

**Rationale**: Per the prototype `app.css` lines 736–748. The CSS-only approach means React just sets data attributes; no derived class state per row. This is also the same pattern Slice 4 (CC lanes) and Slice 7 (DJ units) will use — they all share the `[data-soloing]` flag at the stage root.

**Implication**: The stage's `data-soloing` is computed from `tracks.some(t => t.soloed)` AND (in later slices) from CC-lane solo flags + DJ-unit solo flags too. The orchestrator that owns the stage root is responsible for OR-ing all the contributing flags.

### D3. `useStage()` wraps `useTracks()`; renderer-facing surface stays the same

**Choice**: `useStage()` keeps its existing return shape (`playheadT`, `lo`, `hi`, `totalT`, `marquee`, `selectedIdx`) and adds `tracks: Track[]` plus `selectedTrackId: string | null`. `notes` is dropped from the top-level return (now lives per-track), as is the implicit "single track" assumption.

`useTracks()` is a thin internal hook returning `{ tracks, toggleTrackOpen, toggleTrackMuted, toggleTrackSoloed }`. `useStage()` calls `useTracks()` and exposes the result. Components that need to mutate per-track state can call `useTracks()` directly OR `useStage().toggleTrackMuted` (the orchestrator passes the actions through).

**Rationale**: Keeping `useStage()` as the single hook for stage-level concerns means the AppShell wires only one hook. Components that legitimately need per-track actions (the M/S chip's onMute/onSolo) can pull them from the hook chain without changing the AppShell.

**Alternative considered**: Replace `useStage()` entirely with `useTracks()`. Rejected — Slice 2's `useStage()` API is widely referenced and renaming it doesn't add value.

### D4. Minimap rendering — one absolute-positioned `<span>` per note, CSS-scaled

**Choice**: When a track is collapsed, render the `.mr-track__minimap` strip with one `<span>` per note (skipping notes outside the view window per session-model). Each span:

- Absolute-positioned at `left: ((n.t - viewT0) / totalT) * 100%` of the minimap's width.
- Width `((n.dur / totalT) * 100%)`, clamped to a 1px minimum.
- Top/bottom inset 1px.
- Background `tr.color`, opacity `0.5 + n.vel * 0.4`.
- Border-radius `1px`.

This mirrors `prototype/components.jsx` lines ~819–828.

**Rationale**: A pure CSS render keeps the minimap fast. The 6px height is enough to show note distribution without being crowded; opacity-by-velocity preserves the dynamics signal at micro scale.

**Trade-off**: At very long sessions with hundreds of notes per track, this renders hundreds of DOM nodes per minimap. Measure if it becomes a problem; switch to a single `<canvas>` per minimap if so. Slice 3's seed has 12–22 notes per track, well below any threshold.

### D5. Track header click-to-toggle vs M/S chip click — discrete event targets

**Choice**: Clicking anywhere on `.mr-track__hdr` *outside* the M/S chip toggles `open`. Clicking the M/S chip's `M` or `S` button toggles the corresponding state without bubbling up. Implementation: the M/S chip's buttons call `event.stopPropagation()` in their onClick handlers.

**Rationale**: Per the prototype README §Track / Unit collapse: *"Click anywhere on the header (outside the M/S cluster) to collapse/expand."* The stop-propagation is the cleanest way to achieve "click on chip ≠ click on header".

### D6. Track row height: 22px header + dynamic body

**Choice**: The header is a fixed-height 22px strip (per prototype CSS). When open, the body height is determined by the embedded `PianoRoll`'s natural fixed-zoom height (`range * rowHeight = 28 * 14 = 392px` at default zoom). When collapsed, the body is a fixed 18px strip (per prototype CSS).

This makes a stack of N tracks consume `N * 22 + (sum of body heights)` of vertical space. At three tracks all open: `3 * 22 + 3 * 392 = 1242px`. The stage region uses `overflow: hidden` (already set in Slice 2) to clip if the content exceeds the column. Vertical scrolling within the stage is a future slice's concern.

**Rationale**: Fixed pixel heights match Slice 2's fixed-zoom decision and make the layout predictable. The stage clipping handles overflow consistently with the horizontal axis.

**Trade-off**: Three open tracks at 1242px height won't fit in a typical viewport; the user will see the bottom track clipped. Acceptable for the demo (the seeded default has track 3 collapsed) and it motivates the future scroll/zoom slice.

### D7. Marquee/selection scope — single track via `selectedTrackId`

**Choice**: The Stage state tracks a `selectedTrackId: string | null`. The marquee and `selectedIdx` (when used) apply to that track only. The orchestrator passes `marquee={null}` and `selectedIdx={[]}` to every other track's `PianoRoll`.

For the `?demo=marquee` placeholder, `selectedTrackId` defaults to the first track's id (Lead).

**Rationale**: The prototype shows the demo marquee on track 0 only. Future cross-track selection (Slice 5+ or a dedicated selection capability) will redesign this; for Slice 3 the single-track scope is sufficient and matches the visual reference.

### D8. M/S chip is colocated under `src/components/ms-chip/`, not under tracks/

**Choice**: `src/components/ms-chip/MSChip.tsx` and `src/components/ms-chip/MSChip.css`. Tracks import from there.

**Rationale**: M/S chip is shared infrastructure — Slice 4 (CC lanes) and Slice 7 (DJ units) will both consume it. Putting it under `tracks/` would imply ownership; a top-level component folder makes the shared nature explicit.

### D9. Stage root data attributes — orchestrator vs AppShell

**Choice**: The `MultiTrackStage` orchestrator sets `data-soloing` on its OWN root, not on `.mr-stage`. The AppShell renders `.mr-stage` as a wrapper; the orchestrator's root sits inside it. The CSS selector becomes `[data-soloing="true"] [data-soloed="false"] .mr-track__roll { ... }` which matches regardless of which ancestor carries `data-soloing`.

**Rationale**: Tightly scoping `data-soloing` to the orchestrator's subtree means future Slices 4 (CC lanes) and 7 (DJ units) can each have their own orchestrator (with their own `data-soloing`), and the global stage's `data-soloing` becomes the OR of all child orchestrators' flags. For Slice 3, only the multi-track orchestrator emits the flag; future slices broaden.

**Trade-off**: There's a question of whether CC-lane solo composes with track solo (e.g., does soloing one CC lane dim non-soloed *tracks*?). The prototype implies "yes — solo composes across the whole stage". To support this fully, the stage-root `data-soloing` needs to OR across all sources. We'll handle that orchestration when Slice 4 lands; for now, multi-track-stack's `data-soloing` lives on the orchestrator subtree and Slice 4 will hoist if needed.

## Risks / Trade-offs

- **Risk**: Three open tracks at fixed-zoom heights overflow most viewports vertically.
  **Mitigation**: Seeded default has track 3 collapsed (per prototype). Stage's `overflow: hidden` clips the rest. Vertical scrolling is the future scroll/zoom slice's concern.

- **Risk**: M/S chip's `event.stopPropagation()` is a foot-gun if a future feature wants to listen for header-area clicks at a higher level.
  **Mitigation**: Document in the spec; if a need arises, switch to comparing `event.target` against the chip's element.

- **Risk**: Selection-on-first-track-only is asymmetric and confusing once a future slice introduces real click-to-select.
  **Mitigation**: Document the limitation in the spec; the future selection-capability slice replaces this with a proper cross-track model.

- **Risk**: Mute and solo are visual-only; users may expect them to actually silence audio.
  **Mitigation**: No audio runtime exists yet (Slice 10). Until then, the M/S chips are state knobs that visualize correctly. The toast layer can render a `Muted` / `Soloed` confirmation on toggle if needed for clarity.

## Migration Plan

`useStage()`'s public surface changes (drops `notes`, adds `tracks` and `selectedTrackId`). The only caller is `AppShell.tsx`, which is updated in this slice. No downstream consumers exist yet.

The placeholder modular wrap on the playhead — `((beatsElapsed % totalT) + totalT) % totalT` from Slice 2's `useStage()` — should be removed per the session-model contract (which says non-looping playback advances forever). However, removing the wrap makes the demo's playhead disappear off-screen after ~7s, leaving a confusing dev experience until the future scroll/zoom slice. **Decision: keep the placeholder wrap in this slice** with an explicit `// TODO: remove once scroll/zoom lands` comment. The session-model spec already flags this as deferred behavior.

## Open Questions

- **Track 1 `data-soloed` defaults**: prototype seeds all three tracks as `soloed: false`. Confirmed — same default here.
- **Channel display format**: prototype shows `CH 1`, `CH 2`, ... — strings, not numbers. Keep as strings for Slice 3; introduce a numeric form when the routing matrix in Slice 4+ needs it.
- **Track color values**: prototype uses oklch literals — `oklch(72% 0.14 240)` (Lead, blue), `oklch(70% 0.16 30)` (Bass, red-orange), `oklch(74% 0.10 145)` (Pads, green). These are runtime strings stored in the track record, NOT new tokens. Adding token-driven track colors would require the design source's input — defer until track creation/customization is real.
- **Inspector "Track" tab**: the prototype's Inspector already has a `Track` tab placeholder. Slice 5 (Inspector — Note panel) is when that tab gets populated; this slice exposes the data shape it'll need.
