## Context

Slice 7b shipped the DJ action-track body with three event rendering modes (trigger / velocity-sensitive / pressure-bearing). Pressure-bearing events render a per-event aftertouch bar graph **synthesized at render time** from a deterministic pitch-based seed (`ActionRoll.tsx:185-198`). No pressure data is stored on `ActionEvent` — every render redraws the same synthetic curve.

Slice 8 closed the action-mapping loop: clicking an action *row* opens its input/output bindings in the side panels via `djActionSelection`. Slice 9 extends that pattern down one level — to the **event** — and gives the Inspector a real surface for expression data.

The prototype's pressure editor (`prototype/dj.jsx:927-982`) is a 16-bin bar-graph viewer with a summary readout (`n events · peak · avg`), three bulk-op buttons (Smooth / Flatten / Clear), and a Curve/Step mode toggle. It is purely **bulk-transformational** — there is no per-bin paint editing. We adopt the same scope for Slice 9.

The Inspector's Pressure tab exists today as an empty placeholder (`inspector/spec.md` § "Inspector renders a three-tab strip"). The prototype screenshot for Slice 9 (`screenshots/09-dj-pressure-editor.png`) shows the pressure editor rendered **inside** the ACTION-context body (below the Output mapping form), not as a separate tab. This slice follows the screenshot — the editor lives inside `ActionPanel`. Repurposing the Pressure tab itself is a separate concern (see Open Questions).

## Goals / Non-Goals

**Goals:**
- Materialise per-event pressure as a real `PressurePoint[]` field on `ActionEvent`, with a backwards-compatible "absent → synthesize" fallback so unedited events keep their current visual.
- Render the prototype's pressure editor (bar-graph + summary + bulk-ops + mode toggle) in the Inspector's `ActionPanel`, visible iff the selected DJ action's `pressure` capability is true.
- Add event-level selection (`djEventSelection`) orthogonal to the existing row-level `djActionSelection`, so clicking an action note in the lane body opens its pressure editor.
- Add a session-level `pressureRenderMode: 'curve' | 'step'` that affects both the editor's rasterised bars and the inline bar rendering inside `ActionRoll`.
- Make the bulk ops pure functions on `PressurePoint[]` so they are unit-testable in isolation.

**Non-Goals:**
- **Per-bin paint editing.** The bar graph is read-only; bulk ops are the only mutations. Paint editing is a separate slice.
- **Pressure capture.** Slice 10 wires the audio engine; until then, pressure data is either synthesized (default) or manually shaped via bulk ops.
- **Pressure editor for piano-roll notes.** The piano roll has no `pressure` capability flag today, and the IMPLEMENTATION_PLAN scopes Slice 9 to the DJ surface. Future slices may extend.
- **Inspector tab restructure.** Screenshot 09 shows `ACTION | TRACK` tabs (vs. current `Note | Pressure | Channel`). That restructure is out of scope; we render the pressure section inside the existing `ActionPanel` body without touching the tab strip.
- **Persisting render mode across sessions.** `pressureRenderMode` is in-memory only — matches every other per-user preference in the app today.

## Decisions

### D1. Pressure data lives on `ActionEvent`, three-state semantics

`ActionEvent` grows an optional `pressure?: PressurePoint[]` field, where `PressurePoint = { t: number; v: number }`:
- `t` is **note-relative** in `[0, 1]` (not absolute beats), so pressure curves survive note shifts without re-mapping.
- `v` is `[0, 1]` (mapped to MIDI `0..127` only at the audio-engine boundary).

The field has **three meaningful states**:
- `undefined` — never edited; renderer (both `ActionRoll` and the editor) computes the synthesized curve via `synthesizePressure(event)`. This is the default for every event in the seed.
- `[]` — explicitly cleared by the user via the Clear bulk op. Renderer draws no pressure data (flat baseline at zero, semantically "no aftertouch"). Summary shows `0 events · peak 0.00 · avg 0.00`.
- `[...]` — non-empty stored points. Renderer rasterises and draws these.

