## Context

`src/hooks/useStage.tsx` owns three pieces of selection state that live in the timeline domain:

1. `selectedTimelineTrack` — which channel/DJ row is "selected" in the timeline (drives header highlight + Inspector contents).
2. `djActionSelection` / `djEventSelection` — which DJ action row / event is active (drives the Action+Output inspector panel and the Sidebar Map Note panel).
3. `interactiveRollSel` — the user-driven roll note selection.

Two `useEffect` hooks attach window-level `pointerdown` listeners to clear these:

- The timeline-track hook (~L190–209) bails when the click target is not inside `.mr-timeline`. Effectively, chrome clicks already don't clear it — but this is implicit, undocumented, and one accidental selector change could regress it.
- The DJ-selection hook (~L219–231) bails only when the click is inside `.mr-djtrack` or `[data-mr-dj-selection-region="true"]`. Every other click — including the entire titlebar, toolstrip, sidebar, inspector, statusbar — clears the selection. This is the user-visible bug.

The two effects evolved separately and embody two different mental models (allow-list inside the timeline vs. opt-in regions everywhere). We want a single, predictable rule.

## Goals / Non-Goals

**Goals:**
- Clicks on the chrome regions (titlebar, toolstrip, sidebar, inspector, statusbar) never clear any timeline-domain selection.
- The intended clear paths still work: clicking inside `.mr-timeline` on empty ruler space, lane gutter, or another non-exempt area clears as before. `Escape` (where wired) is unchanged.
- One shared predicate for "is this click on selection-preserving chrome?" so all three selection clearers stay consistent if regions are added later.
- The behavior is documented in spec (app-shell + dj-action-tracks) so it can be verified and regression-tested.

**Non-Goals:**
- No new selection model, no new selection state, no change to how selections are *made* (still on header / row / note click).
- Not changing the existing `[data-mr-dj-selection-region]` opt-in — panel-internal surfaces that want to preserve DJ selection can still use it.
- Not introducing keyboard shortcuts, focus management, or selection persistence across reloads.
- No visual changes.

## Decisions

### 1. Define chrome-exempt regions by class, not by data attribute

The five chrome regions already have stable class names in `AppShell.tsx`: `.mr-titlebar`, `.mr-toolstrip`, `.mr-sidebar`, `.mr-inspector`, `.mr-statusbar`. Reusing those classes means zero new DOM surface area.

**Alternative considered:** mark each chrome region with `data-mr-selection-preserving="true"`. Rejected because (a) it duplicates information already present in the class taxonomy required by `app-shell`, and (b) it spreads the contract across five separate files instead of one shared predicate.

### 2. Extract a single `isSelectionPreservingChrome(target)` predicate

Add a small helper next to the hooks (or in a sibling util file) that returns `true` when `target.closest()` hits any of the five chrome classes. Both `useEffect`s consult it before deciding to clear.

**Alternative considered:** inline the `target.closest('.mr-titlebar') || target.closest('.mr-toolstrip') || …` check in both effects. Rejected — the two effects would drift over time and the spec scenarios would be harder to keep in sync.

### 3. Keep the two effects separate; do not merge into one

They guard different state with different scopes (one is `.mr-timeline`-internal, the other is global). Merging would force the timeline-track hook to widen its scope or the DJ hook to narrow its scope, both of which change unrelated behavior.

### 4. Spec the rule in two places

- `app-shell` gets a new top-level requirement: "Chrome regions preserve timeline-domain selections." That's where the class taxonomy lives, so it's the natural home.
- `dj-action-tracks` modifies the existing "Outside-click blurs the selection" requirement to add the chrome exemption alongside the existing `data-mr-dj-selection-region` opt-in, with new scenarios for each chrome region.

## Risks / Trade-offs

- **Risk:** A future region added to the body but not to the chrome class list (e.g., a floating overlay) would clear selection unexpectedly → Mitigation: spec scenarios are listed per class, and the predicate is colocated with the hooks so adding a region is a one-line change.
- **Risk:** A child element inside the chrome carries `pointer-events: none` and the click bubbles to an unexpected ancestor → Mitigation: `target.closest()` traverses ancestors, so as long as one ancestor matches a chrome class the exemption holds. The chrome roots all carry their class directly.
- **Trade-off:** The `[data-mr-dj-selection-region]` opt-in becomes partially redundant for panels that live inside `.mr-sidebar` / `.mr-inspector` — but it's kept for backwards compatibility and for cases where a smaller sub-region inside the timeline needs to opt in. No code currently breaks.
- **Risk:** Test coverage today exercises the "click clears" path but not "click on chrome does not clear" → Mitigation: tasks.md adds explicit tests for each chrome region × each selection kind.
