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

### Timeline header hover backgrounds bleed playhead through (sub-100% color-mix)

**Why**: Every timeline header (`.mr-channel__hdr`, `.mr-track__hdr`, `.mr-param-lane__hdr`, `.mr-djtrack__hdr`) uses a `:hover` rule of the form `background: color-mix(in oklab, var(--mr-bg-panel[-2]) 80%, var(--mr-text-1) 4%)` whose two percentages sum to 84% (or 85% in `.mr-channel__hdr`, 78% in one `ChannelGroup.css` rule at line 192). Per CSS Color 5 spec, when `color-mix` percentages don't sum to 100% the result's alpha is multiplied by `(p1 + p2) / 100` — so the hover state is rendered at ~84% opacity. On hover, the playhead's `1px` vertical bar and its 9×9px diamond cap (z=5 inside the lanes, but capped by the lanes' `z-index: 0`) become visible THROUGH the header background. The same bleed-through affects any other content the header is supposed to occlude (collapsed track bodies, lane fills at scroll boundaries). The hover should change the COLOR only, not the opacity.

**Scope**:

- Audit the 6 affected rules across:
  - `src/components/channels/ChannelGroup.css` (3 occurrences — lines 28, 157, 192).
  - `src/components/dj-action-tracks/DJActionTrack.css` (line 30).
  - `src/components/param-lanes/ParamLane.css` (line 59).
  - `src/components/tracks/Track.css` (line 53).
- For each, change the two percentages so they sum to exactly `100`. Two equivalent options — pick one consistently:
  - **Option A (recommended)**: keep the tint constant by scaling each percentage proportionally. E.g. `80% + 4%` → `96% + 4%` (tint preserved, alpha 100%). `80% + 5%` → `95% + 5%`. `70% + 8%` → `92% + 8%`.
  - **Option B**: keep the absolute tint-color amount and increase the panel side. Mathematically the same as A — listed only to clarify the design intent.
- Verify no other `:hover` or stateful rule on these elements re-introduces sub-100% mixing.

**Verification**:

- Hover any timeline header at a horizontal scroll position where the playhead crosses the header's hit region (e.g. scrub the playhead to beat 4, hover the channel header above it). The playhead's vertical line and diamond cap SHALL NOT be visible through the hover-tinted header.
- Toggle `data-soloing` (solo any track) and hover the dimmed header. The non-hover and hover states SHALL have identical opacity; only the hue SHALL change.
- `grep -E "color-mix\(.*%, .*%\)" src/components/*/*.css | awk -F'[%,]' '{print $0}' | <check sum is 100>` (or eyeball) → all hits sum to 100%.
- `yarn typecheck` clean (no source changes; CSS-only).

**Estimated effort**: 15–30 minutes. Six one-line CSS edits plus a manual hover-check pass.

**Status**: pending. Surfaced during the `dj-action-track-playback` playhead-layering work — the playhead bleed-through under hover was visible after the playhead landed in the DJ track and is reproducible on every timeline header today.

### Scope selection-blur to inside the timeline; cross-track blur on row-click

**Why**: The current outside-click blur for DJ selections (`useStage.tsx:138–150`) is window-scoped: any `pointerdown` outside `.mr-djtrack` and outside an opted-in `[data-mr-dj-selection-region]` element clears both `djActionSelection` and `djEventSelection`. That includes clicks on the Toolstrip, the Statusbar, the Sidebar panels that aren't marked as a selection region, the app-shell background, and any future side panel that forgets the data attribute — every one of those dismisses the Inspector's Output/Pressure panels mid-edit. The desired model: the Inspector, Sidebar, and other chrome are SURFACES FOR the current selection, so clicking into them must keep selection alive; only clicks INSIDE `.mr-timeline` itself (but outside the row/event that already represents the selection) should change or clear it. The same scoping applies in advance to channel-roll note selection and param-lane CC-point selection — both are coming online in upcoming slices and will hit the same trap if the blur scope is window-wide.

Separately, `<ActionKeys>` row-click (`ActionKeys.tsx:54-59`) sets `djActionSelection` for the clicked row but does not touch `djEventSelection`. When the user has clicked a `.mr-djtrack__note` on track A (setting `djEventSelection = { trackId: 'A', ... }`) and then clicks an `.mr-actkey` on track B, the row selection moves to B while the event selection on A is left dangling — the Inspector's pressure editor keeps showing A's event. Row-click is fundamentally a row-level (re-)target action and should clear any event selection that doesn't belong to the same row on the same track.

**Scope**:

- **Invert the blur predicate**: change `useStage.tsx`'s window listener to fire `setDJActionSelection(null)` + `setDJEventSelection(null)` ONLY when the `pointerdown` target is *inside `.mr-timeline`* AND outside both `.mr-djtrack` and `[data-mr-dj-selection-region]`. Clicks outside `.mr-timeline` are a no-op — the Inspector, Sidebar, Toolstrip, and Statusbar can all be interacted with without losing selection. The `[data-mr-dj-selection-region]` opt-in remains useful for in-timeline regions that should preserve selection (none today, but the affordance stays for future panels embedded in the timeline body).
- **Cross-track row blur**: in `ActionKeys.tsx`'s row-click handler, after `setDJActionSelection({ trackId, pitch })` also call `setDJEventSelection(null)` UNLESS the current `djEventSelection` already matches `{ trackId, pitch }` (i.e. the event lives on the row being re-selected). Same edit for the `Enter`/`Space` keyboard activation path.
- **Apply the same blur scoping to future selections**: when channel-roll note selection (currently demo-driven via `selectedIdx` in `useStage.tsx:186`) and param-lane CC-point selection land as real user interactions, their outside-click clearers SHALL use the same "only inside `.mr-timeline`" predicate. Add a shared helper (e.g. `useTimelineBlur(setters: Array<() => void>)`) so all three selection systems share the predicate.
- Audit any other selection-clearing call sites (`deleteActionEntry`, `deleteOutputMapping`, transport mode changes, file load, etc.) for consistency — those legitimately clear selection regardless of click target and should remain unchanged.

**Verification**:

- With `djActionSelection !== null`, click anywhere in the Inspector (outside `[data-mr-dj-selection-region]`), the Sidebar's non-marked panels, the Toolstrip, or the Statusbar. The selection SHALL persist; the Output/Pressure panels SHALL stay rendered.
- With `djActionSelection !== null`, click on the ruler band or an empty area inside `.mr-timeline` that is neither a `.mr-djtrack` nor a `[data-mr-dj-selection-region]`. The selection SHALL clear; the side panels SHALL collapse.
- Set `djEventSelection` by clicking a `.mr-djtrack__note` on track A. Then click an `.mr-actkey` on a different track B. The next render SHALL have `djActionSelection = { trackId: 'B', pitch }` AND `djEventSelection === null`. The Inspector pressure editor SHALL no longer show A's event.
- Clicking an `.mr-actkey` on the SAME row that owns the current `djEventSelection` (rare but possible) SHALL NOT clear `djEventSelection` — the event is logically part of the row, so re-selecting the row is idempotent for the event.
- `yarn typecheck` clean; `yarn test` clean (update the existing scenarios in `dj-action-tracks/spec.md` covering "Outside-click blurs the selection" to require the new predicate, and add a scenario for cross-track row blur).

**Spec deltas**: `dj-action-tracks` — MODIFY the "Outside-click blurs the selection" and "Clicking outside the DJ track blurs djEventSelection" requirements to specify the inside-`.mr-timeline` predicate; ADD a scenario to "Clicking an action row selects it" covering cross-track event-selection blur. Likely warrants escalation to an OpenSpec change when picked up.

**Estimated effort**: 1–2 hours. The blur predicate rewrite is ~10 LOC; the row-click cross-clear is ~5 LOC; the bulk is spec deltas + scenario coverage + manual UI verification across the four chrome surfaces.