**Alternative considered**: collapse `undefined` and `[]` into a single "no data" state. *Rejected* — we need to distinguish "user cleared this" (zero pressure) from "user has not touched this" (visual default). The renderer can use this signal in Slice 10 to decide whether to emit zero-valued aftertouch on playback (cleared) versus suppress aftertouch entirely (untouched).

### D2. Bulk ops are pure functions on `PressurePoint[]`, materialise immediately

The three bulk ops live in `src/data/pressure.ts`:
- `smoothPressure(points, kernel=3): PressurePoint[]` — moving-average smoothing across the 16-bin rasterisation. Returns 16 points evenly spaced at `t = i/15`.
- `flattenPressure(points): PressurePoint[]` — replaces all values with the mean. Returns 16 points evenly spaced.
- `clearPressure(): PressurePoint[]` — returns `[]`.

All three are pure (no `Date`, no `Math.random`, no DOM). They are exported from a new module so they can be unit-tested in `src/data/pressure.test.ts` without React.

When the editor invokes a bulk op against an event whose stored `pressure` is `undefined`, the op operates on the **synthesised** curve (materialising it). After the op, `setEventPressure(...)` writes the result to the event. Subsequent renders use the stored data.

**Alternative considered**: keep bulk ops as methods on a `PressureEditor` class. *Rejected* — class-vs-function is a style call; the existing codebase consistently uses pure data helpers (`summary.ts`, `notes.ts`) and we follow suit.

### D3. 16 rasterised bins, Curve/Step is a rendering preference (not a data transformation)

The bar graph is a fixed-16-bin SVG rasterisation of `PressurePoint[]`. The rasteriser (`rasterizePressure(points, bins=16)`) does nearest-neighbour sampling at bin centers (`t = (i + 0.5) / 16`). When `points` is empty, every bin reads as `0`.

The `pressureRenderMode` toggle affects **how the bins are drawn**, not the underlying data:
- `'curve'` — bars draw at their natural value with linear interpolation between adjacent bins for the optional connector polyline (Slice 9 may ship without the connector — see Open Questions).
- `'step'` — bars draw as discrete blocks; no interpolation.

This means switching modes is a pure render preference — it never mutates pressure data. Matches the prototype's behaviour.

`ActionRoll`'s inline event bar rendering reads the same `pressureRenderMode` so the in-track visualisation stays in lockstep with the editor.

