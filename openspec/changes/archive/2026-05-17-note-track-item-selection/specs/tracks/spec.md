## MODIFIED Requirements

### Requirement: Open tracks render an embedded PianoRoll; collapsed tracks render a 6px minimap

When a roll has `collapsed === false`, the row's body SHALL render a `<div className="mr-track__roll">` containing a `<PianoRoll>` component instantiated with the roll's notes and the parent channel's color:

- `notes={roll.notes}`
- `trackColor={channel.color}`
- `marquee` and `selectedIdx`: only the roll whose `channelId === selectedChannelId` receives non-empty values; all other rolls receive `marquee={null}` and `selectedIdx={[]}`.
- `pxPerBeat`, `rowHeight`, `lo`, `hi`, `totalT`, `playheadT`: shared across the stack from the orchestrator's view-window props.
- **`onNoteSelect`**, when supplied by orchestration **for interactive sessions**, MUST be threaded into **`PianoRoll`** so activating a `.mr-note` can update **`selectedChannelId`** / **`selectedIdx`** upstream (see **`piano-roll`** capability).

`.mr-track__roll` SHALL NOT carry `overflow: hidden`. Horizontal clipping of the PianoRoll's content beyond the visible timeline area SHALL be performed by the outer `.mr-timeline` scroll container's `overflow-x: auto`.

When a roll has `collapsed === true`, the row's body SHALL render a `<div className="mr-track__collapsed">` containing a `.mr-track__minimap` strip — a 6px-tall horizontal bar with one `<span>` per note (filtered by the view window per session-model). Each minimap span:

- Absolute-positioned at `left: ((n.t - viewT0) / totalT) * 100%`.
- Width `((n.dur / totalT) * 100%)`, with a 1px minimum.
- Top/bottom inset 1px, leaving a 4px-tall colored bar.
- Background: parent channel's `color`.
- Opacity `0.5 + n.vel * 0.4`.
- Border-radius `1px`.

`.mr-track__collapsed` SHALL span the full intrinsic timeline width and SHALL NOT carry its own `overflow: hidden`.

#### Scenario: Open roll renders a PianoRoll without inner overflow clipping

- **WHEN** a roll has `collapsed: false`
- **THEN** its `.mr-track__roll` SHALL contain exactly one `.mr-roll` element (the PianoRoll's root)
- **AND** `.mr-track__roll`'s computed `overflow-x` SHALL NOT be `hidden`

#### Scenario: Collapsed roll renders a minimap

- **WHEN** a roll has `collapsed: true` and `notes.length === 12`
- **THEN** its `.mr-track__collapsed` SHALL contain exactly one `.mr-track__minimap`
- **AND** the minimap SHALL contain up to 12 `<span>` children (filtered by view window)

#### Scenario: Notes outside the view window do not appear in the minimap

- **WHEN** a roll has `collapsed: true` and contains a note with `t = 99` (past the view window)
- **AND** the view window is `viewT0 = 0, totalT = 16`
- **THEN** that note's `<span>` SHALL NOT render in the minimap
