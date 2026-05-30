## Context

The app already receives MIDI clock via `midi-clock` (`MidiClockProvider` + `useMidiClock()`) and surfaces an input-source picker as the "Clk" pill in the titlebar. There is no symmetric capability to *send* clock to downstream gear, blocking master-clock use cases. The Web MIDI API exposes `MIDIOutput.send(data, timestamp)`; the `src/midi/scheduler.ts` module already demonstrates a lookahead-scheduled emission pattern for note events.

Architectural constraints in the existing codebase:

- The right region is the Inspector (`.mr-inspector`, width `var(--mr-w-inspector) = 320px`). No other right-side aside exists; adding one would change `app-shell`. We avoid that.
- The Inspector tab strip is selection-driven (Note / etc.). The send config is global, not selection-driven, so it lives as a section anchored at the **bottom** of the Inspector, always visible, regardless of which tab is active and regardless of timeline selection.
- Titlebar pills follow the `.mr-meta` / `.mr-meta__val--btn` pattern with a dropdown listbox (`.mr-clk__menu`). The new Send pill SHALL reuse this vocabulary so the topbar reads as one row of related chips.
- Tokens and primitives in `src/styles/tokens.css` and `src/styles/leds.css` already cover panels, lines, rec/play/cue glows, LED dots, and mono typography. No new tokens are introduced.
- BPM emission cadence in internal mode = 24 PPQ × `useTransport().bpm / 60` Hz (≈49.6 msg/sec/output at 124 BPM). In external-clock mode the sender relays each incoming `0xF8` 1:1 (lower jitter than re-synthesising from the smoothed BPM).

## Goals / Non-Goals

**Goals:**
- Emit Clock / Start / Continue / Stop on a user-selectable set of MIDI outputs, with a single global enable/disable.
- Surface the toggle in the titlebar next to "Clk" so input + output clock controls are visually adjacent.
- Surface the device picker as an always-visible Inspector section, so the user can see *which* downstream devices are receiving without opening a menu.
- Pulse a small TX LED per emitted `0xF8` (signature gear-instrument detail), giving instant visual confirmation that the wire is alive.
- Match the existing industrial DAW aesthetic — no new fonts, no new color families, no new component primitives.

**Non-Goals:**
- Per-output BPM offset, MIDI Time Code (MTC), Song Position Pointer (SPP), or MIDI Machine Control (MMC). These are explicit follow-on slices, called out in Open Questions.
- Persistence of the enabled flag or selected-output set across reloads — in-memory only this slice, mirroring `useMidiClock().selection`'s ephemeral semantics.
- Drift correction or sub-millisecond accuracy beyond what `MIDIOutput.send(data, timestamp)` already provides with the standard ~10 ms lookahead.
- Sysex, Active Sensing (`0xFE`), or any non-real-time message family.

## Decisions

### D1. Cadence source

- **Internal clock mode** (`useTransport().clockSource === 'internal'`): the sender SHALL run an internal scheduler that emits `0xF8` at intervals of `60000 / (bpm * 24)` ms, using `MIDIOutput.send([0xF8], performanceNowTimestamp)` with a 25 ms lookahead window, similar to `src/midi/scheduler.ts`. BPM changes take effect on the next scheduled batch.
- **External clock mode** (`useTransport().clockSource === 'external-clock'`): the sender SHALL relay each incoming `0xF8` 1:1 to every selected output, in the same `onmidimessage` callback that `useMidiClock` already attaches. This minimises added jitter — the relayed pulse inherits the master's timing.

Rationale: external relay is simpler and more accurate than running an independent smoothed-BPM emitter alongside the receiver. Alternatives considered: (a) always run the internal scheduler driven by `useTransport().bpm` — rejected because under external clock that BPM is the *rounded* smoother output and would inject ~1 BPM of cadence noise; (b) send only in internal mode and ignore external — rejected because relay-master is a common live-DJ workflow.

### D2. Start / Continue / Stop emission