**Status**: pending. Surfaced during DJ playback testing — Inspector dismissal on every side-panel click made it impractical to inspect and adjust an event mid-playback. Cross-track row blur surfaced in the same session when the Inspector kept showing a stale event after re-selecting an action row on a different track (today: only one DJ track in the seed, so this is preventative for when multi-track sessions ship).

### Drop the Routing panel; move I/O config to per-track inline (with CC# remap)

**Why**: The Sidebar's "Routing" panel (`Sidebar.tsx:145–147`, `RoutingMatrix` component at line 56) renders a global channel×output-device matrix that's decorative today. The DJ-action-track playback work already moved away from the matrix model — DJ tracks emit on `track.midiChannel` directly, with `outputMap[pitch]` as a per-row override. The instrument-track (channel-roll) side should follow the same model: routing belongs to the track, not to a separate top-level panel. A global matrix forces the user to think in cross-product terms (channel × output) when the natural mental model is "this track sends to this device on this channel." It also creates a brittle UI as device counts grow (a 16-channel session × 4 outputs = 64 cells of decorative chrome). Drop the panel; configure I/O on a selected track instead. Same opportunity: expose CC-number remapping on output so a captured CC (e.g. CC 1 mod wheel from the input device) can be re-emitted as a different CC# (e.g. CC 74 cutoff on the output synth) — today's "CC and pitch-bend capture during recording" backlog entry only covers capture, not output-side remap.

**Scope**:

- **Drop the Routing panel**:
  - Remove `<Panel icon={<RouteIcon />} title="Routing">` and its `<RoutingMatrix>` body from `src/components/sidebar/Sidebar.tsx`.
  - Delete the `RoutingMatrix` and `RoutingRow` components (in the same file or wherever they live).
  - Remove `.mr-routing*` CSS rules from `src/components/sidebar/Sidebar.css`.
  - Audit `RouteIcon` usage — if unused elsewhere, drop from `src/components/icons/transport.tsx`.
  - Remove any `useRouting`-style hook or `routing` slice of `useStage` that exists solely to back the matrix. If a routing capability spec exists (check `openspec/specs/`), REMOVE it.
- **Track selection UX for channel-rolls**:
  - Clicking a `.mr-channel__hdr` or `.mr-track__hdr` (the instrument track's header, not the body) SHALL set a new `selectedTrack: { kind: 'channel', channelId } | { kind: 'dj', trackId } | null` state in `useStage`. Today `selectedChannelId` is demo-only; this slice promotes it to a real user-driven selection with cross-kind support so the same Inspector tab can target both instrument and DJ tracks.
  - The selected track's header SHALL carry `data-selected="true"` so CSS can render a subtle accent border (consistent with `.mr-actkey[data-selected]` and `.mr-djtrack__note[data-selected]`).
  - Outside-click blur for `selectedTrack` SHALL use the in-timeline predicate from the preceding "Scope selection-blur" backlog entry — clicks in the Inspector / Sidebar / Toolstrip don't drop the selection.
- **Per-track I/O config UI (Inspector panel)**:
  - When `selectedTrack.kind === 'channel'`, the Inspector renders an "I/O" section with four controls:
    - **Input device** picker (dropdown of `useMidiInputs().inputs`).
    - **Input channel** (1..16 or "Omni"). Notes arriving on this channel byte from the chosen input device are routed to this track during recording.
    - **Output device** picker (dropdown of `useMidiOutputs().outputs`).
    - **Output channel** (1..16). Notes/CCs/PB from this track emit on this channel byte.
  - When `selectedTrack.kind === 'dj'`, the same section shows the DJ track's `midiChannel` (with an output-channel picker — already implied by the `dj-action-track-playback` spec but no editor exists yet).
  - The Inspector section SHALL carry `data-mr-selection-region="true"` (the new generalized attribute; rename from `data-mr-dj-selection-region` in the scope-blur slice) so clicks inside don't blur the track selection.
- **Channels capability data shape**:
  - Add `inputDeviceId: string | null`, `inputChannel: number | 'omni'`, `outputDeviceId: string | null`, `outputChannel: number` to `Channel`. Defaults: `inputDeviceId/outputDeviceId = null` (track uses the session-wide first device, mirroring today's behavior); `inputChannel = 'omni'`; `outputChannel = channel.id` (preserve today's "channel id is channel byte" identity behavior).
  - Setters: `setChannelInputDevice(id, deviceId)`, `setChannelInputChannel(id, ch)`, `setChannelOutputDevice(id, deviceId)`, `setChannelOutputChannel(id, ch)`. No-op for unknown ids.
- **Recording side — input device + channel filter**:
  - `useMidiRecorder` SHALL respect each channel's `inputDeviceId` + `inputChannel` config: a note arrives → look up the channel(s) whose `inputDeviceId === <source>` AND (`inputChannel === 'omni'` OR `inputChannel === <msg channel byte + 1>`). Append the note to all matching channels.
  - When no channel matches, the note is silently dropped (no auto-channel-creation in this slice; that's the existing "Multi-channel record routing" entry's job). This part is mostly forward-compat; today's single-channel recording still works because the demo seed has one channel set to omni.
- **Playback side — output device + channel resolution**:
  - The scheduler's `ChannelSnapshot` shape gains `outputDeviceId: string | null` and `outputChannel: number`. `useMidiScheduler` resolves the output: if `outputDeviceId !== null` AND that MIDI output is present at play-time, dispatch goes to that output on `outputChannel`. Else fall back to `useMidiOutputs().outputs[0]` (today's behavior).
  - `channelByte` in `resolveChannelEmit` switches from `(ch.id - 1) & 0x0F` to `(ch.outputChannel - 1) & 0x0F`.
  - The `activeNoteOns` key already includes `outputId`, so multi-output sessions panic correctly.
- **CC# output remap**:
  - Add a `ccOutputMap: Record<number, number>` field per `Channel` — keys are input CC numbers, values are output CC numbers. Empty by default = identity passthrough.
  - When the CC-capture slice ("CC and pitch-bend capture during recording" backlog entry) lands, captured CC lane points carry the INPUT CC number (e.g. `kind: 'cc-1'`). On playback emit, the scheduler SHALL look up `ccOutputMap[inputCC] ?? inputCC` and emit the resulting CC# in the `0xB0 | channelByte, ccNumber, value` message.
  - The Inspector's I/O section SHALL list each active CC lane on the channel with an inline "→ CC#" input box. Editing it calls `setChannelCCRemap(channelId, inputCC, outputCC)`.
  - For DJ pressure-bearing rows: the same affordance applies via `outputMap[pitch].cc?` (a new optional field) — DJ rows can choose to emit pressure as a CC instead of channel-aftertouch when they target a synth that uses CC for the same expression knob.
- **Statusbar I/O picker cleanup**: the global I/O picker in the Statusbar (per the existing "Pickers for MIDI input and clock source" backlog entry) becomes the *default device* for new channels, not a global routing override. Tracks always win via their per-track config.

**Verification**:

- Routing panel is gone from the Sidebar — no "Routing" panel title, no matrix, no related CSS rules in DevTools.
- Click a channel header → header carries `data-selected="true"`; the Inspector's I/O section appears with the channel's defaults.
- Change the channel's input device to "Device A" + input channel to 5 → notes arriving on Device A channel 5 land in this channel; notes on other devices/channels do not.
- Change the channel's output device to "Device B" + output channel to 10 → playback emits on Device B's MIDI channel byte 9. Stop → All Notes Off fires on Device B channel byte 9.
- Two channels routed to the same output but different channels → both emit independently, no cross-talk.
- Remap CC 1 → CC 74 on a channel; record while moving the input mod wheel → the channel's lane shows `cc-1`; play back → output emits CC#74 (not CC#1).
- `yarn typecheck` clean; `yarn test` clean.

**Spec deltas (likely OpenSpec proposal)**:

