## Why

Clicking anywhere in the side panels (Sidebar, Inspector) or the top bar (Titlebar, Toolstrip) — or the Statusbar — currently clears the DJ action/event selection, because the outside-click handler only exempts `.mr-djtrack` and a small allow-list of regions marked `data-mr-dj-selection-region`. As a result, routine actions like adjusting a toolstrip control, scrolling a sidebar list, or reading the inspector cause the user to lose their selection and have to re-select before continuing. Timeline-row selection (`selectedTimelineTrack`) is already shielded by a `.mr-timeline` scope check, but the rule is implicit and not documented, so it is at risk of regressing.

## What Changes

- Treat the app's non-timeline chrome (`.mr-titlebar`, `.mr-toolstrip`, `.mr-sidebar`, `.mr-inspector`, `.mr-statusbar`) as **selection-preserving regions**: a pointerdown whose target is inside any of those regions SHALL NOT clear DJ action/event selection, timeline-row selection, or interactive roll-note selection.
- Update the `dj-action-tracks` outside-click requirement so the chrome regions are exempt by class, in addition to the existing `[data-mr-dj-selection-region]` opt-in (which is retained for panel-internal opt-outs).
- Document the existing `selectedTimelineTrack` clearing rule in `app-shell` so its `.mr-timeline` scope and chrome-exempt behavior are spec'd, not just implicit.
- Leave intentional clear paths unchanged: clicking inside `.mr-timeline` but outside a track header / roll / DJ track still clears the selection, and `Escape` (where wired) still works.

## Capabilities

### New Capabilities
<!-- None — this change refines existing UI selection rules. -->

### Modified Capabilities
- `dj-action-tracks`: outside-click handler exempts the chrome regions (titlebar, toolstrip, sidebar, inspector, statusbar) by class, in addition to the existing `data-mr-dj-selection-region` opt-in.
- `app-shell`: adds an explicit requirement that chrome regions preserve timeline selections and documents the `.mr-timeline`-scoped clear path for `selectedTimelineTrack`.

## Impact

- Code: `src/hooks/useStage.tsx` — both outside-click `useEffect`s (DJ selections at ~L219–231 and timeline-track at ~L190–209) updated to share a single chrome-exempt predicate.
- Tests: new unit / component tests covering "click on titlebar / toolstrip / sidebar / inspector / statusbar does not clear selection" for each selection kind.
- No data, API, or persistence impact. No new dependencies. No breaking change for existing `data-mr-dj-selection-region` consumers.
