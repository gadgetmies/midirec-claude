# dj-action-tracks Specification

## Purpose
TBD - created by archiving change dj-mode-shell. Update Purpose after archive.
## Requirements
### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>` — verbatim from the prototype's `dj.jsx`. Keys: `'transport' | 'cue' | 'hotcue' | 'loop' | 'fx' | 'deck' | 'mixer'`.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — verbatim. Keys are MIDI pitch numbers from 48 (C3) to 75 (D♯5). 28 entries.
- `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean }`.
- Helpers `devColor(d: DeviceId): string`, `devShort(d: DeviceId): string`, `devLabel(d: DeviceId): string`, `pitchLabel(p: number): string`.

The data SHALL be declared `as const` so TypeScript narrows the literal types; the helpers SHALL fall back to the `'global'` device for unknown ids, matching the prototype's `(DJ_DEVICES[device] || DJ_DEVICES.global)` pattern.

#### Scenario: Module is importable and typed

- **WHEN** another file imports `DJ_CATEGORIES`, `DJ_DEVICES`, `DEFAULT_ACTION_MAP`, or any helper from `src/data/dj.ts`
- **THEN** TypeScript SHALL resolve the import without errors
- **AND** `DJ_DEVICES.deck1.color` SHALL be the literal string `"oklch(72% 0.16 200)"`
- **AND** `DEFAULT_ACTION_MAP[48].label` SHALL be the literal string `"Play / Pause"`

#### Scenario: pitchLabel formats correctly

- **WHEN** `pitchLabel(48)` is called
- **THEN** it SHALL return `"C3"`
- **AND** `pitchLabel(60)` SHALL return `"C4"`
- **AND** `pitchLabel(57)` SHALL return `"A3"`

### Requirement: DJActionTrack data shape

The `dj-action-tracks` capability SHALL define the following types:

```ts
type DJTrackId = string;

// TODO(routing-ui-slice): expand the routing shape with pitch ranges and CC selectors
// when the routing-configuration UI is built. For Slice 7a the channel list is
// the only field we commit to.
interface DJTrackRouting {
  channels: ChannelId[];
}

interface DJActionTrack {
  id: DJTrackId;
  name: string;
  color: string;
  actionMap: Record<number, ActionMapEntry>;
  inputRouting: DJTrackRouting;
  outputRouting: DJTrackRouting;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
}
```

`inputRouting` SHALL declare which incoming MIDI messages feed this track's action map. `outputRouting` SHALL declare where the track's actions emit on playback. Both fields exist on every dj-action-track; their full selector shapes (pitch ranges, CC selectors) are deferred to the routing-configuration slice.

The `actionMap` field SHALL be **the set of actions actively configured on this track** — NOT a reference to a catalog of all possible actions. The track's body SHALL render exactly one row per entry in `actionMap`. Adding an action to the track means inserting a new entry into `actionMap` (typically via a future routing/add-action UI in Slice 7b or later); the catalog of available actions a user can pick from lives in `DEFAULT_ACTION_MAP` (exported from `src/data/dj.ts`), which is a SOURCE for the picker, not a track's actionMap.

The default seeded track SHALL contain a small demo subset of `DEFAULT_ACTION_MAP` (4 entries — pitches 48, 56, 60, 71 — spanning 3 devices) so the shell has visible rows to demo against. Future tracks created via the routing/add-action UI MAY start empty; an empty `actionMap` is a valid state and SHALL render the track header with body content sized to zero rows.

#### Scenario: Default seeded track has the expected fields

- **WHEN** the app first renders
- **THEN** `useStage().djActionTracks` SHALL be an array of length 1
- **AND** the entry SHALL have `id === 'dj1'`, `name === 'DJ'`, `color === DJ_DEVICES.global.color`
- **AND** `Object.keys(actionMap)` SHALL have length 4 (the demo subset)
- **AND** the seeded pitches SHALL be `48`, `56`, `60`, `71` — each mapped to the matching entry from `DEFAULT_ACTION_MAP`
- **AND** `inputRouting.channels` SHALL be `[]`
- **AND** `outputRouting.channels` SHALL be `[]`
- **AND** `collapsed`, `muted`, `soloed` SHALL all be `false`