**Alternative considered**: 14 bins (matching `ActionRoll`'s synthesized cell count) for visual parity between editor and lane. *Rejected* — the prototype uses 16 bins for the editor, and visual parity is achieved through using the same rasteriser+colour, not the same bin count. The editor renders at a different scale (taller, narrower bars) and 16 is a power-of-2 friendly count for future smoothing kernels.

### D4. Event selection is a new orthogonal state

`useStage` grows `djEventSelection: { trackId, pitch, eventIdx } | null` alongside the existing `djActionSelection`. They are **not mutually exclusive** — the user can have both a row selected (for the Output panel) and an event selected (for the Pressure section). The two states are managed independently:

- Clicking an event in `ActionRoll` sets `djEventSelection` *and* sets `djActionSelection` to `{ trackId, pitch }` (so the Output panel opens too — the pressure section lives inside that panel's body).
- Clicking elsewhere on a row's key (the existing Slice 8 affordance) sets `djActionSelection` and clears `djEventSelection` (because we're no longer focused on a specific event).
- The outside-click handler clears both selections when the click falls outside any DJ track and outside the existing selection regions.

The `eventIdx` is the index into `track.events`. This is fragile to reordering, but `events` is treated as append-only today (no reorder, no insertion-in-the-middle), so it suffices for Slice 9. A future slice may switch to event IDs when capture lands.

**Alternative considered**: a single union selection (`djSelection: { kind: 'row', ... } | { kind: 'event', ... } | null`). *Rejected* — the Output panel and Pressure section co-exist in the same body, so we need both pieces of information simultaneously.

### D5. Pressure section lives inside `ActionPanel`, not the Pressure tab

The pressure editor is rendered **inside the ActionPanel body**, below the Output mapping form, gated on `djEventSelection !== null && actionMap[pitch]?.pressure === true`. This matches screenshot 09.

The Inspector's existing Pressure tab remains an empty placeholder. Repurposing it (or restructuring the tab strip into `ACTION | TRACK` per the screenshot) is deferred to a follow-up slice — out of scope here.

**Alternative considered**: populate the Pressure tab with the editor. *Rejected* — the screenshot is unambiguous: pressure is a *section* of the Action body, not a tab. Putting it in the Pressure tab would split the user's flow (one click to select the action row → another click to switch tabs) and diverge from the prototype.

### D6. Section visibility predicate

The Pressure section renders iff all of:
1. `djEventSelection !== null`, AND
2. `djEventSelection.trackId === djActionSelection?.trackId` (the selected event belongs to the selected row's track), AND
3. `djEventSelection.pitch === djActionSelection?.pitch` (same row), AND
4. `actionMap[djActionSelection.pitch]?.pressure === true` (the action has pressure capability), AND
5. `track.events[djEventSelection.eventIdx]` exists (the event is still present).

Any failure → section is absent from DOM. This keeps the visibility rules tight: if the user deletes the event or the action mapping, the section disappears cleanly.

## Risks / Trade-offs

[Pressure rasterisation may lose detail when stored data is sparse] → The 16-bin rasterisation is nearest-neighbour, so 2 stored points produce 16 visible bins (each replicated 8×). This is the prototype's behaviour and is acceptable for Slice 9 — the editor is a *summary* view, not a high-fidelity time-domain editor. Mitigation: document the rasteriser semantics in `pressure.ts` with a comment.

[Event-index selection is fragile to future event reordering] → We use `eventIdx` because action events have no ID today. If a future slice reorders or splices events, every open Pressure section becomes wrong. Mitigation: when capture lands (Slice 10), introduce stable event IDs and migrate `djEventSelection.eventIdx` → `djEventSelection.eventId`. Tracked as a comment on the `djEventSelection` type.

[Synthesised pressure curve renders the same way in editor and lane, but only after the editor first opens] → Until the editor opens (or a bulk op runs), the lane's inline bar uses the legacy `ActionRoll.tsx:185-198` synthesis. We refactor that synthesis into `synthesizePressure(event)` in `src/data/pressure.ts` and call it from both surfaces, so the visuals match from day 1. Mitigation: a unit test asserts that `synthesizePressure({pitch: 56, ...})` returns the same 14-point curve that the legacy seed produced.

[Curve/Step render-mode state lives on the stage but only one editor and one row of lanes consume it] → This is fine. It's a session-wide preference and consumers are cheap. We pay a single state hook for a visible UX win (mode follows the user across selections).

[Bulk-op buttons could mutate state out from under the user mid-render if multiple selections fire in the same tick] → Each bulk op is a single hook-action call with a deterministic input; React batches `setState` in event handlers. Not a real risk for Slice 9. Documented for the test suite to confirm.

## Migration Plan

No migration needed — `pressure?: PressurePoint[]` is additive and optional. The renderer's fallback path preserves the current visual for every event in the seed.

If a future schema bump introduces persisted sessions (Slice 10+), the field round-trips trivially as JSON. The `synthesizePressure` helper is the only stateful seam — if we ever change the synthesis seed, every untouched event re-synthesises with the new curve at next render. This is acceptable: untouched events have no contract.

## Open Questions

- Does the Curve mode render an **interpolating polyline overlay** on top of the bars, or just the bars at their values? Prototype `dj.jsx:927-982` analysis suggests bars-only with a tinted-fill envelope; defer the polyline overlay to a backlog item if we ship bars-only and the visual gap is acceptable.
- Should "Smooth" be re-applicable (each click smooths further) or idempotent at some kernel size? Prototype is non-idempotent — each click runs the kernel again. We adopt that behaviour for Slice 9; "Smooth → Smooth → Smooth" produces an increasingly flat curve. Confirm in implementation review.
- The Pressure tab in the Inspector tab strip stays empty. Backlog item: either remove the empty tab (smallest change) or restructure tabs to `ACTION | TRACK` per the screenshot (larger). Out of scope here.