Driven entirely by `useTransport().mode` transitions, observed via a `useEffect` on `mode` and `timecodeMs`:

| From   | To   | Condition           | Emit  |
|--------|------|---------------------|-------|
| `idle` | `play` | `timecodeMs === 0` | `0xFA` Start |
| `idle` | `play` | `timecodeMs > 0`   | `0xFB` Continue |
| `play` | `idle` | any                | `0xFC` Stop |
| `record` ↔ any | — | — | no transport message (recording state is internal) |

The transport message SHALL be sent immediately (no batching), with `timestamp: 0` (= send-now) per the Web MIDI spec.

Rationale: matches the symmetric semantics of `midi-clock`'s receive side. The record-mode exclusion mirrors the existing rule that incoming Start/Continue/Stop are ignored in record mode — symmetric, predictable.

### D3. State model

Single context, single reducer. Public API:

```ts
type MidiClockSendState = {
  enabled: boolean;
  selectedOutputIds: Set<string>;  // MIDIOutput.id values
  txPulse: number;                 // monotonic counter incremented per emitted 0xF8 batch — drives LED blink
};

interface MidiClockSendValue extends MidiClockSendState {
  setEnabled(enabled: boolean): void;
  toggleOutput(id: string): void;
  setSelectedOutputs(ids: string[]): void;
}
```

Both `enabled` and `selectedOutputIds` reset to `false` / empty on `MidiClockSendProvider` mount; **no persistence**. Symmetric with `useMidiClock().selection`.

When `enabled === false`, the sender SHALL emit nothing — neither clock pulses nor transport messages.

`txPulse` is a render-cheap monotonic counter — components subscribe to it to drive the LED blink animation via a `key`-reset CSS class swap. Specifically it is incremented at most every 16 ms (rAF-coalesced) so React never re-renders faster than display refresh.

### D4. UI placement and structure

**Topbar — new "Send" pill, immediately right of the existing "Clk" pill.**

Reuses the `.mr-meta` / `.mr-meta__val--btn` / `.mr-clk__menu` vocabulary. Structure:

```
┌─────────────────────────────────────┐
│ Snd ▸ [Off / 2 outs ▾] ● TX        │
└─────────────────────────────────────┘
   ▲     ▲                ▲
   │     └ menu trigger    └ .mr-led data-state="tx" (pulses per 0xF8)
   │
   └ .mr-meta__lbl "Snd" (mono, --mr-text-2)
```

- Label `Snd` (mono, `var(--mr-text-2)`, `var(--mr-fs-11)`) — abbreviated to match existing `Clk`, `BPM`, `Sig` labels.
- Button text reflects state:
  - `enabled === false` → `Off` (in `var(--mr-text-3)`)
  - `enabled === true` && `selectedOutputIds.size === 0` → `No outs` (in `var(--mr-rec)` — config error)
  - `enabled === true` && size = 1 → `<deviceName-truncated-12ch>` (in `var(--mr-text-1)`)
  - `enabled === true` && size ≥ 2 → `<n> outs` (in `var(--mr-text-1)`)
- TX LED — an `.mr-led[data-state='tx']` placed flush against the right edge of the pill. Glow color: `var(--mr-cue)` (same family as the existing MIDI IN LED for visual cohesion). The LED briefly opacity-pulses (`0.4 → 1.0` over 80 ms) every time `txPulse` advances; when `enabled === false` or no clock has emitted in the last 500 ms, the LED is dim (background `var(--mr-text-4)`).
- Click opens a dropdown menu (`.mr-clk__menu` reused) with rows:
  - Row 0: a single-row toggle "Enable send" — uses the same `data-on` mono-row style as the existing clock-source rows.
  - Rows 1..N: one row per `useMidiOutputs().outputs` entry. Each row is a `role="option"` button with `aria-checked` and a leading checkbox glyph (`☐` / `☑` via a small CSS box, not a unicode literal). Disabled state when `enabled === false` (dim).
  - Footer row: a tiny `[All] [None]` pair (right-aligned, `var(--mr-fs-11)` mono) that selects/deselects all outputs.

