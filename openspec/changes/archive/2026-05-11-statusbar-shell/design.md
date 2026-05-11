## Context

The AppShell's bottom strip exists as a placeholder: `AppShell.tsx:101-103` renders `<footer class="mr-statusbar"><span class="mr-stub">Statusbar</span></footer>`. Slice 10 of `IMPLEMENTATION_PLAN.md` is the only remaining visual slice, but it bundles a Statusbar UI with a real audio engine. Two project facts force a re-scope:

1. **This is a MIDI-only tool.** No audio is ever synthesized or played back. The audio-engine portion of Slice 10 is excluded permanently.
2. **CPU/RAM meters in the prototype are audio-engine load indicators.** With no engine they have no signal to report; they are also excluded permanently.

What remains is the MIDI half. A first attempt put MIDI input device + channel AND clock source into the Statusbar, but design review surfaced two problems:

- The MIDI input cluster duplicated the Sidebar's "MIDI Inputs" panel (`Sidebar.tsx:14, 55-58` already shows `Korg minilogue xd · CH·1` with an activity LED).
- Clock source naturally belongs next to BPM — the two are tied (an external clock owns BPM, making it derived rather than user-set; the user reads them together).

Reshaping makes each surface answer a distinct question:

- **Sidebar** = "what MIDI inputs are enumerated?" (catalog view)
- **Titlebar MIDI IN LED** = "is MIDI flowing right now?" (binary pip)
- **Titlebar Clk cell** = "where does timing come from?" (source kind)
- **Titlebar BPM cell** = "at what tempo?" (numeric, user-set OR externally-derived)
- **Statusbar** = "where did the most recent message come from?" (device + channel, single live readout)

That is, the Titlebar carries the *meta* (LED + source + tempo) and the Statusbar carries the *flow* (which device + channel just sent us a message). They share a common state (`useStatusbar().active` drives the Titlebar's LED; `useStatusbar().lastInput` drives the Statusbar's text).

## Goals / Non-Goals

**Goals:**

- Replace the `.mr-stub` placeholder with a `<Statusbar />` component that surfaces the device + channel of the most recently received MIDI message.
- Move clock-source state into `useTransport` (it belongs with BPM and Sig — all timing-related) and render it as a `Clk` meta cell in the Titlebar, right after BPM.
- Wire the Titlebar's MIDI IN LED to a real activity flag from `useStatusbar()` so it lights only when MIDI is flowing.
- Use the same `.mr-led` selector throughout (Sidebar, Titlebar, Statusbar) — there's exactly one LED style in this codebase.
- Stubbed data only — no Web MIDI / CoreMIDI. The stub returns `active: true` and a seeded `lastInput` so visual review can see the populated state.
- Design the Statusbar markup so turning it into a picker later is a CSS/event change, not a structural rewrite (inert `<button>` wrapper with `data-pickable="false"`).

**Non-Goals:**

- **No** CPU meter, RAM meter, sample rate, buffer size, audio output device, audio engine status of any kind. Permanently excluded.
- **No** Web MIDI / CoreMIDI / WinMM wiring. The stub returns constant values; turning that into real MIDI is a separate change.
- **No** picker overlays for switching input or changing clock source. Those land when the real MIDI runtime lands.
- **No** decay animation on the activity LED yet (e.g., "stay lit 80ms after each note"). The stub holds `active: true` steady; the decay belongs with the real-MIDI work that drives `active` from actual message events.
- **No** changes to the Sidebar. It stays the enumerated-inputs catalog.
- **No** new design tokens.

## Decisions

### Decision: Statusbar is a single cluster — the "flow" readout

Sketch:

```
●  Korg minilogue xd   CH·1
↑  ↑                   ↑
|  device name         channel chip (matches .mr-dev__ch)
└─ activity LED (data-state="midi" when active)
```

A single cluster on the left, no spacer, no right side. The Statusbar's job is one fact at a time: which device + channel just sent us data. When MIDI is flowing, the LED is lit and the text reflects the source. When idle, the LED is dim — the text either persists from the last received message OR shows `Awaiting MIDI` if nothing has arrived yet.

This is *not* a redundant Sidebar — the Sidebar enumerates every input the OS has surfaced regardless of whether it's sending data. The Statusbar shows the singular live flow.

**Alternative considered**: two clusters with spacer (the previous attempt). Rejected — the second cluster's content (clock source) belongs in the Titlebar near BPM, leaving the Statusbar with one cluster.

### Decision: Clock source moves to `useTransport`, rendered as a Titlebar meta cell

The Titlebar meta-row today is `Bar / BPM / Sig` (three cells, each: tiny uppercase label + mono value). Adding `Clk` as a fourth cell, placed directly after BPM (so order becomes `Bar / BPM / Clk / Sig`), gives the user the BPM and its source together. Values are compact mono codes matching the cell style:

- `Int` — internal clock
- `Ext` — external MIDI clock
- `MTC` — MIDI Time Code

The state lives on `useTransport` (which already owns BPM, Sig) so timing-related state is one hook:

```ts
type ClockSource = 'internal' | 'external-clock' | 'external-mtc';
// TransportState extends with: clockSource: ClockSource
```

Default in this slice: `'internal'`. No setter is exposed yet — switching clock sources is a future change that lands with the real-MIDI runtime.

**Alternative considered**: keep clock source in `useStatusbar`, render in the Titlebar. Rejected — coupling the Titlebar to a hook called "statusbar" for clock state is confusing, and clock source has no relationship to the LED activity flag that lives on `useStatusbar`.

