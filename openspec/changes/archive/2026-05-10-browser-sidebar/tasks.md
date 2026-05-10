## 1. Reconnaissance & primitive consolidation

- [x] 1.1 Grep `src/**/*.css` for existing `.mr-row {`, `.mr-chip {`, `.mr-led {`, `.mr-chev {` definitions. **Findings**: only `.mr-led` exists today (in `src/components/titlebar/Titlebar.css` lines 269–301, with all 3 `data-state` variants and the `mrLed` keyframes; one prototype-deviation already there — `play`-state glow uses `--mr-accent-soft` instead of an oklch literal per the no-oklch rule). `.mr-row`, `.mr-chip`, `.mr-switch`, `.mr-chev` are NOT defined anywhere; existing chevron headers use per-component classes (`.mr-channel__chev`, `.mr-track__chev`, `.mr-param-lane__chev`) with the `▾` text glyph and a 90° rotation rule via per-component `[data-collapsed="true"]` attribute. M/S chips use `.mr-ms__btn`, not `.mr-chip`. `.mr-btn` exists in `Inspector.css` (slice-local).
- [x] 1.2 Grep `src/**/*.tsx` for existing chevron icon source. **Findings**: no shared chevron icon component. `src/components/icons/transport.tsx` exposes `ChevDownIcon` (10×10 SVG path) but it isn't currently consumed by the headers (they use the `▾` Unicode glyph inline). Sidebar will use `ChevDownIcon` from the existing icons module — no extraction needed.
- [x] 1.3 Hoisting plan: (a) move `.mr-led` + keyframes from `Titlebar.css` into a new `src/styles/leds.css`, imported once from `main.tsx`; (b) introduce `src/styles/forms.css` with `.mr-row`, `.mr-row-lbl`, `.mr-switch`, `.mr-chip` since the Record Filter (this slice) AND the future Export Dialog (Slice 6b) both consume them; (c) leave `.mr-chev` co-located in `Sidebar.css` (only one consumer for now — hoist on the next consumer). Existing per-component `*__chev` classes are NOT touched (different names, different glyph, different rotation trigger; they'll converge in a future cleanup).
- [x] 1.4 No icon extraction needed — `ChevDownIcon` already exists in `src/components/icons/transport.tsx`. Mic, route, and filter icons are NEW and will be added to that same module so all icons live in one place.

## 2. Sidebar component scaffolding

- [x] 2.1 Created `src/components/sidebar/` with `Sidebar.tsx`, `Sidebar.css`, `Panel.tsx`. Routing matrix is inlined in `Sidebar.tsx` as small helper components (`RoutingMatrix`, `RoutingRow`) since the whole grid fits in ~30 lines.
- [x] 2.2 `<Panel>` renders `.mr-panel` with `data-open`, `.mr-panel__head` as a `<button type="button">`, head contents = `.mr-chev` + `icon` + title text + optional `.mr-panel__count`. Body renders only when open.
- [x] 2.3 `useState<boolean>(defaultOpen ?? true)` drives open/close. Chevron rotation is via `.mr-panel[data-open="true"] .mr-chev { transform: rotate(90deg) }` in `Sidebar.css`.
- [x] 2.4 Added `MicIcon`, `RouteIcon`, `FilterIcon` to `src/components/icons/transport.tsx` (existing module — already had `ChevDownIcon` which `<Panel>` reuses for the chevron). All icons use `currentColor`. **Follow-up during review**: the timeline-track headers (`.mr-channel__chev`, `.mr-track__chev`, `.mr-param-lane__chev`) were updated to use `<ChevDownIcon />` as well, replacing the `▾` Unicode glyph for visual consistency across all collapsible headers in the app. Per-component chev classes are unchanged.

## 3. Sidebar fixtures and panels

- [x] 3.1 Fixtures declared at the top of `Sidebar.tsx`: `Device` type, `INPUTS` (3), `OUTPUTS` (2), `FILTERS` (6), `CHANNEL_CHIPS` (6), `ROUTING` (3×3). Comment block points to the prototype's `Sidebar()` source.
- [x] 3.2 `<Sidebar>` returns a fragment of four `<Panel>` children in fixed order.
- [x] 3.3 Both inputs and outputs panels delegate to a `<DeviceRow>` helper that handles the `data-active` (set only when `device.active === true`) and `data-state` (set only when `led !== 'off'`) conditional attributes.
- [x] 3.4 Record Filter panel maps `FILTERS` to `.mr-row` rows (with `.mr-switch` rendered as a `<button>` for keyboard activation + `aria-pressed`). Channel chips render in `.mr-sidebar__chip-strip` flex-wrap container as `.mr-chip` `<button>` elements.
- [x] 3.5 Routing panel renders `<RoutingMatrix>` — emits 16 cells: empty corner, 3 `.mr-routing__hdr` cells, then for each input row a `.mr-routing__lbl` cell + 3 `.mr-routing__cell` checkbox wrappers. The checkbox itself is a `.mr-routing__cb` div with `data-on`, containing an SVG check-path when on.

## 4. Sidebar CSS port

- [x] 4.1 `.mr-sidebar` surface, border-right, and overflow remain owned by `AppShell.css` (matches the convention `Inspector.css` uses). `Sidebar.css` only adds `display: flex; flex-direction: column` so the panels stack.
- [x] 4.2 `.mr-panel`, `.mr-panel:last-child {border-bottom: 0}`, `.mr-panel__head`, `.mr-panel__head:hover`, `.mr-panel__head-l`, `.mr-chev`, `[data-open="true"] .mr-chev`, `.mr-panel__count`, `.mr-panel__body` ported into `Sidebar.css`. Note: the prototype's `.mr-panel:last-child { flex: 1; min-height: 0 }` was dropped — it makes the last panel grow to fill available height, but the codebase's panels are content-sized and we want consistent panel heights, not a stretching last panel.
- [x] 4.3 `.mr-led` + 3 `data-state` variants + `mrLed` keyframes hoisted from `Titlebar.css` to a new `src/styles/leds.css`, imported once from `main.tsx`. Titlebar.css now references it via a comment.
- [x] 4.4 `.mr-dev` (hover, `[data-active="true"]` background, 2px `::before` stripe) ported into `Sidebar.css`.
- [x] 4.5 `.mr-dev__name` (truncating, `--mr-fs-11`) and `.mr-dev__ch` (mono, `--mr-fs-10`, `--mr-text-3`) ported into `Sidebar.css`.
- [x] 4.6 `.mr-row` / `.mr-row-lbl` placed in new `src/styles/forms.css` (no prior consumer — Inspector uses `.mr-kv`, not `.mr-row`). Imported once from `main.tsx`.
- [x] 4.7 `.mr-switch` (with `::after` thumb + `data-on` translate) ported into `src/styles/forms.css`. Thumb animation uses `var(--mr-dur-base) var(--mr-ease)` per spec.
- [x] 4.8 `.mr-chip` ported into `src/styles/forms.css` (no prior consumer — M/S chips use `.mr-ms__btn`, not `.mr-chip`).
- [x] 4.9 Routing matrix CSS authored in `Sidebar.css` as class-based rules: `.mr-routing` (grid container with `gap: 1px; background: var(--mr-line-1); padding: 1px`), `.mr-routing__cell` (panel-bg cell), `.mr-routing__hdr` (uppercase center-aligned), `.mr-routing__lbl` (mono left-aligned), `.mr-routing__cb` (14×14 checkbox with optional check SVG), `.mr-routing__corner` (empty top-left).

## 5. AppShell integration

- [x] 5.1 `AppShell.tsx` now renders `<aside className="mr-sidebar"><Sidebar /></aside>` — stub removed.
- [x] 5.2 `Sidebar` imported from `'../sidebar/Sidebar'`.
- [x] 5.3 `AppShell.css` unchanged — the aside's surface/border/overflow rules from Slice 0 are reused unchanged.

## 6. Spec sync and design-doc updates

- [x] 6.1 Added deviation #12 to `design/deviations-from-prototype.md`.
- [x] 6.2 Added the summary-table row.
- [x] 6.3 `design/README.md` only references the deviations file (no duplicate table) — no sync needed.

## 7. Verification

- [x] 7.1 `yarn typecheck` — clean.
- [x] 7.2 `yarn test --run` — 13/13 passing (no new tests added; no pure helpers introduced).
- [x] 7.3 `openspec validate browser-sidebar --strict` — `Change 'browser-sidebar' is valid`.
- [x] 7.4 Visual check — user verified ("looks good now, verified") after a chevron-glyph refinement: the Panel chevrons, channel headers, track headers, and param-lane headers were unified to all use `<ChevDownIcon />` from `src/components/icons/transport.tsx` (replacing the `▾` Unicode glyph in the timeline-track headers). All four collapsible-header levels now share the same SVG caret with consistent rotation behavior.
- [x] 7.5 `grep -rn 'mr-stub' src/components/shell/` — matches only Toolstrip and Statusbar (the `.mr-stub` CSS class definition is also a match, expected). Sidebar stub is gone.
- [x] 7.6 `grep -rn '^.mr-row \|^.mr-chip \|^.mr-led \|^.mr-chev \|^.mr-switch ' src/` — each primitive appears in exactly one CSS file: `.mr-row` and `.mr-row-lbl` in `forms.css`, `.mr-chip` in `forms.css`, `.mr-switch` in `forms.css`, `.mr-led` in `leds.css`, `.mr-chev` in `Sidebar.css`.

## 8. Pre-archive cleanup

- [x] 8.1 Re-read the proposal and spec deltas. The only structural divergences from the original plan: (a) `.mr-row`, `.mr-chip`, `.mr-switch`, `.mr-led` actually live in `src/styles/forms.css` + `src/styles/leds.css` instead of `Sidebar.css` (covered by the spec's "primitives are reused if they exist" requirement); (b) the timeline-track headers were updated to use `<ChevDownIcon />` for visual consistency with the new Panel chevron — strictly an enhancement to the existing per-component classes, no spec rewrite needed.
- [x] 8.2 All boxes are `[x]` except 7.4 (visual check) which is deferred to the user since the agent has no browser. The dev server is running and the module compiles cleanly through Vite.
- [x] 8.3 Handed off to `/opsx:archive` — moves change into `openspec/changes/archive/<date>-browser-sidebar/` and syncs `openspec/specs/`.
