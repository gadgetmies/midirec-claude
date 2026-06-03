## Context

`timeline-drag-move-items` introduced horizontal drag-to-move for piano-roll notes and DJ action events with **delta-snap** as the default math: `deltaTicks` is snapped, then added to `tick0`. This preserves the dragged item's original off-grid offset under repeated nudges — the right call for most workflows, but it removes drag as a means of *re-aligning* an off-grid item to the grid. Users have to use the Inspector Start editor for that.

The transport already exposes `quantizeOn: boolean` and `quantizeGrid: QuantizeGrid`, plumbed to `PianoRoll` / `ActionRoll`. The `Q` chip in the titlebar toggles `quantizeOn`. This change adds a sibling `snapAbsoluteOn` flag and an `A` chip, switching the drag math to absolute-snap when both flags are on.

`quantizeGridToTicks(grid, tpq)` already lives in `src/midi/quantizeGrid.ts` and is reused unchanged.

## Goals / Non-Goals

**Goals:**

- Give users an explicit, discoverable opt-in for absolute-snap drag math.
- Keep the default behavior (delta-snap) unchanged when the new toggle is off.
- Apply consistently across `PianoRoll` and `ActionRoll` (single events + CC groups).
- Mirror existing `quantizeOn` patterns for state, action, and UI so the new toggle feels native.

**Non-Goals:**

- Modifier-key temporary inversion (e.g. hold Shift to invert mode for one gesture). Could be a follow-up; out of scope here.
- Per-track / per-channel override.
- Persisting the toggle across reloads (in-memory only, like `quantizeOn`).
- Changing the default — delta-snap remains the default established by `timeline-drag-move-items`.
- Touching the resize gesture or the Inspector — they don't share this snap math.

## Decisions

### 1. Flag lives on the transport, not on the rolls

`snapAbsoluteOn` joins `quantizeOn` / `quantizeGrid` on the transport state, accessed via `useTransport()` and plumbed as a prop. This mirrors the existing pattern exactly: a global session-wide flag, not per-track. The transport already governs the snap grid; the snap mode is the natural sibling.

**Alternatives considered:**

- Put it on each roll component (rejected — would make the setting per-mount; users would have to remember which roll is in which mode).
- Put it on `useStage` (rejected — `useStage` owns session/document state, not transport flags).

### 2. Absolute snap math

When `snapAbsoluteOn === true` and `quantizeOn === true`:

```
deltaTicksRaw = round(deltaPx / pxPerTick)
snap = quantizeGridToTicks(quantizeGrid)
finalTick = max(0, round((tick0 + deltaTicksRaw) / snap) * snap)
```

Otherwise (either flag off), keep the delta-snap math from `timeline-drag-move-items`:

```
deltaTicksRaw = round(deltaPx / pxPerTick)
if (quantizeOn) deltaTicks = round(deltaTicksRaw / snap) * snap
else            deltaTicks = deltaTicksRaw
finalTick = max(0, tick0 + deltaTicks)
```

The two branches collapse to the same result when `tick0` is already on-grid, so on-grid items behave identically in both modes.

### 3. CC group: align the earliest member, preserve internal spacing

For a DJ CC group in absolute mode, only the **earliest member** snaps to the grid:

```
deltaTicksRaw = round(deltaPx / pxPerTick)
earliestFinal = max(0, round((earliestTTicks + deltaTicksRaw) / snap) * snap)
groupDeltaTicks = earliestFinal - earliestTTicks
# Each member: originalTTicks + groupDeltaTicks
```

This matches the user's intent ("align this group to the grid") while preserving relative spacing between members. Snapping every member independently would compress or fan out the group — almost never what the user wants.

**Alternatives considered:**

- Snap every member to its own grid position (rejected — destroys group spacing; a CC sweep would lose its shape).
- Snap the representative (chronologically-first) member instead of the earliest by ticks (rejected — they're the same member in practice, but spec-wise "earliest" is the load-bearing word).

### 4. UI chip mirrors the Q chip

The `A` chip sits immediately to the right of the existing `Q` chip in the titlebar transport bar (subregion 6, "Quantize widget"). It uses the same chip styling and click-to-toggle behavior. When `quantizeOn === false`, the `A` chip renders disabled (greyed, non-interactive) — clicking does nothing, since absolute mode has no effect with quantize off. The disabled visual SHALL come from a `data-disabled="true"` attribute paired with existing token styles, not a new color token.

**Alternatives considered:**

- Hide the `A` chip when `quantizeOn === false` (rejected — toggling Q would shuffle the titlebar layout; disabled-but-visible is steadier).
- A single tri-state chip with delta / absolute / off (rejected — three states on one control is harder to read at a glance, and the two flags have independent semantics that benefit from separate controls).

### 5. No persistence

`snapAbsoluteOn` is initialized to `false` on every session load, matching `quantizeOn`'s ephemeral nature. Persistence (e.g. to localStorage) is out of scope and can be added later alongside other transport-state persistence work if/when it materializes.

## Risks / Trade-offs

- **[Risk]** Users may not discover the `A` chip and stay confused about the off-grid behavior → **Mitigation**: chip tooltip on hover (`Snap Absolute · drag aligns items to grid`); add to in-app help if/when help exists.
- **[Risk]** Disabled-while-quantize-off chip could read as a bug ("why is this greyed?") → **Mitigation**: tooltip text in disabled state says `Enable Quantize to use Snap Absolute`.
- **[Trade-off]** Two flags interact: users have to understand `Q` ON + `A` OFF vs `Q` ON + `A` ON. We accept this because (a) the default `A` OFF is the right behavior most of the time, (b) the chip labels are short and inspectable, (c) hiding the chip when Q is off keeps `A` from cluttering the common case mentally.
- **[Risk]** The CC-group "earliest member aligns" rule is subtle and may surprise users who expected every member to snap → **Mitigation**: documented in the spec scenario; consider visual feedback in a later UX pass.

## Migration Plan

No data migration. No backwards-compatibility shim. The flag defaults to `false`, so existing sessions and tests continue to use delta-snap math. Components that don't render `.mr-note` / `.mr-djtrack__note` / `.mr-djtrack__cc` are untouched.

## Open Questions

- Should the `A` chip render a different visual when `quantizeOn === true && snapAbsoluteOn === false` to hint that absolute is available? **Default: no** — the chip is plainly visible and clickable; no extra hint needed.
- Should the absolute-mode CC-group rule (earliest aligns, rest follow) also apply to multi-event marquee selections in a future "drag selection" gesture? **Out of scope here**; revisit when marquee-drag is proposed.
