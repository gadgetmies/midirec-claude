## 1. Ruler component changes

- [x] 1.1 Add `BEATS_PER_BAR = 4` and `BEATS_PER_PHRASE = 16` named constants at module scope in `src/components/ruler/Ruler.tsx`
- [x] 1.2 Update major-tick label rendering to compute `phrase = 1 + Math.floor(beatIdx / BEATS_PER_PHRASE)`, `bar = (Math.floor(beatIdx / BEATS_PER_BAR) % (BEATS_PER_PHRASE / BEATS_PER_BAR)) + 1` (bar resets each phrase), `beat = (beatIdx % BEATS_PER_BAR) + 1`, emit text `{phrase}.{bar}.{beat}`
- [x] 1.3 When `beatIdx % BEATS_PER_PHRASE === 0`, add `mr-ruler__tick--phrase` to the tick's className (alongside `mr-ruler__tick` and `mr-ruler__tick--major`)
- [x] 1.4 Confirm the thinning branch still preserves all `beatIdx % 4 === 0` ticks (no logic change needed; phrase ticks are a subset)

## 2. Ruler stylesheet changes

- [x] 2.1 Add `.mr-ruler__tick--phrase` rule in `src/components/ruler/Ruler.css` giving the line a stronger visual weight than `--mr-line-2`, using an existing `--mr-*` token only (no hex / no `oklch(...)`)
- [ ] 2.2 Verify in browser that the phrase tick is visually distinguishable from `mr-ruler__tick--major` against the panel background at default zoom *(manual; not run by Claude)*

## 3. Tests

- [x] 3.1 Update any ruler tests that assert label strings (`1.1`, `2.1`, etc.) to expect the new `{phrase}.{bar}.{beat}` format *(no-op: no pre-existing Ruler tests in repo)*
- [x] 3.2 Add a test (or scenario in an existing test) asserting that for `totalT=32` the phrase ticks (`beatIdx % 16 === 0`) carry the `mr-ruler__tick--phrase` class and the labels increment phrase number at beat 16 *(added `src/components/ruler/Ruler.test.tsx`)*
- [x] 3.3 Add a CSS-grep guard in tests (if a similar guard exists elsewhere) confirming no new hex or `oklch` literal appears in `Ruler.css` *(added in `Ruler.test.tsx` via `Ruler.css?raw` import)*

## 4. Verification

- [x] 4.1 Run typecheck and the project test suite; all green *(typecheck clean; ruler suite 5/5 green; 6 unrelated pre-existing `DJValueEditor.height.test.ts` failures confirmed to exist on baseline)*
- [ ] 4.2 Manually scan the ruler in the running app at a typical horizon and confirm phrase boundaries are obvious without reading the labels *(manual; not run by Claude)*
- [ ] 4.3 Confirm no regressions to ruler sticky-top, keys-column spacer, or scroll alignment with the piano roll *(manual; not run by Claude)*