**Inspector — new "MIDI Clock Send" section, anchored at the bottom of `.mr-inspector`.**

Always visible, regardless of selection or active Inspector tab. Structure (vertical stack):

```
┌─ MIDI CLOCK SEND ─────────────── ▾ ─┐
│                                     │
│  ┌─ master ─────────────────────┐   │
│  │ [ ] Enable          Internal │   │  ← rocker + cadence source readout
│  └──────────────────────────────┘   │
│                                     │
│  CADENCE  124.0 BPM · 49.6 Hz · 24 PPQ
│  STATUS   ◉ transmitting · 2 outs   │
│                                     │
│  OUTPUTS                            │
│  ┌──────────────────────────────┐   │
│  │ ☑  IAC Driver — Bus 1    ● TX│   │  ← per-port row with own TX LED
│  │ ☑  USB MIDI Cable        ● TX│   │
│  │ ☐  Bluetooth MIDI         ·  │   │
│  └──────────────────────────────┘   │
│                                     │
│  [Select all]   [Clear]             │
└─────────────────────────────────────┘
```

Visual specifics:

- Header: `.mr-panel__head` matching the existing Sidebar panel pattern — uppercase `MIDI CLOCK SEND`, `var(--mr-fs-11)`, letter-spacing `0.08em`, color `var(--mr-text-2)`. A right-aligned chevron (`ChevDownIcon`) toggles a local `data-open` boolean. Default `open === true`.
- Master row: a rocker-style switch (rendered with two `:before/:after` pseudo-elements creating a 28×14px track + 12×12px thumb) labelled `Enable`. To the right: the live cadence source — `Internal` (in `var(--mr-text-2)`) or `External (relay)` (in `var(--mr-cue)`). Reading the source live tells the user *why* a relay session is or isn't ticking.
- `CADENCE` / `STATUS` rows use the `.mr-row` two-column pattern (label in `var(--mr-text-3)` uppercase, value in `var(--mr-text-1)` mono). The `STATUS` value shows a green `.mr-led[data-state='tx-on']` dot when actively emitting, dim when not, plus the count of selected outputs.
- `OUTPUTS` row list: each row is a `<button>` (full-width, `var(--mr-bg-panel-2)`, hover → `var(--mr-bg-hdr-hover)`, `role="checkbox"`, `aria-checked` bound to membership in `selectedOutputIds`). Layout: `[checkbox-glyph 14×14] [device name flex-1] [TX LED 8×8]`. The TX LED pulses per-port — the sender keeps a `txPulseByOutputId` map so each port blinks independently (cosmetic, since they all emit simultaneously, but accurate).
- Bottom action row: two ghost buttons `Select all` and `Clear`, `var(--mr-fs-11)`, mono, `var(--mr-text-3)` hovering to `var(--mr-text-1)`.
- Disconnected outputs (a port previously selected, then unplugged): row remains in the list with `var(--mr-text-3)` text and a small `(offline)` suffix until the user explicitly removes it or hotplugs it back. The id stays in `selectedOutputIds` across hotplug.

**Motion:**
- TX LED pulse — a CSS class `.is-tx-pulse` is applied for 80 ms via a key swap on `txPulse`. The class transitions `opacity` from `0.4` to `1.0` and back via a single `@keyframes mrTx { 0%, 100% { opacity: 0.4 } 30% { opacity: 1 } }` animation, `animation-duration: 80ms`, `animation-fill-mode: none`. No transform — flat, instrument-like.
- Inspector section collapse — reuse the Sidebar's `[data-open]` boolean / height transition (no new animation).
- Pill open — reuse the existing `.mr-clk__menu` fade/slide (no new animation).

