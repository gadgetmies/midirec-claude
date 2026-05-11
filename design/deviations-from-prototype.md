# Deviations from the prototype

Every place where the codebase chose differently than `design_handoff_midi_recorder/prototype/`. Each item lists the rationale, where it lives in the codebase, and a recommendation on whether to back-port to the design source.

## 1. `--mr-note-sel` token value — warm orange-red instead of light blue

**What changed**: `src/styles/tokens.css` overrides `--mr-note-sel` to `oklch(72% 0.18 30)` (a warm orange-red). The upstream `design_handoff_midi_recorder/prototype/tokens.css` value is `oklch(82% 0.14 240)` — a light blue.

**Why**: The README §Design Tokens describes `--mr-note-sel` as *"selected note (warm orange-red)"*, and `screenshots/04-marquee-selection.png` renders selected notes in warm orange-red. The upstream token value contradicts both the README description and the screenshot. The codebase's local override aligns with the documented design intent.

**Where**: `src/styles/tokens.css` lines around the `--mr-note` block, with an explicit deviation comment.

**Recommendation**: Back-port to `design_handoff_midi_recorder/prototype/tokens.css` (change the value to `oklch(72% 0.18 30)` or another warm orange-red the design owner picks). Once back-ported, the codebase removes its deviation comment and resumes pure sync.

**Status**: deviation — awaiting design source fix.

## 2. Marquee corner markers removed

**What changed**: The four `.mr-marquee__corner` squares (positioned at `tl/tr/bl/br` of the marquee rectangle in the prototype) are no longer rendered. The marquee is just a dashed-stroke rectangle with the `7 SELECTED` badge alongside.

**Why**: Design owner request after visual review — the corner squares added clutter without adding signal beyond what the dashed border already conveys. Removing them simplifies the visual.

**Where**:
- JSX: `src/components/piano-roll/PianoRoll.tsx` — `.mr-marquee__corner` elements not rendered.
- CSS: `src/components/piano-roll/PianoRoll.css` — `.mr-marquee__corner` rules removed.

**Recommendation**: Back-port to `prototype/components.jsx` and `prototype/app.css` — remove the corner markers from the prototype's marquee component. Update screenshot 04 to match if regenerated.

**Status**: confirmed by design owner — back-port pending in next inbound bundle.

## 3. Marquee marching-ants animation — SVG `stroke-dashoffset` instead of CSS `background-position`

**What changed**: The marquee in the codebase is an `<svg>` containing a `<rect>` with `stroke-dasharray: 4 4` and an `animation` on `stroke-dashoffset` (0 → -8 over 0.8s linear infinite). The prototype is a `<div>` with `border: 1px dashed var(--mr-accent)` and an `animation: mr-marquee-march 0.8s linear infinite` that animates `background-position`.

**Why**: The prototype's animation has no visible effect — `background-position` only moves a repeating-pattern fill, but the marquee's `background` is a flat-color `color-mix()`, not a pattern. There's nothing for `background-position` to move, so the dashes never march. SVG `stroke-dashoffset` is the standard CSS-only way to actually animate dashed strokes.

**Where**:
- JSX: `src/components/piano-roll/PianoRoll.tsx` — the marquee renders as `<svg className="mr-marquee">` containing a `<rect className="mr-marquee__rect">`.
- CSS: `src/components/piano-roll/PianoRoll.css` — `.mr-marquee__rect` carries the dashed-stroke + animation.

**Recommendation**: Back-port to the prototype. The prototype's animation is broken; SVG with stroke-dashoffset is the right technique. Tradeoff: the DOM element type changes from `<div>` to `<svg>` — minor.

**Status**: deviation — fixes a latent bug in the prototype.

## 4. Ruler keys-column offset — JSX per-tick, not CSS `padding-left`

**What changed**: The Ruler's tick and label children are positioned at `left: KEYS_COLUMN_WIDTH + i * pxPerBeat` in JSX, where `KEYS_COLUMN_WIDTH = 56`. The original instinct was to put `padding-left: 56px` on the `.mr-ruler` element in CSS.

**Why**: CSS `padding-left` does not shift absolutely-positioned descendants — they're positioned relative to the parent's *padding box*, whose left edge is at the inner edge of the border. So absolute children with `left: 0` would still land at the visible left edge regardless of padding. Computing the offset in JSX is the only way to actually shift the ticks.