### Requirement: Stage exposes dj-action-track state and per-track toggles

The `StageState` interface returned by `useStage()` SHALL expose:

- `djActionTracks: DJActionTrack[]` — the current list of dj-action-tracks. Default seed contains exactly one entry per the data-shape requirement above.
- `toggleDJTrackCollapsed(id: DJTrackId): void` — flips the `collapsed` flag on the named track. No-op if the id is unknown.
- `toggleDJTrackMuted(id: DJTrackId): void` — flips `muted`. No-op for unknown ids.
- `toggleDJTrackSoloed(id: DJTrackId): void` — flips `soloed`. No-op for unknown ids.

The state SHALL persist across re-renders in `useState` keyed off the `useDJActionTracks` hook. It SHALL NOT reset on Toolstrip state changes, dialog opens, or any other unrelated state transitions.

#### Scenario: toggleDJTrackMuted flips the muted flag

- **WHEN** `toggleDJTrackMuted('dj1')` is called while `djActionTracks[0].muted === false`
- **THEN** the next render SHALL have `djActionTracks[0].muted === true`
- **AND** other fields on the track SHALL be unchanged

#### Scenario: Unknown id is a no-op

- **WHEN** `toggleDJTrackMuted('nonexistent')` is called
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)
- **AND** no error SHALL be thrown

### Requirement: Soloing flag combines channel and dj-action-track solo

The `soloing` flag returned by `useStage()` SHALL be `true` when ANY of the following holds:

- Any channel in `state.channels` has `soloed === true`.
- Any roll in `state.rolls` has `soloed === true`.
- Any lane in `state.lanes` has `soloed === true`.
- Any track in `state.djActionTracks` has `soloed === true`.

The flag is track-kind-independent. Solo state set on a dj-action-track contributes to the same global flag as channel/roll/lane solo. `.mr-timeline` (or `.mr-timeline__inner`) SHALL carry `data-soloing="true"` whenever `soloing` is `true`, per the existing `app-shell` capability rule.

#### Scenario: dj-action-track solo lights up data-soloing

- **WHEN** `toggleDJTrackSoloed('dj1')` is called while no channel/roll/lane is soloed
- **THEN** the next render SHALL have `useStage().soloing === true`
- **AND** `.mr-timeline` SHALL carry `data-soloing="true"`

#### Scenario: Mixed solo state across kinds

- **WHEN** a channel is soloed AND a dj-action-track is also soloed
- **THEN** `useStage().soloing` SHALL be `true`
- **AND** un-soloed channels and un-soloed dj-action-tracks SHALL both render with `data-audible="false"` and dim per the existing solo-dim rule

### Requirement: DJActionTrack component renders header and placeholder body

The `<DJActionTrack>` component at `src/components/dj-action-tracks/DJActionTrack.tsx` SHALL render a `.mr-djtrack` element with the following data attributes:

- `data-track-collapsed={track.collapsed ? 'true' : undefined}`
- `data-muted={track.muted ? 'true' : undefined}`
- `data-soloed={track.soloed ? 'true' : undefined}`
- `data-audible` matching the channel-track convention: under `data-soloing="true"`, only soloed tracks are audible.

The header (`.mr-djtrack__hdr`) SHALL split its children into three sticky-zoned wrappers, in left-to-right order, mirroring the existing `<Track>` header layout:

1. `<div className="mr-djtrack__hdr-left">` — sticky-left zone (`position: sticky; left: 0; z-index: 1`), background `var(--mr-bg-panel-2)`, containing in order:
   1. `<span className="mr-djtrack__chev">` — chevron glyph. CSS rule `[data-track-collapsed="true"] .mr-djtrack__chev` rotates it `-90deg`.
   2. `<span className="mr-djtrack__name">` — text `track.name`, with inline `color: track.color` to match the track's chosen color.
   3. `<span className="mr-djtrack__sub">` — text `"{Object.keys(track.actionMap).length} actions"`.
2. `<div className="mr-djtrack__hdr-spacer">` — flex-grow filler, NOT sticky.
3. `<div className="mr-djtrack__hdr-right">` — sticky-right zone (`position: sticky; right: 0; z-index: 1`), background `var(--mr-bg-panel-2)`, containing exactly one `<MSChip muted={track.muted} soloed={track.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed} />` (reused from the existing `tracks` capability).