**Accessibility:**
- The Send pill button — `role="button"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-label="MIDI clock send — {state-summary}"`.
- The menu — `role="listbox"`, each row `role="option"` (or `role="checkbox"` for the per-output rows) with `aria-checked`.
- The Inspector master toggle — `role="switch"` with `aria-checked`.
- Per-output rows — focus-visible outline via `var(--mr-line-strong)`.
- The TX LED is purely decorative; it carries `aria-hidden="true"` and the status is also announced in text via the `STATUS` row's count.

### D5. Provider mounting

`MidiClockSendProvider` mounts in `App.tsx` as a **descendant of `MidiRuntimeProvider`** (to read `useMidiOutputs()`), **inside `TransportProvider`** (to read `mode`, `bpm`, `timecodeMs`, `clockSource`), and **inside `MidiClockProvider`** (to relay incoming pulses under external clock). Sibling-order: after `MidiClockProvider`, before `TimelineStorageProvider`.

The provider SHALL be a no-op when `useMidiOutputs().status !== 'granted'` — no scheduler started, no Web MIDI sends, `enabled` clamped to `false`.

### D6. Scheduler shape

```
src/midi/clockSender.ts
  - export function emitClock(outs: MIDIOutput[], timestamp: number): void
  - export function emitStart(outs: MIDIOutput[]): void
  - export function emitContinue(outs: MIDIOutput[]): void
  - export function emitStop(outs: MIDIOutput[]): void
  - export function createInternalScheduler({ getBpm, getOutputs, onPulse }): { start, stop, reset }
```

The internal scheduler uses `performance.now()` + 25 ms lookahead, scheduling the next batch via `setTimeout(..., 12 ms)` (lookahead minus headroom) — same shape as `src/midi/scheduler.ts`. `onPulse` is called each time a batch is committed so the provider can advance `txPulse`.

External relay does not go through this scheduler; it lives in a separate `useEffect` inside the provider that subscribes to `useMidiClock()` via a low-level pulse callback added in a small additive change to `MidiClockProvider` (see Open Questions).

### D7. Sync button — bundled emission for slave realignment

The Sync action is a single one-shot, fired from a button. When invoked with `enabled === true` and at least one selected connected output, the provider SHALL emit the following byte sequence to every selected connected output, in this DOM-stable order, with `timestamp: 0` (send immediately):

1. `0xFC` Stop
2. `0xF2 lsb msb` Song Position Pointer — where `sppBeats = clamp(floor(playheadTicks / (DEFAULT_MIDI_TPQ / 4)), 0, 16383)` (sixteenth-note count, 14-bit), `lsb = sppBeats & 0x7F`, `msb = (sppBeats >> 7) & 0x7F`
3. `0xFA` Start *if* `playheadTicks === 0`, *else* `0xFB` Continue

Rationale: this triple covers both classes of slaves. SPP-aware DAWs jump to the explicit position then resume on Continue. SPP-ignorant gear (drum machines, Traktor) treats the Stop + Start as a downbeat reset. The internal scheduler SHALL NOT pause during the sync emission — `0xF8` pulses continue uninterrupted, so the downstream "next clock pulse" lands within ~20 ms.

Alternatives considered: (a) emit only `0xFA` Start (Traktor-style, minimal interruption) — rejected as default because it ignores SPP-aware DAWs that would otherwise stay aligned to their own position; (b) emit only `0xF2 SPP` + `0xFB Continue` (DAW-friendly, no restart) — rejected as default because SPP-ignorant hardware would not realign at all. The bundled approach is the union of both. A "lite" mode (Start-only, Traktor-style) is left as a follow-on toggle.

The `sync()` action SHALL be a no-op when `enabled === false` or when zero outputs are connected+selected. It SHALL NOT change any state of the sender or transport.

### D8. Strict-Start mode on the incoming receiver

`useMidiClock()` SHALL expose a new field `strictStart: boolean` (default `true`) and an action `setStrictStart(b: boolean): void`. The state lives in `MidiClockProvider`, is in-memory only, and is set to `true` on provider mount.

