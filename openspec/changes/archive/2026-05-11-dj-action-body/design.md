## Context

Slice 7a shipped the dj-action-track shell — header, empty placeholder body, M/S at the track level, three new state fields, and integration with the timeline's solo dimming. The body renders one empty row per pitch in `actionMap` and a centered "Action body — Slice 7b" caption.

7b replaces the placeholder with the real action-body surface. The work spans:

1. A keys column showing each row's action identity + per-row M/S.
2. A lane area with beat ticks and event-note rendering in three modes.
3. New per-track state for per-row mute/solo plus a synthetic events array.
4. Audibility model extended down to the per-row level.

Two structural questions were resolved during the explore step and need to be recorded here:

- **Keys-column width**: the prototype used 192px for action-keys in a single-mode global view. The new per-track architecture has channel-tracks (56px piano keys) and dj-action-tracks coexisting in the same `.mr-timeline__inner` with a shared horizontal scroll axis. Mismatched key-column widths would misalign the time origin. Both kinds must use the same width.
- **Events source**: the long-term model is that dj-action-tracks derive events from channel-track notes via `inputRouting`. Routing UI is not in scope for 7b. Synthetic per-track events are sufficient for the visual contract and demo.

## Goals / Non-Goals

**Goals:**

- Replace the empty placeholder body with a usable visual surface — keys column, lanes, beat ticks, action-event notes.
- Implement the three note-rendering modes (trigger / velocity-sensitive / pressure-bearing) faithfully to the prototype's `ActionRollUnit`.
- Add per-row M/S controls with local-mute / session-solo semantics.
- Keep the channel-track timeline (rolls, lanes, ruler) unchanged; the dj-action-track sits below it and shares the same time origin.
- Keep the renderer cheap enough that synthesizing ~12 events per track at render time is a non-issue.

**Non-Goals:**

- Routing UI (`inputRouting` / `outputRouting` editors). Deferred.
- Routing-derived events. Synthetic per-track events ship in 7b; the renderer's contract is the same shape, so a future switch is a 1-line change.
- Real pressure data model (`pressure: number[]` on `ActionEvent`). Slice 9.
- "+ Add Track" picker. Deferred.
- Sidebar `ActionMapPanel` + Inspector "Action" tab. Deferred.
- Action-note selection (click, marquee, drag). Deferred.
- "Map note" inline editor. Slice 8.

## Decisions

### Decision 1: Keys-column width is 56px, identical to channel-tracks

**Alternatives considered:**

- **All tracks at 192px** — give dj-action-tracks the prototype's full keys width; channel-tracks get a 56px piano-key strip plus a 136px sticky-left filler to align the time origin. Wastes screen real estate on every channel-track; cramped on small screens.
- **Per-track keys width with global `max()` time origin** — same drawback (channel-tracks padded with a useless filler).
- **56px for all tracks** (chosen) — both kinds share the same keys width; dj-action-track rows fit a 5-char-truncated label plus a compact M/S chip in 56px. Deviates from the prototype, but the prototype's 192px assumed a single-mode global view we've already abandoned.

**Why 56px:**

- Channel-tracks and dj-action-tracks share `.mr-timeline__inner`'s horizontal scroll. Beat 0 must be at the same x in both. Equal keys widths is the cheapest way to guarantee that.
- 56px is enough for `Play…` (5 chars + ellipsis) + a compact M/S chip (12–16px combined) with a few px of padding.
- Channel-track conventions (piano keys, `KEYS_COLUMN_WIDTH = 56`) already constrain the width; matching it costs no new layout work.

**Recorded as deviation #16 in `design/deviations-from-prototype.md`**.

### Decision 2: Action-label is truncated to 5 chars + ellipsis, no short code, no note label

**Alternatives considered:**

- **Show full label** — `Play / Pause`, `Hot Cue 1`. Doesn't fit in 56px alongside any M/S.
- **Show prototype's three-element row** (short code · full label · note name). Needs 192px.
- **Show only the short code** (`PLAY`, `HC1`). Fits, but loses the natural-language label. The short code is opaque without the legend.
- **Show full label truncated** (chosen). 5 chars is enough to disambiguate Play vs Hot vs Cross vs Loop at a glance, and the full label is available via tooltip (browser-native `title` attribute) and in the Inspector "Action" tab (future).

**Why 5 chars:**

- Empirical: at 10–11px font size, 5 chars + ellipsis ≈ 28–32px wide, leaving room for a compact M/S chip + padding in 56px.
- Increasing to 6–7 chars wouldn't fit M/S; reducing to 3–4 chars would alias `Play` and `Pres…` and `Pres…` (Press? Preset?).
- Tooltip via `title` attribute is browser-native and free.

**Recorded as deviation #17.**

### Decision 3: M/S chip is always-visible, with a new compact variant

**Alternatives considered:**