Clicking on `.mr-djtrack__hdr` outside the M/S chip SHALL invoke `onToggleCollapsed`. Clicking on the M/S chip SHALL NOT bubble — the existing `MSChip` component handles `event.stopPropagation()`.

When `track.collapsed === false`, the body (`.mr-djtrack__body`) SHALL render below the header. The body SHALL contain:

- A sticky-left keys-spacer zone (`position: sticky; left: 0; width: var(--mr-w-keys)`) that is empty in this slice — placeholder for the future ActionKeys column from Slice 7b.
- A row container of intrinsic height `Object.keys(track.actionMap).length * var(--mr-h-row)` (or a sensible minimum like 120px), containing one empty `<div className="mr-djtrack__row">` per pitch in the action map.
- A centered `<div className="mr-djtrack__placeholder">Action body — Slice 7b</div>` overlay or interleaved element so the placeholder is visible and grep-able.

When `track.collapsed === true`, only the header SHALL render. The body SHALL NOT exist in the DOM.

When `track.muted === true`, the body SHALL be visually dimmed via `[data-muted="true"] .mr-djtrack__body { opacity: 0.4 }` (or equivalent rule).

The action-label keys column (`.mr-actkey` rules), action-mode lane rows, beat ticks inside the body, and the three note-rendering modes (trigger / velocity-sensitive / pressure-bearing) are explicitly NOT part of `<DJActionTrack>` in this slice — they are deferred to Slice 7b.

#### Scenario: Header structure includes the three sticky-zoned wrappers