- `channels`: ADD four I/O config fields per `Channel` + setters + a `ccOutputMap` field + setters. Modify the existing requirement "Channel state shape" to include these fields.
- `midi-playback`: MODIFY "Tempo and output are snapshotted at play time" to also snapshot per-channel `outputDeviceId`/`outputChannel`; MODIFY the channel-roll dispatch requirement to use `(ch.outputChannel - 1) & 0x0F` for the channel byte and resolve the output via `ch.outputDeviceId ?? outputSnapshot`.
- `inspector`: ADD a "Track I/O" panel requirement covering the four pickers + CC-remap list. Wire it to the new `selectedTrack` state.
- `sidebar`: REMOVE the Routing panel requirements; REMOVE any `routing` capability spec entirely.
- `midi-recording`: MODIFY the recording requirements to respect per-channel `inputDeviceId`/`inputChannel` instead of `selectedChannelId`.
- `dj-action-tracks`: MODIFY `DJActionTrack` data shape to include the same `inputDeviceId`/`outputDeviceId` fields (DJ tracks already have `midiChannel`; this extends them with device routing). Optionally extend `OutputMapping` with `cc?: number` for the DJ-side CC remap.

**Supersedes**: "Per-channel output routing in playback (Routing matrix becomes live)" (further down in this backlog) — that entry assumed the matrix would become live; this entry deletes the matrix instead. Also reshapes: "Pickers for MIDI input and clock source" (the Statusbar pickers become per-track defaults), "Input mapping rules — device + MIDI channel → internal channel" (the rules now live in per-channel config instead of a separate panel), "CC and pitch-bend capture during recording" (gains the output-side remap path).

**Dependencies**: "Web MIDI access" — done. "Play back channel notes" / "DJ action track playback" — done. Pairs naturally with "Multi-channel record routing by incoming MIDI channel byte" (use the per-channel input config for routing) and "CC and pitch-bend capture during recording" (use the per-channel `ccOutputMap` on the emit side).

**Estimated effort**: 1.5–2 days. Removing the Routing panel is ~1 hour. The per-track Inspector section + four channel fields + setters is ~3–4 hours. Scheduler wiring for per-channel output device/channel is ~2 hours. CC remap end-to-end (channel field + Inspector list editor + scheduler lookup) is ~3 hours. Spec deltas + manual verification across multi-device scenarios is the rest. Likely escalates to a full OpenSpec proposal given the cross-capability surface.

**Status**: pending. Surfaced during the `dj-action-track-playback` review — the user explicitly redirected routing UX from a global panel to per-track inline config and added the CC# remap requirement in the same conversation.

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

**Why**: All four header levels (`.mr-channel__hdr`, `.mr-track__hdr`, `.mr-djtrack__hdr`, `.mr-param-lane__hdr`) define a `:hover` rule that mixes a small amount of `--mr-text-1` into the panel surface (`color-mix(in oklab, var(--mr-bg-panel*) 80%, var(--mr-text-1) 4–5%)`). But each header's sticky child zones carry their own opaque `background: var(--mr-bg-panel*)` that matches the *un-hovered* base color. On hover, the parent's middle (spacer area) gets the hover tint while the sticky zones stay at the base color — producing visible "patches" of un-hovered color sitting on top of the hover-tinted middle.

Currently-opaque sticky zones by level:

- `.mr-channel__hdr-left` (right zone has no bg).
- `.mr-track__hdr-left` (right zone has no bg).
- `.mr-djtrack__hdr-left` and `.mr-djtrack__hdr-right` (both sides opaque).
- `.mr-param-lane__hdr-left` and `.mr-param-lane__hdr-right` (both sides opaque).

The bug is most obvious at the param-lane and dj-track levels where both left AND right zones are opaque — hovering produces three visible bands: left-base, middle-hover, right-base. At the track and channel levels only `__hdr-left` is opaque so the asymmetry is one-sided but still visible.

The sticky zones currently need an opaque background only to keep `chev + swatch + name + sub` (and the M/S chip cluster) visible at horizontal scroll offsets > 0. Without the bg, content from sibling rows would bleed through *only if there were any* — but the spacer area inside the header row is empty (`flex: 1; min-width: 0` div), so the sticky zones don't actually mask any header-row content. They only need to mask content from the scrolled plot/roll *below* the header, which the parent's own bg already handles via the explicit `position: relative; z-index: 1` lift documented in the inline comments.

**Scope**:

- **Decision** (during grooming): apply **option #1 (remove `background`)** to the channel/track/dj-track sticky zones. Specifically remove the `background` declaration from `.mr-channel__hdr-left`, `.mr-track__hdr-left`, `.mr-djtrack__hdr-left`, and `.mr-djtrack__hdr-right`. The parent header already has `position: relative; z-index: 1` and an opaque bg; the sticky-zone children inherit visibility from the parent's bg layer, and the empty spacer means no header-row content needs masking.
- **Param-lane zones (`.mr-param-lane__hdr-left`, `.mr-param-lane__hdr-right`) are deferred to a follow-up**. The 22px row is denser and sticky on both sides; option #1 is riskier there (more chance content needs masking). Pick option #2 (CSS-variable cascade) or option #3 (`:has`) for that level once the channel/track/dj-track fix has been visually validated.
- Alternative approaches considered (not picked for channel/track/dj-track):
  1. CSS-variable cascade — define `--hdr-bg` on the parent; both parent and sticky-zone children read it via `background: var(--hdr-bg)`. Robust but adds ~6 lines per header file.
  2. `:has`-based rule — `.mr-*__hdr:hover .mr-*__hdr-left { background: <hover-color> }`. Cheapest LOC-wise but duplicates the hover color.

**Verification**:

- Hover each of: `.mr-channel__hdr`, `.mr-track__hdr`, `.mr-djtrack__hdr` (collapsed and expanded). The entire header SHALL show the hover background color uniformly — no visible patches at the sticky-left or sticky-right zones.
- Horizontal-scroll the timeline so the sticky zones are visibly pinned (scroll the inner content past the keys column). Hover the header. Sticky zones still show the hover color uniformly with the rest of the header.
- Confirm nothing in the header row becomes visible-through the (now transparent) sticky zones — the header's spacer is empty today, so this should hold.
- Param-lane headers still show the banded hover artifact (deferred); not a regression.
- Cross-browser check: Chromium, Safari, Firefox.
- `yarn typecheck` clean.
- Visual diff: spot-check `?demo=marquee` URL — hovered Lead channel/track headers and any visible dj-track headers should look continuous, not banded.

**Estimated effort**: ~15 minutes — delete one `background:` line each from `ChannelGroup.css`, `Track.css`, and `DJActionTrack.css` (the dj-track file gets two deletions), plus a manual hover-pass cross-browser.

**Status**: pending. Surfaced during Slice 5 backlog grooming; scope decision made during Slice 10a grooming. Not blocking any in-flight slice; cosmetic but visible.

### Move the MIDI Outputs panel to the right aside

**Why**: Establish a clearer side-aside convention — **left aside = MIDI inputs, right aside = MIDI outputs** — and reduce panel pressure in the left sidebar. Today the left `.mr-sidebar` aside hosts `<Sidebar>` (`AppShell.tsx:36`), which renders both the `MIDI Inputs` and `MIDI Outputs` panels (`Sidebar.tsx:103,109`). The right `.mr-inspector` aside hosts only the Inspector. Reading routing left-to-right (inputs → center timeline → outputs) makes the signal flow obvious; it also groups output-side decisions (device, channel, mute) next to the Inspector's selection-detail surface, which is where output-affecting edits already concentrate.

**Scope** (likely escalates to an OpenSpec proposal — the `sidebar` and `inspector` capabilities both have "exactly N children" requirements that need to change in lockstep):