When `strictStart === true` AND incoming `0xFA` is accepted by the active-master filter AND `useTransport().mode === 'idle'`, the receiver SHALL invoke `useTransport().rewind()` immediately before `useTransport().play()`. The rewind+play pair SHALL be atomic from the user's perspective: no intervening render commits `mode === 'idle'` with `timecodeMs > 0`. React 18's automatic batching of non-event updates handles this — the two dispatches commit in one render.

When `strictStart === false`, current behavior is preserved — `0xFA` invokes `play()` from the current `timecodeMs` (resume semantics).

Rationale: this matches the MIDI 1.0 spec ("Start: rewind, then play on next clock") which most slave-side workflows expect. The dominant real-world scenario is *this app as slave + Traktor as master*; in that case Traktor's Sync button sends `0xFC Stop` → `0xFA Start` and expects the slave to realign its grid to bar 1 on the next clock. **The original D8 default of `false` was reversed after live testing revealed the resume-style default broke Traktor's Sync workflow.** Users running this app standalone, or wanting resume-style Start semantics (e.g. accidental Start mid-session shouldn't move them), flip the toggle off via the Clk menu.

`0xFB` Continue is unaffected — it always resumes from current timecode regardless of `strictStart`. `0xFC` Stop is unaffected. The active-master filter is unaffected.

### D9. Grid Alignment trigger — configurable Note/CC on bar/phrase boundaries

The provider SHALL expose:

```ts
type GridAlignmentMessage =
  | { kind: 'note';  channel: number; note: number; velocity: number }
  | { kind: 'cc';    channel: number; cc: number;   value: number };

type GridAlignmentBoundary = 'bar' | 'phrase' | 'manual';

type GridAlignmentConfig = {
  enabled: boolean;
  outputId: string | null;     // null = no output picked yet
  message: GridAlignmentMessage;
  boundary: GridAlignmentBoundary;
  phraseBars: number;          // 1..32, used when boundary === 'phrase'
};

interface MidiClockSendValue {
  gridAlignment: GridAlignmentConfig;
  setGridAlignment(patch: Partial<GridAlignmentConfig>): void;
  fireGridAlignment(): void;
}
```

Defaults on mount: `{ enabled: false, outputId: null, message: { kind: 'note', channel: 1, note: 60, velocity: 127 }, boundary: 'bar', phraseBars: 8 }`.

**Boundary detection.** The provider SHALL fire the configured message on the *first* clock pulse of a bar (or phrase) boundary, where:

- "bar" boundary = `playheadTicks % (DEFAULT_MIDI_TPQ * beatsPerBar) === 0`
- "phrase" boundary = `barNumber % phraseBars === 0` (where `barNumber = floor(playheadTicks / (DEFAULT_MIDI_TPQ * beatsPerBar))`)

`beatsPerBar` is derived from `useTransport().sig` (e.g. "4/4" → 4, "3/4" → 3, "7/8" → 7).

Detection runs in both clock modes:

- **Internal mode**: detect via a `useEffect` watching `useTransport().playheadTicks` — fire when the playhead crosses a boundary. The check uses the previous tick (held in a ref) and looks for `prev < boundaryTick <= curr`.
- **External mode**: subscribe to `useMidiClock().onPulse(...)` and maintain a local pulse counter. Every `24 * beatsPerBar` pulses = one bar; fire on pulse count divisible by `24 * beatsPerBar` (or `24 * beatsPerBar * phraseBars` for phrase mode). The pulse counter resets on incoming `0xFA` Start.

The message SHALL be emitted as a single `MIDIOutput.send([statusByte, data1, data2], 0)` call on the resolved output port:

- Note: `[0x90 | (channel - 1), note, velocity]` followed immediately by `[0x80 | (channel - 1), note, 0]` after 50 ms (a short note-off so the trigger is a pulse, not a held note).
- CC: `[0xB0 | (channel - 1), cc, value]` — single message, no companion.

When `boundary === 'manual'`, automatic firing is disabled; only `fireGridAlignment()` triggers emission.

`fireGridAlignment()` SHALL be a no-op when `outputId === null` or when no output with that id is currently connected. It SHALL NOT require `enabled === true` (a manual fire works even when the auto-trigger is off — useful for one-shot mapping testing).

`setGridAlignment(patch)` accepts a partial — common usage is `setGridAlignment({ note: 64 })` rather than passing the whole struct.

Rationale: this is the Traktor-mapping workaround codified. By emitting a regular MIDI note/CC at bar 1 (or every Nth bar for phrase), the user can map it inside Traktor's TSI to "Master Clock Reset" or per-deck "Phase Sync" and get downbeat alignment that the bare MIDI clock protocol can't deliver.

### D10. UI placement for the new controls

**Strict Start toggle — added row in the existing Clk dropdown menu.**

The Clk menu currently contains: Auto, Internal, `<device rows>`. The new row is appended at the bottom, visually separated by a 1px `var(--mr-line-1)` divider, with structure:

- Row label `Strict Start` (mono, `var(--mr-text-1)`) + tiny sub-label `rewind to 0 on incoming Start` (mono, `var(--mr-fs-11)`, `var(--mr-text-3)`)
- Right-aligned `role="switch"` mini-rocker (same rocker primitive used elsewhere)

Clicking the row (or the rocker) toggles `strictStart`. The menu does NOT close on this row's click (clicks on Auto/Internal/device rows still close per the existing requirement — only the new row keeps the menu open, mirroring how the existing Snd menu's Enable row behaves).