**Alternative considered**: render clock source inline next to BPM (e.g., `124 BPM · Int`) instead of a dedicated meta cell. Rejected — the meta-row's strength is uniform structure (label + value per cell). Breaking that for one field would weaken the layout. The Clk cell is two extra cells worth of width but stays inside the established grammar.

### Decision: Titlebar MIDI IN LED binds to `useStatusbar().active`

Today: `Titlebar.tsx:200` renders `<span className="mr-led" data-state="midi" />` — hardcoded to `data-state="midi"`, always lit, always animating via `mrLed` keyframes. This is misleading: the LED looks like activity but reports nothing.

New: bind `data-state` to `useStatusbar().active`. When `active === true`, `data-state="midi"`. When `active === false`, omit the attribute (LED renders dim). The text label `MIDI IN` stays.

For this slice the stub returns `active: true`, so the visual change is invisible — but the wiring is correct. When real MIDI lands, only the hook body changes; the Titlebar binding is already right.

**Alternative considered**: add `lastMessageAt: number` and have the Titlebar derive `active` from a freshness check (e.g., `active = Date.now() - lastMessageAt < 200`). Rejected for this slice — adds time-based render churn for a stub. The boolean is enough now; a freshness/decay timer is a real-MIDI concern.

### Decision: `useStatusbar()` is standalone, stub-only

```ts
// src/hooks/useStatusbar.ts
export interface MidiInput {
  id: string;
  name: string;
  channel: number | 'omni' | number[];
}

export function useStatusbar(): {
  lastInput: MidiInput | null;
  active: boolean;
} { ... }
```

The stub returns `lastInput: { id, name: 'Korg minilogue xd', channel: 1 }` and `active: true`. Two consumers — `Statusbar.tsx` (reads `lastInput` + `active`) and `Titlebar.tsx` (reads `active`). No provider needed; the stub is constant.

When real MIDI lands, the hook's *shape* doesn't change; only its body grows: it subscribes to the MIDI runtime, tracks the most recent message's source, and decays `active` after a short timeout. That work is out of scope here.

**Alternative considered**: combine into `useTransport`. Rejected — `useTransport` already mixes a lot (mode, timecode, loop region, quantize, BPM, sig); adding MIDI input state would blur its purpose. Two hooks with clear, narrow responsibilities ages better than one fat one.

### Decision: Drop `.mr-stub` from `AppShell.css`

`.mr-stub` has no other consumer. Once the Statusbar slot is filled, the rule becomes dead. Delete it.

## Risks / Trade-offs

- **[Risk] The Statusbar's empty state ("Awaiting MIDI") and the Sidebar's catalog could feel disjoint.** A user opening a fresh session sees a Sidebar listing devices that are connected (LEDs on) but a Statusbar saying nothing has arrived — which is correct (no messages yet) but might read as a contradiction. → Mitigation: the empty state's text needs to be honest about the distinction ("Awaiting MIDI" is fine — "no input" would be wrong since the Sidebar shows inputs exist). Settle wording during apply if a better phrase comes up.
- **[Risk] The Titlebar's MIDI IN LED now goes dark in the stubbed state if the hook returns `active: false`.** That's a feature, not a bug — but it changes the Slice 1 screenshot expectation. → Mitigation: this slice's stub keeps `active: true`, so the visible state matches all prior screenshots. When real MIDI ships, that screenshot will need re-shooting; document under deviations.
- **[Trade-off] Clock source's stub default is `'internal'`, which means the Clk cell shows `Int`.** Cost: in tests/snapshots, the Titlebar's meta-row now has four cells instead of three. → Mitigation: existing `transport-titlebar` scenarios that assert "three columns" need updating in the delta. That's spec hygiene, not a regression.
- **[Trade-off] No decay animation on the LED.** Cost: when real MIDI lands, a single note tap will momentarily set `active: true` and then immediately false — the LED would flash for one frame, which is barely visible. The decay/freshness work has to land at the same time as real MIDI. → Mitigation: this is a future-slice concern; flagged in the design so it isn't forgotten.

## Migration Plan

Additive change — no production state migration.

1. Extend `useTransport` with `clockSource: ClockSource`, default `'internal'`. Surface it on the returned value.
2. Create `src/hooks/useStatusbar.ts` with `lastInput` + `active`, stubbed.
3. Create `src/components/statusbar/Statusbar.tsx` + `Statusbar.css` — single cluster.
4. Edit `AppShell.tsx` to render `<Statusbar />` in place of `.mr-stub`. Edit `AppShell.css` to drop `.mr-stub`.
5. Edit `Titlebar.tsx` to: (a) add the Clk meta cell after BPM; (b) bind MIDI IN LED to `useStatusbar().active`.
6. Edit `Titlebar.css` if a Clk cell needs styling that doesn't fall out of the existing `.mr-meta` rules.
7. Add a deviation entry to `design/deviations-from-prototype.md`.
8. Run `yarn typecheck` and `openspec validate --strict statusbar-shell`.

Rollback: revert the diffs. The `.mr-stub` placeholder is the rollback state.

## Open Questions

- **`Awaiting MIDI` vs `No incoming MIDI` vs something else for the empty state?** Soft preference for `Awaiting MIDI` — terser, doesn't sound like a fault. Settle during apply.
- **Should the BPM cell visually indicate when clock source is external (e.g., dim, or carry a `data-derived="true"`)?** Reasonable to add but not required by the stub (which is always internal). Defer to the change that surfaces a real external-clock state.