- **Sidebar (left aside)**: drop the `MIDI Outputs` panel from `<Sidebar>`. The remaining panel order becomes `InputMappingPanel`, `MIDI Inputs`, `Record Filter`, `Routing` — three `.mr-panel` children instead of four (plus the input-mapping panel).
- **Inspector (right aside)** OR a new right-side container: render the `MIDI Outputs` panel in the right aside. Open question — pick one:
  1. **Stack with the Inspector**: the `.mr-inspector` aside contains the Outputs panel above (or below) the Inspector content. Cheapest; reuses the existing aside; but the right aside is no longer purely "Inspector".
  2. **Rename the right aside**: `.mr-inspector` → `.mr-right` (or similar) and let it host both the outputs panel and the inspector as siblings. More invasive, touches every reference to `.mr-inspector` in CSS/specs/tests.
  3. **Tabs within the right aside**: a top-of-aside tab strip switches between "Inspector" and "Outputs" content. Worst for ambient awareness — output-mute state isn't visible while editing notes — but keeps the aside small.
  Recommend **option 1** (stack). The Outputs panel is short (2 device rows + 1 routing chip strip per current fixtures), and stacking matches how the left sidebar already stacks multiple panels.
- **Documentation update** — write the convention into the design corpus so future panels land on the correct side without re-litigating:
  - `design/README.md` — add a short "Side aside convention" section: left aside = MIDI input domain (inputs, input mapping, input filtering), right aside = MIDI output domain (outputs, output routing) + selection inspector. Cross-reference the `sidebar` and `inspector` specs.
  - `design/deviations-from-prototype.md` — add an entry noting this divergence if the prototype keeps both panels on the left (likely; the original `design_handoff_midi_recorder/` layout has both there).
- **Spec deltas** (OpenSpec change):
  - `sidebar` capability — modify `Sidebar renders four fixed-order panels` to three (or four, depending on whether `InputMappingPanel` is counted). Modify `MIDI Outputs panel renders two device rows` — either delete the requirement (Outputs no longer in `sidebar` scope) or move it to the `inspector` capability (or a new capability).
  - `inspector` capability (or a new `right-aside` capability) — add a requirement for hosting the Outputs panel. If we keep `.mr-inspector` as the class but broaden its semantics, the `inspector` spec gets a new requirement; otherwise a new capability owns the renamed aside.
  - `app-shell` capability — possibly modify the class taxonomy list and the "Inspector populated by the `inspector` capability" rule.
- **Pickers backlog item interaction**: the pending "Pickers for MIDI input and clock source" entry adds an input picker anchored from the Statusbar. The matching "Output picker" (per-channel output routing) would naturally live in the right aside under this new convention — worth calling out the connection but not bundling here.

**Verification**:

- `.mr-sidebar` aside renders three (or four, including `InputMappingPanel`) panels: no `MIDI Outputs` panel present.
- `.mr-inspector` aside renders the `MIDI Outputs` panel and the Inspector content; both visible without scrolling at default heights.
- `data-open` defaults preserved (Outputs ships `data-open="true"`).
- Routing-matrix and device-row primitives still work in the new mount location (no CSS regressions on `.mr-dev`, `.mr-routing__*`).
- `yarn typecheck` clean; `openspec validate --strict` clean.
- Visual diff: the Outputs panel reads as part of the right-aside vertical stack, not a stray strip floating above the Inspector.
- `design/README.md` gains the side-aside convention section; `grep -n "left aside" design/README.md` finds the new text.

**Estimated effort**: 0.5–1 day. The component move is small (~30 min: relocate the JSX, lift `OUTPUTS` fixtures to wherever they end up living). The spec/doc work dominates — three spec files to update, a design-doc convention to write, and an OpenSpec proposal to gather the deltas under one change.

**Status**: pending. Convention decision recorded; implementation deferred until picked up.

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

### Piano-roll 2-octave visible viewport + vertical scroll

**Why**: Today the piano roll renders the entire `lo..hi` pitch range as a single fixed-height block — `lo = 48`, `hi = 76` means every roll is 28 semitones tall, all visible at once. There's no way to record/display notes outside that range, and a real session might span more than 28 semitones (or far less). The intended model: each channel-track's piano roll shows a 2-octave (24-semitone) visible window with vertical scrolling to navigate the rest of the track's recorded pitch range.