**Sync button — prominent placement in the Inspector Clock Send section, with a quick-action mirror in the Snd pill menu footer.**

In the Inspector section, the Sync button is positioned between the master row and the CADENCE row. Visual: a full-width button styled like `.mr-tbtn` but with the cue accent — `background: var(--mr-bg-panel-2)`, `border: 1px solid var(--mr-cue)`, `color: var(--mr-text-1)`, mono text reading `SYNC SLAVES`, `var(--mr-fs-11)`, `letter-spacing: 0.08em`. Pressing fires `sync()`. Disabled state (`disabled` attribute + `var(--mr-text-4)`) when `enabled === false` OR no outputs are selected+connected.

Brief flash feedback on press: the button briefly inverts (background → `var(--mr-cue)`, color → `var(--mr-text-on-accent)`) for 120 ms via a CSS class toggle. This is the only visual confirmation; no toast.

In the Snd pill menu, after the `Select all` / `Clear` footer, add a third row `Sync slaves now` styled as a ghost button — same accent color, smaller (`var(--mr-fs-11)`). Same disable rule.

**Grid Alignment subsection — collapsible subsection inside the Inspector Clock Send section, below OUTPUTS list, above the footer.**

Structure:

```
┌─ GRID ALIGNMENT ─────────────── ▾ ─┐
│                                     │
│  [ ] Enable                         │
│                                     │
│  OUTPUT      [▾ Device picker ]     │
│  TRIGGER     ( ) Bar  ( ) Phrase    │
│              ( ) Manual only        │
│  PHRASE      [— 8 +] bars           │  ← visible only when TRIGGER=Phrase
│  MESSAGE     ( ) Note   ( ) CC      │
│              CH [— 1 +]             │
│              N# [— 60 +]            │  ← labeled N# (note) or CC# depending on type
│              VAL[—127 +]            │  ← labeled VAL (note vel) or VAL (cc value)
│                                     │
│  [ Fire now ]                       │  ← manual one-shot
└─────────────────────────────────────┘
```

