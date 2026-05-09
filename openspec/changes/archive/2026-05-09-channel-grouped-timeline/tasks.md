## 1. Pre-flight: catalog the blast radius

- [x] 1.1 Grep `src/` for `useTracks`, `useCCLanes`, `MultiTrackStage`, `CCLanesBlock`, and the strings `"PB"` / `"VEL"` used as `cc` field values; record every call site in a scratch list.
- [x] 1.2 Grep `src/` for `data-soloing`, `[data-soloed=`, `data-track-open` to find every selector that needs to follow the rename to `data-audible` / `data-track-collapsed`.
- [x] 1.3 Confirm there are no other consumers (tests, demo URLs, storybook entries) outside `src/` that import the old hooks.

## 2. New `channels` capability — types and hook

- [x] 2.1 Create `src/hooks/useChannels.ts` exporting `Channel`, `PianoRollTrack`, `CCLane`, `ChannelId`, `CCLaneKind` types plus `useChannels()` hook.
- [x] 2.2 Implement seeded default state: channel 1 ("Lead") with `roll: makeNotes(22, 7)` and three lanes (`'cc' cc:1` Mod Wheel, `'pb'` Pitch Bend, `'vel'` Note Velocity with `muted: true`); channel 2 ("Bass") with `roll: makeNotes(16, 11)` and zero lanes.
- [x] 2.3 Implement all twelve toggle actions (`toggleChannelCollapsed/Muted/Soloed`, `toggleRoll*`, `toggleLane*`) preserving referential identity for unchanged records.
- [x] 2.4 Implement `addCCLane(channelId, kind, cc?)` with the dedup rule (no-op on duplicate `(channelId, kind, cc)`) and default-name derivation (e.g., `'cc' cc:7` → "Volume").
- [x] 2.5 Implement helper utilities used by render code: `audibleRollKeys(state)` and `audibleLaneKeys(state)` that compute the set of audible keys given the global solo predicate; export the `anySoloed(state)` predicate. (Implemented as per-record predicates `isChannelAudible/isRollAudible/isLaneAudible`, which is what `<ChannelGroup>` actually consumes.)
- [x] 2.6 Add a fixed standard-MIDI-CC name table (CC 1 Mod Wheel, CC 7 Volume, CC 10 Pan, CC 11 Expression, CC 64 Sustain, CC 71 Resonance, CC 74 Cutoff) used by both `addCCLane`'s name derivation and the popover.

## 3. New `channels` capability — components