This affects the `piano-roll` and `tracks` capabilities. It does NOT affect dj-action-tracks (their body is row-per-mapped-action, not pitch-based — see Slice 7a's `dj-action-tracks` spec).

**Scope** (escalate to OpenSpec proposal when picked up):

- **Visible-window contract**: each piano-roll renders `lo..lo+24` as the visible viewport (24 semitones = 2 octaves). The recorded pitch range can be wider; notes outside the visible window exist in the data but only render when scrolled into view.
- **`piano-roll` capability**:
  - `<PianoRoll>` receives a `visibleLo`/`visibleHi` window (or equivalent `viewportStart`/`viewportSpan`) in addition to or replacing today's `lo`/`hi`.
  - The roll's `.mr-roll__lanes` container becomes `overflow-y: auto` with `height = 24 * rowHeight` (2 octaves at default zoom).
  - The keys column `.mr-keys` either scrolls in lockstep (sticky-left within the scroll container) OR stays full-pitch-range static (a navigator strip). Recommend lockstep — matches DAW convention.
  - Notes are clipped to the visible window by the scroll container's `overflow: hidden`-via-`auto` behavior; no extra JS filtering needed.
- **`tracks` capability**:
  - The open-track body height becomes a fixed `24 * rowHeight` value rather than today's `range * rowHeight`. Track header heights unchanged.
  - The collapsed-track minimap behaviour is unchanged (it already compresses everything to a 6px strip).
- **`useStage`** or `useChannels`:
  - Per-track `viewportLo` state (initialized to the channel's recorded median pitch's octave boundary, or to a session-default like 48).
  - `setRollViewportLo(channelId, lo)` action; the scroll container's `onScroll` handler updates this state (or, simpler, the viewport is uncontrolled and managed entirely by the browser scrollbar).
- **Per-track pitch window** (related question): today every roll shares `LO=48, HI=76`. With per-track viewports, each track can independently scroll its piano range. This naturally extends to per-channel pitch ranges (a bass channel might naturally sit in `lo=24`, a lead in `lo=60`). Recommend keeping the data model channel-agnostic for now — the viewport is a render-time concern, not a data-model one.
- **Spec deltas**: `piano-roll` capability adds a "2-octave visible viewport" requirement; `tracks` capability updates the open-track body height rule.

**Verification**:

- A track with notes from C3 to C5 (across 2 octaves exactly) renders all notes visible in the default viewport.
- A track with notes from C2 to G5 (4.5 octaves) renders 2 octaves visible; vertical scroll reveals the rest. The scroll position SHALL persist within a session.
- The scroll within a track does NOT scroll the timeline's horizontal axis or any other track.
- The keys column scrolls in lockstep with the lanes.
- The collapsed-track minimap still shows the full pitch range compressed (no scrolling there — minimap is the "everything compressed" view).
- `?demo=marquee` and `?demo=note` URL fixtures still work; they may need updated default `viewportLo` values if the demo notes fall outside the default 2-octave window.
- `yarn typecheck` clean; `openspec validate --strict` clean for the new requirements.

**Estimated effort**: 1 day — the viewport math is straightforward but every piano-roll consumer (`<Track>`, `<ChannelGroup>`, `?demo=*` fixtures, the marquee/selection scoping, the `notesInMarquee` helper) needs to be reviewed for assumptions about the visible window. The marquee rectangle is currently in pitch units (`p0`, `p1` MIDI pitch); per-track viewports change how those translate to screen Y per roll.

**Status**: pending. Surfaced during dj-mode-shell (Slice 7a) review as a separate concern from the dj-action-track row-count fix.

### Pickers for MIDI input and clock source

**Why**: The `statusbar-shell` slice landed two ambient readouts — the Statusbar's incoming-MIDI cluster and the Titlebar's `Clk` meta cell — but both are inert. The Statusbar cluster is a `<button>` with `data-pickable="false"` and `tabIndex={-1}`; the `Clk` cell is a plain `.mr-meta` value. `useTransport().clockSource` is read-only state; there is no `setClockSource` action. `useStatusbar()` returns only `lastInput` and `active`; there is no list of available inputs or a selector. Users can see the current source and the most recent input but cannot change either.

The original Slice 10 in `design_handoff_midi_recorder/IMPLEMENTATION_PLAN.md` bundled "MIDI input device picker; clock source" with audio-engine wiring. The audio half is permanently dropped (`design/deviations-from-prototype.md` #20 — MIDI-only tool); the picker work needs its own home, which is here.

**Scope**:

- **`useTransport`**: add `setClockSource(source: ClockSource)` action. No validation needed — the union type guarantees the value. Modify the `transport-titlebar` capability's "useTransport hook is the single source of transport state" requirement to list the new action; add an ADDED requirement covering picker behaviour.
- **`useStatusbar`**: add `inputs: MidiInput[]` (the enumerated list — three stubbed entries matching the Sidebar's `MIDI Inputs` panel) and `setSelectedInputId(id: string)` action. Selection state lives on the hook (replace the constant stub with a small reducer). Modify the `statusbar` capability accordingly.
- **Clock-source picker**: opens from the Titlebar's `Clk` cell. Popover anchored below the cell. Radio group of three options: `Internal` / `External · MIDI Clock In` / `External · MTC`. Click an option → `setClockSource(...)` → close. Esc and click-outside dismiss without changing.
- **MIDI-input picker**: opens from the Statusbar cluster button. Popover anchored above the button (it's the bottom of the shell — `bottom: calc(100% + 4px)`). Lists the stubbed inputs with their LED state and channel. Click an input → `setSelectedInputId(...)` → close.
- **Markup change**: flip `data-pickable="false"` to `data-pickable="true"` on the Statusbar button; attach `onClick` and open/close state. Add hover / focus-ring affordances under the `[data-pickable="true"]` selector (CSS-only — `cursor: pointer`, `:hover` background change, `:focus-visible` ring). Change `tabIndex` from `-1` to default. The `Clk` cell currently isn't a button — promote it to a `<button>` with the same `data-pickable` flag pattern, keeping the meta-row's visual layout.
- **Popover primitive**: we don't have a generic one. `AddParamLanePopover` exists but has a known z-index issue (see backlog entry "Keys-spacer paints over the + Add Lane popover"). Two options:
  - Hoist a generic `<Popover>` primitive that both pickers consume (and the future `+ Add Channel` picker from the channels backlog entry). Half a day of upfront work; pays off across three callers.
  - Inline the popover per call site; cheaper now, but we'll have three different implementations to maintain.
  Recommend hoisting.
- **Spec deltas**:
  - `transport-titlebar`: MODIFIED `useTransport hook is the single source of transport state` to add `setClockSource`; ADDED `Clk cell is interactive and opens a clock-source picker` with open/select/dismiss scenarios; ADDED `setClockSource updates clockSource state` with scenarios.
  - `statusbar`: MODIFIED `useStatusbar hook returns lastInput and active flag` → returns `inputs`, `selectedInputId`, `lastInput`, `active`, plus `setSelectedInputId`; ADDED `Statusbar cluster is interactive and opens an input picker` with scenarios.

- **NOT in scope**: real Web MIDI / CoreMIDI / WinMM enumeration. The pickers feed from stubbed input lists; turning that into OS-level enumeration is a separate, larger change tracked elsewhere when scoped.

**Verification**:

- Click the `Clk` cell → popover opens with three radio options, current source pre-selected. Click `External · MIDI Clock In` → cell now reads `Ext`, popover closes.
- Click the Statusbar cluster → popover opens above it listing the three stubbed inputs. Click `Arturia KeyStep Pro` → Statusbar cluster updates to show `Arturia KeyStep Pro · CH·1–4`.
- Esc dismisses either popover without changing state.
- Click outside the popover dismisses it.
- Tab order now includes both buttons; Enter on a focused button opens its popover; arrow keys move within the popover.
- The Sidebar's `MIDI Inputs` panel and the Statusbar's input cluster stay in sync (both reflect the same `inputs[]` and `selectedInputId`).
- `yarn typecheck` clean; `openspec validate --strict` clean for the deltas.

**Dependencies**: none. Lands independently of real-MIDI runtime work.

**Estimated effort**: 1 day if reusing the existing `AddParamLanePopover` pattern (accepting its z-index quirk). 1.5 days if hoisting a generic `<Popover>` primitive first — the saner long-term choice given three eventual callers. The hook deltas, spec updates, and visual review take ~half a day combined; the popover primitive is the variable.

**Status**: pending. Surfaced during `statusbar-shell` slice planning — the `clockSource` field on `useTransport`, the `data-pickable="false"` flag on the Statusbar button, and the inert `Clk` cell are anchors waiting for this work.

### Web MIDI access and real device enumeration

**Why**: Every MIDI device list in the app is stubbed today — `useStatusbar().inputs`, the `MIDI Inputs` panel, the `MIDI Outputs` panel, the Routing matrix's device column, the (pending) input/clock-source pickers — all feed from a hardcoded array. To do anything real (monitoring, recording, playback) the app first needs to talk to the user's actual hardware via the Web MIDI API. This entry is the foundation: replace stubs with `navigator.requestMIDIAccess()` results, surface permission state, react to hotplug. It is the first of an end-to-end recording/playback chain (this slice → record → play); the chain is laid out across the next several backlog entries.

**Scope**:

- New module `src/midi/access.ts`: thin wrapper around `navigator.requestMIDIAccess({ sysex: false })` returning a singleton `MIDIAccess`, plus a `subscribe(listener)` for `statechange` events. All other modules go through this wrapper rather than touching `navigator.requestMIDIAccess` directly.
- Permission flow: a small banner / inline UI in the left sidebar (or a one-time toast) requests MIDI access on first load. Memoize the granted state so subsequent navigations don't re-prompt. Denied state shows a retry control. Browsers without Web MIDI support (Firefox without flag, Safari prior to its support landing) get a "MIDI not available" banner instead of an error.
- `useStatusbar().inputs`: replace the stubbed array with `Array.from(access.inputs.values()).map(toMidiInput)`. The `toMidiInput` helper builds the existing input-shape from a `MIDIInput` (id, name, manufacturer → label). LED/active state still derives from runtime message activity (next slice).
- `useOutputs` (whichever hook backs the `MIDI Outputs` panel): same treatment — real outputs from `access.outputs`.
- Hotplug: subscribe to `statechange` and refresh both `inputs` and `outputs` arrays in their hooks when a device is added / removed / disconnected. Keep `selectedInputId` stable across hotplug events; clear it only if the selected device disappears.
- The Routing matrix's device column reads from the same outputs list.
- The pending "Pickers for MIDI input and clock source" entry consumes the same hooks unchanged, so its popovers list real devices automatically once both this slice and the pickers slice land.

**Verification**:

- Open the app with a real MIDI keyboard connected → keyboard appears in the `MIDI Inputs` sidebar panel, in the Statusbar cluster's picker (once pickers slice lands), and in the Routing matrix.
- Open the app with no MIDI device → lists render their existing empty states; no console errors.
- Plug a device in while the app is running → device appears without a reload.
- Unplug the currently selected input → selection clears; no errors.
- Deny the permission prompt → banner explains the state; lists are empty; no errors.
- Open the app in a browser without Web MIDI support → "not available" banner; no errors.
- `yarn typecheck` clean.

**Spec deltas**: minor — `statusbar` (and wherever outputs live) modify the source of `inputs`/`outputs` from a constant to a live hook-backed array. No new capability needed yet; runtime MIDI plumbing is implementation detail, not a user-facing capability with its own spec.

**Dependencies**: none. Pairs naturally with the pending "Pickers for MIDI input and clock source" entry but doesn't require it.

**Estimated effort**: 0.5–1 day. Wrapper is ~50 LOC; the bulk of the time is wiring it into 4–5 hooks/components without breaking the consumer shape, plus the permission UX.

**Status**: pending. **First of three core slices** for end-to-end MIDI recording and playback.

### Play back channel notes to an output device

**Why**: With device enumeration and recording in place, the app captures notes but can't play them back. This slice closes the loop: press play, pre-scheduled MIDI note-on/note-off messages stream to a real output device with sub-ms hardware-level timing via the Web MIDI API's timestamp argument. Single hardcoded output (first available) in this slice — per-channel routing via the Routing matrix comes later.

**Scope**:

- New module `src/midi/scheduler.ts`: classic lookahead scheduler (Chris Wilson, "A Tale of Two Clocks"). A `requestAnimationFrame` loop ticks every frame. Each tick walks every channel's note list, finds notes whose start (`t * msPerBeat`) falls within `[playheadMs, playheadMs + lookaheadMs)`, and pre-emits `MIDIOutput.send([0x90 | ch, pitch, vel], targetTimestamp)` plus the matching `0x80` note-off at `(t + dur) * msPerBeat`. Lookahead ~100ms absorbs frame skips; the Web MIDI timestamp delivers sample-accurate hardware scheduling.
- `useTransport.play()` / `stop()`: `play` starts the scheduler from the current playhead; `stop` halts it AND emits panic — explicit note-off for every note the scheduler has dispatched a note-on for but not yet a note-off, plus an `All Notes Off` CC (`0xB0 | ch, 0x7B, 0x00`) on every channel that has emitted activity in the current play session.
- Output selection: pick the first output from `useOutputs().outputs`. The Routing matrix is **not** consulted in this slice — per-channel routing is slice 6. Outgoing MIDI channel byte is the internal channel id (1..16) clipped to 0..15.
- `play` with no available output: toast/Statusbar message "No output device available"; button stays enabled (a no-op).
- Tempo change mid-playback: out of scope; the scheduler captures `tempo` at `play` time. Acceptable to break or no-op for now.
- Loop / count-in / pre-roll: out of scope (separate backlog entries).

**Verification**:

- Record a short phrase (using the recording slice), press stop, press play with an output device connected → phrase plays back through the output at correct pitches, velocities, timing.
- Press stop mid-playback → all sounding notes go silent within a frame (panic note-offs).
- Press play with no output → no errors; toast/Statusbar explains.
- `yarn typecheck` clean.

**Spec deltas**: `transport-titlebar` — flesh out `play`/`stop` action contracts to drive the scheduler. Probably bundled with the recording slice's OpenSpec proposal.

**Dependencies**: requires "Web MIDI access and real device enumeration." Independent of the recording slice — could land first, but easiest to test once recording exists.

**Estimated effort**: 1–1.5 days. Scheduler is ~80 LOC of careful code; panic ~30 LOC; the rest is action wiring and output selection.

**Status**: pending. **Third of three core slices** for end-to-end MIDI recording and playback. Together with the previous two, closes the E2E loop.

### Multi-channel record routing by incoming MIDI channel byte

**Why**: The initial recording slice routes every incoming note to `selectedChannelId`. Real controllers and split keyboards send on multiple MIDI channels (left hand on ch1, right hand on ch2; drum machine on ch10). To capture a multi-channel performance the recorder must route by the incoming MIDI channel byte — a note arriving on MIDI channel N lands in the internal channel with id N.

**Scope**:

- Recorder change: extract MIDI channel from the status byte (`status & 0x0F`); route the captured note to internal channel `chanByte + 1` (Web MIDI is 0-indexed; our internal channel ids are 1-indexed).
- Auto-add channels: if a note arrives on a MIDI channel with no matching internal channel, call `addChannel(id)` from the pending "Add/remove affordances" backlog entry before appending. Either depend on that entry landing first, or include a stripped-down inline `addChannel` here.
- Per-channel record-arm: each channel header gets a small record-arm indicator (red dot when armed). During recording only armed channels receive notes; notes on non-armed channels are dropped. Default: every channel in the session is auto-armed at record-start. UI: clicking the dot toggles arm. Decision deferred to grooming: should auto-created channels (from incoming-channel-not-yet-in-state) be auto-armed? Recommend yes — if they're new, the user wants to capture them.
- `selectedChannelId` no longer affects record routing — the MIDI channel byte does.

**Verification**:

- Use a controller sending on multiple MIDI channels → notes on ch1 land in internal channel 1, ch2 in channel 2, etc., simultaneously.
- Disarm channel 2 → notes on MIDI ch2 are dropped; channel 1 unaffected.
- Send a note on MIDI ch5 with no internal channel 5 in the session → channel 5 auto-created and capture continues there.
- `yarn typecheck` clean.

**Spec deltas**: `channels` — add `armed: boolean` field and toggle action; modify recording requirements in `transport-titlebar` (or wherever recording lives). Likely an OpenSpec proposal.

**Dependencies**: E2E core (recording slice). Couples with "Add/remove affordances for channels and tracks" — share `addChannel`.

**Estimated effort**: 0.5–1 day.

**Status**: pending.

### Per-channel output routing in playback (Routing matrix becomes live)

**SUPERSEDED** by "Drop the Routing panel; move I/O config to per-track inline (with CC# remap)" earlier in this backlog. The decision is to delete the matrix entirely rather than wire it up. Keep this entry until the superseding slice ships, then remove this entry as part of that slice's cleanup.

**Why**: The Routing panel renders a matrix (channel × output device) today but its state is decorative — playback ignores it and sends every channel to the first available output. This slice wires the matrix into the scheduler: each channel's events go to the output(s) selected for it in the matrix, with optional per-route MIDI-channel rewrite (e.g., "route everything to output X on its channel 5").

**Scope**:

- Scheduler change: when scheduling a channel's notes/CC/pitch-bend, look up the routing matrix entries for that channel. For each routed output, send the event to that output. A channel can route to 0..N outputs (0 = silent, N>1 = layered).
- Per-route `outputChannel?: 1..16` override. Default: pass through the source channel byte.
- Panic on stop: track every output used since last `play` and emit `All Notes Off` to each. Per-channel rewrites mean the panic message goes out on the rewritten channel.
- Routing matrix UI: matrix already renders, but its click handlers may be inert today — verify and wire them to the routing state (`useRouting` or wherever the routing capability lives). Cell toggle: click to enable/disable. Long-press or context menu: set `outputChannel` for the cell.

**Verification**:

- Connect two outputs (e.g., a hardware synth and a virtual MIDI loopback). Route channel 1 to synth, channel 2 to loopback.
- Play a session with notes on both channels → synth plays only channel 1, loopback plays only channel 2.
- Route channel 1 to both → both outputs play channel 1.
- Set channel 1's route-to-synth `outputChannel: 5` → synth receives the notes on its channel 5.
- Stop → both outputs silent within a frame.
- `yarn typecheck` clean.

**Spec deltas**: routing capability — formalize route shape, modify the playback contract.

**Dependencies**: E2E core (playback slice).

**Estimated effort**: 0.5–1 day.

**Status**: pending.

### Input mapping rules — device + MIDI channel → internal channel

**Why**: Multi-channel record routing (previous entry) uses the raw MIDI channel byte. That breaks when two devices both send on MIDI channel 1 — the user can't keep them in separate internal channels. The `InputMappingPanel` in the sidebar is the UI for this: explicit rules of `{deviceId, fromChannel} → toChannel`.

**Scope**:

- `useInputMapping` hook: state is an array of `{ inputDeviceId, fromChannel, toChannel }` rules. Recording looks up the matching rule on each incoming event; falls back to identity routing (the previous slice's default) if no rule matches.
- `InputMappingPanel` UI: list rules with add/remove/edit. Each rule row shows `<device picker> <channel 1-16> → <channel 1-16>`. Empty state hint: "No mapping rules — incoming MIDI uses its channel byte."
- Out of scope: wildcards (`fromChannel: '*'` matching any channel from a device), velocity curves, pitch transposition. Defer; revisit if asked.

**Verification**:

- Two devices A and B both sending on MIDI channel 1. Add rules `{A, 1, 1}` and `{B, 1, 9}` → A's notes land in channel 1, B's in channel 9.
- Remove the rule for B → B's notes fall back to identity routing (channel 1).
- `yarn typecheck` clean.

**Spec deltas**: new `input-mapping` capability or extend `sidebar`.

**Dependencies**: "Multi-channel record routing by incoming MIDI channel byte" (previous entry).

**Estimated effort**: 0.5–1 day.

**Status**: pending.

### CC and pitch-bend capture during recording

**Why**: The recorder captures note-on/note-off pairs only. CC messages (mod wheel, sustain pedal, expression) and pitch-bend are first-class MIDI data, and the app already renders them as param-lane points. This slice fills the param lanes from real input.

**Scope**:

- Recorder change: listen for `status & 0xF0 == 0xB0` (CC) and `0xE0` (pitch-bend) in addition to notes. Capture a `LanePoint { t, value }` keyed by `kind = 'cc-' + ccNumber` (e.g., `'cc-1'`) or `'pitchbend'`.
- `useChannels.appendLanePoint(channelId, kind, point)` action. If no param lane of that `kind` exists on the channel, auto-create one (uses the channels capability's `addParamLane`).
- Piano-roll already renders lane points; new ones appear live during recording.
- Playback (scheduler) needs to pre-schedule CC/pitch-bend events alongside notes — small extension to the scheduler walk: include lane points in the lookahead window.
- Out of scope: aftertouch (`0xA0`/`0xD0`), program change (`0xC0`), sysex. Add later if requested.

**Verification**:

- Record while moving the mod wheel → a Mod Wheel param lane appears under the channel; lane points trace the wheel movement.
- Record sustain pedal (CC 64) on/off → on/off transitions appear as lane points.
- Record pitch-bend → a pitch-bend lane shows the bend curve.
- Play the recording back → CC/pitch-bend stream to the output; the controlled synth responds correctly.
- `yarn typecheck` clean.

**Spec deltas**: extend recording requirements; `param-lanes` capability gains a "captured from live input" scenario.

**Dependencies**: E2E core (recording slice required; playback slice required for the playback-side test).

**Estimated effort**: 0.5 day.

**Status**: pending.

### Loop playback over a time range

**Why**: Producers loop a bar or chorus during overdubs and creative iteration. Today playback runs once from the playhead to the end and stops. This slice adds a loop range that the playhead wraps around indefinitely. Closing this also fixes the playback-slice's documented "~100ms boundary tail bleed" — the third E2E slice (archived as `play-channel-notes`) intentionally did not clip its 100ms lookahead at `loopRegion.end`, so notes whose start lands in `[end − 100ms, end)` already have a future-timestamped note-off queued past the wrap. The scheduler change below (lookahead clipped to `min(playhead + 100ms, t1)`, panic note-offs at wrap for sustained notes) closes that gap. Also note: no UI currently lets the user set `loopRegion` — this entry adds it (toggle + ruler band), so the tail bleed is observable today only via programmatic `setLoopRegion`.

**Scope**:

- `useTransport`: add `loop: { enabled: boolean, t0: beats, t1: beats }` plus toggle/set actions.
- UI: loop toggle in the titlebar; ruler overlay shows the loop range as a colored band; drag the band's edges to adjust `t0`/`t1`; drag the band's middle to translate.
- Scheduler change: when the playhead reaches `t1` and `loop.enabled` is true, wrap to `t0`. At the wrap, emit panic note-offs for any sounding notes whose duration would cross `t1`; the next iteration's note-ons re-trigger them.
- `loop.enabled = true` with `t1 <= t0` is a no-op (no loop).
- Setting loop range via shift+drag on the ruler — pairs with the pending "Shift+drag the ruler to select across all channels and tracks" backlog entry. May be worth bundling.

**Verification**:

- Set loop from bar 2 to bar 4, press play → playhead wraps at bar 4 to bar 2 indefinitely. Notes ringing at the wrap point get clean note-offs.
- Disable loop mid-playback → playhead continues past `t1` to end.
- `yarn typecheck` clean.

**Spec deltas**: `transport-titlebar` plus ruler.

**Dependencies**: E2E core (playback slice). Pairs with "Shift+drag the ruler" backlog entry.

**Estimated effort**: 1 day.

**Status**: pending.

### External clock source (MIDI Clock In drives transport)

**Why**: The pending "Pickers" entry adds a clock-source picker with `Internal` / `External · MIDI Clock In` / `External · MTC` options. Only `Internal` does anything today. This slice makes `External · MIDI Clock In` real: incoming MIDI Clock messages (`0xF8`, 24 per quarter note) drive the playhead and tempo, with start/stop/continue messages (`0xFA`/`0xFC`/`0xFB`) controlling transport. MTC (`External · MTC`) is a separate, larger slice.

**Scope**:

- Clock-input device selection: recommend a separate "Clock In" picker rather than reusing `selectedInputId`, so the user can play one device and slave to a clock on another. Lives next to (or inside) the clock-source picker.
- MIDI Clock listener on the chosen clock device: each `0xF8` advances an internal tick counter by 1/24 quarter; tempo derives from a moving average of inter-tick intervals over the last 24 ticks (~1 quarter).
- `0xFA` (start) → `play()` from t=0. `0xFB` (continue) → `play()` from current playhead. `0xFC` (stop) → `stop()`. `0xF2` (song position pointer) → jump playhead.
- When `clockSource` is external, disable the internal `requestAnimationFrame` playhead driver. Switching back to `Internal` re-enables it.
- Clock-input device disconnect mid-session → fall back to `Internal` with a Statusbar warning.

**Verification**:

- Set clock source to `External · MIDI Clock In`, pick a clock device, start the external transport → app's playhead moves in sync at the external tempo.
- Stop the external transport → app stops.
- Switch back to `Internal` → app drives its own playhead again.
- `yarn typecheck` clean.

**Spec deltas**: `transport-titlebar` — flesh out `clockSource` behavior beyond the picker.

**Dependencies**: pending "Pickers for MIDI input and clock source" entry; E2E core.

**Estimated effort**: 1–1.5 days.

**Status**: pending.

### Live MIDI IN LED tap (pulse on real activity, not stub)

**Why**: The Titlebar's `MIDI IN` LED is wired to `useStatusbar().active`, but `useStatusbar` is a stub that returns a constant. The LED today is either always-on or always-off depending on the stub value, regardless of whether any MIDI message is actually arriving. Surfaced during `record-incoming-midi` (2026-05-12) manual testing — user confirmed the LED doesn't pulse when notes arrive, even from a working device that successfully records.

The recorder hook installs its own `onmidimessage` listener only while armed; the LED needs an always-on tap that flashes regardless of transport state.

**Scope**:

- New always-on listener (likely a hook `useMidiActivityTap()` mounted alongside `MidiRecorderRunner`, or folded into the runtime) that subscribes to `onmidimessage` on every connected input via `useMidiInputs()`. On every message it stamps a ref `lastMessageAt = performance.now()` and triggers a state flip with a debounce/decay window of ~150 ms.
- `useStatusbar`: replace the stub `active` field with state driven by the tap. `active === true` while `now − lastMessageAt < 150ms`, else `false`. A small `setInterval`/`requestAnimationFrame` decay loop handles the trailing edge.
- Chain-forward semantics: the tap must coexist with the recorder's `onmidimessage` install on the same input. Either (a) the tap subscribes via `addEventListener('midimessage', ...)` while the recorder uses the `onmidimessage` slot, or (b) both go through a small dispatcher that fans out to all subscribers. Recommend (a) — `MIDIInput` is an `EventTarget` and `addEventListener` doesn't conflict with `onmidimessage`.
- Spec deltas: `statusbar` capability — `useStatusbar().active` becomes derived from live activity rather than a constant; the Titlebar/MIDI-IN-LED requirements in `transport-titlebar` already drive `data-state` off `active`, so no change there.

**Verification**:

- Open the app with a MIDI keyboard, transport idle (not recording). Press a key → the `MIDI IN` LED pulses for ~150 ms.
- Hold a key → the LED stays lit (continuous messages keep `active === true`).
- Stop pressing → LED goes dim within ~150 ms.
- Behavior is identical whether or not recording is active.
- `yarn typecheck` clean.

**Dependencies**: web-midi-access (already shipped).

**Estimated effort**: 0.5 day. The hook is ~30 LOC; spec delta is small; the only subtlety is the recorder/tap coexistence on the same input.

**Status**: pending. Surfaced during `record-incoming-midi` (2026-05-12) manual verification.

### Pause-during-record reversibility

**Why**: Today `pause()` while recording (mode `'record'`) flips transport `mode` to `'idle'` and clears `recordingStartedAt`. Press play (or record) again and the playhead jumps to 0 (record from idle) or continues without recording (play from idle). Users expect DAW-style behavior: pause during a record take should freeze the playhead, keep the record-arm visual (LED, pulsing button), let me set up for the next phrase, and resume on the next press at the same timecode.

Surfaced during `record-incoming-midi` (2026-05-12) manual testing — user pressed pause mid-take expecting a reversible pause but got a soft stop instead.

**Scope**:

- Introduce a new transport mode value `'record-paused'`. Update `TransportMode` union.
- Reducer changes:
  - `pause()` from `'record'` → `mode = 'record-paused'`, keep `recordingStartedAt` populated (or migrate to a paired ref — see below).
  - `record()` (or `pause()`) from `'record-paused'` → `mode = 'record'`, shift `recordingStartedAt` by the pause duration so beat math remains consistent (`recordingStartedAt += pauseDurationMs`).
  - `stop()` from `'record-paused'` → clears as today.
- `TransportState.recording` becomes `mode === 'record' || mode === 'record-paused'` so the LED/pulse keeps animating while paused.
- The rAF tick effect already pauses when `mode === 'idle'`; extend it to also pause when `mode === 'record-paused'` so `timecodeMs` freezes.
- Recorder hook: when `mode === 'record-paused'`, the listener should detach (no notes captured during pause) and any held notes should finalize at the pause instant. The current effect already finalizes-and-detaches when `recording` goes false; new behavior is to finalize-and-detach when transitioning into `record-paused` but keep the recording session "live" (so the user can resume).
- Resume flow: on `record-paused → record`, the effect re-installs the listener with the same channel target; the active-note map is empty (fresh), and new notes pick up the take from the current `timecodeMs`.
- Titlebar UI: the play/pause button label/icon updates when in `record-paused` — likely keep the pause icon since the gesture is "press to resume", and pulse the record button at a reduced rate (or keep the existing pulse).
- Spec deltas: `transport-titlebar` ADDED scenarios for `record-paused`; recorder spec ADDED scenarios for the finalize-and-detach-but-stay-armed semantics.

**Verification**:

- Press record, play a few notes, press pause (the play/pause button). The record button keeps its armed visual (red), timecode freezes, held notes finalize with the correct truncated `dur` (no extension to t=0 — handled by the `record-incoming-midi` finalize fix).
- Press play/pause again. Recording resumes from the frozen timecode. Play more notes. Their `t` continues from where the take left off (NOT t=0).
- Press stop from `record-paused`. Same behavior as stop from `record`: idle, timecode 0, recordingStartedAt cleared.
- `yarn typecheck` clean.

**Dependencies**: `record-incoming-midi` (just shipped); the finalize fix in that slice unblocks this one.

**Estimated effort**: 0.5–1 day. Reducer + spec changes dominate; UI churn is minimal (the pulse already lives off `recording`).

**Status**: pending. Surfaced during `record-incoming-midi` (2026-05-12) manual verification.

### Session save / load to a `.midirec` file

**Why**: Everything is in volatile React state today — refresh and your recording is gone. To make the tool usable across sittings, the app must serialize state to a file the user owns. Recommended format: a zipped `.midirec` archive containing a Standard MIDI File (notes + CC + pitch-bend, one track per internal channel) **plus** a sidecar `session.json` carrying app-only state (channel colors, param-lane configs, routing, tempo, time signature, lo/hi pitch windows, input-mapping rules). Renaming `.midirec` → `.zip` lets users extract the SMF for use in any DAW.

**Scope**:

- `useSession.save()` / `useSession.load(file)`: serialize/deserialize. Add a tiny zip lib dep (e.g., `fflate` — ~8KB) for the archive; SMF via `midi-file` or similar.
- Titlebar (or Statusbar) gains a file menu: `New`, `Open`, `Save`, `Save As`. Use `showSaveFilePicker` / `showOpenFilePicker` where supported (Chromium); fall back to `<a download>` + `<input type=file>` elsewhere.
- `Open` validates the archive structure and the SMF; malformed files show a banner/toast with the error and leave existing state untouched.
- Out of scope: autosave, undo across sessions, version migration. Defer.

**Verification**:

- Record a multi-channel session with CC and pitch-bend → Save → refresh the page → Open the saved file → exact same session reappears and plays back identically.
- Rename `.midirec` → `.zip`, extract → SMF imports cleanly into Logic / Ableton.
- Open a malformed file → banner/toast, no state change.
- `yarn typecheck` clean.

**Spec deltas**: new `session-io` capability.

**Dependencies**: E2E core. Independent of all other build entries; can land any time after the E2E loop closes.

**Estimated effort**: 1–1.5 days. SMF serialization is the main unknown; a small npm dep handles it.

**Status**: pending.

## Done

<!-- Move completed entries here with a date and the commit hash that resolved them. -->

- **2026-05-12** · pending archive — **DJ action track playback**. Unifies channel-roll and DJ-track dispatch into a SINGLE loop in `src/midi/scheduler.ts` walking all playable sources via a shared `emitNoteEvent` helper (note-on/note-off + optional channel-aftertouch curve). Adds `midiChannel: number` to `DJActionTrack` (seed: 16) — events emit by default on `track.midiChannel` with `event.pitch` as the output pitch, mirroring how channel-rolls emit on `Channel.id` with `Note.pitch`. `outputMap[pitch]` becomes an OPTIONAL override (channel + pitch) instead of a required prerequisite. Pressure-bearing rows additionally emit `0xD0` from `event.pressure` (or `synthesizePressure(event, perPitchIndex)` when undefined), throttled to a minimum 10 ms gap on the same channelByte; pressure points emit in the dispatch tick with future timestamps (mirrors the channel-roll's future-timestamped note-off). All DJ events share the channel-roll's single `outputSnapshot`; the `activeNoteOns` and `channelsActivated` maps absorb DJ note-ons unchanged so panic-on-stop covers the envelopes. Solo composition: any DJ track or row soloed flips the session-wide `data-soloing` flag and silences un-soloed channel-rolls. Deferred to follow-up slices: configurable CC# emission (needs an `OutputMapping.cc?` field), per-track real-output routing (the `device: DeviceId` field is label-only here), polyphonic key pressure, an editor UI for `midiChannel`. See archived change `2026-05-12-dj-action-track-playback`.
- **2026-05-12** · `f588865` — **Record incoming MIDI to the active channel**. Second of three core E2E slices. Adds `useMidiRecorder` (active-note map keyed by pitch, rAF-coalesced dispatch, hung-note finalization, chain-forward `onmidimessage`), `useTransport.recordingStartedAt`, `useChannels.appendNote`, and the record-button disabled state in the Titlebar. Single-channel routing only (`selectedChannelId`); multi-channel routing, CC/PB capture, reversible pause, and live MIDI-IN LED tap are separate backlog entries. Manual verification surfaced two pre-existing bugs that were folded into the slice: stop-while-holding extended notes back to `t=0` (origin not captured at effect setup) and the non-looping playhead wrapped at `TOTAL_T`. See archived change `2026-05-12-record-incoming-midi`.
