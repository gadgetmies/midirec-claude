## Context

The just-archived `channel-grouped-timeline` change introduced a `kind: 'cc' | 'pb' | 'at' | 'vel'` discriminator to honestly tag what each lane represents in MIDI. But it kept the container's name as `CCLane` / `addCCLane` / `<CCLane>` / `.mr-cc-lane*` / the `cc-lanes` capability folder, plus the user-facing button "+ Add CC". Three of the four kinds aren't CCs in MIDI:

- Pitch Bend (`'pb'`) has its own status byte `0xEn` with 14-bit resolution.
- Channel Aftertouch (`'at'`) has status `0xDn`.
- Note Velocity (`'vel'`) is a Note On field, not a stream message.

This change finishes the renaming so the names match the data. It's a pure rename — no behavior, no semantics, no user-visible interactions other than the button label change.

## Goals / Non-Goals

**Goals:**

- Eliminate "CC" from container/component/class/folder names — keep it ONLY where it genuinely refers to Control Change (the `kind: 'cc'` value, the `cc?: number` field on a `'cc'` lane, the `laneCCLabel(lane)` helper, the `STANDARD_CCS` table, the `ccPoints.ts` seed module).
- Rename the user-facing "+ Add CC" button to "+ Add Lane" since it adds non-CC kinds too.
- Move the OpenSpec capability folder from `cc-lanes/` to `param-lanes/` so future work refers to the new name.
- Reduce the `kind` discriminator to `'cc' | 'pb' | 'at'` — three real channel-scoped MIDI stream types.
- Get the misclassified `'vel'` kind out of the param-lanes capability entirely, since velocity isn't a stream and the current implementation is fake (sine-wave generator unrelated to `notes[].vel`).

**Non-Goals:**

- Renaming `CCPoint` → `ParamPoint` (deferred). Internal helpers, not user-facing.
- Renaming `STANDARD_CCS` (it really is the Standard CC list).
- Renaming `laneCCLabel` (it formats the per-`kind` label which still includes "CC N" for `kind === 'cc'`).
- Replacing the dropped Note Velocity lane with a per-note velocity UI. That's Slice 5 (Inspector — Note panel) for editing, and a future per-note velocity strip in the piano roll body for visualization. Until those land, velocity is invisible in the timeline — acceptable.
- Touching any MIDI-handling logic. None exists yet anyway.
- Adding any back-compat aliases or shims.

## Decisions

### Target name: `ParamLane` / `param-lanes`

**Why**: short, common DAW vocabulary ("automation parameter"), and crisply distinguishes the container from its `kind === 'cc'` member. Doesn't overload any existing CSS classes or types in the codebase.

**Alternatives considered**:
- `ControllerLane` — rejected: "controller" is already MIDI's word for a CC controller (CC#1 = Mod Wheel "controller"). Doubles down on the confusion.
- `MidiLane` — rejected: too generic, doesn't say what kind of MIDI data.
- `AutomationLane` — rejected: verbose and slightly misleading (the lane doesn't yet automate anything; it's a visualization of incoming events).
- `Lane` — rejected: too generic; would clash with future per-track concepts (e.g., audio lanes, MIDI lanes by channel, etc.).

### Folder rename via filesystem `mv`, not file recreation

**Why**: preserves git history per-file. `git mv src/components/cc-lanes src/components/param-lanes` followed by content edits inside the renamed files is cleaner than deleting + recreating.

**Trade-off**: each file inside the folder is ALSO renamed (`CCLane.tsx` → `ParamLane.tsx`, etc.). Git treats this as a rename + content modification, but since the diff is dominated by the renames, history-following tools (`git log --follow`, blame) should still work. Not perfect but acceptable.

### CSS class rename via global find-and-replace

**Why**: the `.mr-cc-lane*` token appears in three files: `ParamLane.css` (after the move), `ChannelGroup.css` (the global solo-dim selector references `.mr-cc-lane__plot` and `.mr-cc-lane__collapsed`), and `Track.css` / spec files for documentation. A single sed-style replace `cc-lane → param-lane` across `src/**/*.css` and `src/**/*.tsx` (for `className` strings) does the whole rename.

**Trade-off**: the string `cc-lane` is unique enough that there are no false positives in `src/`. Confirmed via grep.

### Keep `laneCCLabel` and `STANDARD_CCS` names

