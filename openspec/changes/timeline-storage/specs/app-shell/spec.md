## ADDED Requirements

### Requirement: Authoring providers expose a hydrate boundary for timeline-storage

`TransportProvider` (`useTransport`), `StageProvider` (`useStage`), and the in-stage hooks `useChannels` and `useDJActionTracks` SHALL each expose a `hydrate(slice)` action (reducer action or imperative setter, the choice is per-provider) that replaces the relevant slice of authoring state with the values from a deserialised `TimelinePayload`.

Each `hydrate(slice)` SHALL be the ONLY entry point used by `useTimelineStorage` (defined by `timeline-storage`) to rehydrate state from a loaded payload or restore empty defaults on `newTimeline()`. No other consumer SHALL call `hydrate(...)`; all other mutations SHALL continue to flow through the existing per-domain setters (`addNote`, `setDJEventTTicks`, `setBpm`, etc.).

Each provider's `hydrate(slice)` SHALL be a no-op-equivalent to dispatching the slice through the normal reducer in terms of derived state: after `hydrate(slice)` returns, every derived selector (`visibleChannels`, `lo`, `hi`, `sessionHorizonFloorTicks`, `anyDJTrackSoloed`, etc.) SHALL reflect the new slice on the next render.

`TimelineStorageProvider` SHALL be mounted inside `App.tsx`'s provider tree such that it can read from and dispatch into `TransportProvider`, `StageProvider`, `useChannels`, and `useDJActionTracks`. The Provider order SHALL place `TimelineStorageProvider` as a descendant of `StageProvider` (which already depends on `useChannels` and `useDJActionTracks`) and a descendant of `TransportProvider`.

#### Scenario: Each provider exposes hydrate

- **WHEN** the codebase is built
- **THEN** `useChannels()` SHALL return a function or dispatchable action whose effect is to replace the channels / rolls / lanes / MIDI-learn-mapping slice
- **AND** `useDJActionTracks()` SHALL expose the same for the DJ action tracks slice
- **AND** `useTransport()` SHALL expose the same for the transport-authoring subset (`bpm`, `sig`, `quantizeOn`, `quantizeGrid`, `snapAbsoluteOn`, `looping`, `metronomeOn`, `clockSource`)
- **AND** `useStage()` SHALL expose the same for the `loopRegion` slice

#### Scenario: Hydrate is reserved for timeline-storage

- **WHEN** the codebase is searched for callers of any provider's `hydrate(...)`
- **THEN** the only call sites SHALL live inside `src/hooks/useTimelineStorage.tsx` (or its supporting modules under `src/storage/`)
- **AND** no component, other hook, or test outside the storage layer SHALL invoke `hydrate(...)`

#### Scenario: Derived selectors update after hydrate

- **GIVEN** an editor state with three channels and forty notes
- **WHEN** `useChannels()`'s `hydrate(emptySlice)` is dispatched
- **THEN** on the next render `visibleChannels` SHALL be empty
- **AND** `useStage().lo` / `.hi` / `.sessionHorizonFloorTicks` SHALL reflect the empty session
