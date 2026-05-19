## Why

In DJ-style arrangements, phrases (16-beat / 4-bar groups) are the dominant structural unit operators think in. The ruler currently shows `{bar}.{beat}` only, which forces users to mentally divide bar numbers by 4 to locate phrase boundaries — slow and error-prone when scanning long arrangements or aligning cluster edits to phrase grid. Surfacing the phrase number on the ruler makes 16-beat intervals visible at a glance.

## What Changes

- Extend the ruler's major-tick label to include the phrase number alongside the bar/beat, using the form `{phrase}.{bar}.{beat}` so phrase 1 spans bars 1–4, phrase 2 spans bars 5–8, etc.
- Visually emphasize phrase-boundary ticks (every 16 beats) so they are distinguishable from regular bar majors at a glance.
- No new component, no behavior change to playback, scrolling, zoom, or layout horizon.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ruler`: Bar/beat label format expands to include a phrase number, and phrase-boundary ticks gain a distinct visual emphasis.

## Impact

- Code: `src/components/ruler/Ruler.tsx` (label math, optional phrase-boundary class) and `src/components/ruler/Ruler.css` (phrase-tick rule).
- Specs: `openspec/specs/ruler/spec.md` requirement covering label format and tick differentiation.
- Tests: any existing ruler tests that assert label strings (e.g., `1.1`, `2.1`) will need updates to the new format.
- No API, dependency, runtime, or persisted-data impact. MIDI/audio behavior unchanged.
