## Why

Slice 7 of `IMPLEMENTATION_PLAN.md` is "DJ mode foundation" — it bundles the lanes-mode toggle, the DJ data port, and the entire ActionRollUnit visual language (action labels in the keys column, three note-rendering modes, per-row M/S for Deck 1). The prototype models DJ mode as a global timeline-wide toggle: flip `lanesMode` and the whole timeline re-renders as a stack of per-device units. That works for screenshot capture but doesn't match how a real session is structured.

This change reframes DJ mode as a **track kind**, not a global mode. The timeline is a vertical stack of tracks; each track has a kind chosen at creation time:

- **Channel track** (today's behavior): bound to exactly one channel. Notes from that channel render in a piano roll. Param lanes attached to that channel render below the roll. M/S is per-track and per-lane.
- **DJ action track** (new): has user-configured input and output routing maps. The input map declares which incoming MIDI messages — by source channel and by pitch/CC selector — feed which slots in the track's action map. The output map declares which channel/pitch/CC each action emits to on playback. Notes render as DJ actions (action label keys column, three note-rendering modes). M/S is per-track.

Both kinds coexist in the same timeline. The same source note can appear in both views — e.g., a Ch1 pitch 48 note shows up in the Lead channel-track's piano roll AND in any dj-action-track whose input map listens to Ch1 pitch 48. Tracks are render configurations, not ownership boundaries.

There is no per-track "convert to other kind" affordance. Track kind is fixed at creation; converting would be ambiguous (channel-track → dj-action-track has no obvious routing default; the reverse drops information). Users add a new track of the desired kind instead.

This change is **Slice 7a** — the structural foundation. It establishes the dj-action-track as a renderable entity sitting in the timeline alongside the existing channel groups, ports the DJ data tables, seeds one default dj-action-track in the demo session, and renders its header (stripe + chevron + name + count + M/S chip) with a placeholder body. The action-label keys column, the three note-rendering modes, the per-row M/S for Deck 1, the input/output routing UI, and the "+ Add Track" picker are all deferred to **Slice 7b** (or later).

Storage stays split for now: channel-tracks live in the existing `state.channels` / `state.rolls` / `state.lanes` arrays (unchanged), and dj-action-tracks live in a new `state.djActionTracks` array. A polymorphic `Track` union is established at the **render layer** (the timeline iterates a derived sequence of tracks, dispatching by kind) but the underlying state is not unified in this slice. Storage unification is a follow-up if/when it pays off.

## What Changes

- New `src/data/dj.ts` module exporting:
  - `DJ_CATEGORIES: Record<CategoryId, { label: string }>` — verbatim from `dj.jsx:10-18`.
  - `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim from `dj.jsx:21-30`.
  - `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — verbatim from `dj.jsx:37-72`. Pitch keys 48..75 (28 entries).
  - `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean }`.
  - Helpers `devColor(d)`, `devShort(d)`, `devLabel(d)`, `pitchLabel(p)` — typed ports of `dj.jsx:32-34, 75-77`.
- New `dj-action-tracks` capability owning the new track kind:
  - `DJActionTrack` type: `{ id: DJTrackId; name: string; color: string; actionMap: Record<number, ActionMapEntry>; inputRouting: DJTrackRouting; outputRouting: DJTrackRouting; collapsed: boolean; muted: boolean; soloed: boolean }`. **`actionMap` is the set of actions configured on the track — not a reference to a catalog.** `DEFAULT_ACTION_MAP` (from `src/data/dj.ts`) is the future picker's catalog source; users add entries from there into a track's `actionMap`. The body renders exactly one row per configured action.
  - `DJTrackRouting` type: a stub shape with at least `{ channels: ChannelId[] }`. The full routing-selector shape (pitch ranges, CC selectors) is deferred to the routing-UI slice; 7a only commits to the field's existence and the channel list.
  - `useDJActionTracks` hook: `useState<DJActionTrack[]>` with one default seeded entry (id `dj1`, name `"DJ"`, color from `DJ_DEVICES.global.color`, `actionMap` populated with 4 demo entries from `DEFAULT_ACTION_MAP` at pitches 48/56/60/71 spanning 3 devices, `inputRouting.channels = []`, `outputRouting.channels = []`, all M/S off).
  - Per-track toggle actions: `toggleDJTrackCollapsed(id)`, `toggleDJTrackMuted(id)`, `toggleDJTrackSoloed(id)`. Each toggles the corresponding boolean. No-op for unknown ids.
  - New `<DJActionTrack>` component at `src/components/dj-action-tracks/DJActionTrack.tsx`. Header structure mirrors the existing `<Track>` and `<ChannelGroup>` headers — sticky-left zone (chevron + name + sub "{n} actions"), spacer, sticky-right zone (M/S chip). Body when expanded renders a placeholder (rows-tall empty container with a centered "Action body — Slice 7b" caption). Body when collapsed renders nothing or a placeholder collapsed-state strip.
  - `DJActionTrack.css` rules: `.mr-djtrack`, `.mr-djtrack__hdr`, `.mr-djtrack__hdr-left`, `.mr-djtrack__hdr-spacer`, `.mr-djtrack__hdr-right`, `.mr-djtrack__chev`, `.mr-djtrack__name`, `.mr-djtrack__sub`, `.mr-djtrack__body`, `.mr-djtrack__row`, `.mr-djtrack__placeholder`. Sticky zones use `var(--mr-bg-panel-2)` per the existing track-header convention. Mute dims body via `[data-muted="true"] .mr-djtrack__body { opacity: 0.4 }`.
- Extend `useStage` to expose `djActionTracks` and the three toggle actions. The `soloing` flag in `StageState` SHALL fold in dj-action-track solo (`soloing = anyChannelSoloed(channels) || djActionTracks.some(t => t.soloed)`), and the existing `data-soloing` attribute on `.mr-timeline` continues to work.
- AppShell renders the timeline as: Ruler, then `state.visibleChannels.map(<ChannelGroup>)` (unchanged), then `state.djActionTracks.map(<DJActionTrack>)` below. Track ordering is not user-configurable in this slice — channel groups always come first, dj-action-tracks always come after. A reorder UI is a future concern.
- `data-audible` semantics extend to dj-action-tracks: when any track in the session is soloed, non-soloed tracks (channels OR dj-action-tracks) carry `data-audible="false"` and dim under the existing `[data-soloing="true"] [data-audible="false"]` rule.
- New `dj-action-tracks` capability spec: data shapes (DJActionTrack, DJTrackRouting), the seed default, M/S behavior, header structure, placeholder body, and the explicit "ActionRollUnit body comes in Slice 7b" call-out.
- Modified `app-shell` capability spec:
  - Empty-regions rule extended to mention the timeline now hosts both channel groups (`channels` capability) and dj-action-tracks (`dj-action-tracks` capability).
  - Stage-region requirement updated: the timeline body hosts a vertical stack of channel groups followed by dj-action-tracks. Both kinds can be present simultaneously.
  - `data-soloing` flag combines channel/roll/lane solo AND dj-action-track solo.
- The Toolstrip is **unchanged** in this slice. The prototype's `lanesMode` global toggle is explicitly NOT introduced; per the new architecture it has no purpose. The Toolstrip stays at its Slice-6b state (single Export button).

## Capabilities

### New Capabilities

- `dj-action-tracks`: Owns the DJ action track entity — its data shape (`DJActionTrack`, `DJTrackRouting`), the default seeded track in the demo session, the per-track M/S state and toggle actions, the `<DJActionTrack>` component (header + placeholder body), and the CSS rules for `.mr-djtrack` and its children. Does NOT own the action-label keys column, the action-mode lane rows with the three note-rendering modes, the routing-configuration UI, or the per-row M/S for Deck 1 — those are Slice 7b (or routing-UI slice) concerns.

### Modified Capabilities

- `app-shell`: Empty-regions and Stage-region requirements updated to acknowledge that the timeline body hosts both `<ChannelGroup>` (per `channels`) and `<DJActionTrack>` (per `dj-action-tracks`) elements simultaneously, and that `data-soloing` combines solo state from both kinds.

## Impact

- **Code**:
  - new `src/data/dj.ts` (DJ_CATEGORIES, DJ_DEVICES, DEFAULT_ACTION_MAP, helpers, types).
  - new `src/components/dj-action-tracks/DJActionTrack.tsx` and `DJActionTrack.css`.
  - new `src/hooks/useDJActionTracks.ts` (state + toggle actions).
  - edits to `src/hooks/useStage.tsx` (compose `useDJActionTracks` into `StageState`; extend `soloing` to fold in dj-action-track solo).
  - edits to `src/components/shell/AppShell.tsx` (render `<DJActionTrack>` stack after the channel groups).
  - reuse `MSChip` from the existing `tracks` capability (no changes there).
- **Specs**: ADDED `dj-action-tracks/spec.md`. MODIFIED `app-shell/spec.md`.
- **Design docs**: edits to `design/deviations-from-prototype.md` (entry recording the architectural change — DJ mode is a track kind, not a global toggle; the prototype's `lanesMode` is dropped).
- **Out of scope** (explicitly):
  - `lanesMode` global toggle (Toolstrip Lanes group, Piano/Actions chips). Architectural pivot — DJ mode is now per-track.
  - Track kind conversion (no "convert this channel-track to dj-action-track" affordance, no reverse). Track kind is fixed at creation.
  - "+ Add Track" picker (with channel-track / dj-action-track choice). Deferred to 7b (or whenever the add-track UI is built).
  - Routing configuration UI (input map and output map editors). Deferred to a routing slice.
  - Action-label keys column (`mr-actkey` rules, ActionKeys component). Deferred to 7b.
  - Action-mode lane rows, beat ticks inside the dj-action-track body, note rendering. Deferred to 7b.
  - Three note-rendering modes (trigger / velocity-sensitive / pressure-bearing). Deferred to 7b.
  - Per-row M/S on Deck 1's keys column. Deferred to 7b.
  - Sidebar's `ActionMapPanel`. Deferred to 7b or later.
  - Inspector "Action" tab. Deferred to 7b or later.
  - Map note editor. Slice 8.
  - DJ-flavored CC streams in param-lanes (Crossfader / EQ Low · A / Jog · A) inside the channel-tracks. Deferred — those streams now belong inside dj-action-tracks via routing, not as global timeline lanes.
  - Marquee selection across track kinds. Marquee stays piano-mode-only; cross-kind selection is a follow-up.
  - Storage unification (collapsing `state.rolls` + `state.djActionTracks` into a single `state.tracks: Track[]`). Deferred — render-layer polymorphism is sufficient for 7a.
  - Track reordering UI (drag-to-reorder). Deferred — channel groups always come before dj-action-tracks in 7a.
- **Dependencies**: builds on the existing `useStage` Context provider (Slice 6b) and the channels/tracks/param-lanes capabilities (unchanged in this slice).
- **Risk**: low. The new `<DJActionTrack>` is appended to the timeline; existing channel-group rendering is not touched. The `soloing` flag's expansion to fold in dj-action-track solo is mechanical. Biggest risk is the data-shape decision for `DJTrackRouting` — keeping it intentionally minimal in 7a (just `{ channels: ChannelId[] }`) avoids over-committing to a routing model before the routing-UI slice clarifies what's actually needed.
