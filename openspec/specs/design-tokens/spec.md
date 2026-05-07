### Requirement: Codebase consumes tokens.css verbatim

The codebase SHALL import `tokens.css` from `design_handoff_midi_recorder/prototype/tokens.css` as a byte-identical copy located at `src/styles/tokens.css`. The codebase MUST NOT introduce hand-typed color, spacing, radius, shadow, or type-scale literals in component CSS — every visual value MUST resolve through a `--mr-*` custom property.

#### Scenario: Tokens copy matches the design source

- **WHEN** the codebase contains `src/styles/tokens.css` and the design source is at `design_handoff_midi_recorder/prototype/tokens.css`
- **THEN** the contents of the two files SHALL be byte-identical except for an optional leading sync-header comment in the codebase copy
- **AND** running `diff` on the two files (ignoring the sync-header) SHALL produce no output

#### Scenario: No hex literals in component CSS

- **WHEN** any component stylesheet under `src/` is inspected
- **THEN** it SHALL NOT contain a hex color literal (e.g. `#1a1a1a`), an `oklch(...)` literal, or a hardcoded pixel size that duplicates a token value
- **AND** all colors, radii, shadows, spacing, and font sizes SHALL be expressed as `var(--mr-*)` references

### Requirement: Console theme is active on the app root

The app SHALL apply the attribute `data-mr-theme="console"` to the root DOM element so that the scoped token block in `tokens.css` activates.

#### Scenario: Theme attribute is present at runtime

- **WHEN** the app is rendered in the browser
- **THEN** the document root (or the top-most React-rendered shell element) SHALL carry the attribute `data-mr-theme="console"`
- **AND** computed style of `--mr-bg-app` on the root SHALL resolve to the value defined under `[data-mr-theme="console"]` in `tokens.css`

### Requirement: Mono font enforces tabular numerals

Any element using `--mr-font-mono` SHALL render numerals with `font-variant-numeric: tabular-nums` so that timecode and other numeric readouts have fixed-width digits.

#### Scenario: Mono utility class enforces tabular numerals

- **WHEN** an element has the class `mr-mono` (or otherwise consumes `--mr-font-mono` via the codebase's mono utility)
- **THEN** its computed `font-variant-numeric` SHALL include `tabular-nums`

### Requirement: Display and mono font families are loaded

The app SHALL load `Inter` (display) and `JetBrains Mono` (mono) such that `--mr-font-display` and `--mr-font-mono` resolve to those families before first paint of any visible content.

#### Scenario: Fonts available at first paint

- **WHEN** the app's entry module is executed
- **THEN** the Inter and JetBrains Mono font faces SHALL be registered (via self-hosted bundling, e.g. `@fontsource/*`)
- **AND** elements using `--mr-font-display` SHALL render in Inter (or its declared fallback chain) without an unstyled-font flash that swaps to a serif default
