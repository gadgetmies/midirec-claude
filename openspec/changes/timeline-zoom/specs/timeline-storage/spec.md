## ADDED Requirements

### Requirement: Payload round-trips `pxPerBeat` view geometry

`TimelinePayload.session` SHALL carry a numeric field `pxPerBeat` representing the user's chosen horizontal zoom at save time. `serializeTimeline(state, name)` SHALL read this value from `useStage().pxPerBeat`. `deserializeTimeline(payload)` SHALL surface it on the `view` slice produced for hydration.

Hydration semantics SHALL be:

- If `payload.session.pxPerBeat` is **absent** (e.g. a payload written before this change), the hydrated view slice SHALL fall back to `DEFAULT_PX_PER_BEAT`. No console warning SHALL be emitted (the field is optional on read).
- If the value is **non-finite** (`NaN`, `Infinity`, `-Infinity`), the hydrated view slice SHALL fall back to `DEFAULT_PX_PER_BEAT` and a single console warning SHALL identify the field as corrupted.
- If the value is **out of range** for `clampPxPerBeat`, the hydrated value SHALL be the clamped result.
- Otherwise the value SHALL be hydrated verbatim.

`STORAGE_SCHEMA_VERSION` SHALL NOT be bumped by the addition of this field, because absence is a well-defined no-op for older payloads.

#### Scenario: Round-trip preserves pxPerBeat

- **GIVEN** a session where `useStage().pxPerBeat === 250`
- **WHEN** `serializeTimeline(state, "demo")` is called, then the payload is passed through `deserializeTimeline` and its `view` slice is dispatched to `useStage().hydrate(...)`
- **THEN** `useStage().pxPerBeat` SHALL equal `250` on the next render

#### Scenario: Legacy payload without pxPerBeat hydrates to default silently

- **GIVEN** a `TimelinePayload` whose `session` object omits `pxPerBeat` (older save)
- **WHEN** the payload is hydrated
- **THEN** `useStage().pxPerBeat` SHALL equal `DEFAULT_PX_PER_BEAT`
- **AND** no console warning SHALL be emitted

#### Scenario: Corrupted pxPerBeat hydrates to default with warning

- **GIVEN** a `TimelinePayload` whose `session.pxPerBeat` is `NaN` (or any non-finite number)
- **WHEN** the payload is hydrated
- **THEN** `useStage().pxPerBeat` SHALL equal `DEFAULT_PX_PER_BEAT`
- **AND** exactly one console warning SHALL identify the `pxPerBeat` field

#### Scenario: Out-of-range pxPerBeat clamps on hydrate

- **GIVEN** a `TimelinePayload` whose `session.pxPerBeat` is `5000`
- **WHEN** the payload is hydrated
- **THEN** `useStage().pxPerBeat` SHALL equal `MAX_PX_PER_BEAT` (`2000`)

#### Scenario: STORAGE_SCHEMA_VERSION is unchanged

- **WHEN** the codebase is grepped for `STORAGE_SCHEMA_VERSION`
- **THEN** its exported value SHALL remain `1` after this change
- **AND** a payload with `version: 1` and no `pxPerBeat` field SHALL load successfully

### Requirement: JSONL codec carries pxPerBeat on a `view` line

The JSONL codec (`src/storage/timelineJsonl.ts`) SHALL accept and produce a dedicated line kind for view geometry, discriminated by `kind: "view"`, with shape `{ kind: "view", pxPerBeat: number }`. The codec SHALL emit exactly one `view` line per serialisation, after the `meta` line and before any `channel`/`roll`/`lane`/`dj.track` lines.

`parseTimelineJsonl` SHALL accept the line if present and surface it as part of the parsed slice set. If the line is absent (e.g. an older JSONL save), parsing SHALL succeed and the parsed view slice SHALL be omitted; the hydration step SHALL fall back to `DEFAULT_PX_PER_BEAT` per the payload absence rule above.

A malformed `view` line (non-finite `pxPerBeat`, missing field, wrong type) SHALL raise `PayloadShapeError` with a message that identifies the line and field, consistent with existing codec error behavior.

#### Scenario: View line is emitted and parsed

- **WHEN** a session with `pxPerBeat = 176` is serialised to JSONL and parsed back
- **THEN** the JSONL text SHALL contain exactly one line whose parsed `kind` is `"view"` and whose `pxPerBeat` is `176`
- **AND** `parseTimelineJsonl` SHALL produce a view slice with `pxPerBeat: 176`

#### Scenario: Missing view line parses with default

- **GIVEN** a JSONL string with no `view` line (older save)
- **WHEN** `parseTimelineJsonl(text)` is called
- **THEN** it SHALL succeed
- **AND** the resulting view slice SHALL be `undefined` or empty (hydrate falls back to default)

#### Scenario: Malformed view line is rejected

- **GIVEN** a JSONL string whose `view` line is `{"kind":"view","pxPerBeat":"oops"}`
- **WHEN** `parseTimelineJsonl(text)` is called
- **THEN** it SHALL throw a `PayloadShapeError`
- **AND** the error message SHALL identify the `view` line and the `pxPerBeat` field