**Where**: `src/components/ruler/Ruler.tsx` — `KEYS_COLUMN_WIDTH = 56` constant; tick/label `left` includes the offset.

**Recommendation**: No back-port needed. The prototype's `Ruler` component doesn't apply this offset at all (it lets ticks span the full passed `width`, including over the keys column area). The codebase's offset is an intentional improvement so beat-0 in the Ruler aligns with beat-0 in the lane area below. Document as an enhancement.

**Status**: improvement — codebase is more correct than prototype.

## 5. Fixed-zoom rendering — constant `pxPerBeat` × `rowHeight`

**What changed**: The PianoRoll and Ruler render at fixed pixel sizes derived from constants `DEFAULT_PX_PER_BEAT = 88` (px per beat) and `DEFAULT_ROW_HEIGHT = 14` (px per pitch row). The piano roll is `KEYS_COLUMN_WIDTH + totalT * pxPerBeat` × `range * rowHeight` pixels. The viewport's center column may be wider or narrower than the piano roll; `.mr-center { overflow: hidden }` clips the fixed-size content at the column boundary.

The prototype's renderer takes `width` and `height` props and resizes responsively to fit them.

**Why**: Responsive resizing introduces ResizeObserver lag (renderer measures, then re-renders, then layout settles) and races during interactive resize where stale prop values force the renderer wider than its allocated column, overlapping the inspector. Fixed zoom decouples the renderer's intrinsic size from the viewport, making the layout robust at any window size. Horizontal/vertical scrolling to navigate a roll wider/taller than the viewport is a deliberately deferred concern — it's the right next step but isn't required for Slice 2 acceptance.

**Where**:
- Constants: `src/components/piano-roll/PianoRoll.tsx` exports `KEYS_COLUMN_WIDTH`, `DEFAULT_PX_PER_BEAT`, `DEFAULT_ROW_HEIGHT`.
- Renderer: PianoRoll and Ruler compute their own widths/heights from those constants. No `useElementSize` / `ResizeObserver` involved.
- Layout shell: `.mr-shell`, `.mr-body`, `.mr-center` all carry `min-width: 0` + `overflow: hidden` to contain the fixed-size renderer.

**Recommendation**: Confirmed by design owner — fixed-zoom rendering is the chosen approach. Horizontal/vertical scrolling is a deliberately deferred concern for a later slice. The prototype's measure-based mock can stay as-is (it's a design canvas, not production), but Slice 6+ design refreshes should assume fixed zoom + scroll/zoom UI.

**Status**: confirmed by design owner — fixed zoom is the model.

## 6. Ruler `5.1` label removed

**What changed**: For a 16-beat view (`totalT = 16`), the Ruler renders major labels `1.1`, `2.1`, `3.1`, `4.1` — but NOT `5.1` (the start of bar 5). The prototype's `Ruler` component would emit a `5.1` label at i=16.

**Why**: Bar 5 starts AT the very right edge of a 4-bar window. The `5.1` label, even if positioned correctly, falls outside the visible area (clipped by `.mr-ruler { overflow: hidden }`). And conceptually the labels should mark the start of each bar that has CONTENT visible — bar 5 has no content because the window only extends to beat 16. So we suppress the label at `i === totalT`.

**Where**: `src/components/ruler/Ruler.tsx` — label rendering condition is `major && i < totalT`.

**Recommendation**: Back-port to the prototype's `Ruler` component (suppress label at the trailing tick). Minor change.

**Status**: deviation — small bug fix.

## 7. AppShell layout — explicit grid `minmax(0, 1fr)` and `overflow: hidden`

**What changed**: `.mr-shell` has `grid-template-columns: minmax(0, 1fr)` plus `overflow: hidden`. `.mr-body` has `grid-template-columns: var(--mr-w-sidebar) minmax(0, 1fr) var(--mr-w-inspector)` (explicit `minmax(0, ...)` for shrinkability) plus `overflow: hidden`. `.mr-center` (a grid that defines `grid-template-rows` but no template columns) has `grid-template-columns: minmax(0, 1fr)` plus `min-width: 0` plus `overflow: hidden`. `.mr-stage` has `min-width: 0`.

