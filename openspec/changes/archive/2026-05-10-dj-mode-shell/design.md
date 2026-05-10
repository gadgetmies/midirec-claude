## Context

The prototype models DJ mode as a global timeline-wide toggle (`lanesMode: 'piano' | 'actions'`): flip it and the entire timeline re-renders as a stack of per-device units. That works for screenshot capture but doesn't compose with the rest of the architecture — channels are real entities, the recording pipeline writes notes to channels, and a session might want to view some channels as piano rolls AND aggregate some of them as a DJ controller surface at the same time. A global toggle forces the user to switch contexts to see one or the other; never both.

This change reframes DJ mode as a **track kind**. The timeline becomes a vertical stack of tracks, each with a kind chosen at creation:

- `'channel'` — bound to one channel, displayed as a piano roll. This is what every track is today.
- `'dj-action'` — has user-configured input/output routing maps, displayed as DJ actions. New in this slice.

Both kinds coexist in the same timeline. Channel-tracks render exactly as today (the existing `<ChannelGroup>` is unchanged). DJ action tracks are a new top-level renderable that sits below the channel groups in the timeline.

Three upstream realities shape the slice:

1. **Channels are not tracks.** The current data model has `state.channels[]` (a registry of MIDI channels 1..16, with name/color/id), `state.rolls[]` (one piano-roll-track per channel, bound via `channelId`), and `state.lanes[]` (param lanes per channel). The "track" today is the piano-roll-track. Adding a second track kind that doesn't bind 1:1 with a channel doesn't break that model — it just adds a sibling renderable.

2. **Routing is the new contract surface.** A dj-action-track has explicit input and output mappings. Input: which incoming MIDI messages (by source channel + pitch/CC selector) feed which slots in the track's action map. Output: which channel/pitch/CC each action emits when played back. The shape of these maps is a substantial design surface that 7a deliberately defers — for 7a, the routing fields exist on the type but are stubs (`{ channels: ChannelId[] }` only).

3. **Slice 7b owns the action-rendering visuals.** ActionKeys (action-label keys column), the three note-rendering modes (trigger / velocity-sensitive / pressure-bearing), per-row M/S for Deck 1, and the body's lane rows + ticks + notes are all 7b's job. 7a is the structural shell — the data shape, the seeded default, and the header + placeholder body.

## Goals / Non-Goals

**Goals:**

- Establish the dj-action-track as a first-class entity in the data model, alongside channels and channel-tracks.
- Port the DJ data tables (categories, devices, default action map, helpers) verbatim with TypeScript types into `src/data/dj.ts`.
- Render dj-action-tracks in the timeline with the existing track-header chrome (sticky-zoned left/right, chevron + label + sub on the left, M/S chip on the right) and a placeholder body. The shell should look at-home next to channel groups even with no action-rendering visuals yet.
- Wire dj-action-track M/S into the global `data-soloing` flag so dimming behaves correctly across track kinds.
- Keep channel-track rendering 100% unchanged — no regressions in piano mode behavior.

**Non-Goals:**

- The prototype's `lanesMode` global toggle. (Removed by this architectural pivot. Toolstrip stays at just the Export button.)
- Track kind conversion. (Track kind is fixed at creation; users add a new track of the desired kind.)
- "+ Add Track" picker UI. (Deferred to 7b. In 7a, dj-action-tracks exist via the seeded default only.)
- Routing configuration UI. (Deferred to a routing-UI slice.)
- ActionKeys, action-mode lane rows, the three note-rendering modes, per-row M/S for Deck 1. (All Slice 7b.)
- Sidebar `ActionMapPanel`, Inspector Action tab. (7b or later.)
- Map note editor. (Slice 8.)
- Storage unification (`state.rolls` + `state.djActionTracks` → single `state.tracks: Track[]`). (Render-layer polymorphism is enough for now.)
- Track reordering UI.

## Decisions

### Decision 1: Track kind is fixed at creation, no conversion

**Considered:** Per-track "Convert to DJ Action / Channel" affordance in the track header menu.

**Chose:** No conversion path. Users add a new track of the desired kind and remove the old one if they want to swap.

**Why:** Conversion is ambiguous in both directions. Channel-track → dj-action-track has no obvious routing default — should the new track listen to the original channel? All channels? Inherit nothing? The reverse drops the routing maps entirely; if the user converts and then converts back, their routing config is gone. Either branch ships a UX that requires the user to redo work.

The simpler model — "create the kind you want" — sidesteps the ambiguity. Channel-tracks already exist for every recorded channel; dj-action-tracks are a deliberate addition. Users are unlikely to want to convert; if they do, they recreate.

