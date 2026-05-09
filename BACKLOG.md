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