- [x] 3.1 Create `src/components/channels/ChannelGroup.tsx` rendering one channel: header (sticky-left + sticky-right M/S), then either nothing (if collapsed) or `<Track>` + `<CCLane>[]` + `<AddCCLaneRow>`.
- [x] 3.2 Add `data-channel`, `data-channel-collapsed`, `data-muted`, `data-soloed`, `data-audible` attributes on `.mr-channel`.
- [x] 3.3 Wire the channel header click handler: outside-MS-chip → `toggleChannelCollapsed(channel.id)`; M/S clicks `event.stopPropagation()`.
- [x] 3.4 Create `src/components/channels/ChannelGroup.css` with `.mr-channel`, `.mr-channel__hdr`, `.mr-channel__hdr-left/spacer/right`, `.mr-channel__chev` (with `[data-channel-collapsed="true"]` rotation rule).
- [x] 3.5 Create `src/components/channels/AddCCLaneRow.tsx` rendering a thin row with the `[+ Add CC]` button that opens an `<AddCCLanePopover>`.
- [x] 3.6 Create `src/components/channels/AddCCLanePopover.tsx` listing standard MIDI CCs, Pitch Bend, Aftertouch, Note Velocity, plus a `Custom CC#` numeric input; close on outside-click or Escape; dispatch `addCCLane(channelId, kind, cc?)` on selection.
- [x] 3.7 Add CSS for the global solo dim selector: `.mr-timeline[data-soloing="true"] [data-audible="false"] .mr-track__roll, .mr-track__collapsed, .mr-cc-lane__plot { opacity: 0.45 }` (lives in this capability's stylesheet).

## 4. Modify `tracks` capability

- [x] 4.1 Delete `src/hooks/useTracks.ts`.
- [x] 4.2 Delete `src/components/tracks/MultiTrackStage.tsx`.
- [x] 4.3 Update `src/components/tracks/Track.tsx` to take a `roll: PianoRollTrack` and a `channel: Channel` (parent reference), rendering chevron + swatch (uses `channel.color`) + name "Notes" + sub `{notes.length} notes` (no channel name in sub).
- [x] 4.4 Replace `data-track-open` with `data-track-collapsed` everywhere: JSX attribute, CSS selector for chevron rotation, scenarios in tests if any.
- [x] 4.5 Wire header click → `toggleRollCollapsed(roll.channelId)`; M/S clicks → `toggleRollMuted/Soloed(roll.channelId)`.
- [x] 4.6 Remove the lane-or-stage-scoped `[data-soloing="true"] [data-soloed="false"]` rule from `Track.css`. The mute rule (`[data-muted="true"]`) stays.
- [x] 4.7 Update marquee/selection wiring: read `selectedChannelId: ChannelId | null` from the orchestrator; only the matching roll receives a non-empty marquee.

## 5. Modify `cc-lanes` capability

- [x] 5.1 Delete `src/hooks/useCCLanes.ts`.
- [x] 5.2 Delete `src/components/cc-lanes/CCLanesBlock.tsx`.
- [x] 5.3 Update `src/components/cc-lanes/CCLane.tsx` to render the new header structure: `chev + name + cc-label` where `labelFor(lane)` returns `"CC " + cc` / `"PB"` / `"AT"` / `"VEL"` based on `kind`.
- [x] 5.4 Add `data-collapsed` attribute on `.mr-cc-lane`; add CSS `[data-collapsed="true"] .mr-cc-lane__plot { display: none }` and shrink lane height to `var(--mr-h-row)` when collapsed.
- [x] 5.5 Wire lane header click → `toggleLaneCollapsed(channelId, kind, cc)`; M/S clicks → `toggleLaneMuted/Soloed(...)`.
- [x] 5.6 Remove the lane-block-scoped `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot` rule from `CCLane.css`.
- [x] 5.7 Confirm `overflow: clip` on `.mr-cc-lane` is preserved (it already exists from the previous fix; just keep it through the rewrite).

## 6. Modify `app-shell` capability

- [x] 6.1 Update `src/components/shell/AppShell.tsx` to use `useChannels()` and render `channels.filter(hasContent).map(c => <ChannelGroup ... />)` between the Ruler and the bottom of the timeline. Remove the `<MultiTrackStage>` and `<CCLanesBlock>` usages.
- [x] 6.2 Compute `data-soloing` at the timeline root (on `.mr-timeline` or `.mr-timeline__inner`) using the `anySoloed` predicate from `useChannels`.
- [x] 6.3 Implement `hasContent(channel)` predicate as `roll.notes.length > 0 || lanes.some(l => l.points.length > 0)` and use it to filter the visible-channel list. (Implemented as `channelHasContent` in `useChannels.ts`, called from `useStage` to compute `visibleChannels`.)
- [x] 6.4 Confirm scrollbar-hide CSS (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) on `.mr-timeline` is preserved.
- [x] 6.5 Remove any leftover references to `.mr-multi-track-stage` and `.mr-cc-lanes` block (as orchestrator markers) from `AppShell.css`. The `.mr-cc-lanes` *grouping* class inside a channel can stay if the channel needs a wrapper around its lanes; otherwise remove it. (Stale comment in `AppShell.css` updated; no `.mr-cc-lanes` block element now exists in the DOM — lanes are direct children of `<ChannelGroup>`.)

## 7. Audibility and selectors

- [x] 7.1 Compute `data-audible` per channel/roll/lane in `<ChannelGroup>` from `useChannels` outputs (channel-soloed cascades to its rolls/lanes; lane/roll soloed only audibilizes itself).
- [x] 7.2 Verified during review — initial bug "solo dims also the contents of the soloed track" was caused by the descendant `[data-audible="false"]` matching the parent channel; fix scopes the qualifier to the immediate `.mr-track` / `.mr-cc-lane` row.
- [x] 7.3 Remove all remaining `[data-soloing="true"] [data-soloed="false"]` selectors from any stylesheet — they're replaced by the `[data-audible]` global rule.

## 8. Visual cleanup of removed orchestrator state

- [x] 8.1 Remove the `position: relative; z-index: 1` stacking-context fix on `.mr-multi-track-stage` (the element no longer exists). Marquee z-index containment moved to `.mr-track__roll { position: relative; z-index: 1 }`.
- [x] 8.2 Remove `position: sticky; bottom: 0` from `.mr-cc-lanes` (or remove the rule entirely if `.mr-cc-lanes` no longer exists as a dedicated block). The block element is gone; CCLane.css no longer carries the rule.
- [x] 8.3 Remove the now-orphaned `data-soloing` attribute on `.mr-cc-lanes` from `CCLanesBlock` (deleted) and any vestigial references in `CCLane.css`.

## 9. Demo URLs and seed reseed

- [x] 9.1 Update `?demo=marquee` to use `selectedChannelId = 1` instead of `selectedTrackId = "t1"`. Ensure the demo marquee still renders on the Lead channel's roll.
- [x] 9.2 Sweep for any other `?demo=*` URL handler that imported the old hooks; reseed via `useChannels`. (Only `?demo=marquee` exists; verified by grep.)
- [x] 9.3 Verified during review — popover opens, inserts a new lane (initially empty after the `resampleBars([])` fix), and dedups against existing lanes.

## 10. Validation

- [x] 10.1 Run `yarn typecheck` and resolve any errors. (Clean.)
- [x] 10.2 Verified during review (multiple iterations): two channels render, three M/S levels independent with global solo cascade, three collapse levels work, `+ Add CC` popover end-to-end, horizontal scroll lockstep, no scrollbar gap, marquee under the ruler, CC playhead in expanded + collapsed views, collapsed views aligned with expanded plot via the keys-spacer. One known minor issue tracked in `BACKLOG.md`: M/S chip jumps 1px to the left at the rightmost horizontal scroll position (Chromium sub-pixel artifact).
- [x] 10.3 Run `openspec validate channel-grouped-timeline --strict` and resolve any warnings. (Valid.)

## 11. Documentation cleanup

- [x] 11.1 Update `design/deviations-from-prototype.md` to reflect the new channel grouping (the prototype has no channel groups; record the deviation and rationale). (Added entry #10; marked entry #8 as superseded.)
- [x] 11.2 Add a backlog entry (or supersede the existing one) for "remove `N SELECTED` count badge from the marquee" if it's now affected by the marquee z-index change. (Existing BACKLOG entry stands — the badge sits inside `.mr-track__roll` and is unaffected by the new stacking context boundary; no new entry needed.)
- [x] 11.3 Note in the change description that `synchronized-timeline-scroll`'s sticky-bottom-CC-lanes scenario is superseded by this change; the horizontal-scroll-axis half is preserved. (Recorded in `proposal.md` Impact section.)
