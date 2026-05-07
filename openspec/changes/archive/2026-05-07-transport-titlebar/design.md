## Context

Slice 0 shipped a Vite + React + TypeScript scaffold with `tokens.css` synced verbatim, the six-region shell at correct geometry, and stub labels in each region. Slice 1 fills the Titlebar region with the transport cluster from the design — the first piece of UI the user actually interacts with. The reference implementations are `prototype/components.jsx` (Transport, Brand, Icon set) and `prototype/app.css` lines ~37–215 (`.mr-transport`, `.mr-brand`, `.mr-tgroup`, `.mr-tbtn`, `.mr-timecode`, `.mr-meta`, `.mr-led`, `mrPulse`, `mrLed`).

Real audio doesn't land until Slice 10. Every slice between 1 and 10 needs to stand on a *placeholder* transport state — fake state that flips the right flags so the visual states can be exercised, recorded as screenshots, and demoed. Designing the placeholder hook as a real React contract (not just an inline `useState` blob in `Titlebar`) is what lets Slice 10 swap implementations cleanly.

## Goals / Non-Goals

**Goals:**
- `Titlebar` matches screenshots 02 and 03 pixel-accurately, including the recording pulse, the timecode color flip, and the LED blink.
- `useTransport()` is a single, named hook that owns transport state. Components consume it; no prop-drilling.
- `useToast()` provides a tiny, opinionated toast API that later slices can extend without redesign.
- Transport-state changes propagate via React state — no event-bus or external store. Slice 10 may introduce one if the audio runtime needs it.
- `mrPulse` and `mrLed` keyframes live in the transport stylesheet (where they're consumed); no global CSS bloat.

**Non-Goals:**
- Real MIDI capture, real playback, real BPM detection. The hook fakes everything.
- Keyboard shortcuts (Space → play/pause, R → record, etc.). Coming in a later slice; the toast does render the static `⌘Z` hint chip from screenshot 03 but doesn't bind it.
- Toast queue / multi-toast / position variants. One toast at a time, bottom-center, fixed.
- Dropdown popovers (the quantize-grid picker is a static chip in this slice — README §Toolstrip doesn't even live here, the quantize widget is part of the prototype's titlebar Transport).
- Sync source dropdown. README §Titlebar mentions "Sync source — text label, optional dropdown for clock source" — we render the placeholder text only; the dropdown is deferred.

## Decisions

### D1. `useTransport()` as the React contract; implementation is replaceable

**Choice**: Define `useTransport()` in `src/hooks/useTransport.ts`. It returns a `TransportState` object plus action functions. Internally it uses `useReducer` over a discriminated-union action type.

```ts
type TransportMode = 'idle' | 'play' | 'record';
interface TransportState {
  mode: TransportMode;
  playing: boolean;     // mode === 'play' || mode === 'record'
  recording: boolean;   // mode === 'record'
  looping: boolean;
  metronomeOn: boolean;
  quantizeOn: boolean;
  quantizeGrid: '1/4' | '1/8' | '1/16' | '1/32';
  timecodeMs: number;   // single source of truth; UI formats it
  bar: string;          // 'B.B.S' from the fake clock; e.g. '13.2.1'
  bpm: number;
  sig: string;
}
interface TransportActions {
  play(): void;
  pause(): void;
  stop(): void;
  record(): void;
  toggleLoop(): void;
  toggleMetronome(): void;
  toggleQuantize(): void;
  seek(ms: number): void;
}
```

The actual *advance* of `timecodeMs` is driven by a `useEffect` that runs `requestAnimationFrame` while `mode !== 'idle'`. Stop sets `timecodeMs = 0`; pause keeps it; record-then-stop also resets to 0 (but emits the "Recording saved" toast first using the pre-stop value). On every frame: `timecodeMs += deltaMs`. Bar number is derived from `(timecodeMs / 1000) * (bpm/60)` modulo the signature; this is fake-clock arithmetic — not musically faithful — but consistent with itself.

**Rationale**: Centralizing the clock is the single decision that makes Slice 10 cheap. The audio runtime will replace the rAF advance with a sample-clock subscription, leaving the hook signature alone. Keeping `mode` as the single source of truth (with `playing` / `recording` as derived booleans) avoids the bug where you set `playing = true` and forget to clear `recording`.

**Alternatives**: A Zustand/Jotai store. Rejected — pulls in a dep for one piece of state that React already handles. Slice 10 can introduce one if needed.

### D2. Provide `useTransport()` via React context, not by re-instantiating per consumer

**Choice**: `<TransportProvider>` wraps the app shell in `App.tsx`. `useTransport()` reads from a context. This mirrors how `useToast()` works.

**Rationale**: If `useTransport` were a plain hook, every consumer would get its own state copy. Two `useTransport()` calls (Titlebar + later, Statusbar's BPM display) need to see the same clock. Context is the simplest fix.

**Trade-off**: Context re-renders on every state change. Acceptable here — the clock advances trigger re-renders of the timecode anyway. If profiling shows a hot path, we can split state and dispatch into separate contexts later.

### D3. Timecode formatting

**Choice**: Format `timecodeMs` as `MM:SS.FFF` (milliseconds, 3 digits). The big-digits part is `MM:SS`, the dim part is `.FFF`. Wrapping component in JSX:

```tsx
<span className="mr-timecode__big">{formatBig(timecodeMs)}</span>
<span className="mr-timecode__big mr-timecode__ms">.{formatMs(timecodeMs)}</span>
```

The README mentions `MM:SS:FF` — frame-based timecode. The prototype mock uses `MM:SS.FFF` (milliseconds — see `Transport`'s default `time = "00:01:23.456"`). The screenshots agree with the prototype: `00:00:08.420`, `00:01:23.456`. We follow the prototype/screenshots, not the README's stray `MM:SS:FF`. Document the discrepancy in the spec.

When `recording === true`, both spans get color `var(--mr-rec)` via a parent attribute `data-recording="true"` on `.mr-timecode`.

**Rationale**: Tabular-nums (already wired) plus a single source of truth for the millisecond render keeps the digit jitter zero. The prototype-and-screenshot agreement outweighs the README's one-line mismatch.

### D4. Toast: minimal context-based API

**Choice**: `<ToastProvider>` renders a single absolute-positioned `<div className="mr-toast-viewport">` inside the shell. `useToast()` returns `{ show(message, opts?), dismiss() }`. Only one toast visible at a time — calling `show` while another is up replaces it. Default `durationMs = 2000`, with an opt-out (`durationMs: 0` for sticky).

**Why not a queue / stack?**: Looking ahead — the only places toasts will fire are Play (start), Stop (recording saved), Export complete, Mapping saved. None of those would reasonably overlap. A queue is YAGNI.

**Anchoring**: `.mr-toast` per the prototype is `position: absolute; bottom: 16px; left: 50%`. The viewport must be a positioned ancestor — the `.mr-shell` element or a dedicated `.mr-toast-viewport` covering the shell. Cleanest is an absolute viewport child of `.mr-shell` with `pointer-events: none`, and the toast itself has `pointer-events: auto`.

**Alternative**: render directly into `document.body` via a portal. Rejected — the toast is part of the app surface, not a system overlay; portals complicate testing for no benefit at this scale.

### D5. Transport icons live in `src/components/icons/transport.tsx`

**Choice**: Port the SVG paths from `prototype/components.jsx`'s `Icon` object verbatim into typed React components: `<PlayIcon/>`, `<PauseIcon/>`, etc. One file, one default export per icon.

**Rationale**: README §Assets says "All iconography is inline SVG... extract them to your codebase's icon system or paste the SVG paths directly." This is the lightweight version of "icon system" — typed components that render the exact prototype SVG. No icon font, no Lucide/heroicons import, no decision about an icon library this early.

**Trade-off**: When Slice 7 (DJ mode) and beyond add more icons, this file will grow. Splitting is a 5-minute task at that point.

### D6. CSS structure

**Choice**: New stylesheet `src/components/titlebar/Titlebar.css` containing every `.mr-transport`, `.mr-brand`, `.mr-tgroup`, `.mr-tbtn`, `.mr-timecode`, `.mr-meta`, `.mr-meta-row`, `.mr-spacer`, `.mr-status`, `.mr-led`, `.mr-quant` rule from `prototype/app.css` lines 37–215, plus `@keyframes mrPulse` and `@keyframes mrLed`. Imported by `Titlebar.tsx`.

A separate `src/components/toast/Toast.css` for `.mr-toast` and `.mr-toast__dot`.

**Rationale**: Component-collocated CSS files are easy to find, easy to delete with the component, and avoid a single `app.css` blob that mixes concerns. The class taxonomy is preserved verbatim — ports of the prototype rules, not rewrites.

**Trade-off**: The titlebar's transport bar background is `linear-gradient(180deg, #14171b 0%, #0f1114 100%)` — two literal hex colors in the prototype. This is one of two places where the prototype uses hex literals not in tokens.css. We have three options: (a) copy the literals (breaks our "no hex literals" rule), (b) approximate with `var(--mr-bg-panel)` flat (loses the subtle gradient), (c) introduce two new tokens `--mr-bg-titlebar-top` and `--mr-bg-titlebar-bot` in *our* `tokens.css` copy (but D2 of Slice 0 says don't edit). **Decision: option (b) for now** — flat `var(--mr-bg-panel)`. Document this gap in spec/risks; the design owner can decide whether to add tokens upstream.

### D7. AppShell wires the Titlebar; both class names coexist

**Choice**: `AppShell.tsx` keeps the `<header className="mr-titlebar">` region wrapper from Slice 0 and renders `<Titlebar />` inside it. The `Titlebar` component returns the prototype's `<div className="mr-transport">…</div>` markup. Two class names with two responsibilities:

- `.mr-titlebar` — the shell-level region (owned by `AppShell.css`, just allocates the row and provides the panel surface for empty space if Titlebar ever shrinks).
- `.mr-transport` — the prototype's class for the transport bar (owned by `Titlebar.css`, holds the gradient/flat background, the divider rules, and all child styles).

**Rationale**: Slice 0's spec said the shell exposes a `.mr-titlebar` region. Honoring that spec while *also* matching the prototype's `.mr-transport` taxonomy costs nothing — they refer to different things. The wrapper is the *region*; the transport is the *content*.

**Cleanup**: `AppShell.css`'s `.mr-titlebar` rule loses any inner-content styling (padding, flex layout) — those move to `.mr-transport`. The wrapper keeps just the row allocation and surface fallback.

## Risks / Trade-offs

- **Risk**: Hex-literal gradient on `.mr-transport` (per prototype) violates the "no hex outside tokens.css" rule from Slice 0.
  **Mitigation**: Ship flat `var(--mr-bg-panel)` for now. Open question to design owner: should `--mr-bg-titlebar` be added to `tokens.css`? Tracked in Open Questions below.

- **Risk**: README's `MM:SS:FF` (frame-count) format conflicts with the prototype's `MM:SS.FFF` (milliseconds).
  **Mitigation**: Follow the prototype + screenshots. Document the discrepancy in the spec so a future slice (or design-source PR) can reconcile.

- **Risk**: rAF-driven timecode in `useTransport` causes re-renders at 60fps, which will show up in profiles even though the work is tiny.
  **Mitigation**: Keep `Titlebar` lean; only the timecode subtree depends on `timecodeMs`. If profiling becomes a concern, split context into stable-state vs ticking-state, or memo the timecode component. Not worth doing speculatively.

- **Risk**: Toast contract gets locked in suboptimally and every later slice has to live with it.
  **Mitigation**: API surface is tiny (`show`, `dismiss`); changes should be cheap. Document the "single toast, no queue" decision so future contributors don't accidentally rely on stacking.

- **Risk**: Slice 0's `app-shell` spec MODIFIED requirement wording is brittle — relaxing "zero functionality" piecemeal as each slice lands creates noise.
  **Mitigation**: Reword once now as "regions ship empty until their respective slices populate them"; future slices simply remove their region from the still-empty list. Cheaper than a delete-and-add per slice.

## Migration Plan

Not applicable — no breaking changes to user-visible state. The Slice 0 spec MODIFIED requirement is text-only; no consumers exist.

## Open Questions

- **Should `tokens.css` add a `--mr-bg-titlebar` (or a `--mr-bg-titlebar-gradient`)** so the prototype's subtle gradient can ship without a hex-literal violation? **Owner: design source.** For Slice 1, we ship flat panel color and flag this.
- **Where do keyboard shortcuts live** (Space, R, ⌘Z)? **Decision: deferred.** Render `⌘Z` as static text in the save toast for fidelity to screenshot 03. Real binding is a later slice's problem.
- **Sync source dropdown** in the titlebar (README mentions it). **Decision: text-only placeholder for now.** No clear screenshot reference for the dropdown state.
