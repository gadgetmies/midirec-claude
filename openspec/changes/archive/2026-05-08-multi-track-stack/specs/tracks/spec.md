## ADDED Requirements

### Requirement: Track is a flat record carrying notes, color, and per-row state

The codebase SHALL define a `Track` interface with the following fields, in this exact shape:

```ts
interface Track {
  id: string;          // stable unique identifier
  name: string;        // display name (e.g. "Lead")
  channel: string;     // formatted MIDI channel string (e.g. "CH 1")
  color: string;       // CSS color string (e.g. "oklch(72% 0.14 240)") — used as swatch and trackColor
  notes: Note[];       // session notes belonging to this track, in beats per the session-model
  open: boolean;       // expanded vs collapsed
  muted: boolean;      // mute state (visual only in this slice; Slice 10 wires audio)
  soloed: boolean;     // solo state (visual only in this slice)
}
```

`notes` SHALL follow the session-model convention: `t` and `dur` are in beats; values are unbounded; the renderer's view-window contract (`viewT0`, `totalT`) determines what's visible. Tracks SHALL NOT carry their own loop region — loop is session-scope per the `session-model` capability.

#### Scenario: Track shape includes all required fields

- **WHEN** code constructs a `Track` value
- **THEN** the value SHALL have all eight fields (`id`, `name`, `channel`, `color`, `notes`, `open`, `muted`, `soloed`) populated

#### Scenario: Tracks share the session-scope loop region

- **WHEN** a session has a non-null `loopRegion` in `TransportState`
- **THEN** all tracks SHALL be subject to the same loop region during playback
- **AND** no track-specific loop region field SHALL exist

### Requirement: useTracks hook owns the track list and per-track actions

The codebase SHALL expose a `useTracks()` hook at `src/hooks/useTracks.ts` returning:

```ts
interface UseTracksReturn {
  tracks: Track[];
  toggleTrackOpen: (id: string) => void;
  toggleTrackMuted: (id: string) => void;
  toggleTrackSoloed: (id: string) => void;
}
```

The seeded default `tracks` value SHALL match the prototype's `Stage` default (`prototype/components.jsx` lines ~698–702):

- Track id `"t1"`, name `"Lead"`, channel `"CH 1"`, color `"oklch(72% 0.14 240)"`, notes `makeNotes(22, 7)`, `open: true`, `muted: false`, `soloed: false`.
- Track id `"t2"`, name `"Bass"`, channel `"CH 2"`, color `"oklch(70% 0.16 30)"`, notes `makeNotes(16, 11)`, `open: true`, `muted: false`, `soloed: false`.
- Track id `"t3"`, name `"Pads"`, channel `"CH 3"`, color `"oklch(74% 0.10 145)"`, notes `makeNotes(12, 19)`, `open: false`, `muted: true`, `soloed: false`.

The action functions SHALL flip the corresponding boolean on the matching track. Calling an action with an unknown `id` SHALL be a no-op.

#### Scenario: Default seeded tracks are three rows

- **WHEN** `useTracks()` is read on first mount
- **THEN** `tracks.length` SHALL be `3`
- **AND** `tracks[0].id === "t1"`, `tracks[1].id === "t2"`, `tracks[2].id === "t3"`

#### Scenario: Default seed matches the prototype names and colors

- **WHEN** `useTracks()` is read on first mount
- **THEN** `tracks[0]` SHALL match `{ name: "Lead", channel: "CH 1", color: "oklch(72% 0.14 240)", open: true, muted: false, soloed: false }`
- **AND** `tracks[1]` SHALL match `{ name: "Bass", channel: "CH 2", color: "oklch(70% 0.16 30)", open: true, muted: false, soloed: false }`
- **AND** `tracks[2]` SHALL match `{ name: "Pads", channel: "CH 3", color: "oklch(74% 0.10 145)", open: false, muted: true, soloed: false }`

#### Scenario: Toggle actions flip the targeted boolean

- **WHEN** `toggleTrackOpen("t3")` is called and the prior `t3.open === false`
- **THEN** the next render SHALL have `t3.open === true`

#### Scenario: Toggle actions on unknown id are no-ops