- Header collapse mirrors the parent section's `.mr-panel__head` pattern; default `data-open === "true"`.
- The Enable row is a `role="switch"` rocker styled identically to the master Send rocker, full-width with the label `Enable` left, rocker right.
- The OUTPUT picker is a dropdown (`role="combobox"`) listing `useMidiOutputs().outputs`. Selection writes `outputId`. A `(none)` row at the top represents `outputId = null`.
- The TRIGGER row is a 3-button segmented control (`.mr-seg`, `role="radiogroup"`) with Bar / Phrase / Manual options. Selection writes `boundary`.
- The PHRASE row is a small `[— N +]` numeric stepper (range 1..32, default 8). Visible only when `boundary === 'phrase'`.
- The MESSAGE row is a 2-button segmented control (Note / CC) writing `message.kind`. Below it, three small steppers for channel, note-or-cc-number, and velocity-or-value. The middle and right labels switch text based on `kind` (`N#` vs `CC#`, `VEL` vs `VAL`).
- The Fire now button is a small ghost button styled like the Snd menu footer buttons (`var(--mr-fs-11)`, mono, hover → `var(--mr-text-1)`). Disabled when `outputId === null` or no connected output matches.

Motion: when an automatic fire occurs, the Fire now button briefly flashes (same 80 ms accent pulse used elsewhere) so the user sees the auto-trigger working without watching their slave gear.

Accessibility: all stepper inputs are `<input type="number">` for keyboard/screen-reader compat. The segmented controls use `role="radiogroup"` with `role="radio"` children and `aria-checked`. The rocker uses `role="switch"` with `aria-checked`.

### D11. Receiver hardening for real-world jitter and gaps

After live testing against Traktor (same-machine, virtual IAC port), three additional hardening fixes landed in `MidiClockProvider`:

**a) Drive inter-pulse deltas from `event.timeStamp`, not `performance.now()`.**
Web MIDI events carry a `DOMHighResTimeStamp` set by the OS/UA at byte-arrival time. Using this instead of `performance.now()` inside the handler makes the smoother and `applyExternalPulse` delta-math immune to JS main-thread blocking — if pulses queue in the event loop during a blocking render or GC pause and then drain in a burst, each pulse still reports its original RX timing. Without this, a 100ms main-thread stall would compress 5 pulses into "all at once" and the smoother would briefly compute a wildly wrong BPM.

**b) Cap `deltaMs` to `MAX_PULSE_DELTA_MS = 50ms`** before passing to `applyExternalPulse`. After a gap (silence, hotplug, browser tab regaining focus), the first resumed pulse has a `deltaMs` equal to the entire gap duration. Without capping, `timecodeMs` would jolt forward by the gap and the scheduler would skip the in-gap notes. The cap (50ms ≈ 50 BPM steady-state) treats gap-recovery as a single normal pulse and absorbs the silence smoothly.

**c) Split the present-timer (500ms) from the revert-timer (2000ms).**
The original implementation used a single 500ms timer for both `present`-flag flip and `revertToInternalClock()`. Spec said 2000ms for the revert, but code reverted at 500ms — so brief jitter (USB packet aggregation, 100ms main-thread blocks) would spuriously flip `clockSource` to internal, drifting the playhead at `userBpm` until the next pulse re-flipped it. The split keeps `present` responsive (500ms — UI dim feedback, smoother considered stale) while the revert is tolerant of multi-second gaps (2000ms). Device-locked selections remain external indefinitely (no auto-revert) per the existing requirement.

Rationale: All three were necessary together to deliver smooth sync under real-world load. (a) gives correct timing arithmetic; (b) caps the worst-case jolt at the timing arithmetic's boundary; (c) prevents spurious source-flipping during the same gaps. Tests cover each in isolation plus an integration test that verifies a 600ms silence preserves `clockSource === 'external-clock'` and a 2100ms silence reverts.

Deferred: rAF-coalesced pulse batching (a CPU win at 50Hz pulse rate). Attempted alongside this slice but produced test infrastructure conflicts with the transport's own rAF loop. Splittable into a follow-on change once we have a clean mocking pattern for rAF that doesn't recurse with the transport tick.

## Risks / Trade-offs

