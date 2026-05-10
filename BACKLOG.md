# Backlog

Small, scoped tasks that aren't tied to an in-flight slice or OpenSpec change. Each entry should be concrete enough to start without further discovery; if a task needs design alignment or a spec, escalate it to an OpenSpec proposal in `openspec/changes/` instead.

## Open

### Remove the `N SELECTED` count badge from the marquee

**Why**: After Slice 2 review the badge was deemed redundant — the dashed marquee rectangle plus the orange-red highlight on selected notes already communicate "these are selected", and the count will be available in the Inspector's multi-select panel from Slice 5 onwards. Today the badge sits to the upper-right of the marquee rectangle, occupies a chunk of lane space, and is the only thing in the renderer that requires a JS-side count.

**Scope**:

- `src/components/piano-roll/PianoRoll.tsx` — remove the `marqueeBadge` JSX block; the SVG marquee + selection-coloring on notes are kept.
- `src/components/piano-roll/PianoRoll.css` — remove the `.mr-marquee__badge`, `.mr-marquee__count`, and `.mr-marquee__lbl` rules.
- `openspec/specs/piano-roll/spec.md` — drop the badge requirements/scenarios from the *Marquee renders dashed rect with badge* requirement (rename it to *Marquee renders dashed rect* or similar). The marquee rectangle itself stays.
- `design/deviations-from-prototype.md` — add a new entry (or extend the existing marquee entry #2/#3) recording the badge removal as another back-port-recommended deviation from the prototype, with rationale "selection count is shown in the Inspector multi-select panel from Slice 5 onwards".
- `design/README.md` — the deviations table at the bottom gets a new row.

**Verification**:

- `?demo=marquee` URL renders the dashed marquee with selected notes in `--mr-note-sel`, but no badge element. The 7 selected notes are still visibly distinct via color.
- `yarn typecheck` clean.
- `grep -r 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/` returns zero matches.

**Estimated effort**: 30 minutes — one focused edit pass + spec update + design-doc note.

**Status**: pending. Not blocking any other slice.

### M/S chip jumps 1px to the left at the end of horizontal scroll

**Why**: With the `channel-grouped-timeline` change, every level (channel header, track header, CC lane header) carries a sticky-right `__hdr-right` zone holding an `<MSChip>`. At horizontal `scrollLeft === scrollWidth - clientWidth` (the rightmost scroll position), the chip transitions from "pinned to viewport-right" to "natural position at parent's right edge" and visibly jumps 1px to the left. Reproduces in Chromium. Tracing the layout (the rightmost cap rect ends at ~1398.25px inside a 1408px plot; `hdr-right`'s natural right edge equals `inner.right` at scroll-max) suggests a sub-pixel rounding artifact at the sticky boundary rather than a layout error. Design owner confirms it's a minor visual nit, not a blocker.

**Scope**:

- Investigate whether the artifact is the sticky-right boundary or a flex layout-box edge case. Likely candidates: flex subpixel rounding inside `.mr-channel__hdr` / `.mr-track__hdr` / `.mr-param-lane__hdr` (the spacer's computed width changes by < 1px as the sticky chip pulls/releases), or `.mr-param-lane__keys-spacer`'s `border-right` rendering differently than the equivalent border on `.mr-keys` (both are `box-sizing: border-box; width: 56px` so total width is 56px, but pixel snapping at the right edge may differ).
- Try mitigations in order of cheap-to-expensive:
  1. Add `transform: translateZ(0)` or `will-change: transform` on `__hdr-right` zones to force a stable rasterization layer.
  2. Verify nothing else uses fractional pixel values (e.g. the SVG cap's `x - 0.5`, `y - 0.5`).
  3. Replace `position: sticky; right: 0` with a JS-driven `transform: translateX(...)` that always uses integer pixels (more invasive).
- If none of the cheap mitigations work, document as a known platform issue.

**Verification**:

- Scroll the timeline horizontally to its rightmost position; the chip's left edge SHALL stay within ±0px of its position at scroll-1px.
- Cross-browser check: Chromium (latest), Safari (latest), Firefox (latest).

**Estimated effort**: 1–2 hours to investigate, plus 30 min if the cheap mitigation works. Could expand to a half-day if it's a deep CSS rounding issue.

**Status**: pending. Surfaced during `channel-grouped-timeline` review; deferred per design owner.

### Add/remove affordances for channels and tracks (notes / param lanes)

**Why**: Today the timeline can grow per-channel (`+ Add Lane`) but never shrink, and there's no way to add a new channel either. No remove for channels, no remove for the roll/notes track, no remove for individual param lanes. Channel visibility is currently content-derived (`channelHasContent` predicate in `useStage`), which means a channel with no notes and no lane points silently disappears — and once removed has no path back.

This slice also corrects the **channel visibility model** from "content-derived" to "explicit membership": a channel exists iff it was added through one of three paths (`addChannel`, recording capture, or opening a file), and an existing-but-empty channel stays visible. The data structure already has no placeholders (the seed explicitly inserts 2 records, not 16), so this is purely a render-rule change plus dropping `channelHasContent` from the visibility gate.

**Scope** (this is a meaty slice — probably warrants escalation to an OpenSpec proposal when picked up):

- Visibility-rule change (independent of removers, but bundled here since the slice already touches `useStage` and the channels capability):
  - Drop `channelHasContent` and the `visibleChannels = channels.filter(...)` line in `useStage`.
  - `useStage` exposes the channel list directly; the timeline renders one `<ChannelGroup>` per entry in `state.channels` regardless of content.
  - `<ChannelGroup>` keeps rendering its `+ Add Lane` affordance even when the channel has no roll and no lanes, so freshly-added empty channels stay interactive.
  - Modifies the existing `channels` spec requirement "Timeline renders channels with content only" — replace the predicate with "every entry in `state.channels` renders".
- Hook actions on `useChannels`:
  - `addChannel(id: ChannelId, name?: string, color?: string)` — inserts a new channel with an empty roll and no lanes. No-op if `id` already exists. Default `name = "CH " + id`, default `color` from a fixed palette indexed by `id`. Used by the `+ Add Channel` UI affordance, by the recording capture pipeline (when MIDI arrives on a channel that isn't in state yet — future slice), and by the file-loading code (when a session is opened from disk — future slice).
  - `removeChannel(id: ChannelId)` — drops the channel record AND its roll AND every lane with that `channelId` from `state`. No-op if the channel doesn't exist.
  - `removeRoll(channelId: ChannelId)` — drops the matching `PianoRollTrack` record entirely (NOT just emptying `notes`). The orchestrator already handles `roll: PianoRollTrack | undefined` in `<ChannelGroup>`, so a "channel with no roll" is a valid rendered state.
  - `removeParamLane(channelId, kind, cc?)` — drops the matching lane. No-op if no match.
- Toast-based undo plumbing (decided over confirm dialogs — destructive confirms are ugly for routine cleanup):
  - On every `remove*` action, dispatch a toast with text like `"Removed Mod Wheel (CC 1)"` and an "Undo" action.
  - The undo action calls a new `restoreSnapshot(snap)` (or a per-record reverse action) that re-inserts the removed record(s). Snapshot needs to include enough state to reconstruct: for `removeChannel`, that's the channel record + roll + all lanes; for `removeRoll`, just the roll; for `removeParamLane`, just the lane.
  - Reuses the existing `toast` capability — likely needs a new "action toast" variant if the current Toast component doesn't already support an action button.
  - The undo affordance times out after ~5–8 seconds; after that the snapshot is gone.
- UI affordances at three levels:
  - Sidebar / toolstrip: `+ Add Channel` button. Opens a small picker for the channel id (1–16, disabling already-used ids) and inserts via `addChannel(id)`.
  - Channel header (`.mr-channel__hdr`): a small "×" or context-menu item next to the chevron, calling `removeChannel(channel.id)`.
  - Track header (`.mr-track__hdr`): "×" or context menu calling `removeRoll(channel.id)`.
  - Lane header (`.mr-param-lane__hdr`): "×" or context menu calling `removeParamLane(channel.id, lane.kind, lane.cc)`.
  - Visual design needs a pass — explicit "×" buttons on every header risks header clutter at the lane level (already cramped at 22px tall). Context menus are denser but require a popover primitive we don't yet have. Worth deciding before implementation.
- Spec deltas (escalate to OpenSpec change when picked up):
  - `channels` capability — add 4 `ADDED Requirements` (one per action: `addChannel`, `removeChannel`, `removeRoll`, `removeParamLane`), each with no-op-on-unknown semantics and undo-snapshot scenarios.
  - `toast` capability — extend with an action-toast requirement (text + button + onClick → restore snapshot) if not already supported.

**Verification**:

- Click `+ Add Channel` → picker opens with ids 3..16 enabled (1 and 2 are taken by the seed); pick id 5 → channel 5 appears in the timeline immediately, empty, with the channel header + `+ Add Lane` row but no track and no lanes. (No special-case logic needed — empty channels are visible because they're in `state.channels`.)
- Click "×" on a CC lane → lane disappears; toast shows "Removed Mod Wheel (CC 1)" with Undo. Click Undo → lane reappears in the same position.
- Click "×" on the Lead channel header → entire Lead group disappears; toast shows "Removed Lead". Undo → channel + roll + all lanes restored to pre-removal state.
- Click "×" on a track header → roll disappears (channel may or may not stay visible depending on remaining lane content). Toast + undo.
- After ~6 seconds the toast expires and undo is no longer available; the action is permanent.
- `yarn typecheck` clean; `openspec validate --strict` clean for the new requirements.

**Decisions made** (during backlog grooming):

- `removeRoll` drops the record entirely — rolless channels are a valid state.
- `+ Add Channel` is bundled in the same slice as the removers (otherwise channels can't come back).
- Destructive removals use toast-based undo, not confirm dialogs.
- Channel visibility is **explicit-membership**, not content-derived. A channel exists iff it was added through `addChannel`, recording, or file-load. `channelHasContent` is dropped from the visibility gate; an existing-but-empty channel stays visible. The data structure already has no placeholders (no implicit 16-channel array), so this is a render-rule change only.

**Estimated effort**: 4–6 hours for the hook actions + spec deltas + toast-undo plumbing. Plus 2–4 hours for the UI affordances depending on whether we go with context menus (needs a popover primitive) or "×" buttons (needs a visual design pass). Likely escalates to a half-day OpenSpec proposal when picked up.

**Status**: pending.

### Marquee selection spans tracks and channels

**Why**: Today the marquee is single-channel. `useStage` exposes a single `selectedChannelId`, and `AppShell.tsx:53` passes `marquee={isSelected ? stage.marquee : null}` — only the channel matching `selectedChannelId` sees the marquee, and `notesInMarquee` (in `src/components/piano-roll/notes.ts`) runs against that one roll. A user dragging a rectangle from inside the Lead group across into the Bass group sees the dashed rectangle drawn in Lead, but the orange-red selection coloring stops at the Lead/Bass boundary even when notes in Bass fall inside the rect's screen footprint.

This blocks any cross-track editing workflow: "transpose this phrase that spans two instruments", "delete everything in this region across all tracks", "nudge the chorus across drums + bass + lead together". Inspector multi-select summaries (from Slice 5) also can't represent multi-channel selections today since the resolved-selection shape is a single `selectedIdx: number[]` scoped to the selected channel's roll.

**Scope** (likely escalates to an OpenSpec proposal — touches the marquee shape, the renderer's selection-resolution rule, the `useStage` selection state, and the inspector's resolved-selection contract):

- **Coordinate model**: today `Marquee = {t0, t1, p0, p1}` with `p0/p1` in MIDI pitch units. All rolls currently share `LO=48, HI=76`, but that won't always be true (per-channel pitch windows are a near-future change). The marquee shape needs to express its vertical bounds in a way that each channel can independently translate into its own pitch range. Two options:
  1. Keep pitch units, accept that channels with different `lo`/`hi` clip the marquee differently. Cheaper but couples cross-channel selection to a global pitch axis.
  2. Switch the marquee's vertical bounds to **timeline-content Y pixels** (i.e. `y0`, `y1` measured from the timeline-inner top). Each channel/roll maps that Y range into its own pitch range via its own `lo/hi/laneH`. More flexible, more invasive.
- **Selection state shape**: replace single `selectedIdx: number[]` with `resolvedSelection: Array<{ channelId, indexes: number[] }>` (and similarly for the Inspector's input). The piano-roll renderer's "explicit selectedIdx wins over marquee derivation" rule still applies, but per-channel.
- **Marquee rendering**: the dashed rect is currently drawn inside one `<PianoRoll>`. Cross-channel needs the rect to render in a layer above the channel stack — likely a new `.mr-timeline__overlay` (`position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none`) that draws the SVG rect once at timeline-content coordinates, instead of once per channel.
- **`notesInMarquee` per-channel**: the helper stays note-array-scoped, but the orchestrator runs it once per channel/roll, intersected with that channel's pitch window. Each channel's rendered notes use the per-channel result for `[data-sel="true"]`.
- **Inspector multi-select**: extend the resolved-selection summary to aggregate across channels (range/pitches/velocity-mixed all become cross-channel summaries; Channel field becomes `mixed` when the selection spans multiple channels).
- **Spec deltas**: the `piano-roll` capability's "Selection resolution" requirement narrows to per-roll inputs; a new top-level capability or `app-shell` requirement owns the cross-channel marquee overlay and the resolved-selection aggregation.

**Verification**:

- With a multi-channel session (Lead + Bass), drag a marquee from upper-left of Lead to lower-right of Bass. The dashed rectangle SHALL render once, spanning both channels visually. Notes in both Lead and Bass that fall inside the rect SHALL be colored `--mr-note-sel`. The Inspector multi-select panel SHALL show the combined count (e.g. "12 notes selected · multi · 6 pitches · 2 channels").
- Drag a marquee that's entirely inside Lead → behaves identically to today (only Lead notes selected, only Lead notes colored).
- `?demo=marquee` URL fixture is updated to drag across both channels (or a new `?demo=marquee-multi` variant is added).
- `yarn typecheck` clean; `openspec validate --strict` clean.

**Dependencies**: depends on a real click-to-select / drag-to-marquee interaction landing first (Slice 5 only ships the Inspector against fake selection fixtures; the marquee gesture itself isn't wired to pointer events yet). Once interaction lands, this is the natural follow-up.

**Estimated effort**: 1–2 days. The coordinate-model decision is the main fork; option 2 (Y-pixel bounds) is cleaner long-term but adds a `ResizeObserver`-style measurement step. Probably warrants an OpenSpec proposal when picked up.

**Status**: pending. Surfaced during Slice 5 exploration as a known limitation of the single-channel selection model.

### Shift+drag the ruler to select across all channels and tracks

**Why**: Power-user workflow for "select everything in this time range, no matter which track or channel it's on." Useful for bar-aligned bulk edits — quantize a chorus, delete a take across drums + bass + lead, transpose a section. The marquee gesture (with or without the cross-channel fix above) requires the user to drag a rectangle that visually encloses every relevant note; for tall track stacks or notes near the top/bottom of a roll's pitch window, that's awkward. A time-only selection from the ruler skips the pitch-axis problem entirely.

This is conceptually distinct from the cross-channel marquee: the ruler-drag is **time-only, all-pitches, all-channels, all-lanes** — it should also pick up CC/param-lane points in the time range, not just notes.

**Scope** (likely an OpenSpec proposal — introduces a new selection mode, changes the ruler from passive to interactive, and extends the resolved-selection shape to cover param-lane events):

- **Ruler interaction**: today `Ruler.tsx` is purely visual (ticks + labels) and ignores pointer events. Add a `pointerdown` handler that, when the shift key is held (or unconditionally — see decision below), starts a horizontal drag and tracks `pointermove` until `pointerup`. The drag emits a time range `{t0, t1}` to the stage state.
- **Selection shape**: new variant on the resolved-selection state — call it a `TimeSelection` — distinct from the rect-marquee. Shape: `{ kind: 'time', t0, t1 }` (no pitch bounds). The renderer applies it across every channel's roll AND every param lane's points.
  - Notes whose `[t, t+dur)` interval overlaps `[t0, t1)` get `data-sel="true"`.
  - Param-lane points (CC, pitch bend) whose `t` is in `[t0, t1)` get a corresponding selection visual (probably the same `--mr-note-sel` highlight; param-lane bars don't currently have a selected state, so this needs a CSS rule).
- **Visual affordance for the time range**: a vertical band — semi-transparent fill in `var(--mr-accent)` with dashed `1px` left/right edges — drawn across the full timeline height, from `t0*pxPerBeat` to `t1*pxPerBeat`. Lives in the same `.mr-timeline__overlay` layer the cross-channel marquee uses (so it composes naturally with the cross-channel marquee work). Sticky at top covers the ruler so the band "starts at the ruler" visually.
- **Inspector summary**: the Inspector multi-select panel needs a "time selection" mode showing `Range`, total event count broken down by source (`12 notes · 84 CC events`), and bulk actions scoped to the time range (Quantize, Nudge, Delete).
- **Modifier key**: shift+drag (matches DAW conventions: Pro Tools, Logic, Ableton). Plain click on the ruler is reserved for "set playhead" (a future slice). Decision needed: is the modifier strictly shift, or should plain-drag-on-ruler also do this and click-to-set-playhead require a different gesture? Recommend **shift+drag for selection, plain-click for playhead**, matching most DAWs.
- **Spec deltas**:
  - `ruler` capability — add a "Ruler accepts pointer interaction for time-range selection" requirement.
  - New top-level capability (or extension of `app-shell`/`channels`) for the resolved-selection model that now has two variants (rect marquee, time range).
  - `param-lanes` capability — add a "Lane points render a selected state" requirement so the ruler-drag selection actually shows up on CC bars.

**Verification**:

- Hold shift, drag from bar 2 to bar 4 on the ruler. A vertical accent band SHALL render from x=`2*pxPerBeat*beatsPerBar` to x=`4*pxPerBeat*beatsPerBar`, spanning the full timeline height. Every note across every channel whose interval overlaps `[2 bars, 4 bars)` SHALL be colored `--mr-note-sel`. Every CC/pitch-bend point in that range SHALL show a selected state.
- Release shift mid-drag → the drag continues using the most recent shift state at `pointerdown` (don't switch modes mid-gesture).
- Plain click on the ruler (no shift) does NOT select anything — that gesture is reserved for the future "set playhead" slice and should be a no-op until then.
- The Inspector shows `Range`, `12 notes · 84 CC events`, and bulk-action buttons; pressing `Delete` removes everything in the range.
- Shift+drag a zero-width range (release where you pressed) → no selection (don't paint a 0px band).
- `yarn typecheck` clean; `openspec validate --strict` clean.

**Dependencies**: assumes the cross-channel resolved-selection shape from the previous backlog item exists. If picked up before that, this work introduces the multi-channel resolved-selection shape as a side effect, which is fine but probably motivates doing the cross-channel marquee item first or bundling them.

**Estimated effort**: 1 day if the resolved-selection plumbing from the cross-channel marquee item already exists; 2+ days if both have to land together. Warrants an OpenSpec proposal.

**Status**: pending. Surfaced during Slice 5 exploration alongside the cross-channel marquee item.

### Header sticky zones don't track parent's hover background

**Why**: All three header levels (`.mr-channel__hdr`, `.mr-track__hdr`, `.mr-param-lane__hdr`) define a `:hover` rule that mixes a small amount of `--mr-text-1` into the panel surface (`color-mix(in oklab, var(--mr-bg-panel*) 80%, var(--mr-text-1) 4–5%)`). But each header's sticky child zones (`__hdr-left` at all three levels; additionally `__hdr-right` at the param-lane level) carry their own opaque `background: var(--mr-bg-panel*)` that matches the *un-hovered* base color. On hover, the parent's middle (spacer area) gets the hover tint while the sticky zones stay at the base color — producing visible "patches" of un-hovered color sitting on top of the hover-tinted middle.

The bug is most obvious at the param-lane level (`ParamLane.css:43-89`) where both left AND right zones are opaque, so hovering produces three visible bands: left-base, middle-hover, right-base. At the track and channel levels (`Track.css:35-70`, `ChannelGroup.css:11-44`) only `__hdr-left` is opaque so the asymmetry is one-sided but still visible.

The sticky zones currently need an opaque background only to keep `chev + swatch + name + sub` (and the M/S chip cluster) visible at horizontal scroll offsets > 0. Without the bg, content from sibling rows would bleed through *only if there were any* — but the spacer area inside the header row is empty (`flex: 1; min-width: 0` div), so the sticky zones don't actually mask any header-row content. They only need to mask content from the scrolled plot/roll *below* the header, which the parent's own bg already handles via the explicit `position: relative; z-index: 1` lift documented in the inline comments.

**Scope**:

- Pick one of three fixes:
  1. **Remove `background` from `.mr-param-lane__hdr-left`, `.mr-param-lane__hdr-right`, `.mr-track__hdr-left`, `.mr-channel__hdr-left`** entirely. The parent header already has `position: relative; z-index: 1` and an opaque bg; sticky zones inherit visibility from the parent's bg layer. Verify nothing else scrolls beneath the sticky zones in the header row (spacer is empty today). Cleanest if the assumption holds.
  2. **CSS-variable cascade**: define `--hdr-bg` on the parent (`.mr-*__hdr` and `.mr-*__hdr:hover` set different values); both parent and sticky-zone children use `background: var(--hdr-bg)`. Custom properties cascade by default, so the children's bg auto-updates on hover. Robust and explicit. About 6 added lines per header file.
  3. **`:has`-based** rule: `.mr-*__hdr:hover .mr-*__hdr-left { background: <hover-color> }` (and same for `__hdr-right` at param-lane). Works but duplicates the hover color across selectors and breaks if a future ancestor's hover state matters. Cheapest LOC-wise.
- Recommended: option #2 (CSS-variable cascade). Aligns with how the codebase already uses tokens; one source of truth per header level.
- Apply fix to all three header levels in the same pass (channel, track, param-lane) — the bug pattern is identical, fixing one without the others leaves the visual inconsistency in place.

**Verification**:

- Hover each of: `.mr-channel__hdr`, `.mr-track__hdr`, `.mr-param-lane__hdr` (collapsed and expanded). The entire header SHALL show the hover background color uniformly — no visible patches at the sticky-left or sticky-right zones.
- Horizontal-scroll the timeline so the sticky zones are visibly pinned (scroll the inner content past the keys column). Hover the header. Sticky zones still show the hover color uniformly with the rest of the header.
- Cross-browser check: Chromium, Safari, Firefox.
- `yarn typecheck` clean.
- Visual diff: spot-check `?demo=marquee` URL — the hovered Lead channel/track/lane headers should look continuous, not banded.

**Estimated effort**: 30 minutes for option #2 across all three header CSS files, plus a manual hover-pass cross-browser. Could be 15 minutes if option #1 turns out to be safe (and ~10 lines deleted, not added).

**Status**: pending. Surfaced during Slice 5 backlog grooming. Not blocking any in-flight slice; cosmetic but visible.

### Keys-spacer paints over the "+ Add Lane" popover

**Why**: The `+ Add Lane` row's popover (`.mr-param-lanes__popover`, `position: absolute; top: calc(100% + 4px); z-index: 10`) hangs below the affordance row into the next channel/track/lane's space. Where it overlaps another row's `.mr-track__keys-spacer` or `.mr-param-lane__keys-spacer` (both `position: sticky; left: 0; z-index: 2`), the spacer paints OVER the popover instead of under it.

**Why this happens**: The popover's `z-index: 10` is local to its `.mr-param-lanes__add` parent's stacking context (which is itself `position: sticky; left: 0; z-index: 2` — that becomes the popover's effective ceiling in the parent stack). Adjacent rows' keys-spacers are sibling stacking contexts also at z=2 in the same parent stack; same level → DOM-later wins, and the next row appears after the affordance row in DOM order.

**Scope**:

- Pick one of the two cheap fixes:
  1. Raise `.mr-param-lanes__add`'s z-index above other sticky-left zones (e.g., to 3, since keys-spacers are at 2). Cleanest if no other element relies on the affordance row sitting below them.
  2. Render the popover via a portal into the `.mr-timeline` root so it's not constrained by `.mr-param-lanes__add`'s stacking context. Heavier change but bulletproof.
- Whichever is picked, also verify the popover remains correctly positioned at `top: calc(100% + 4px)` of the anchor button (the portal version needs explicit positioning math).
- Add a CSS scenario or comment to `ChannelGroup.css` explaining why the z-index value was chosen, so future stacking-context tweaks don't regress this.

**Verification**:

- Click `+ Add Lane` on Lead (which has a Pitch Bend lane below the affordance row). The popover opens and is fully visible — no part of it is obscured by the next lane's `.mr-param-lane__keys-spacer`.
- Click `+ Add Lane` on Bass (which is followed by no further channel content; popover hangs into empty timeline). Still fully visible.
- Click `+ Add Lane` on a collapsed channel — popover doesn't render (channel is collapsed, so the affordance row isn't in the DOM); not a regression.

**Estimated effort**: 15 minutes for fix #1 (one CSS tweak + verification). 30–45 minutes for fix #2 (portal + positioning math).

**Status**: pending.

## Done

<!-- Move completed entries here with a date and the commit hash that resolved them. -->
