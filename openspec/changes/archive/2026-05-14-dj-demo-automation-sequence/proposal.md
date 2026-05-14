## Why

Developers and testers need a single, repeatable DJ session that exercises beat-jump controls, transport, and long mixer CC “automation” in one timeline. Today’s `demo=dj` seed demonstrates generic deck and mixer activity but not this scripted order or sustained CC ramps. A dedicated URL-gated preset makes regression checking and demos possible without manual drawing.

## What Changes

- Add an optional **`demo=dj-automation`** query token (used **together with** `demo=dj` so the app still loads the three-track DJ deck) that replaces the default synthetic `events[]` on **Deck 1**, **Deck 2**, and **Mixer** with a deterministic script.
- **Deck 1 & Deck 2 — discrete actions (session beats, 0-based `ActionEvent.t`):**
  - **t = 0** (“first beat”): **Beat Jump Size** with outgoing value **11** on Deck 1 row and Deck 2 row (`ActionMapEntry` pitches **89** and **90**; velocity encodes scaled MIDI value `11/127`).
  - **t = 1** (“second beat”): **Beat Jump** with value **127** (product convention: **127 ⇒ −1 beat** backward) on both decks (pitches **76** and **77**).
  - **t = 3** (“fourth beat”): **Play** for Deck 2 only (pitch **65**).
- **Mixer track — CC automation via stepped `ActionEvent` series** (playback already emits one CC per event from `vel × 127`; ramps are approximated with **one event per integer beat** on the ramp interval):
  - **Ch 1 Volume** (pitch **81**): linear **0 → 127** from beat **4 through 20** inclusive.
  - **Ch 2 Volume** (pitch **82**): linear **127 → 0** from beat **34 through 68** inclusive; default output **CC 8** for `ch2_vol` in `src/data/dj.ts`.
  - **Ch 2 EQ Low** (pitch **88**): event at beat **4** with value **0**; linear **0 → 63** from beat **26 through 34** inclusive.
  - **Ch 1 EQ Low** (pitch **85**): linear **63 → 0** from beat **26 through 34** inclusive.
- Extend `parseDemoQueryFlags` / `useStage` wiring so the seed function selects this preset when the flag is present. Default `demo=dj` behavior (without the new token) stays unchanged.

## Capabilities

### New Capabilities

- `dj-automation-demo`: URL discovery and normative timeline for the `demo=dj-automation` + `demo=dj` DJ demo preset (events, beats, pitches, velocities).

### Modified Capabilities

- _(none — demo URL wiring and hook branching are specified inside `dj-automation-demo`; implementation touches existing modules without changing unrelated normative requirements.)_

## Impact

- **`src/data/dj.ts`** — default output CC for `ch2_vol` is **8** (Ch 2 Volume row).
- **`src/session/demoQuery.ts`** — parse new token; export a flag or preset discriminator consumed by stage.
- **`src/hooks/useStage.tsx`** — pass the new flag into `useDJActionTracks`.
- **`src/hooks/useDJActionTracks.ts`** — branch `seedDefault` (or sibling helper) to emit the automation demo `events` arrays; ensure required action rows exist on deck tracks (pitches 89, 90, 76, 77 already covered by extending slice sets if needed).
- **Tests** — `demoQuery` unit tests; optional snapshot or length checks on seeded events for the new mode.
