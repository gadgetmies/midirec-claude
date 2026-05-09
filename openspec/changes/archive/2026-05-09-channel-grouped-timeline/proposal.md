## Why

The current timeline treats `tracks` (notes) and `cc-lanes` (CC streams) as siblings under the timeline, with no shared organizational unit. This is wrong for MIDI: CCs are channel-scoped (mod wheel on ch.1 is independent from mod wheel on ch.2), and the prototype-driven model has no way to express that. It also forces three structural workarounds we've already paid for — sticky-bottom CC band, lane-scoped solo, free-form `cc` strings (incl. `"VEL"` for per-note velocity, which isn't a CC at all). Promoting **channel** to the organizational unit collapses all three into one consistent grouping and matches how MIDI actually works.

## What Changes

- **BREAKING**: Introduce `Channel` as the organizational unit owning one piano-roll track + N CC lanes. The timeline renders `.mr-channel` groups directly; `.mr-multi-track-stage` and the standalone `.mr-cc-lanes` block at the bottom go away.
- **BREAKING**: `Track` (renamed `PianoRollTrack` in the type system, still rendered via the `tracks` capability) now lives under a channel and no longer carries `channel` as a free-form string — it carries `channelId: 1..16` matching its parent.
- **BREAKING**: `CCLane` gains `channelId` and replaces the free-form `cc: string` with `kind: 'cc' | 'pb' | 'at' | 'vel'` plus optional `cc?: number` (0–127, only when `kind === 'cc'`). The seeded `cc3 = "Velocity"` becomes `kind: 'vel'` with display name **"Note Velocity"** and no "CC" prefix.
- **BREAKING**: M/S and `collapsed` flags exist at three levels — channel, roll, lane — each independent (channel M/S does NOT aggregate over its children).
- **BREAKING**: Solo becomes session-global. `data-soloing` moves from `.mr-cc-lanes` to a timeline-root attribute. A roll/lane is "audible" if its own `soloed` OR its channel's `soloed`. Otherwise, when any solo is active anywhere, it dims.
- **BREAKING**: `useTracks` and `useCCLanes` hooks are replaced wholesale by a single `useChannels` (or `useSession`) hook returning `{ channels, rolls, lanes, toggle*, addCCLane }`. No back-compat shims.
- Channels render iff their roll has `notes.length > 0` OR any of their CC lanes has `points.length > 0`. Empty channels drop out automatically. Adding a (initially empty) CC lane to a channel that already has notes keeps the channel rendered.
- Each channel gets a **`+ Add CC`** affordance (a thin row at the end of its CC lanes) opening a popover with standard MIDI CC names + a custom `CC#` input. Selecting one inserts a new `CCLane` under the channel with empty `points`.
- Each CC lane is collapsible via a chevron in its header. Collapsed = only the header strip (~`var(--mr-h-row)`) renders; the plot is hidden.
- Sticky-bottom on `.mr-cc-lanes` is removed. CC lanes render inline beneath their channel's piano roll. The whole timeline becomes one continuous vertical scroll. The single shared horizontal scroll axis on `.mr-timeline` is preserved.

## Capabilities

### New Capabilities

- `channels`: Owns the `Channel` data type, the `useChannels` hook, the `<ChannelGroup>` orchestrator that renders one channel's roll + CC lanes + add affordance, the global-solo predicate that drives `data-soloing` on the timeline root, and the content-derived visibility rule.

### Modified Capabilities

- `tracks`: `Track` becomes `PianoRollTrack` keyed by `channelId`; the multi-track stage orchestrator goes away (its job moves into `channels`). `tracks` keeps responsibility for the per-track header (chevron, name, M/S) and the `.mr-track__roll` shell wrapping `<PianoRoll>`. The `Stage hosts the MultiTrackStage orchestrator` requirement is removed.
- `cc-lanes`: `CCLane` gains `channelId` + `kind` (`'cc' | 'pb' | 'at' | 'vel'`); `cc` becomes optional `number`. The block-level `<CCLanesBlock>` orchestrator (and its global `data-soloing` attribute) is removed — channels own the block now. `useCCLanes` is removed; lane state lives in `useChannels`. The `cc-lanes` capability keeps responsibility for rendering one `<CCLane>` (header + plot + M/S + collapse), plus the new `<AddCCLanePopover>` picker.
- `app-shell`: The timeline body hosts `.mr-channel` elements directly under `.mr-timeline__inner` between the Ruler and the timeline's lower bound. The "CC Lanes block sticks to the bottom of the timeline" scenario is removed. The timeline-root carries the global `data-soloing` attribute instead of `.mr-cc-lanes`. Browser scrollbars are hidden on `.mr-timeline` so no reserved-track gap appears at the right/bottom edge.

(`session-model` is NOT modified — it scopes time/value units and view-window semantics, none of which change. Seed data shape is owned by `useChannels` in the `channels` capability.)

## Impact

- **Code**: `src/hooks/useTracks.ts` and `src/hooks/useCCLanes.ts` deleted; new `src/hooks/useChannels.ts` (or `useSession.ts`) introduced. `MultiTrackStage` deleted; `CCLanesBlock` deleted (lifted into a new `ChannelGroup`). `AppShell.tsx` swaps the two block children for a `channels.map(<ChannelGroup>)`. New `ChannelGroup` component + `AddCCLanePopover` component. `Track` and `CCLane` components stay, lose their orchestrator-level concerns, gain `collapsed` handling.
- **CSS**: `.mr-multi-track-stage` rules deleted; `.mr-channel` + `.mr-channel__hdr` added; the `.mr-cc-lanes` sticky-bottom rule and lane-scoped `data-soloing` selectors are dropped; new global `.mr-timeline[data-soloing="true"]` selectors replace them.
- **Specs**: New `specs/channels/spec.md`. Modified `specs/tracks/spec.md`, `specs/cc-lanes/spec.md`, `specs/app-shell/spec.md`.
- **Demo URLs**: Existing `?demo=*` URLs that depended on the old hook shapes need reseeding to the new model (or removal).
- **Supersedes**: The just-archived `synchronized-timeline-scroll` change's "CC Lanes block sticks to the bottom of the timeline" scenario. The horizontal-scroll-axis half of that change stays.
- **Out of scope**: User-editable picker list, channel reorder/rename, M/S aggregation child→parent, playback wiring for muted/soloed, back-compat shims for the old hooks.
