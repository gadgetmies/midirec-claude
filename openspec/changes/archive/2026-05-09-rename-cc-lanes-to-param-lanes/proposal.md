## Why

Two problems left over from the just-archived `channel-grouped-timeline` change:

1. **The `cc-lanes` capability name is misleading for three of the four kinds.** Pitch Bend (`0xEn`), Channel Aftertouch (`0xDn`), and Polyphonic Aftertouch (`0xAn`) are separate MIDI message types — none are CCs. The `kind: 'cc' | 'pb' | 'at' | 'vel'` discriminator made the data tagging honest but kept the container's "CC" prefix everywhere (`CCLane`, `addCCLane`, `<CCLane>`, `.mr-cc-lane*`, the `cc-lanes` capability folder, the "+ Add CC" button).
2. **The `'vel'` kind doesn't belong in this capability at all.** Velocity is a field on each Note On (`0x9n`), not a stream message — there's nothing to record over time at the channel level. The seeded "Note Velocity" lane uses `ccVelocity(totalT)`, a sine-wave generator with **no relationship to the actual `notes[]` array** on the same channel; the visualization is fake. Multiple Note Velocity lanes per channel would also be nonsensical (there's only one velocity per note). Per-note velocity belongs in the piano roll's per-note UI or the Inspector — both deferred work, not channel-scoped param streams.

This change finishes both: rename `cc-lanes` → `param-lanes` so the container is honestly about parameter-automation streams, and drop `'vel'` from the kinds list so the capability genuinely is about channel-scoped MIDI streams (CC, Pitch Bend, Aftertouch).

## What Changes

### Rename surface

- **BREAKING**: TypeScript type `CCLane` → `ParamLane`. `CCLaneKind` → `ParamLaneKind`. `CCPoint` keeps its name.
- **BREAKING**: Hook function `addCCLane` → `addParamLane` (in `useChannels` and re-exported via `useStage`). Toggle helper signatures keep their shape; only `kind: CCLaneKind` references rename to `ParamLaneKind`.
- **BREAKING**: React components rename: `<CCLane>` → `<ParamLane>`, `<CCMinimap>` → `<ParamMinimap>`, `<AddCCLaneRow>` → `<AddParamLaneRow>`, `<AddCCLanePopover>` → `<AddParamLanePopover>`. Component file names follow.
- **BREAKING**: Source folder `src/components/cc-lanes/` → `src/components/param-lanes/`. Files inside are renamed (`CCLane.tsx` → `ParamLane.tsx`, `CCLane.css` → `ParamLane.css`, `CCMinimap.tsx` → `ParamMinimap.tsx`). `ccPoints.ts` stays with its current name (the remaining seed generators `ccModWheel` and `ccPitchBend` are internal helpers; not user-facing).
- **BREAKING**: CSS class taxonomy: every `.mr-cc-lane*` selector renames to `.mr-param-lane*`. The string `cc-lane` no longer appears in any class name.
- **BREAKING**: User-facing button label "**+ Add CC**" → "**+ Add Lane**" on the affordance row at the end of each channel's lane list.

### Velocity removal

- **BREAKING**: Drop `'vel'` from `ParamLaneKind`. The discriminator becomes `'cc' | 'pb' | 'at'` only. Code that constructs a lane with `kind: 'vel'` will fail typecheck.
- **BREAKING**: Remove the seeded Note Velocity lane from channel 1 in `useChannels`'s seed. Lead drops from 3 lanes to 2 (Mod Wheel + Pitch Bend).
- **BREAKING**: Remove the "Note Velocity" row from `<AddParamLanePopover>`. The popover lists CC entries (with "(CC N)" suffixes), then Pitch Bend, then Aftertouch, then a Custom CC# input. No Velocity row.
- **BREAKING**: Remove `ccVelocity` from `ccPoints.ts`. The `ccModWheel` and `ccPitchBend` generators stay.
- The `--mr-aftertouch` design token stays (still used by `kind: 'at'` lanes; was only repurposed for velocity in the seed).
- Per-note velocity is **deferred** to Slice 5 (Inspector — Note panel, the next planned slice) and to a future per-note velocity strip in the piano roll body. Until then, velocity is invisible in the timeline. Acceptable trade-off.

### Migration

**No back-compat shim.** All deleted names — type aliases, function names, CSS classes, the `'vel'` literal — go entirely. Downstream code updates wholesale.

## Capabilities

### New Capabilities

- `param-lanes`: Replaces the existing `cc-lanes` capability. Owns the `ParamLane` data type, the `<ParamLane>` component (header + body + collapsed minimap with playhead), the `<ParamMinimap>` collapsed-view minimap, the `<AddParamLanePopover>` picker, the `<AddParamLaneRow>` affordance, the per-lane mute composition CSS, and the lane-rendering responsibilities. All requirements and scenarios that were in `cc-lanes` are preserved verbatim under the new name.

### Modified Capabilities

- `cc-lanes`: REMOVED in full — all of its contents move to the new `param-lanes` capability under the renamed identifiers. The old folder `openspec/specs/cc-lanes/` is deleted; nothing remains under the `cc-lanes` capability name.
- `channels`: Every reference to `CCLane`, `addCCLane`, `<CCLane>`, `<CCMinimap>`, `<AddCCLaneRow>`, `<AddCCLanePopover>`, `.mr-cc-lane*`, and `laneKey(channelId, kind, cc)` (which uses the `cc` field name unchanged) is renamed to its `Param`-prefixed equivalent. The `kind` discriminator and the toggle/add semantics are unchanged.
- `app-shell`: The capability list under "Empty regions ship empty until their slices populate them" changes the entry `cc-lanes` to `param-lanes`. No structural changes.

## Impact

- **Code**: ~6 source files renamed (one folder rename, plus per-file renames inside it), 4–5 source files modified to follow the type/import/class rename. `useChannels.ts` is the type-renaming hub. `ChannelGroup.tsx` updates imports + props + the button label. `useStage.ts` re-exports the renamed type and action.
- **CSS**: Global rename of `.mr-cc-lane*` classes. The `data-collapsed`, `data-muted`, `data-soloed`, `data-audible` attributes don't change. The mute selector `[data-muted="true"] .mr-cc-lane__plot, [data-muted="true"] .mr-cc-lane__collapsed` becomes `[data-muted="true"] .mr-param-lane__plot, [data-muted="true"] .mr-param-lane__collapsed`. Same in the `channels` global solo-dim selector.
- **Specs**: Net ~zero spec content change (everything in `cc-lanes/spec.md` moves to `param-lanes/spec.md` with names swapped); `channels/spec.md` and `app-shell/spec.md` get small textual updates. The `cc-lanes/spec.md` file is deleted.
- **Backlog**: The `BACKLOG.md` entry for the M/S 1px shift mentions `__hdr-right` zones — the entry text refers to `.mr-cc-lane__hdr-right` once. Update or leave with a note since the issue is browser-rendering, not code-naming-dependent.
- **Out of scope**: Renaming `CCPoint` → `ParamPoint` (deferred — `CCPoint` is shared with the `ccPoints.ts` seed generators which stay). Touching MIDI-handling logic. Any back-compat aliases. Per-note velocity UI (in the piano-roll body or the Inspector — handled by Slice 5 onwards). Restoring a velocity lane in any other form.