- **Risk: per-emit LED render storm** → Mitigation: `txPulse` is rAF-coalesced; React only re-renders the LED component at most ~60 Hz regardless of clock rate.
- **Risk: jitter under internal clock at low BPM** → Mitigation: 25 ms lookahead window is adequate down to 30 BPM (interval ≈ 83 ms ≫ lookahead). For BPM > ~250 the scheduler would need shorter lookahead — out of scope this slice; we cap effective emission at the user-set BPM range already enforced by `useTransport`.
- **Risk: external-relay introduces handler-chain order coupling with `useMidiClock`** → Mitigation: the relay subscription is a *callback* registered on the existing `MidiClockProvider` API (additive), not a second `onmidimessage` attach. The receiver remains the single attacher; the sender is a downstream observer.
- **Risk: a disconnected output id lingers in `selectedOutputIds`** → Mitigation: provider filters `selectedOutputIds` against live `outputs` at emit time; offline rows render but emit no bytes. The id persists across hotplug, so reconnecting a USB cable restores send without re-checking the box.
- **Trade-off: no persistence** means the user re-enables send on every reload. Accepted to keep this slice surgical; can be promoted to session state in a follow-on slice without API churn (`hydrate` slot is left open).
- **Trade-off: send config is global, not per-track / per-routing** — only "send to this list of outputs" exists. Per-track clock send is not a known use case for this app and would balloon the surface.
- **Risk: Strict-Start rewinds an intentionally cued playhead** → Mitigation: `strictStart` defaults to `false`. Users opt in only when their workflow needs Traktor-style downbeat resync. The toggle is one click away in the Clk menu so users can disable mid-session.
- **Risk: Grid-alignment auto-fire missed at boundary under heavy CPU** → Mitigation: in external mode the pulse counter guarantees exact firing on the divisor pulse; in internal mode the `playheadTicks`-watching effect uses a `prev < boundary <= curr` window so a missed frame still fires on the *next* tick (≤16ms late). For sub-frame accuracy users should use external clock + the pulse-count path.
- **Risk: Grid-alignment Note On without a Note Off stays "stuck" on slaves** → Mitigation: Note kind emits a paired Note Off after 50 ms (described in D9). CC kind does not need pairing.
- **Risk: Sync bundle order matters for some hardware** → Mitigation: emit in strict `Stop → SPP → Continue/Start` order in a tight loop, no Promise/await between bytes; Web MIDI's send queue preserves order to a single output. Worst-case skew across multiple outputs is sub-millisecond on macOS Core MIDI.

## Open Questions

1. Should `MidiClockProvider` expose a `onPulse(callback): () => void` subscription API, or should the sender attach its own `onmidimessage` chain? Recommendation: extend `MidiClockProvider` with `onPulse` — keeps the single-attach invariant and avoids handler-chain ordering bugs. This is an additive change to the `midi-clock` capability and is captured in the spec deltas.
2. When the user enables send while `mode === 'play'` mid-session, should the sender emit a Start, a Continue, or neither? Recommendation: emit Continue (since `timecodeMs > 0`), matching the transition table for `idle → play` with a non-zero timecode. Downstream gear that doesn't honour Continue will at minimum start clocking from the next `0xF8` and sync on the next bar.
3. Should we expose a "Send only while playing" preference (no idle-time clock)? Many hardware sequencers send clock continuously; some require it. Recommendation: continuous emission while `enabled === true` matches the more compatible default; revisit if user reports request it.
4. Should the Sync button have a "lite" mode that emits only `0xFA` Start (Traktor's behavior, no Stop/SPP)? Recommendation: ship Robust as the default; add a toggle in the Grid Alignment subsection (or next to the Sync button) in a follow-on slice if the Traktor-only workflow is the dominant one.
5. Should Grid Alignment fire at `playheadTicks === 0` on the very first play, or wait for the next bar boundary? Recommendation: fire at bar 0 (i.e., when `playheadTicks === 0` and play just started) — most slave mappings expect a "bar 1, beat 1" pulse at song start.
6. Strict-Start: should it also act on `0xFB` Continue (rewind+continue)? Recommendation: no — Continue's semantic is "resume from current position" regardless of strict mode. A Continue that rewinds would be self-contradictory.