### Decision 2: Storage stays split; polymorphism is at the render layer

**Considered:** Collapse `state.rolls` and the new `state.djActionTracks` into a single discriminated `state.tracks: Track[]` array, with `kind: 'channel' | 'dj-action'` distinguishing.

**Chose:** Keep `state.rolls` (channel-tracks, owned by the existing `tracks` capability) and `state.djActionTracks` (new) as separate arrays. Polymorphism is established at the render layer: the timeline derives a render sequence (channel groups first, then dj-action-tracks) and dispatches by kind.

**Why:** Storage unification is a substantial refactor — it touches `useChannels`, `useStage`, every consumer of `state.rolls`, every test, and the `tracks` capability spec. The unification doesn't pay off until something actually iterates "all tracks regardless of kind" as a primary operation. For 7a (and likely 7b), the timeline iterates them in a fixed order; storage staying split is fine.

If a future slice introduces "drag to reorder a track across kinds" or "tracks have shared properties that need to live in one place," storage unification becomes the right move. We'll do it then. For now, the type-level `Track` union exists as a render-layer concept, not a storage commitment.

### Decision 3: One default seeded dj-action-track with a 4-action demo subset

**Considered:** Zero seeded dj-action-tracks (the user has to add one via "+ Add Track"). One seeded track with the full `DEFAULT_ACTION_MAP` (28 actions). Multiple seeded tracks one per device — Deck 1, Deck 2, FX 1, FX 2, Mixer, Global — like the prototype's screenshot 06.

**Chose:** Exactly one seeded track named "DJ", with a 4-action demo subset of `DEFAULT_ACTION_MAP` (pitches 48 / 56 / 60 / 71 — spanning 3 devices and 4 categories).

**Why:** A track's `actionMap` is the set of actions ACTIVELY CONFIGURED on the track (not a catalog of all possible actions — that's `DEFAULT_ACTION_MAP` in `src/data/dj.ts`, used by the future picker UI). Body row count = number of configured actions. Seeding the whole `DEFAULT_ACTION_MAP` (28 entries) into one track would imply "every possible action is configured here" which isn't the right default. Seeding empty would render a body with zero rows — visually broken until the routing-add UI lands. The 4-entry subset gives the shell visible rows to demo against (Play on Deck 1, Hot Cue 1 on Deck 1 with pad/pressure flags, FX 1 On, Crossfade ◀ on Mixer) spanning enough devices and categories that Slice 7b's per-action rendering has visual diversity to test.

Empty `actionMap` is still a valid state — future tracks created via the routing/add-action UI MAY start empty and accumulate actions as the user configures routing.

### Decision 4: Routing types are stubs in 7a

**Considered:** Define the full routing-selector shape now (`{ channels: ChannelId[]; pitchRanges: PitchRange[]; ccSelectors: CCSelector[] }` etc.).

**Chose:** Minimal stub — `DJTrackRouting = { channels: ChannelId[] }`. Both `inputRouting` and `outputRouting` use the same minimal shape.

**Why:** The full routing shape is a substantial design decision: do users select pitch ranges or individual pitches? Per channel, or globally? Are CC selectors a separate field or part of the same routing? Each option ripples into the routing UI. Designing it now without a UI is over-committing — the spec would lock in choices the UI hasn't validated. The minimal `{ channels: ChannelId[] }` is enough to (a) demonstrate the field exists, (b) seed an empty routing in the default track, (c) let 7b extend the shape when the routing UI lands.

### Decision 5: Channel groups always render first, dj-action-tracks below

**Considered:** Interleaved order driven by a per-track `position` field, like a DAW's track list.

**Chose:** Fixed order — channel groups first, dj-action-tracks below.

**Why:** Per-track positioning requires (a) a position field on every track entity, (b) a way for the user to set/change it (drag-to-reorder UI), (c) tie-breaking logic when positions collide. None of those exist today. Fixed order is the cheapest thing that ships. When the user actually wants reordering, that's a separate slice with a clear motivation.

### Decision 6: Toolstrip is unchanged in 7a

**Considered:** Keep the Lanes toggle and use it as a "filter" — show only channel-tracks, only dj-action-tracks, or both. Add a "+ Add Track" button to the toolstrip.

**Chose:** Toolstrip is unchanged. Just the Slice-6b Export button.

**Why:** Filtering by track kind is a feature without a clear use case — a user who has both kinds in their session wants to see both. "+ Add Track" is the right toolstrip control eventually, but it needs the picker UI and the channel-track / dj-action-track creation paths, which are 7b's job. Adding a placeholder button now is just visual noise.