- **WHEN** a `<DJActionTrack>` is rendered with the default seeded track
- **THEN** the rendered DOM SHALL contain `.mr-djtrack > .mr-djtrack__hdr` with children matching the order: `.mr-djtrack__hdr-left`, `.mr-djtrack__hdr-spacer`, `.mr-djtrack__hdr-right`
- **AND** `.mr-djtrack__hdr-left` SHALL contain (in this order): `.mr-djtrack__chev`, `.mr-djtrack__name`, `.mr-djtrack__sub`
- **AND** `.mr-djtrack__hdr-right` SHALL contain exactly one `.mr-ms` (the MSChip's root)

#### Scenario: Sub label format

- **WHEN** the seeded track is rendered with its default 4-entry `actionMap`
- **THEN** the `.mr-djtrack__sub` text content SHALL be `4 actions`
- **AND** if a track's `actionMap` is empty, the text SHALL be `0 actions`

#### Scenario: Expanded body renders one row per configured action

- **WHEN** a `<DJActionTrack>` is rendered with `track.collapsed === false` AND `Object.keys(track.actionMap).length > 0`
- **THEN** the rendered DOM SHALL contain `.mr-djtrack > .mr-djtrack__body`
- **AND** `.mr-djtrack__body` SHALL contain `Object.keys(track.actionMap).length` `.mr-djtrack__row` children (the configured-actions count, NOT the size of any reference catalog)
- **AND** the rows SHALL appear in ascending order of MIDI pitch (matching the prototype's `ActionRollUnit` row order)
- **AND** `.mr-djtrack__body` SHALL contain a `.mr-djtrack__placeholder` element with text content "Action body — Slice 7b"
- **AND** the body's intrinsic height SHALL equal `rowCount * var(--mr-h-row)` — there SHALL NOT be a `min-height` reservation that adds extra vertical space below the last row

#### Scenario: Empty actionMap renders zero rows

- **WHEN** a `<DJActionTrack>` is rendered with `track.collapsed === false` AND `track.actionMap = {}`
- **THEN** `.mr-djtrack__body` SHALL exist
- **AND** `.mr-djtrack__body` SHALL contain zero `.mr-djtrack__row` children
- **AND** `.mr-djtrack__body` SHALL NOT contain a `.mr-djtrack__placeholder` element (the "Action body — Slice 7b" caption is suppressed when there are no rows it would caption)
- **AND** the body's intrinsic height SHALL collapse to zero; only the header is visible

#### Scenario: Collapsed body is absent from the DOM

- **WHEN** a `<DJActionTrack>` is rendered with `track.collapsed === true`
- **THEN** `.mr-djtrack > .mr-djtrack__body` SHALL NOT exist in the DOM

#### Scenario: Header click toggles collapse

- **WHEN** the user clicks `.mr-djtrack__hdr` outside the M/S chip
- **THEN** `onToggleCollapsed` SHALL be invoked exactly once

#### Scenario: M/S chip click does not toggle collapse

- **WHEN** the user clicks the `M` button inside the M/S chip
- **THEN** `onToggleMuted` SHALL be invoked
- **AND** `onToggleCollapsed` SHALL NOT be invoked

#### Scenario: Muted track dims the body

- **WHEN** `track.muted === true` and `track.collapsed === false`
- **THEN** `.mr-djtrack` SHALL carry `data-muted="true"`
- **AND** the `.mr-djtrack__body` element's computed opacity SHALL be visibly less than 1 (per the `[data-muted="true"] .mr-djtrack__body` rule)

### Requirement: Timeline renders dj-action-tracks below channel groups

The AppShell's timeline body (inside `.mr-timeline__inner`, after the `<Ruler>`) SHALL render channel groups followed by dj-action-tracks, in this order:

1. `<Ruler>` (sticky top).
2. One `<ChannelGroup>` per entry in `stage.visibleChannels`, in numeric ascending order of `Channel.id` (per the `channels` capability — unchanged).
3. One `<DJActionTrack>` per entry in `stage.djActionTracks`, in array order.

Both kinds SHALL share the timeline's horizontal scroll axis. Both kinds SHALL appear in the vertical scroll axis when the timeline overflows.

DJ action tracks SHALL NOT be rendered inside any channel group. They are siblings of channel groups, both direct children of `.mr-timeline__inner`.

#### Scenario: Default session renders both kinds

- **WHEN** the app first renders with the default seed (2 channels with content, 1 dj-action-track)
- **THEN** `.mr-timeline__inner` SHALL contain (in order): one `.mr-ruler`, two `.mr-channel` elements, one `.mr-djtrack` element
- **AND** the `.mr-djtrack` SHALL appear below all `.mr-channel` elements in the DOM

#### Scenario: dj-action-track is not nested in a channel group

- **WHEN** the rendered DOM is inspected
- **THEN** `.mr-channel .mr-djtrack` SHALL match zero elements
- **AND** `.mr-djtrack` SHALL be a direct child of `.mr-timeline__inner`

### Requirement: DJActionTrack rendering respects real-time correctness

The dj-action-tracks capability introduces the heaviest visual surface in the codebase to date: each track lays out one row per pitch in its action map (28 rows for the default seed), and Slice 7b will add per-action-event painting on top. The components in this capability SHALL be implemented in a way that does not foreclose the real-time guarantees documented in `design/real-time-correctness.md`:

- No incoming MIDI message SHALL be dropped, delayed, or timestamp-offset because of a layout/paint triggered by `<DJActionTrack>` mount, expand/collapse, M/S toggle, or any other render path in this capability.
- The eventual audio engine (Slice 10) SHALL be free to capture and emit messages off the React render path; this capability's hooks (`useDJActionTracks`) and components (`<DJActionTrack>`) SHALL NOT introduce patterns that gate MIDI handling on a `setState` cycle.
- See `design/real-time-correctness.md` for the cross-cutting constraint, the rationale, and the implementation patterns to avoid (per-message React re-renders, render-gated playback emit, `Date.now()`-based capture timestamps).

This requirement is forward-looking — the audio engine itself is Slice 10's work. The constraint is recorded here so that visual-only slices (7a, 7b, 8, 9) do not paint the architecture into a corner.

#### Scenario: Component implementation does not gate MIDI on React state

- **WHEN** a code review or static analysis inspects `src/hooks/useDJActionTracks.ts` and `src/components/dj-action-tracks/DJActionTrack.tsx`
- **THEN** there SHALL NOT be any path that processes raw `MIDIMessageEvent` data inside a React render or `useEffect`
- **AND** there SHALL NOT be any code that triggers `setState` on a per-message basis (the audio engine's eventual ring-buffer pattern is the right surface — direct `setState`-per-message is not)