- **Reuse existing `MSChip`** — sized for track / lane headers, ~24–28px combined. Too wide to share 56px with a 5-char label.
- **Hover-reveal M/S** — name uses full row width when not hovered; M/S overlays on hover. Common DAW convention. Hides the row-mute / row-solo state when not hovered (you'd need a separate mute-dot indicator).
- **Always-visible compact M/S** (chosen) — new variant of `MSChip` (`size="xs"` or a sibling component) with smaller buttons and reduced chrome. Always present; row state is always visible. Easier to test (no hover-state in tests).

**Why always-visible compact:**

- Per-row state should be visible at rest. A hidden control with a hidden indicator is two pieces of UI to discover.
- Per-row M/S is a deliberate power-user feature; surfacing it inline trains users that the controls exist.
- Tests don't have to simulate hover to assert on the chip's render.

**Implementation note:**

- Add a `size?: 'sm' | 'xs'` prop to the existing `MSChip` component, OR create a new `<RowMSChip>` next to it. The decision between size-prop vs sibling component depends on how much CSS diverges. A `size` prop is preferable if the buttons just need smaller dimensions; a sibling is preferable if the chrome treatment changes substantially. **Recommendation: start with a `size` prop, refactor to a sibling only if the CSS branches significantly.**

### Decision 4: No color stripe in the keys row

**Alternatives considered:**

- **Keep the prototype's `borderLeft: 3px solid devColor` on `.mr-actkey`** — preserves at-a-glance device identity in the keys.
- **Drop the stripe** (chosen) — device color survives only in the rendered notes themselves; the keys are uniform.

**Why drop:**

- The user explicitly asked for it in the explore step ("drop the 3px stripe").
- The 3px stripe shifts visible row content by 3px, eating into the already-tight 56px budget.
- Device color is still legible in the lane area (notes painted with `devColor`).

**Recorded as deviation #18.**

### Decision 5: Row-mute is local; row-solo is session-wide

**Alternatives considered:**

- **Both local** — row mute/solo only affects within-track audibility. Simpler, but row solo is then useless for a "focus on this row across the whole session" workflow.
- **Both session-wide** — row mute would propagate to "kill this row everywhere" which doesn't match the row's identity (mute is a per-thing tool, not a cross-cutting one).
- **Mute local, solo session-wide** (chosen) — matches the existing model for channel/roll/lane mute (local) and solo (session-wide).

**Why this asymmetry:**

- Mute is "shut this one thing up." Always local to the thing being muted.
- Solo is "focus on this one thing; everything else fades." Inherently cross-cutting — soloing only-within-a-track is a weak signal and would require a separate UI affordance to communicate.
- The existing channel/roll/lane M/S has the same asymmetry. Consistency is cheap.

**Predicate update:**

```ts
// before (7a)
soloing = anyChannelSoloed(channels) || anyDJTrackSoloed(djTracks);

// after (7b)
soloing = anyChannelSoloed(channels)
       || anyDJTrackSoloed(djTracks)
       || djTracks.some(t => t.soloedRows.length > 0);
```

The `data-soloing="true"` flag on `.mr-timeline` continues to drive the existing solo-dim selector, which extends naturally to row-level dim via the new `[data-audible="false"]` on `.mr-djtrack__lane`.

### Decision 6: Per-row M/S state shape — two arrays of pitches

**Alternatives considered:**

- **`rowControls: Record<pitch, { muted: boolean; soloed: boolean }>`** — clearer per-row state, easier to add per-row flags later.
- **Mutation flags inside `ActionMapEntry`** — `actionMap[48].muted = true`. Mixes binding data with state. `ActionMapEntry` is supposed to be the verbatim port from the prototype's `DEFAULT_ACTION_MAP`; mutating it muddles the data port.
- **Two arrays of pitches: `mutedRows: number[]; soloedRows: number[]`** (chosen) — minimal, sparse (only stores active flags), easy to test for membership (`mutedRows.includes(pitch)`).

**Why two arrays:**

- Sparse representation matches the rarity of per-row M/S (most rows have neither flag).
- Cheap to clone in immutable update patterns.
- Easy to grep / inspect during debugging — `mutedRows: [48, 56]` reads better than a sparse Record.
- Adding new flags later (e.g. `lockedRows`) is just another array.

### Decision 7: Synthetic per-track events, no routing derivation in 7b

**Alternatives considered:**

- **Derive events from channel-rolls via `inputRouting.channels`** — picks up real Ch1/Ch2 notes; demonstrates the routing-derived model. But only 4 pitches in our seeded `actionMap` overlap with seeded channel notes; demo would be sparse.
- **Hardcoded constant in the component** — no state change. Untestable from state; can't demo "different tracks with different content."
- **Per-track synthetic `events: ActionEvent[]`** (chosen) — clean renderer contract; easy to test; matches today's channel-track ownership model (`PianoRollTrack` owns its `notes`); seeded with ~12 deterministic events.

**Why per-track synthetic:**

- The renderer's contract becomes "render `track.events` filtered by row pitch." A future routing slice can replace `track.events` with `eventsForTrack(track, store)` and the renderer doesn't change.
- The seed is deterministic and self-contained — no coupling to channel-track seed data.
- ~12 events × 4 rows = ~3 events per row on average. Dense enough to demo the three rendering modes; sparse enough to test selection (once selection lands).

**Event shape:**

```ts
interface ActionEvent {
  pitch: number;  // must be in track.actionMap keys
  t: number;      // beats
  dur: number;    // beats (used for non-trigger modes)
  vel: number;    // 0..1, used for velocity-sensitive mode
}
```

Identical to `Note` from `src/components/piano-roll/notes.ts` — share the type if the import is clean. **Recommendation: re-export `Note` as `ActionEvent` from `src/data/dj.ts` to keep the type names distinct at call sites while sharing the underlying shape.** If a future slice diverges the shapes (e.g. adds `pressure: number[]`), we split.

### Decision 8: Pressure curves synthesized at render time

**Alternatives considered:**

- **Store pressure curves on each event** — `pressure: number[]` (e.g. 14 samples per event). Real data model; matches what a future MIDI capture would record.
- **Synthesize at render time** (chosen) — deterministic function of `(seed, eventIndex)`, same as prototype.

**Why synthesize:**

- Slice 9 owns the Pressure Editor and the real pressure data model. 7b shouldn't commit to a shape that Slice 9 might change.
- Synthesis is what the prototype does; it produces visually correct demo curves.
- Zero state-shape risk for the 7b → 9 transition.

### Decision 9: Beat ticks are local to the dj-action-track body, not shared

**Alternatives considered:**

- **Hoist beat ticks to a global timeline overlay** — single tick layer covering channel-tracks AND dj-action-tracks. Aligns naturally; less rendering duplication.
- **Render ticks per track-body** (chosen, matching channel-track convention) — `<DJActionTrack>` renders its own ticks inside `.mr-djtrack__lanes`, exactly like `<PianoRoll>` renders ticks inside `.mr-roll__lanes`.

**Why per-body:**

- Matches the existing pattern. The channel-track piano-roll renders its own ticks; touching that is out of scope.
- Tick density (line every beat, accented every 4 beats) is the same in both — visually consistent without a shared layer.
- A global tick overlay would require restructuring channel-tracks to NOT render their own ticks; that's a refactor outside this slice.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Per-event DOM elements at scale: prototype's `ActionRollUnit` generated ~110 elements per unit (28 rows × 2–4 events). With multiple dj-action-tracks, the node count could grow to several hundred. React reconciliation cost may show up. | 7b's seeded track has ~12 events. The renderer-as-DOM pattern matches the channel-track piano-roll, so the migration to `<canvas>` (if ever needed) is the same problem in both places. Defer concrete optimization until measured. |
| `MSChip` size variant adds chrome divergence — risks the existing track/lane M/S chips and the new row chip drifting visually over time. | Start with a `size` prop on the existing component, not a sibling. If CSS branches more than ~20 lines, refactor to a sibling and document why. |
| Always-visible per-row M/S in a tight 56px keys column is busy at rest; users may not need it 99% of the time. | Acceptable for a power-user feature. If feedback says the keys row is too busy, the natural follow-up is hover-reveal (Route 1 from the explore step). |
| Pressure synthesis at render time means the curves change shape if the seeded events array changes; can be surprising during demo. | Document the deterministic seed in `useDJActionTracks.ts` so changes are auditable. |
| Per-track synthetic events will be replaced by routing-derived events later — risks the renderer being coded against a shape that doesn't survive. | Use the same shape as `Note` (`{ pitch, t, dur, vel }`); routing derivation will produce events of the same shape from channel-track notes. The renderer doesn't change. |
| Row-solo session-wide creates new failure modes: a soloed row in track A combined with a soloed track B (without rows soloed) — which rows are audible in B? | Per the predicate update: `soloing = true`. In B, only soloed rows (none) are audible — meaning **the entire B track dims to inaudible**. This is consistent with channel-roll being inaudible when any roll is soloed (the unsoloed roll dims). Audibility predicate per row: `audible = !soloing || rowSoloed || (trackSoloed && noRowsSoloed)`. Will be specified precisely in the spec. |
| Pitches in `events` could fall outside `actionMap` (no row to render in). | Renderer filters: events whose `pitch` has no entry in `actionMap` are skipped silently. The data model treats `events` as ground-truth; the action map is a render-time filter. Spec'd as a renderer rule, not a data invariant. |

## Open Questions

- Should the row-mute affordance also visually dim the row's lane background (in addition to its events), or only the events? **Tentative: dim only the events** (lane background stays uniform); but if user feedback says the muted row is hard to spot, we extend the dim to the whole lane.
- The exact compact M/S chip dimensions and font size. Will be determined empirically during implementation; expect ~14–18px combined width with monospace 9–10px text.
- Whether the seeded events should include at least one of each rendering mode. **Tentative: yes** — seed 4 trigger events on pitch 48 (Play/Pause), 4 velocity-sensitive events on pitch 56 (Hot Cue 1, pad: true), 2 pressure-bearing events on pitch 56 (since the entry has `pressure: true` AND `pad: true`, it overlaps), and 2 trigger events on pitches 60 (FX 1 On) and 71 (Crossfade ◀). Final count and distribution finalized during seed-array authoring.