## Real-time correctness

The dj-action-tracks capability introduces the heaviest visual surface in the codebase to date — and Slice 7b will make it heavier still by adding per-action-event painting (trigger / velocity-sensitive / pressure-bearing notes with inner SVG bar graphs). That makes this slice the right place to call out the cross-cutting non-functional constraint documented in `design/real-time-correctness.md`:

**The MIDI Recorder is a real-time system. UI rendering load SHALL NOT interfere with MIDI message timing.** Specifically: no dropped messages, no late playback emits, no timestamp offsets caused by React render cycles. Capture timestamps come from two MIDI-native sources — the per-message driver timestamp (`MIDIMessageEvent.timeStamp`) for fine-grained ordering and the MIDI Clock (0xF8) stream for musical-time positioning. `Date.now()` / `performance.now()` measured inside a React event handler are NOT acceptable timestamp sources. Playback emits run on the audio engine's clock, not on React's commit cycle. Per-message `setState` is forbidden — capture writes to a buffer; the UI batches reads.

The audio engine that actually delivers these guarantees is Slice 10. This slice — and every visual-only slice between now and Slice 10 — must avoid implementation patterns that foreclose the audio engine's eventual architecture. For dj-action-tracks specifically, that means: `useDJActionTracks` is a React state hook for slow-changing track config (name, color, M/S, routing); it is NOT a MIDI capture surface. The `<DJActionTrack>` component renders track config; it is NOT where incoming MIDI events get processed. When 7b adds per-action-event rendering, the events will come from a separate fast-update channel (refs, external store, or a dedicated subscriber) — not from `setState` on `useStage`.

If a future implementation step in this slice or 7b feels like it wants to wire `<DJActionTrack>` directly to `MIDIMessageEvent`, stop and re-read `design/real-time-correctness.md`.

## Risks / Trade-offs

- **Mute/solo state crosses track kinds.** The `data-soloing` flag is true if any track of any kind is soloed; non-soloed tracks (regardless of kind) dim. Switching the focus from channel-tracks to dj-action-tracks doesn't reset solo state — if the user solos a channel-track and then adds a dj-action-track, the dj-action-track dims. Same convention as today; documenting it explicitly.
- **The prototype's screenshot 06 won't match 7a.** Screenshot 06 shows the global lanesMode-actions view with six unit groups, no channel groups visible. 7a's timeline shows channel groups + one dj-action-track. The prototype is now a stale reference for the DJ-mode demo; future screenshots will reflect the per-track model. Recorded in the deviations doc.
- **Routing types are stubs.** Files importing `DJTrackRouting` will need to extend the shape when the routing-UI slice lands. We'll mark the type with a `// TODO(routing-ui-slice): expand` comment so it's grep-able and obvious.
- **The dj-action-track header reuses the channel-track header chrome.** Visually, a dj-action-track header looks similar to a channel-group header (sticky zones, chevron, name, M/S). That's fine for 7a — the body is what makes them visually distinct, and 7b adds the body content. If the visual similarity becomes confusing, a per-kind glyph or color treatment can be added later.
- **No "+ Add Track" UI in 7a.** Without an add path, the user can't actually create a second dj-action-track in 7a. The seeded default is the only one. That's intentional — 7a is the foundation; 7b adds the creation UI.

## Migration Plan

None required. Channel-track rendering is unchanged. The default session gains one new dj-action-track at the bottom of the timeline; existing tests and consumers of `useStage` are unaffected unless they grep for "all tracks" or call into `data-soloing`. The new `djActionTracks` field initializes to a one-element array at app start; existing tests that snapshot `useStage()` may need updating, but no behavior regresses.

## Open Questions

- **Should the dj-action-track sit below the channels or above?** Today's plan puts it below. The prototype's screenshot 06 puts unit groups in the central timeline (no channels visible because lanesMode hides them). Either order works; below is the cheap default and matches the "channels first, alternative views below" mental model. If user testing prefers above, the order is a one-line render change.
- **Color of the default dj-action-track.** Channel-tracks use channel-derived colors. The default dj-action-track has no channel binding, so it needs a chosen color. Options: accent (`var(--mr-accent)`), a neutral panel color, or one of the device colors from `DJ_DEVICES.global` ("warm neutral"). We'll go with `DJ_DEVICES.global.color` since it's already in the data table and reads as "DJ-themed" without being any one device. Recorded as a default that's not load-bearing; future routing UI can let users change it.