- **WHEN** `toggleTrackMuted("nonexistent")` is called
- **THEN** the tracks array SHALL be unchanged

### Requirement: MultiTrackStage renders a vertical stack of track rows

The codebase SHALL expose a `MultiTrackStage` React component that renders a `<div>` (the stage orchestrator root) containing one `<div className="mr-track">` per track. The orchestrator root SHALL carry `data-soloing="true"` whenever ANY track in the stack has `soloed === true`.

Each `.mr-track` element SHALL carry:
- `data-track-open="true"` or `data-track-open="false"` per the track's `open` field.
- `data-muted="true"` or `data-muted="false"` per the track's `muted` field.
- `data-soloed="true"` or `data-soloed="false"` per the track's `soloed` field.

Track rows SHALL render in array order, top to bottom.

#### Scenario: Three default tracks render three rows

- **WHEN** `<MultiTrackStage>` is rendered with the seeded default tracks
- **THEN** the rendered DOM SHALL contain exactly three `.mr-track` elements

#### Scenario: data-soloing reflects any-track-soloed

- **WHEN** all tracks have `soloed === false`
- **THEN** the orchestrator root SHALL NOT carry `data-soloing="true"` (it MAY be omitted or `"false"`)

#### Scenario: data-soloing flips when a track is soloed

- **WHEN** at least one track has `soloed === true`
- **THEN** the orchestrator root SHALL carry `data-soloing="true"`

#### Scenario: Per-row data attributes match track state

- **WHEN** a track has `{ open: true, muted: false, soloed: true }`
- **THEN** its `.mr-track` element SHALL carry `data-track-open="true"`, `data-soloed="true"`
- **AND** SHALL NOT carry `data-muted="true"`

### Requirement: Track header renders chevron, swatch, name, sub, and M/S chip

Each track row SHALL render a `.mr-track__hdr` element with the following structure, in left-to-right order:

1. `<span className="mr-track__chev">` — chevron glyph. The CSS selector `[data-track-open="false"] .mr-track__chev` rotates it `-90deg` to indicate the collapsed state.
2. `<span className="mr-track__swatch" style={{background: tr.color, color: tr.color}}>` — 9×9px colored square, with a glowing box-shadow derived from the swatch color via `color-mix`.
3. `<span className="mr-track__name">{tr.name}</span>` — the track's display name in 11px semibold.
4. `<span className="mr-track__sub">{tr.channel} · {tr.notes.length} notes</span>` — channel + note count in mono 9px, `var(--mr-text-3)`.
5. `<div className="mr-track__spacer">` — flex-grow filler.
6. `<MSChip muted={tr.muted} soloed={tr.soloed} onMute={...} onSolo={...} />`.

Clicking on `.mr-track__hdr` outside the M/S chip SHALL invoke `toggleTrackOpen(tr.id)`. Clicking on the M/S chip SHALL NOT bubble up to the header click handler — chip buttons SHALL `event.stopPropagation()`.

#### Scenario: Header structure includes all five elements