The prototype's `app.css` `.mr-app` uses plain `1fr` columns and no `overflow: hidden` on these containers.

**Why**: With plain `1fr` (or no `grid-template-columns` at all, which defaults to an auto-sized implicit column), the column's `min-width: auto` resolves to its content's min-content width. For `.mr-shell` and `.mr-body` that's the titlebar's transport bar (several hundred pixels). For `.mr-center` that's the PianoRoll's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) — making `.mr-stage` wider than its allocated body-grid cell and pushing absolute-positioned children past the inspector boundary (e.g., M/S chips on track headers via `.mr-track__hdr`'s `flex: 1` spacer + `MSChip` at the row-end). Explicit `minmax(0, 1fr)` lets the `1fr` actually shrink to 0. `overflow: hidden` on the cascade containers (shell/body/center) contains the fixed-zoom renderer at the column boundary regardless of any one-frame resize-observer lag.

**Where**: `src/components/shell/AppShell.css`.

**Recommendation**: Back-port to `prototype/app.css`. The prototype currently doesn't surface the bug because the design canvas always renders at fixed pixel sizes (no responsive resize), but the underlying CSS will misbehave once the prototype gets a real responsive viewport. Worth fixing upstream.

**Status**: improvement — codebase is more robust.

## 8. CC lane solo composition — lane-scoped, not stage-wide

**Status**: SUPERSEDED by the `channel-grouped-timeline` change. The `data-soloing` attribute now lives on the timeline root (`.mr-timeline`) and reflects a session-global predicate (any channel/roll/lane soloed). Audibility cascades: a roll/lane is audible iff its own `soloed` OR its parent channel's `soloed`. The earlier lane-block-scoped split is gone.

## 10. Timeline organized by channel groups (Channel → Roll + CC lanes)

**What changed**: The timeline is built from `.mr-channel` groups. Each channel owns one piano-roll track and zero-or-more CC lanes that render inline beneath it. M/S and collapse exist independently at three levels (channel / roll / lane). CC lanes carry a `kind: 'cc' | 'pb' | 'at' | 'vel'` discriminator instead of a free-form `cc: string`; the seeded "Velocity" lane is renamed "Note Velocity" with `kind: 'vel'` to stop pretending it's a CC. Each channel exposes a `+ Add CC` popover for adding standard MIDI CCs or a custom CC#. Channels render only when they have content (notes or non-empty CC plots).

The prototype's `Stage` keeps tracks and CC lanes as separate sibling regions — the multi-track stack at top, the CC band at the bottom. There is no notion of a channel as an organizational unit; tracks carry a free-form `channel: "CH 1"` string and CC lanes are global to the session.

**Why**: CCs in MIDI are channel-scoped (status byte `0xBn`). Treating channels as the organizational unit makes the data model honest, lets us colocate a channel's roll with its CCs, and gives a sensible home for channel-level M/S. Inlined CCs replace the prototype's sticky-bottom band — the synchronized horizontal scroll axis is preserved, but vertical scroll moves the whole stack as one continuous list.

**Where**:
- Hook: `src/hooks/useChannels.ts` (replaces the previous `useTracks` + `useCCLanes`).
- Components: `src/components/channels/ChannelGroup.tsx`, `AddParamLaneRow.tsx`, `AddParamLanePopover.tsx`.
- Updated leaves: `src/components/tracks/Track.tsx` (now takes `roll: PianoRollTrack` and `channel: Channel`), `src/components/param-lanes/ParamLane.tsx` (kind-aware label, chevron + collapsed support).
- CSS: `.mr-channel`, `.mr-channel__hdr*` in `src/components/channels/ChannelGroup.css`. Session-global solo dim selector `.mr-timeline[data-soloing="true"] [data-audible="false"] ...` lives in the same file.

**Recommendation**: This is a structural deviation that the prototype design canvas doesn't yet model. Worth back-porting to the prototype as a refresh once the design owner reviews — the prototype's flat tracks+CCs sibling structure is a less-honest-to-MIDI shape.

**Status**: deviation — codebase moves ahead of the prototype.

## 9. M/S chips on the right edge of each CC lane row (now sticky-right)

**What changed**: The MSChip wrapper (`.mr-param-lane__ms`) is rendered as a flex-sibling of `.mr-param-lane__plot`, with `position: sticky; right: 0; z-index: 1; align-self: center`. The 56px left header strip (`.mr-param-lane__hdr`) holds only the lane name and CC label and is `position: sticky; left: 0; z-index: 2`.

The prototype's `CCLane` (`prototype/components.jsx` lines 497–504) nests `<MSChip>` inside the 56px left header alongside the lane name, so the M/S controls sit at the upper-right of the small left strip rather than the upper-right of the full lane row.

**Why**: Design owner request — the M/S chips should mirror the multi-track header convention (chips at the row's far-right end), not float in a 56px corner that's visually disconnected from the lane's identity. Right-edge placement also reads as a per-row affordance of the lane plot rather than a property of the label area. Sticky-right (instead of absolute) is required by the `synchronized-timeline-scroll` capability so the chip stays at the visible right edge of the timeline scroll container at every horizontal scroll offset, not at the natural right edge of the lane row (which would be off-screen at high scroll offsets).

**Where**:
- JSX: `src/components/param-lanes/ParamLane.tsx` — `<div className="mr-param-lane__ms">` is a sibling of `.mr-param-lane__plot`, after it in DOM order.
- CSS: `src/components/param-lanes/ParamLane.css` — `.mr-param-lane__ms { position: sticky; right: 0; flex-shrink: 0; align-self: center; z-index: 1 }`.

**Recommendation**: Back-port to `prototype/components.jsx` and `prototype/app.css` — move `<MSChip>` out of `.mr-param-lane__hdr` and place it on the lane row with right-edge alignment. (Sticky positioning is a codebase-side detail tied to scroll architecture; the prototype's design canvas doesn't need sticky because it doesn't scroll.)

**Status**: deviation — design owner direction; awaiting back-port.

## 11. Inspector tab labels — `Note / Pressure / Channel`

**What changed**: The Inspector's tab strip ships with three tabs labelled `Note`, `Pressure`, `Channel`. In Slice 5 only the `Note` tab has body content; `Pressure` and `Channel` tabs are activatable but their bodies are empty placeholders.

The prototype's Inspector (`prototype/components.jsx` lines 866–870) and screenshot 04 both show the tabs labelled `Note`, `Track`, `File`. Screenshot 04 only renders `NOTE` (active) and `TRACK` in the visible portion; `File` is documented in the prototype source.

**Why**: The implementation plan (`design_handoff_midi_recorder/IMPLEMENTATION_PLAN.md` §Slice 5) specifies the `Note / Pressure / Channel` set, anticipating that the Pressure tab is the natural surface for the per-note pressure editor that lands in Slice 9. The prototype's `Track` and `File` labels were not flagged as needed by any subsequent slice. Keeping `Pressure` visible (even with an empty body) is honest signposting for the deferred Slice 9 content; renaming to `Track`/`File` now would force a second renaming pass when Slice 9 lands.

**Where**:
- JSX: `src/components/inspector/Inspector.tsx` — `const TABS: Tab[] = ['Note', 'Pressure', 'Channel']`.

**Recommendation**: Back-port to the prototype — update the prototype's Inspector tab strip to `Note / Pressure / Channel`. The prototype currently has no Pressure-related content surface; this aligns the design source with the upcoming Slice 9 work.

**Status**: deviation — implementation plan supersedes prototype labels; awaiting prototype refresh.

## 12. Sidebar section names follow the prototype, not the implementation plan

**What changed**: The Browser Sidebar ships four panels in this order: `MIDI Inputs`, `MIDI Outputs`, `Record Filter`, `Routing`. The implementation plan (`design_handoff_midi_recorder/IMPLEMENTATION_PLAN.md` §Slice 6) describes a different set: `Devices / Files / Markers, with the activity-LED list pattern`.

**Why**: The prototype's four panels are fully realized in design — there's working component code (`design_handoff_midi_recorder/prototype/components.jsx` lines 144–239), CSS (`prototype/app.css` lines ~218–304), and they're visible in screenshot 01 (left edge) and screenshot 05 (full sidebar alongside the export dialog). The impl plan's `Devices / Files / Markers` naming is a sketch with no design source — `Files` and `Markers` would each need a fresh design pass before code, which is incompatible with the half-day Slice 6 budget. We follow the prototype because it's the more-realized source, matching the precedent set by deviation #10 (channel-grouped timeline) where the codebase advances ahead of the prototype's structure when the design is well-defined.

**Where**:
- JSX: `src/components/sidebar/Sidebar.tsx` — four `<Panel>` instances with the prototype's titles.
- CSS: `src/components/sidebar/Sidebar.css` (panel chrome, device rows, routing matrix); `src/styles/forms.css` (shared `.mr-row`, `.mr-switch`, `.mr-chip` primitives); `src/styles/leds.css` (shared `.mr-led` and `data-state` variants, hoisted from `Titlebar.css`).

**Recommendation**: Design owner decides — either update `IMPLEMENTATION_PLAN.md` §Slice 6 to read "Sidebar sections: MIDI Inputs / MIDI Outputs / Record Filter / Routing" (matching the prototype, which is what shipped), OR design `Files` and `Markers` panels in the prototype (replacing or supplementing the current four) and revisit. The codebase tracks whichever decision is made.

**Status**: deviation — codebase follows prototype as the more-realized source; awaiting impl-plan or prototype reconciliation.

## 13. Export Dialog ships the union of prototype + impl-plan fields

**What changed**: The Export Dialog ships six body fields in this order: **Format** (Standard MIDI File / NDJSON), **Filename**, **Range** (Whole session / Selection / Loop region), **Tracks** (per-channel checkbox list), **Quantize on export**, **Include CC lanes**. The footer is `Cancel` and `Save · ⌘S`.

The prototype's `ExportDialog()` (`design_handoff_midi_recorder/prototype/components.jsx` lines 1024–1075) ships only **Format**, **Filename**, **Quantize on export**, **Include CC lanes** — no Range and no Tracks. The implementation plan and the `session-model` proposal both describe **Range** (with `Whole session / Selection / Loop region` resolving through the session-model's `loopRegion` shape) and **Tracks** as part of the slice. The codebase ships the union: prototype controls plus Range and Tracks added per the impl plan / session-model.

**Why**: The prototype is from before the session-model lock-in; it predates the `loopRegion` contract and the multi-track storage shape. Both Range (the consumer of `loopRegion` per `design/session-model.md:26`) and Tracks (the impl plan's "export's Tracks checkbox list" — also the first user-facing consumer of the `tracks` capability) are required by upstream specs that landed after the prototype was authored. Shipping Format/Filename/Quantize/Include-CC alone would leave both upstream contracts without a UI consumer.

The dialog also widens to **480px** (prototype: 420px) to accommodate the additional rows comfortably; switches the format-card styling from inline-styles to class-based `.mr-fmt-card` rules per the same reasoning as deviation #10's routing matrix; and renders as a child of `.mr-shell` (no portal) so the scrim's `position: absolute; inset: 0` covers all six regions.

**Where**:
- JSX: `src/components/dialog/ExportDialog.tsx`.
- CSS: `src/components/dialog/Dialog.css` (scrim, card, format cards, range radios, tracks list).
- Hoisted primitives: `.mr-btn`, `.mr-btn[data-primary="true"]`, `.mr-input` moved to `src/styles/forms.css` (the dialog footer's `Save` button is the second consumer of `.mr-btn` after the Inspector's bulk-action buttons).
- Save behaviour: stub — emits a toast `Exported "<filename>" · <N> events` and closes. Real `.mid` / `.ndjson` serialisation is Slice 10's audio-engine concern.

**Recommendation**: Update the prototype's `ExportDialog()` to match — add a Range radio with the three options and a Tracks checkbox list. The prototype's design-canvas screenshot (05) is then in sync with the implementation, and future updates can flow either direction.

**Status**: deviation — codebase ships the impl-plan/session-model contract; prototype refresh pending.

## 14. DJ mode is a per-track kind, not a global `lanesMode` toggle

**What changed**: The prototype models DJ mode as a global timeline-wide toggle (`lanesMode: 'piano' | 'actions'`): flip it and the entire timeline re-renders as a stack of per-device units. The codebase reframes DJ mode as a **track kind** — the timeline holds a vertical stack of tracks, each with a kind chosen at creation:

- **Channel track** (today's behavior, in the `channels` capability): bound to one channel, displayed as a piano roll.
- **DJ action track** (new in Slice 7a, `dj-action-tracks` capability): has user-configured input/output routing maps (which channels feed it, where its actions emit on playback), displayed as DJ actions.

Both kinds coexist in the same timeline. The same source note can appear in both views simultaneously. There is no `lanesMode` toggle in the Toolstrip; the prototype's `Toolstrip()` Piano/Actions chip group is not ported.

Track kind is fixed at creation — no conversion affordance. The "+ Add Track" picker that lets users pick which kind to create lands in Slice 7b (or later).

**Why**: A global toggle forces the user to switch contexts to see one or the other rendering; a real session might want to view some channels as piano rolls AND aggregate some of them as a DJ controller surface at the same time. Per-track kind composes with the rest of the architecture — channels are real entities, the recording pipeline writes notes to channels, and a dj-action-track is just another renderable that consumes routing-selected events.

**Where**:
- Data: `src/data/dj.ts` — `DJ_CATEGORIES`, `DJ_DEVICES`, `DEFAULT_ACTION_MAP`, `pitchLabel`, `devColor`/`devShort`/`devLabel`.
- Hook: `src/hooks/useDJActionTracks.ts` — `DJActionTrack`, `DJTrackRouting`, the seeded default track, M/S toggles. State is sibling-array (`state.djActionTracks`) alongside `state.rolls`; storage unification is deferred.
- Component: `src/components/dj-action-tracks/DJActionTrack.tsx` + `DJActionTrack.css` — header (stripe + chev + name + count + M/S chip) and placeholder body sized to the action-map row count.
- AppShell: `src/components/shell/AppShell.tsx` — renders dj-action-tracks below the channel-groups iteration, both inside `.mr-timeline__inner`.
- Solo: `data-soloing` on `.mr-timeline` combines channel/roll/lane solo AND dj-action-track solo (`useStage`'s `soloing` flag). Dimming rule extended in `ChannelGroup.css` to cover `.mr-djtrack[data-audible="false"] .mr-djtrack__body`.

**Recommendation**: Back-port to the prototype's `lanesMode` model — the prototype should drop the global toggle and instead show channel groups + a sample dj-action-track in the same timeline. Screenshot 06 (DJ overview) would re-shoot with both kinds visible. The prototype's `ActionRoll` / `ActionRollUnit` / `ActionMapPanel` components remain useful — they become per-dj-action-track rendering (Slice 7b) rather than a global mode swap.

**Status**: deviation — architectural pivot, awaiting design-source refresh.

## 15. Default seeded session has one "DJ" dj-action-track with a 4-action demo subset

**What changed**: The default session ships with one `DJActionTrack` named "DJ" appended below the existing channel groups. Its `actionMap` contains 4 entries copied from `DEFAULT_ACTION_MAP` at pitches 48 / 56 / 60 / 71 (Play on Deck 1, Hot Cue 1 on Deck 1, FX 1 On, Crossfade ◀ on Mixer). Its `color` is `DJ_DEVICES.global.color` (warm neutral). Both `inputRouting.channels` and `outputRouting.channels` are empty.

The prototype's screenshot-06 mock seeds six per-device units (Deck 1, Deck 2, FX 1, FX 2, Mixer, Global) each with the full subset of `DEFAULT_ACTION_MAP` entries for that device, and custom open/muted/soloed defaults; the codebase does not ship those defaults.

**Why**: The track's `actionMap` is the set of actions ACTIVELY CONFIGURED on it — not a catalog reference. `DEFAULT_ACTION_MAP` (28 entries) lives in `src/data/dj.ts` as the source the future routing/add-action picker draws from. Seeding the whole map into the default track would imply "every possible action is configured" which isn't the right default; seeding empty would render a body with zero rows (valid but visually broken until the routing-add UI exists). The 4-entry subset gives the shell visible rows for demo and Slice 7b's per-action rendering testing.

The prototype's six-unit mock exists to compose screenshot 06's specific look — it's not a contract. A working app shouldn't ship with arbitrary mute/solo state pre-set on devices the user hasn't yet decided to route to; the user expects a clean slate.

**Where**:
- `src/hooks/useDJActionTracks.ts` — `seedDefault()` returns the single seeded entry.
- `design/real-time-correctness.md` — cross-cutting non-functional constraint that any future per-device default seeding must respect (no MIDI side-effects on app start).

**Recommendation**: No back-port required — the prototype's six-unit screenshot composition can stay as a screenshot-only fixture. If the design source wants a "DJ mode demo" screenshot for the per-track-kind model, re-shoot with the codebase's actual default (one DJ track + the channel groups), or with explicit `?demo=dj` fixture state if such a URL convention is added later.

**Status**: deviation — intentional default-state difference, not a back-port target.

## 16. DJ action-track keys column is 56px (matches channel-track), not 192px

**What changed**: The DJ action-track's keys column (`<ActionKeys>` rendering `.mr-djtrack__keys`) is **56px wide** — identical to the channel-track's piano-keys column (`KEYS_COLUMN_WIDTH` from `src/components/piano-roll/PianoRoll.tsx`). The prototype's `ActionKeys` and `ActionRollUnit` use **192px**.

**Why**: Channel-tracks and dj-action-tracks coexist inside the same `.mr-timeline__inner` container with a shared horizontal scroll axis. Beat 0 must land at the same x-coordinate in both kinds; otherwise the ruler ticks above won't line up with note positions in either. Aligning the keys-column width is the cheapest way to guarantee that. The prototype's 192px assumed a single-mode global view (`lanesMode: 'piano' | 'actions'`) — an architecture we already abandoned in deviation #14.

**Where**:
- `src/components/dj-action-tracks/ActionKeys.tsx` — uses the shared `KEYS_COLUMN_WIDTH = 56` value (literal in CSS for now; could be hoisted as a CSS variable later).
- `src/components/dj-action-tracks/ActionKeys.css` — `.mr-djtrack__keys { width: 56px }`.

**Recommendation**: Back-port to the prototype's `ActionKeys` / `ActionRollUnit` once the lanesMode toggle is dropped (per deviation #14). The 192px assumption goes away with the global toggle.

**Status**: deviation — falls out of the per-track architecture in deviation #14.

## 17. DJ action-track row content is `action.short` + hover-reveal compact M/S

**What changed**: Each `.mr-actkey` row in the DJ action-track keys column shows **only**:
- The action's `short` code (PLAY, CUE, HC1, HC2, ON, X◀, etc.) — the 2–4-character compact identifier that fits the 56px row without truncation. The full `action.label` (e.g. "Hot Cue 1", "Crossfade ◀") is surfaced via the row's `title` attribute as a browser tooltip.
- A compact M/S chip (`MSChip` size="xs", ~22px combined width) wired to per-row mute/solo. The chip is **hidden at rest** (`opacity: 0; pointer-events: none`) and **revealed on hover or keyboard focus-within** (`.mr-actkey:hover .mr-actkey__chip { opacity: 1 }`), overlaying the right side of the row via absolute positioning. Per-row muted/soloed state stays visible at rest via label color/opacity styling (dim text for muted, accent color for soloed) — hover only reveals the controls, not the state.

The prototype's `.mr-actkey` row shows three groups in a wider 192px row: a colored short code (PLAY, HC1, …), the full label, and the row's note name (C3, F#3, …); per-row M/S only appears on Deck 1 (`perRowMS={true}`).

**Why**: At 56px (deviation #16), the prototype's three-group layout doesn't fit. Two earlier iterations were considered and rejected: (a) showing `action.label` truncated to 5 chars with a JS-added ellipsis — but the truncation lost informative chars without buying meaningful clarity over the prototype's existing `short` code; (b) showing the M/S chip always-visible alongside the label — but its presence ate into the row's identity width and made the resting state feel busy. Settling on `action.short` gives row identity at-a-glance without any truncation, frees the entire row width to be all-identity-no-controls at rest, and surfaces the full long-form label via the existing `title` tooltip. Hover-reveal for M/S preserves discoverability (the buttons appear when needed) while keeping the resting state uncluttered. Per-row M/S is available on every dj-action-track, not just Deck 1 — the prototype's Deck-only flag was a special case for screenshot density, not a workflow distinction.

**Where**:
- `src/components/dj-action-tracks/ActionKeys.tsx` — renders `<span>{action.short}</span>` per row + an absolute-positioned `<div className="mr-actkey__chip">` wrapping the xs-size MSChip.
- `src/components/dj-action-tracks/ActionKeys.css` — `.mr-actkey__label` carries CSS `text-overflow: ellipsis` as a defensive fallback (no visible truncation for the seeded 2–4-char codes); `.mr-actkey__chip` is `opacity: 0; pointer-events: none` at rest and `opacity: 1; pointer-events: auto` under `:hover` / `:focus-within`.
- `src/components/ms-chip/MSChip.tsx` + `MSChip.css` — `size="xs"` variant for the row chip.

**Recommendation**: Back-port to the prototype's `ActionKeys` once the keys column shrinks to 56px (per deviation #16). The full label and the row's note name remain useful elsewhere (Inspector "Action" tab, ActionMapPanel) but don't belong in the per-row keys.

**Status**: deviation — falls out of the keys-column width change in #16.

## 18. DJ action-track keys row drops the 3px device-color stripe

**What changed**: `.mr-actkey` rows do **not** carry a `border-left: 3px solid devColor(action.device)` stripe. The prototype's `ActionKeys` and `ActionRollUnit` render this stripe as the device-color anchor for each row.

**Why**: Two reasons. First, at 56px wide (deviation #16), every pixel is dear; a 3px stripe consumes ~5% of the row's content width before the truncated label even starts. Second, device color survives in the **rendered notes** themselves (each note's background is `color-mix(in oklab, devColor(action.device) ..., transparent)`) — so device identity is still legible when the user scans a row's events. Dropping the stripe doesn't lose the signal, just relocates it from a static label to the dynamic content that's already there.

**Where**:
- `src/components/dj-action-tracks/ActionKeys.tsx` — no inline border-left style; comment marks the deviation.
- `src/components/dj-action-tracks/ActionKeys.css` — `.mr-actkey` carries no `border-left` rule.
- `src/components/dj-action-tracks/ActionRoll.tsx` — note backgrounds set inline using `devColor(action.device)`, preserving device identity in events.

**Recommendation**: Back-port to the prototype's `ActionKeys` only after deviations #16 and #17 (the stripe makes more sense in a 192px row with a richer keys layout; in a 56px row it's just clutter).

**Status**: deviation — visual decision tied to the 56px keys column.

---

## Summary table

| # | Deviation | Recommendation | Status |
|---|---|---|---|
| 1 | `--mr-note-sel` warm orange-red | back-port | deviation |
| 2 | Marquee corner markers removed | back-port | confirmed |
| 3 | Marquee animation → SVG | back-port | deviation, fixes bug |
| 4 | Ruler keys-column offset in JSX | document | improvement |
| 5 | Fixed-zoom rendering | confirm | confirmed |
| 6 | Ruler `5.1` label removed | back-port | deviation, small fix |
| 7 | AppShell `minmax(0, 1fr)` + `overflow: hidden` | back-port | improvement |
| 8 | CC-lane solo scope is lane-only | superseded | superseded by #10 |
| 9 | M/S chips on right edge of CC lane | back-port | deviation |
| 10 | Channel-grouped timeline (Channel → Roll + CCs) | back-port pending | deviation |
| 11 | Inspector tabs `Note / Pressure / Channel` (vs prototype `Note / Track / File`) | back-port | deviation |
| 12 | Sidebar sections follow prototype (`MIDI Inputs / MIDI Outputs / Record Filter / Routing`) over impl plan (`Devices / Files / Markers`) | back-port to impl plan, OR design Files/Markers panels | deviation |
| 13 | Export Dialog adds Range + Tracks rows, widens to 480px, classifies format cards | back-port — refresh prototype dialog to match | deviation |
| 14 | DJ mode is a per-track kind, not a global `lanesMode` toggle | back-port — drop the lanesMode toggle, model dj-action-tracks per-track | deviation, architectural |
| 15 | Default seeded session has one "DJ" dj-action-track (empty routing) instead of the prototype's six per-device units | no back-port — intentional default-state difference | deviation |
| 16 | DJ action-track keys column is 56px (matches channel-track) instead of 192px | back-port — falls out of the per-track architecture | deviation |
| 17 | DJ action-track row content is `action.short` (no truncation needed) + hover-revealed compact M/S; per-row M/S available on every track | back-port — pairs with #16 | deviation |
| 18 | DJ action-track keys row drops the 3px device-color stripe; device color lives only in rendered notes | back-port — pairs with #16 | deviation |
