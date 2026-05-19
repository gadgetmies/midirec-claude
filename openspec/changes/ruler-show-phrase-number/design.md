## Context

The ruler at `src/components/ruler/Ruler.tsx` currently labels every bar boundary (every 4 beats) as `{bar}.{beat}` — e.g. `1.1`, `2.1`, `3.1`, `4.1`, `5.1`. In DJ-oriented arrangements the working unit is the phrase (16 beats / 4 bars). Operators repeatedly compute "which phrase is bar N in" by hand. The proposal adds phrase number to the label and visually emphasizes the 16-beat boundary so the structure is legible at a glance.

The ruler is a single, small, stateless component. Labels render only on major ticks (beats divisible by 4). The only data source is `layoutHorizonTicks` + `pxPerBeat`; no session-model or persistence change is involved.

## Goals / Non-Goals

**Goals:**
- Each major-tick label includes the phrase number alongside the bar/beat in a single, readable token.
- Phrase boundaries (every 16 beats) are visually distinct from regular bar majors at any zoom, including when ruler thinning is active.
- Math is pure derivation from `beatIdx`; no new props, no new state.

**Non-Goals:**
- No change to phrase semantics elsewhere (no new "phrase" data model, no quantize/snap-to-phrase, no playhead-on-phrase events).
- No change to tick spacing, scroll, zoom, or layout-horizon math.
- No configurable phrase length — fixed at 16 beats / 4 bars for this slice. (Time signatures other than 4/4 are out of scope alongside the existing ruler's bar=4 assumption.)
- No keys-column-spacer, sticky-top, or token changes.

## Decisions

**Decision 1: Label format `{phrase}.{barInPhrase}.{beat}`, bar resets each phrase**

Adopt a three-component dot-separated label, where `phrase = 1 + floor(beatIdx / 16)`, `bar = (floor(beatIdx / 4) % 4) + 1` (bar is the bar-within-phrase, resetting to `1` at each phrase boundary), and `beat = (beatIdx % 4) + 1`.

Rationale: when the leading phrase number changes, the bar number resetting to `1` reinforces the structural boundary visually — both numbers move together. A non-resetting bar reads as a continuous counter and dilutes the phrase signal the label is meant to deliver. Examples for the first 20 beats: `1.1.1`, `1.2.1`, `1.3.1`, `1.4.1`, `2.1.1`, `2.2.1`, `2.3.1`, `2.4.1`, `3.1.1`...

Alternatives considered:
- `{phrase}.{globalBar}.{beat}` (bar is a globally monotonic counter, e.g. `1.1.1, 1.2.1, 1.3.1, 1.4.1, 2.5.1, 2.6.1`): rejected — the bar number doesn't visually reset at the phrase boundary, weakening the readability win.
- Render phrase on a separate band/row above the ruler: rejected for this slice — doubles ruler height and requires layout token work; not necessary to deliver the readability win.
- Show phrase only at phrase boundaries (omit when bar is mid-phrase): rejected — a label that sometimes hides the phrase forces re-decoding bar→phrase, defeating the purpose.

**Decision 2: Phrase-boundary tick gets `mr-ruler__tick--phrase` modifier**

Major ticks where `beatIdx % 16 === 0` SHALL additionally carry the `mr-ruler__tick--phrase` class. CSS gives this class a more prominent treatment (brighter line color via an existing token, e.g. `--mr-line-3` if available, otherwise `--mr-text-2` — final token choice picked in implementation against the design-tokens spec, with no new hex literals).

Rationale: relying solely on the textual label means users still have to read to find a phrase boundary; a stronger vertical guide gives the spatial cue the proposal asks for. Adding a third tick class is consistent with the existing `tick` / `tick--major` pattern and doesn't change any existing selector.

Alternatives considered:
- Bold the phrase label only: rejected — text emphasis is easy to miss at small font sizes and doesn't help when scanning the lanes below.
- Add a background band every 16 beats: rejected — non-trivial DOM (extra absolute-positioned divs), interacts with lane rendering, exceeds slice scope.

**Decision 3: Behavior under ruler thinning is unchanged**

The existing thinning rule (when `layoutHorizonTicks > GRID_TICK_THINNING_THRESHOLD_TICKS`, only render `beatIdx % 4 === 0`) is unaffected — phrase boundaries (`beatIdx % 16 === 0`) are a strict subset of bar majors (`beatIdx % 4 === 0`), so they survive thinning. The phrase-tick class and updated label apply identically in both modes.

## Risks / Trade-offs

- **Label width grows from up to ~4 chars (`12.1`) to up to ~7+ chars (`12.45.1`)** → at high zoom-out with many bars visible, labels could overlap more than today. Mitigation: thinning already drops non-major ticks for wide horizons, and the existing `transform: translateX(4px)` keeps labels left-anchored at their tick; if overlap becomes a real issue we can revisit by hiding non-phrase labels at extreme widths in a follow-up, but it is not expected at typical session lengths.
- **Time-signature assumption baked deeper** → using a literal "16" alongside the existing literal "4" further hard-codes 4/4. The existing spec already assumes 4 beats per bar; adding 16 beats per phrase is consistent. Mitigation: extract both as named constants (`BEATS_PER_BAR = 4`, `BEATS_PER_PHRASE = 16`) at the top of `Ruler.tsx` so a future time-signature slice has one place to change.
- **Existing tests assert label strings like `1.1`, `2.1`** → those will fail and need updating to the new format. Mitigation: update them as part of this change; they are colocated and small.
- **Color contrast of the phrase tick** → using a stronger token risks visual noise. Mitigation: pick the token in implementation by comparing in-browser against the `--mr-line-2` major and the panel background, and stay within the existing token palette.