- **WHEN** any track row is rendered
- **THEN** its `.mr-track__hdr` SHALL contain (in this order): one `.mr-track__chev`, one `.mr-track__swatch`, one `.mr-track__name`, one `.mr-track__sub`, one `.mr-track__spacer`, one `.mr-ms` (the MSChip's root)

#### Scenario: Sub label format

- **WHEN** a track has `channel: "CH 1"` and `notes.length === 22`
- **THEN** the `.mr-track__sub` text content SHALL be `CH 1 · 22 notes`

#### Scenario: Chevron rotates when collapsed

- **WHEN** a track has `open: false`
- **THEN** the `.mr-track` element SHALL carry `data-track-open="false"`
- **AND** the `.mr-track__chev`'s computed `transform` SHALL be `rotate(-90deg)` (or matrix equivalent)

#### Scenario: Header click toggles open state

- **WHEN** the user clicks on the `.mr-track__hdr` outside the M/S chip
- **THEN** `toggleTrackOpen(tr.id)` SHALL be invoked exactly once

#### Scenario: M/S chip click does not toggle the row open state

- **WHEN** the user clicks the `M` button inside the M/S chip
- **THEN** `toggleTrackMuted(tr.id)` SHALL be invoked
- **AND** `toggleTrackOpen(tr.id)` SHALL NOT be invoked

### Requirement: Open tracks render an embedded PianoRoll; collapsed tracks render a 6px minimap

When a track has `open === true`, the row's body SHALL render a `<div className="mr-track__roll">` containing a `<PianoRoll>` component instantiated with the track's notes and color:

- `notes={tr.notes}`
- `trackColor={tr.color}`
- `marquee` and `selectedIdx`: only the track whose `id === selectedTrackId` receives non-empty values; all other tracks receive `marquee={null}` and `selectedIdx={[]}`.
- `pxPerBeat`, `rowHeight`, `lo`, `hi`, `totalT`, `playheadT`: shared across the stack from the orchestrator's view-window props.

When a track has `open === false`, the row's body SHALL render a `<div className="mr-track__collapsed">` containing a `.mr-track__minimap` strip — a 6px-tall horizontal bar with one `<span>` per note (filtered by the view window per session-model). Each minimap span:

- Absolute-positioned at `left: ((n.t - viewT0) / totalT) * 100%`.
- Width `((n.dur / totalT) * 100%)`, with a 1px minimum.
- Top/bottom inset 1px, leaving a 4px-tall colored bar.
- Background `tr.color`.
- Opacity `0.5 + n.vel * 0.4`.
- Border-radius `1px`.

#### Scenario: Open track renders a PianoRoll

- **WHEN** a track has `open: true`
- **THEN** its `.mr-track__roll` SHALL contain exactly one `.mr-roll` element (the PianoRoll's root)

#### Scenario: Collapsed track renders a minimap

- **WHEN** a track has `open: false` and `notes.length === 12`
- **THEN** its `.mr-track__collapsed` SHALL contain exactly one `.mr-track__minimap`
- **AND** the minimap SHALL contain up to 12 `<span>` children (filtered by view window)

#### Scenario: Notes outside the view window do not appear in the minimap

- **WHEN** a track has `open: false` and contains a note with `t = 99` (past the view window)
- **AND** the view window is `viewT0 = 0, totalT = 16`
- **THEN** that note's `<span>` SHALL NOT render in the minimap

### Requirement: Marquee and selection are scoped to a single track via selectedTrackId

The `MultiTrackStage` component (or equivalent stage state) SHALL track a `selectedTrackId: string | null` value. The marquee rectangle and `selectedIdx` (when non-empty) SHALL be passed only to the `PianoRoll` whose track id matches `selectedTrackId`. All other tracks SHALL receive `marquee={null}` and `selectedIdx={[]}`.

When `selectedTrackId === null`, no track receives a non-null marquee.

For the `?demo=marquee` placeholder mode, `selectedTrackId` SHALL default to `"t1"` (the Lead track), matching the prototype's behavior of showing the demo marquee on the first track only.

#### Scenario: Demo marquee shows on Lead only

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the `.mr-track[data-track-open="true"]` whose track id is `"t1"` SHALL contain a `.mr-marquee` element
- **AND** no other track's `.mr-track__roll` SHALL contain a `.mr-marquee` element

#### Scenario: Default load has no marquee on any track

- **WHEN** the app is loaded at `/`
- **THEN** the rendered DOM SHALL contain zero `.mr-marquee` elements across all tracks

### Requirement: Mute and solo composition follow CSS data-attribute selectors

The codebase SHALL ship `src/components/tracks/Track.css` containing — verbatim from `prototype/app.css` lines ~736–812 — the rules:

- `[data-muted="true"] .mr-track__roll { opacity: 0.32; filter: grayscale(0.7); }`
- `[data-soloing="true"] [data-soloed="false"] .mr-track__roll { opacity: 0.45; }`
- `.mr-track`, `.mr-track__hdr` (with `:hover` state), `.mr-track__chev` (with rotation rule), `.mr-track__swatch`, `.mr-track__name`, `.mr-track__sub`, `.mr-track__spacer`, `.mr-track__roll`, `.mr-track__collapsed`, `.mr-track__minimap`.

All visual values SHALL resolve through `--mr-*` tokens; the `rgba()` literals already present in the prototype's same lines are accepted (they're not theme colors).

#### Scenario: Muted track is faded and grayscaled

- **WHEN** a track has `muted: true` AND the page is rendered
- **THEN** the `.mr-track__roll` inside that row SHALL have computed `opacity: 0.32`
- **AND** SHALL have computed `filter` containing `grayscale(0.7)`

#### Scenario: Non-soloed track dims when another track is soloed

- **WHEN** track `t1` has `soloed: true` and track `t2` has `soloed: false`
- **AND** the orchestrator root carries `data-soloing="true"`
- **THEN** the `.mr-track__roll` inside `t2` SHALL have computed `opacity: 0.45`

#### Scenario: Both mute and solo apply when both are set

- **WHEN** a track has `muted: true` AND another track is soloed (so the stage carries `data-soloing="true"` and this row carries `data-soloed="false"`)
- **THEN** the `.mr-track__roll` inside this row SHALL have a computed `opacity` of approximately `min(0.32, 0.45) = 0.32` (mute dominates) — the exact resolution is whichever the cascade picks, but BOTH effects SHALL be visible (the `filter: grayscale(0.7)` from mute SHALL be applied)

#### Scenario: No hex literals or oklch in CSS

- **WHEN** `src/components/tracks/Track.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases

### Requirement: MSChip is a reusable mute/solo toggle pair

The codebase SHALL expose an `MSChip` React component at `src/components/ms-chip/MSChip.tsx` accepting props:

```ts
interface MSChipProps {
  muted: boolean;
  soloed: boolean;
  onMute?: () => void;
  onSolo?: () => void;
  size?: 'sm' | 'md';  // default 'sm'
}
```

The component SHALL render `<div className="mr-ms" data-size={size}>` containing two `<button>` elements:
- `<button className="mr-ms__btn" data-kind="m" data-on={muted ? "true" : undefined} onClick={...}>M</button>`
- `<button className="mr-ms__btn" data-kind="s" data-on={soloed ? "true" : undefined} onClick={...}>S</button>`

Each button's `onClick` handler SHALL call `event.stopPropagation()` BEFORE calling the corresponding callback (so clicks on the chip don't bubble to a container's click handler).

The codebase SHALL ship `src/components/ms-chip/MSChip.css` containing the rules for `.mr-ms`, `.mr-ms__btn`, and the `[data-on="true"][data-kind="m"|"s"]` variants from `prototype/app.css` lines ~706–735.

#### Scenario: MSChip renders M and S buttons

- **WHEN** `<MSChip muted={false} soloed={false}/>` is rendered
- **THEN** the rendered DOM SHALL contain exactly one `.mr-ms` element
- **AND** SHALL contain exactly two `.mr-ms__btn` children
- **AND** their text content SHALL be `M` and `S`

#### Scenario: data-on reflects state

- **WHEN** `<MSChip muted={true} soloed={false}/>` is rendered
- **THEN** the `M` button SHALL carry `data-on="true"`
- **AND** the `S` button SHALL NOT carry `data-on="true"`

#### Scenario: Click stops propagation

- **WHEN** the user clicks the `M` button inside an MSChip nested in a container with its own click handler
- **THEN** the container's click handler SHALL NOT receive the click event
- **AND** the chip's `onMute` callback SHALL be invoked

### Requirement: Stage hosts the MultiTrackStage orchestrator

`AppShell.tsx` SHALL replace the single `<PianoRoll>` mount inside `.mr-stage` with a `<MultiTrackStage>` component. The orchestrator receives the renderer's view-window props (`pxPerBeat`, `rowHeight`, `lo`, `hi`, `totalT`, `playheadT`) and the tracks/marquee/selection state from `useStage()`, and renders the multi-track stack.

The Ruler component above the stage region remains a singleton (one Ruler for the whole stack, not one per track). The Ruler's view-window props match the orchestrator's.

#### Scenario: Stage contains the orchestrator, not a bare PianoRoll

- **WHEN** the app is rendered
- **THEN** the `.mr-stage` element SHALL contain the `MultiTrackStage` orchestrator's root
- **AND** the orchestrator's root SHALL contain three `.mr-track` elements (the seeded default)
- **AND** each open track SHALL contain its own `.mr-roll` element
