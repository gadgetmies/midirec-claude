## MODIFIED Requirements

### Requirement: Ruler offsets its content by the keys-column width

The `.mr-ruler` element SHALL render its tick + label children offset by 56px from the region's left edge, so beat tick `0` aligns vertically with the left edge of the lane area in the `PianoRoll` below. The offset SHALL be applied in the component's JSX by computing `left = 56 + i * pxPerBeat` for each tick (and matching `left` for each label).

To make this offset visually robust under the timeline's horizontal scroll, the Ruler SHALL ALSO render a sticky-left mask element as the first child of `.mr-ruler`:

```html
<div className="mr-ruler__keys-spacer" />
```

`.mr-ruler__keys-spacer` SHALL have computed style `position: sticky; left: 0; top: 0; width: 56px; height: 100%; background: var(--mr-bg-panel); z-index: 3`. This element occupies the area directly above the keys column at every horizontal scroll offset, masking any beat tick whose computed `left` value would otherwise show through the keys area when the user scrolls right.

The 56px literal mirrors `.mr-keys { width: 56px; }` from the PianoRoll stylesheet; both literals come from `prototype/app.css` and remain duplicated in this slice. A future slice MAY promote them to a shared `--mr-w-keys` token in `tokens.css`.

#### Scenario: Ruler tick at beat 0 aligns with lane area

- **WHEN** the app is rendered with `<Ruler />` above `<PianoRoll />` in the same column AND the timeline is at scroll offset `0`
- **THEN** the first `.mr-ruler__tick`'s rendered `getBoundingClientRect().left` SHALL equal `.mr-roll__lanes`' `getBoundingClientRect().left` (within ±1px tolerance)

#### Scenario: Keys-spacer masks ticks under horizontal scroll

- **WHEN** the user horizontally scrolls `.mr-timeline` so beat tick `0` would render at a negative `left` relative to the visible area
- **THEN** `.mr-ruler__keys-spacer` SHALL remain visible at the left edge of the visible scroll area
- **AND** `.mr-ruler__keys-spacer`'s computed `z-index` SHALL be `3` (above ticks and labels)
- **AND** no tick SHALL be visible to the left of the keys-spacer's right edge

### Requirement: Ruler stylesheet ports prototype rules verbatim

The codebase SHALL ship `src/components/ruler/Ruler.css` containing the rules from `prototype/app.css` lines ~466–490 covering: `.mr-ruler`, `.mr-ruler__tick`, `.mr-ruler__tick--major`, `.mr-ruler__lbl`. All visual values SHALL resolve through `--mr-*` tokens.

In addition to the prototype's rules, the stylesheet SHALL define:

- `.mr-ruler { position: sticky; top: 0; z-index: 3 }` — pinning the Ruler to the top of `.mr-timeline`'s visible area at all vertical scroll offsets.
- `.mr-ruler__keys-spacer { position: sticky; left: 0; top: 0; width: 56px; height: 100%; background: var(--mr-bg-panel); z-index: 3 }` — the new sticky-left mask element (see the "Ruler offsets its content" requirement).

`.mr-ruler` SHALL NOT carry `overflow: hidden`; the outer `.mr-timeline` clips horizontally.

#### Scenario: Ruler uses panel surface and hairline divider

- **WHEN** computed styles are inspected for the `.mr-ruler` element
- **THEN** its `background-color` SHALL match the computed value of `--mr-bg-panel`
- **AND** its `border-bottom` SHALL be `1px solid` matching the computed value of `--mr-line-2`

#### Scenario: Ruler is sticky-top inside the timeline

- **WHEN** the rendered DOM is inspected
- **THEN** `.mr-ruler`'s computed `position` SHALL be `sticky` with `top` resolving to `0`
- **AND** `.mr-ruler`'s computed `z-index` SHALL be `3`

#### Scenario: No new hex literals or oklch in CSS

- **WHEN** `src/components/ruler/Ruler.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases
