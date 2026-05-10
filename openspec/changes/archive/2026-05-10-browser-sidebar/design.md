## Context

The Browser Sidebar is the last unfilled aside in the app shell. Slice 0 (`tokens-and-shell`) wired the geometry and reserved `.mr-sidebar` with `width: var(--mr-w-sidebar)` and the panel surface tokens; every slice since then has filled some other region (Titlebar, Timeline, Inspector). The aside has shipped as a `<span class="mr-stub">Sidebar</span>` placeholder this entire time. Slice 6 of the implementation plan packages "Sidebar + Export Dialog" as a single half-day fill; per user direction we're splitting it into two sequential changes — this one ships the Sidebar.

Two upstream realities shape the slice:

1. **The prototype is the authoritative design source for visual content.** The implementation plan's "Sidebar sections: Devices / Files / Markers" line is a sketch — `Files` and `Markers` are not in the prototype, the screenshots, or the design tokens. The prototype's `Sidebar` (`design_handoff_midi_recorder/prototype/components.jsx` lines 144–239) ships a fully-realized four-panel layout (MIDI Inputs / MIDI Outputs / Record Filter / Routing) that the screenshots back up. Other slices in this codebase (e.g., #11 Inspector tab labels, #10 channel-grouped timeline) have established a pattern of following the prototype when it conflicts with the impl plan and logging the deviation for back-port. We do the same here.

2. **No live MIDI plumbing exists.** Web MIDI is a Slice 10 concern. The Sidebar surfaces device discovery affordances, but with no underlying device enumeration; we hardcode the prototype's fixture data (3 inputs, 2 outputs, named devices, channel suffixes, active/inactive flags) and ship the panel as a visual stub. Same convention as M/S chips, the `+ Add Lane` button, and the Inspector's bulk-action buttons. Real device wiring lands when the audio engine does.

The Sidebar is a one-time-painted region — once mounted, its content is static for this slice. There is no marquee-style "real interaction wired against demo state" path here (the way Slice 5 used `?demo=note`); the panels just render. That keeps the scope tight.

## Goals / Non-Goals

**Goals:**

- Fill the `.mr-sidebar` aside with a `<Sidebar>` component that renders the four-panel layout faithfully, matching the prototype's structure, ordering, and visual language.
- Establish reusable primitives: a `<Panel>` collapsible wrapper used by all four panels, a device-row LED-list pattern usable later for any LED-list section, a routing-matrix grid pattern.
- Port the prototype's Sidebar CSS verbatim, but de-duplicate against existing primitives (`.mr-row`, `.mr-chip`, `.mr-led`) where they already exist in the codebase.
- Log the impl-plan-vs-prototype divergence so the design source stays accountable.

**Non-Goals:**

- Live Web MIDI device enumeration (Slice 10).
- Click-to-toggle device active state, switch state mutation, channel-chip toggling, or routing-matrix cell mutation. All controls are visual stubs.
- Persisting per-panel collapse state to `useStage`. Each `<Panel>` keeps a local `useState` for open/closed.
- The Action Map panel for DJ mode (Slice 7).
- The Export Dialog overlay (Slice 6b — separate change).
- Adding `Files` and `Markers` panels from the impl plan's sketch. Not in the prototype, not in the screenshots, not designed.

## Decisions

### Decision 1: Follow the prototype's section names, not the impl plan's

**Choice:** Sections are `MIDI Inputs / MIDI Outputs / Record Filter / Routing` (prototype). The impl plan's `Devices / Files / Markers` is treated as a sketch.

**Why:** The prototype's four panels are fully designed (component code + CSS + visible in screenshot 01 and screenshot 05). The impl plan's three-panel naming has no design source — `Files` and `Markers` would require designing from scratch, doubling the slice budget. Slice 6's stated half-day target is consistent only with porting what exists.

**Alternatives considered:**

- *Build the impl plan's Devices / Files / Markers from scratch.* Rejected — no design source; would block on a design pass before code. Wrong tradeoff for a half-day slice.
- *Build the prototype's four panels AND add Files / Markers.* Rejected — unbounded scope, the question of what `Files` and `Markers` even mean (recent files? Loop markers? Time markers?) has no obvious answer.

**Mitigation:** Logged as deviation #12 in `design/deviations-from-prototype.md` with a clear ask back to the design owner: either update the impl plan to match the prototype, or redesign the prototype's Sidebar to match the impl plan. Either resolution is fine; the codebase ships what's actually designed.

### Decision 2: `<Panel>` is a generic collapsible wrapper, not four bespoke components

**Choice:** Introduce `src/components/sidebar/Panel.tsx` taking `{ icon, title, count?, defaultOpen?, children }` and rendering the `.mr-panel` head + body. The four panels are composed as four `<Panel>` instances with different children.

**Why:** All four panels share the same head structure (chevron + icon + title + optional count) and the same body container (`.mr-panel__body` with `padding: 4px var(--mr-sp-5) var(--mr-sp-5)` and `gap: var(--mr-sp-3)`). One component, one CSS rule set. The bodies differ in content but not in container.

**Alternatives considered:**

- *Write four separate components (`InputsPanel`, `OutputsPanel`, `FilterPanel`, `RoutingPanel`) each owning its own panel chrome.* Rejected — duplicates head/body markup four times; harder to keep the chevron animation and uppercase head treatment consistent.

### Decision 3: Panel collapse state is local, not stage-derived

**Choice:** Each `<Panel>` instance owns `useState<boolean>(defaultOpen ?? true)`. No coupling to `useStage`.

**Why:** Panel open/closed is pure UI ergonomics. Refreshing the page resetting all panels to default-open is fine — same convention the channel/track/lane chevrons use (those store their state in `useStage` only because they affect what gets rendered downstream into the timeline; the Sidebar's panel chevrons don't have that downstream consumer).

**Alternatives considered:**

- *Persist to `useStage` so panel state survives an HMR or reload.* Rejected — premature; no user research suggests panel state needs persistence. If it does later, lifting state to `useStage` is a localized refactor.

### Decision 4: Hoist `.mr-row`, `.mr-chip`, `.mr-led` to a shared CSS file if duplication is detected

**Choice:** Before adding any of these primitives to `Sidebar.css`, grep the codebase for existing definitions. If `.mr-row` already lives in `src/components/inspector/Inspector.css` (likely from Slice 5) and `.mr-chip` already lives in track/channel headers, hoist the shared rules to `src/styles/forms.css` (new file) and have both consumers import from there. If a primitive isn't duplicated yet, leave it in `Sidebar.css` and hoist when the next consumer arrives.

**Why:** Avoid drift. Once two components carry their own `.mr-row` rules, they will diverge, and the Inspector's row gap will subtly mismatch the Sidebar's. The forms.css hoist is cheap (~10 lines per primitive) and prevents that drift.

**Alternatives considered:**

- *Always duplicate.* Rejected — drift risk is real; we already lost an afternoon to this on `.mr-chev` getting redefined three times.
- *Always hoist proactively.* Rejected — premature abstraction. Hoist when there's a second consumer; until then, co-locate.

### Decision 5: Routing matrix uses a class-based CSS grid, not the prototype's inline-styles

**Choice:** The prototype's `RoutingMatrix` uses `style={{ display: 'grid', gridTemplateColumns: '70px repeat(3, 1fr)', ... }}` with inline styles all over. We port this to `.mr-routing`, `.mr-routing__cell`, `.mr-routing__lbl`, `.mr-routing__cb` classes in `Sidebar.css`.

**Why:** Inline styles in the prototype are a design-canvas convenience; production code wants classes for theme-token cascading and DevTools inspection. The grid is small (4×4), so the class-rule set is small (~30 lines).

**Alternatives considered:**

- *Port inline-styles verbatim.* Rejected — breaks the codebase convention of class-driven styling and makes per-theme overrides (in `tokens.css`) impossible to apply.

### Decision 6: Hardcode fixture data directly in `Sidebar.tsx`

**Choice:** The prototype's fixtures (3 inputs, 2 outputs, 6 filters, 6 channel chips, 3×3 routing grid) live as `const` arrays at the top of `Sidebar.tsx`. No separate fixtures file.

**Why:** Slice scope is "render the prototype's static screenshot." Once Slice 10 wires real MIDI, these fixtures get deleted and replaced with hook outputs. Putting them in a fixtures file now signals a longer lifetime than they actually have.

**Alternatives considered:**

- *Put fixtures in a `Sidebar.fixtures.ts` file.* Rejected — premature; fixtures are throwaway.

## Risks / Trade-offs

- **[Risk] Hoisting `.mr-row` from `Inspector.css` to `forms.css` could break the Inspector's existing rendering.** → Mitigation: before hoisting, verify the Inspector's `.mr-row` rules are byte-identical to the prototype's; if they've been customized in Slice 5, the Inspector keeps its local rule and the Sidebar hoists a renamed `.mr-form-row` (or duplicates with a `// TODO de-duplicate` comment for a follow-up).
- **[Risk] The chevron icon used by the Panel head may not match the chevron used by track/channel/lane headers.** → Mitigation: use the same chevron source as `.mr-track__hdr-chev` (likely `src/components/icons/Icons.tsx` if it exists, otherwise an inline SVG matching the existing rotation transform). Confirm via DOM inspection that the chevron looks identical.
- **[Risk] Hardcoded fixture data drifts from the prototype's fixture data over time.** → Mitigation: add a comment at the top of the fixtures const block (`// Mirror of design_handoff_midi_recorder/prototype/components.jsx Sidebar() — keep in sync until Slice 10 replaces with real device enumeration`) so future maintainers know where to look.
- **[Trade-off] Panels are not draggable / reorderable.** The prototype's order is the order. If a user wanted "Routing" at the top, they can't reorder. → Acceptable: out of scope for any visible slice in the impl plan; reorderable panels would need persistence + a drag-handle affordance + accessibility consideration. Future slice if needed.
- **[Trade-off] No keyboard activation of panel collapse.** A user with no mouse can't collapse a panel. → Acceptable for Slice 6 (consistent with the rest of the codebase, which doesn't ship full keyboard nav until a later A11y slice). The `<Panel>` head uses a `<button>` element, so the browser's native `Enter`/`Space` on focus will toggle without extra wiring.

## Open Questions

- **Where does the chevron icon source live?** If `src/components/icons/` exists with a `chev` export, reuse it; if not, the chevron is currently authored inline in track/channel/lane header components and we need to either extract or duplicate. Resolved during implementation by grep.
- **Does the codebase already have a `.mr-led` rule somewhere?** The transport-titlebar might use it for the `mrLed` recording indicator. Resolved during implementation by grep.