**Why**: `laneCCLabel(lane)` returns the kind-specific sublabel — `"CC N"` for `kind === 'cc'`, `"PB"` / `"AT"` / `"VEL"` for the others. The function name describes what it returns IN MOST CASES (a CC label), and the helper is internal. Renaming to `laneSubLabel` would lose the hint at what it's most often computing. Acceptable to leave.

`STANDARD_CCS` literally is the Standard CC list (Mod Wheel, Volume, Pan, etc.) — only used for the `kind === 'cc'` rows in the popover. Naming is correct.

### Button label: "+ Add Lane" not "+ Add Param"

**Why**: "Lane" matches the new capability name and is the user-visible noun in the UI. "Param" is jargon that belongs in code, not buttons. "+ Add Lane" reads naturally on the affordance row.

### Drop the `'vel'` kind from `ParamLaneKind`

**Why**: Three problems with the existing `kind: 'vel'` lane:

1. **Velocity isn't a stream message in MIDI.** It's a field on each Note On (`0x9n`). The other three kinds (`'cc'`, `'pb'`, `'at'`) are real channel-scoped messages with their own status bytes that genuinely accumulate over time on a channel; velocity does not.
2. **The seeded implementation is fake.** `ccVelocity(totalT)` is a sine-wave generator with no relationship to the actual `notes[]` array on the same channel. The lane's bars don't reflect real velocity data.
3. **Multiple velocity lanes per channel are nonsensical.** There's exactly one velocity per note. The current `addParamLane(ch, 'vel')` would let users add an unbounded number of identical-looking lanes — clearly wrong.

The right home for per-note velocity is the **Inspector — Note panel** (Slice 5, next on the implementation plan, has "velocity" as a per-note field) for editing, and a future per-note velocity strip in the piano roll body for at-a-glance visualization. Both are deferred. Until then, velocity is invisible at the channel level — acceptable, since the lane was lying about what it showed anyway.

**Alternatives considered**:

- **Keep the lane, derive points from notes.** Would need wiring `lane.points` to the parent channel's `notes[]` whenever the notes change, plus deciding what `t` means when there are zero notes (`points.length === 0` → empty plot, fine), plus blocking the popover from inserting more than one velocity lane per channel. Doable but adds three coupling rules; doesn't fix the conceptual mismatch (velocity is per-note, not per-channel-stream). Rejected.
- **Move velocity to its own capability `note-velocity`** with a different visualization. Out of scope for a rename slice; would be a feature slice. Rejected for now.

**Trade-off**: The seed loses one of its three "demonstrate the visualization" lanes. Lead now seeds with 2 lanes (Mod Wheel CC1, Pitch Bend); Bass still seeds with 0 (the empty-channel case for `+ Add Lane`). The remaining seeded data still exercises the `'cc'` and `'pb'` kinds; `'at'` is exercised only via the `+ Add Lane` popover.

### Capability rename creates a new `param-lanes` and removes `cc-lanes` entirely

**Why**: OpenSpec doesn't have a "rename capability" delta operation — RENAMED Requirements only renames within a spec. The cleanest path is: introduce `param-lanes` as a new capability (with the same requirements under renamed identifiers) AND remove `cc-lanes` in full (REMOVED Requirements for every requirement, with `**Reason**` and `**Migration**` pointing to `param-lanes`).

**Alternative considered**: Leave `cc-lanes` in place and add `param-lanes` as an alias. Rejected — defeats the purpose of the rename and creates two source-of-truth folders.

## Risks / Trade-offs

- **Risk**: Breaking imports across the codebase. The `useChannels` hook re-exports the type, so anything importing `CCLane` from `useChannels` breaks. → **Mitigation**: typecheck after each edit; fix imports as they fail. Surface is contained (~6–8 files).
- **Risk**: The `archived` `channel-grouped-timeline` change still references `CCLane` / `addCCLane` etc. in its proposal/design/specs. → **Decision**: leave the archived change alone. Archives are historical records, not living docs. If a reader follows them they'll see the old names — that's accurate for that point in time.
- **Risk**: `BACKLOG.md`'s M/S 1px shift entry mentions `.mr-cc-lane__hdr-right` once. → **Mitigation**: update the BACKLOG entry to reference `.mr-param-lane__hdr-right` so it stays current. The fix-investigation steps are the same regardless of the class name.
- **Risk**: CSS HMR may cache old class names if the dev server is running mid-rename. → **Mitigation**: hard reload after rename.
- **Trade-off**: Two breaking commits over the project's lifetime (`channel-grouped-timeline` was breaking; this rename is also breaking). At pre-1.0 stage with no external consumers, acceptable.
