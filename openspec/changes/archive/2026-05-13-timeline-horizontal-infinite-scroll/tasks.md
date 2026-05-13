## 1. Session horizon derivation

- [x] 1.1 Add pure helper `deriveLayoutHorizonBeats(seed)` aggregating endpoints from rolls, lanes, DJ events (reuse export-style `max` logic where it already exists).
- [x] 1.2 Publish `layoutHorizonBeats` (+ constants `MIN_VISIBLE_BEATS`, `TAIL_PADDING_BEATS`) from `useStage` / `useChannels` with stable defaults matching current seeded span when session is short.
- [x] 1.3 Invalidate / recompute when notes, lanes, or DJ payloads change (`appendNote`, lane append, dj mutations).

## 2. Timeline shell wiring

- [x] 2.1 Drive `.mr-timeline__inner.style.width = KEYS_COLUMN_WIDTH + layoutHorizonBeats * DEFAULT_PX_PER_BEAT` from `AppShell.tsx` replacing fixed `TOTAL_T` width coupling.
- [x] 2.2 Add guarded `clampTimelineScroll(el: HTMLElement)` (or equivalent) invoking `scrollLeft = Math.max(0, scrollLeft)` on ResizeObserver/layout effects and programmatic scroll paths.
- [x] 2.3 Pass `layoutHorizonBeats` into `ChannelGroup`, `DJActionTrack`, and `Ruler`.

## 3. Rendering surfaces

- [x] 3.1 `Ruler`: accept `layoutHorizonBeats`, generate ticks with thinning policy beyond agreed cap while preserving majors at multiples of four beats aligned to prototype bar numbering.
- [x] 3.2 `PianoRoll`: split stripe width (`layoutHorizonBeats`) from window-length props (`totalT`, `viewT0`); keep note filtering unchanged.
- [x] 3.3 `ParamLane` + minimaps + `Track` wrappers: widen inline widths/playhead ratios to stripe pixel width based on horizon.
- [x] 3.4 `ActionRoll` / DJ body: consume same horizon-driven width constants.

## 4. Verification

- [x] 4.1 Manual: widest session — scroll right beyond prior 16 beats; scrollbar track remains hidden; grids stay aligned; playhead extrapolates.
- [x] 4.2 Manual / unit: programmatic `scrollLeft = -200` clamps to `0`; beat-zero column edge matches ruler lane origin.
- [x] 4.3 Run `yarn typecheck`; run targeted tests impacting piano-roll/ruler if present; `openspec validate --strict`.
