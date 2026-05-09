## Context

Today the timeline renders three sibling regions inside `.mr-timeline`: the Ruler (sticky-top), `.mr-multi-track-stage` (the piano-roll stack), and `.mr-cc-lanes` (sticky-bottom band of CC streams). `Track` and `CCLane` are sibling concepts — both reference a "channel" (`Track.channel: string`, `CCLane.cc: string`) but only loosely. CCs in MIDI are channel-scoped (status byte `0xBn`), and the current model has no way to express "Mod Wheel on ch.1 vs ch.2" or to colocate a track's notes with that channel's CCs.

This design promotes **channel** to the organizational unit. Each channel owns one piano-roll track and zero-or-more CC lanes; the timeline becomes a flat vertical stack of channel groups. M/S and collapse exist at three independent levels (channel / roll / lane). Solo becomes session-global. The seeded `cc3 = "Velocity"` lane stops pretending to be a CC and gets a `kind: 'vel'` discriminator with display name "Note Velocity".

The just-archived `synchronized-timeline-scroll` change established the single shared horizontal scroll axis on `.mr-timeline`. That part stays; only its sticky-bottom-CC-lanes scenario is superseded.

## Goals / Non-Goals

**Goals:**

- Channel is the organizational unit — semantically correct (CCs are channel-scoped), and matches how the existing `Track.channel` sub-label was already hinting.
- Three independent M/S + collapse levels (channel / roll / lane) without aggregation.
- Global solo predicate at the session level; one `data-soloing` attribute on the timeline root.
- Content-derived channel visibility — empty channels disappear automatically; adding an empty CC lane to a non-empty channel keeps it rendered.
- One continuous vertical scroll. CC lanes flow inline below their channel's roll; no sticky-bottom band.
- A clean replacement for `useTracks` + `useCCLanes` — one `useChannels` hook, no compatibility shim.
- A new `+ Add CC` affordance per channel that opens a popover picker (standard MIDI CCs + custom CC#).

**Non-Goals:**

- User-editable picker list (MIDI CC names are a fixed standard list + a custom-number escape hatch).
- Channel rename / reorder / color-edit UI. Channels are fixed numerically (1–16) at this stage.
- Aggregation of M/S state from children up to parent. Channel M/S is its own boolean.
- Playback wiring for muted/soloed (the existing specs already defer this; this change only keeps the data shape consistent).
- Backwards-compat shims for the deleted `useTracks` / `useCCLanes` hooks. They go entirely.
- Per-channel custom solo predicates — solo is global, not per-channel.

## Decisions

### Channel as a separate type, not folded into Track

`Channel` is its own interface with `id: 1..16`, `name`, `color`, `collapsed`, `muted`, `soloed`. The roll lives in a separate `PianoRollTrack` keyed by `channelId`.

**Why**: M/S and collapse must exist independently at the channel level. If we folded those flags into the roll, channel-level controls would have to derive from "the roll's M/S state", which conflicts with the explicit decision that channel M/S does not aggregate. Two separate records are easier to reason about than overloading one.

**Alternative considered**: `Channel` carries `roll: PianoRollTrack` and `lanes: CCLane[]` directly (nested shape). Rejected because the existing render orchestrator pattern (`Track` / `CCLane` as flat lists keyed by an id) is a known-working primitive and React reconciliation prefers stable flat lists. The nested shape would need normalization in the hook anyway.

### `kind: 'cc' | 'pb' | 'at' | 'vel'` discriminator on `CCLane`

Replaces the free-form `cc: string` (today's `"01"`, `"PB"`, `"VEL"`). `cc?: number` (0–127) is only meaningful when `kind === 'cc'`.

**Why**: The current string-encoded `cc` field conflates four genuinely different MIDI message kinds. Pitch Bend and Channel Aftertouch have their own MIDI status bytes. Per-note velocity isn't a stream at all (it's a Note On field; the lane visualizes a derived series). A discriminator + optional CC# makes the model honest and lets render code branch cleanly (`kind === 'vel'` → no "CC ##" prefix in the header label, `kind === 'pb'` → label reads "Pitch Bend", etc.).

**Alternative considered**: Keep `cc: string` and use special sentinels (`"PB"`, `"AT"`, `"VEL"`). Rejected because string sentinels are exactly what we have today and are the source of the "Velocity is a CC" confusion.

### Solo is global, audibility cascades

A roll/lane is "audible" if its own `soloed === true` OR its channel's `soloed === true`. When ANY soloed flag is true anywhere in the session, every non-audible roll/lane is dimmed via the `data-soloing="true"` selector at the timeline root.

**Why**: The mixer mental model — clicking a channel's S means "I want to hear this channel including all its CCs" — matches what users expect from DAWs. Without cascade, channel-solo would be useless when the channel has CCs but no roll-level solo (or vice versa). The flat per-lane S still works for fine-grained dim ("solo just this CC across the session").

**Alternative considered**: No cascade — each level is independent. Rejected because it makes channel-solo do nothing in the common case (user clicks a channel's S expecting "play just this channel").

**Alternative considered**: Cascade in both directions — channel-mute cascades down too, and lane-mute cascades up. Rejected for now: mute cascading down is fine (we may add later), but cascading up loses information and tangles the data shape. We'll revisit when playback wiring lands.

### Content-derived channel visibility, not user-toggle

A channel renders iff `roll.notes.length > 0 || lanes.some(l => l.points.length > 0)`. There's no "show/hide channel" UI control.

**Why**: The original ask was "only display the CC channels that have content" — visibility is data-derived, not user-state. Adding a channel-level visibility flag would create two sources of truth (does the user want it shown vs. is there anything to show). The "+ Add CC" affordance handles the empty-lane case explicitly: a freshly-added empty CC lane in an otherwise-non-empty channel keeps the channel visible because the channel is already shown by its roll's notes. A pristine channel with no notes and no lanes simply doesn't render.

**Edge case**: If a user adds an empty CC lane to a totally empty channel, the channel still wouldn't render (`points.length > 0` is false for the new lane and the roll has no notes). For now this is acceptable — the only path to add a CC lane is via the "+ Add CC" button on a channel that's already rendered. We never expose Add-CC for invisible channels.

### Sticky-bottom CC band → inline CC lanes

`.mr-cc-lanes` no longer sticks to the timeline bottom. Each channel's CC lanes render directly under its roll. Vertical scroll moves everything together.

**Why**: With CCs grouped per-channel, sticky-bottom no longer makes sense — there's no single "CC band" to pin. Inlined CCs scroll naturally with their channel. Loses the always-visible CC controls feature, but the channel header (which IS sticky-left) still gives M/S access to all of a channel's audio path.

**Trade-off**: Users with many channels and tall rolls may have to scroll vertically to reach CCs at the bottom of the timeline. Acceptable — the synchronized horizontal scroll (which is the load-bearing property) is preserved.

### Capability split: new `channels` capability

The orchestrator-level concerns (the channel group, the global-solo predicate, the timeline-root `data-soloing` attribute, `useChannels` state) move to a new `channels` capability. The `tracks` and `cc-lanes` capabilities shrink to leaf-rendering responsibilities (per-track header + roll wrapper, per-lane header + plot + popover).

**Why**: Keeps each capability tight. `tracks` = "render one track's header + roll", `cc-lanes` = "render one CC lane's header + plot + the add-CC popover", `channels` = "compose channels from rolls + lanes, drive the global-solo attribute, expose `useChannels`". The alternative (delete `tracks` and `cc-lanes`, fold everything into `channels`) was rejected because it bundles unrelated render concerns into one big capability.

**Alternative considered**: Don't split — keep `tracks` and `cc-lanes` and add channel-level structure directly to `app-shell`. Rejected because `app-shell` is supposed to be region geometry, not orchestration. The channel-grouping logic deserves its own capability.

### Data model lives in `channels`, not `session-model`

The `Channel` / `PianoRollTrack` / `CCLane` types and the `useChannels` hook live in the `channels` capability. The `session-model` capability still owns `Note`, `LoopRegion`, beats-vs-ms convention, and view-window semantics — none of which change.

**Why**: `session-model` is about TIME and value units; channels are about ORGANIZATIONAL grouping. Mixing them dilutes the session-model spec.

## Risks / Trade-offs

- **Risk**: The hook replacement is wholesale (delete `useTracks`, delete `useCCLanes`, write `useChannels`). Any test or demo URL that imports the old hooks breaks. → **Mitigation**: Sweep the codebase for `useTracks` / `useCCLanes` imports as a pre-implementation task; fold the search results into the migration task list. Demo URLs (`?demo=marquee`) need a reseed pass.
- **Risk**: Spec deltas touch four capabilities (`tracks`, `cc-lanes`, `app-shell`, `session-model`) plus one new (`channels`). High blast radius for the OpenSpec review. → **Mitigation**: The deltas are surgical — most of the existing scenarios stay; we MODIFY a small set and ADD the new `channels` capability. The proposal explicitly enumerates which scenarios are superseded.
- **Risk**: Global solo with cascade is more complex than the current per-block lane-soloing. The dim selector becomes "if `data-soloing="true"` is on the timeline root AND neither this lane nor its channel is soloed, dim". → **Mitigation**: Encode the audibility check as `data-audible="true"` on each row at render time (computed once per render in `useChannels`); the CSS becomes `[data-soloing="true"] [data-audible="false"] { opacity: 0.45 }`. Cleaner than ancestor selectors.
- **Risk**: "Inline CCs scroll with channels" means a tall multi-channel session needs vertical scrolling to reach later channels' CCs. Users coming from the previous sticky-bottom design may miss it. → **Mitigation**: Document the new behavior in the change archive; the channel-level M/S is still sticky-left so the most common control (mute the whole channel) stays reachable at any scroll offset. We can revisit a sticky channel header in a future change if the loss is felt.
- **Trade-off**: The "+ Add CC" popover is a new UI primitive. We need a popover component or use a native `<dialog>` / `<select>`. → **Decision**: Use a hand-rolled positioned `<div>` anchored to the button; close on outside-click or Escape. No new dependency. Implementation detail goes in `tasks.md`.
- **Trade-off**: `kind: 'vel'` lanes still need a value series. The current seeded `ccPoints3` generator stays as the seed — we're just relabelling. → **Acceptable**: The visualization is identical; only the discriminator and label change. Future work can replace the seeded series with derived-from-notes velocity values.
