## MODIFIED Requirements

### Requirement: CCLane renders a 56px header strip with right-aligned M/S chips

The `CCLane` component SHALL render a `<div className="mr-cc-lane" data-muted={lane.muted} data-soloed={lane.soloed}>` containing three children, in this order: `.mr-cc-lane__hdr` (the 56px-wide left strip with the lane name and CC label), `.mr-cc-lane__plot` (the SVG plot at intrinsic timeline width), and `.mr-cc-lane__ms` (the M/S chip wrapper).

`.mr-cc-lane` SHALL be `display: flex; align-items: stretch` so its three children lay out horizontally and consume the row's intrinsic width.

The left header strip (`.mr-cc-lane__hdr`) SHALL be `position: sticky; left: 0; z-index: 2; flex-shrink: 0` and SHALL contain:

- `<span className="mr-cc-lane__name">{lane.name}</span>` rendering the uppercase 9px lane name in `var(--mr-text-2)`.
- `<span className="mr-cc-lane__cc">CC {lane.cc}</span>` rendering the CC label in 9px monospace `var(--mr-text-3)`. The literal text "CC " is hard-coded; the variable portion is `lane.cc`.

The header strip's computed width SHALL equal `56px` and its background SHALL be `var(--mr-bg-panel-2)` so it visually masks the plot beneath it at any horizontal scroll offset of `.mr-timeline`.

The M/S chip wrapper (`.mr-cc-lane__ms`) SHALL contain `<MSChip muted={lane.muted} soloed={lane.soloed} onMute={...} onSolo={...} />` (reused from the `tracks` capability without modification). It SHALL be `position: sticky; right: 0; flex-shrink: 0; z-index: 1; align-self: center` (or equivalent vertical-centering) and SHALL be padded such that its visual right edge sits 8px from `.mr-timeline`'s visible right edge regardless of scroll offset.

The middle `.mr-cc-lane__plot` SHALL be `flex: 1` (so it stretches to fill the row's intrinsic width minus the two sticky strips' widths) and SHALL participate in horizontal scroll via the outer `.mr-timeline`.

This layout uses `position: sticky` rather than `position: absolute` (a change from prior versions of this requirement) so the M/S chip stays visible at the right edge of the visible scroll area, not at the natural right edge of the lane row (which would be off-screen at high horizontal scroll offsets).

The placement of `<MSChip>` outside the 56px left header is a deliberate deviation from `prototype/components.jsx` lines 497–504, recorded in `design/deviations-from-prototype.md` (entry #9: "M/S chips on right edge of CC lane").

#### Scenario: Header structure for a representative lane

- **WHEN** `<CCLane lane={{ id:"cc2", name:"Pitch Bend", cc:"PB", ... }} />` is rendered
- **THEN** the rendered DOM SHALL contain `.mr-cc-lane__hdr > .mr-cc-lane__name` with text `"Pitch Bend"`
- **AND** SHALL contain `.mr-cc-lane__hdr > .mr-cc-lane__cc` with text `"CC PB"`
- **AND** SHALL contain `.mr-cc-lane > .mr-cc-lane__ms > .mr-ms` (the M/S wrapper outside the left header)
- **AND** the rendered `.mr-cc-lane__hdr` SHALL NOT contain the `.mr-ms` element

#### Scenario: Header sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural left edge of the lane would scroll out the visible left
- **THEN** `.mr-cc-lane__hdr`'s computed `position` SHALL be `sticky` with `left` resolving to `0`
- **AND** the lane name and CC label SHALL stay visible at the left edge of the visible scroll area at every scroll offset

#### Scenario: M/S chips stick to the visible right edge

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural right edge of the lane would scroll out the visible right
- **THEN** `.mr-cc-lane__ms`'s computed `position` SHALL be `sticky` with `right` resolving to `0`
- **AND** the M/S chip cluster SHALL stay clickable at the right edge of the visible scroll area at every scroll offset

#### Scenario: Header data attributes mirror lane state

- **WHEN** `<CCLane lane={{ ..., muted:true, soloed:false }} />` is rendered
- **THEN** the rendered `.mr-cc-lane` SHALL have `data-muted="true"` and `data-soloed="false"`
