## Context

Slice 7b (`dj-action-body`) shipped a DJ action-track body that renders one row per entry in a track's `actionMap`, with synthetic event coverage of all three rendering modes. Slice 8 ships the **edit surfaces** for those bindings — both input (which MIDI note maps to this action) and output (what MIDI fires when the action plays back) — plus the selection plumbing that lights up the rows.

The original sketch was a single floating overlay in the stage (matching the prototype's `MapNoteEditor`). During implementation it became clear that a permanent two-panel layout — input on the left for "recording" semantics, output on the right for "playback" semantics — fits the existing app shell better than a transient overlay, and naturally extends to symmetric I/O routing concerns. The overlay was removed before merge.

## Goals / Non-Goals

**Goals:**

- Clicking a DJ action row sets `djActionSelection` and lights up the row with a persistent accent highlight.
- The Sidebar grows a top-level "Map Note" panel that renders the **input mapping** form (Category chips, Action select, Device select, Trigger select) for the selected row, auto-saving every change.
- The Inspector, when the selection is set, replaces its channel/roll Note panel with the **Output mapping** form (Device, Channel 1–16, Pitch 0–127 + readout). Auto-saves the same way.
- Both panels disappear (and the selection clears) when the user clicks outside the DJ track and the panels.
- Adding `trigger` to `ActionMapEntry` and `outputMap` to `DJActionTrack` is purely additive — `DEFAULT_ACTION_MAP` entries don't need updates, and existing seeded tracks default to `outputMap: {}`.

**Non-Goals:**

- MIDI Learn — out of scope for Slice 8. The form fields are all manual.
- Toast-based undo for Delete — out of scope (backlogged with the broader add/remove affordances slice).
- Output velocity scaling, output filtering, or trigger mode on the output side — the output form is intentionally minimal (device/channel/pitch).
- Marquee/multi-select editing of mappings — the panels bind to a single pitch per selection.

## Decisions

### Decision 1: Two permanent side panels, no overlay

The Sidebar (left) hosts the input mapping form; the Inspector (right) hosts the output mapping form. Both render only when `djActionSelection` is non-null; both disappear when selection clears.

**Alternatives considered:** Floating overlay in the stage (the original sketch). Rejected during implementation — the overlay had outside-click and Esc concerns, competed with the action-row click for focus, and conceptually didn't differentiate input from output. The two-panel split mirrors the existing left=recording/right=inspect convention and makes the input/output symmetry visible at all times.

### Decision 2: Auto-save on every field change, no Done button

Every form interaction (chip click, select change, number input change) commits immediately via the hook actions. There are no Save/Cancel buttons.

**Alternatives considered:** Explicit Done/Cancel with a draft form state. Rejected — the rest of the app's stateful UI (collapse, mute, solo, M/S, toolstrip toggles) is auto-applying; introducing a draft layer here would be inconsistent. With permanent panels and no modal, there's no natural "commit point" anyway.

### Decision 3: Selection model — `djActionSelection`, not `mapEditor`

A single discriminated state `djActionSelection: { trackId, pitch } | null` lives in `useStage`. The action-row click sets it. Both panels read it. Outside-click clears it. There is no separate "editor open" state.

**Alternatives considered:** Keeping both `mapEditor` (for the old overlay) and `djActionSelection` (for the inspector). Rejected — with the overlay gone, the two states collapsed into one. Simpler model, fewer corner cases.

### Decision 4: Outside-click contract via `[data-mr-dj-selection-region]`

A single `useEffect` in `useStageState` registers a window-level `pointerdown` listener while the selection is non-null. The listener clears the selection unless the click target is inside `.mr-djtrack` (any DJ track) or inside an element marked `[data-mr-dj-selection-region="true"]`. Both panels carry that attribute on their outer wrappers.

**Alternatives considered:** Per-panel listeners or React-level focus-within tracking. Rejected — a single composable opt-in attribute keeps the rule explicit and lets future surfaces (Pressure panel in Slice 9?) opt into the same region without changing the listener.

### Decision 5: ActionMapEntry gains an optional `trigger` field

```ts
type TriggerMode = 'momentary' | 'toggle';
interface ActionMapEntry { /* existing fields */ trigger?: TriggerMode }
```

Optional and absent on all `DEFAULT_ACTION_MAP` entries. Readers (`InputMappingPanel`) substitute `'momentary'` when absent; writers (auto-save) persist explicit values.

**Alternatives considered:** Required field — would have touched every `DEFAULT_ACTION_MAP` entry and broken the existing literal-equality test scenarios. The optional form is purely additive.

### Decision 6: New `OutputMapping` type, separate from `ActionMapEntry`

```ts
interface OutputMapping { device: DeviceId; channel: number; pitch: number }
```

Stored as `outputMap: Record<number, OutputMapping>` on each `DJActionTrack`, keyed by the **input** pitch (so the same key drives both maps and a delete cleans up both). Channel is 1..16, pitch is 0..127.

**Alternatives considered:**

- Stuff output fields into `ActionMapEntry` itself. Rejected — input and output are conceptually different: an action *is* the binding (category, label, short, trigger mode); the output mapping is the *playback consequence* (a different device may receive a different note on a different channel). Separating them keeps each shape sharp.
- Make output keyed by `action.id` instead of pitch. Rejected — the renderer and selection model are already pitch-keyed throughout, and a single pitch can only have one bound action at a time, so pitch is the right key.

### Decision 7: Auto-default the output form when no mapping exists

When the selected row has no `outputMap[pitch]` yet, the form renders with sensible defaults derived from the input binding — device = input device, channel = 1, pitch = input pitch — and shows a hint "No output configured. Editing any field below will create the mapping." The first field-change commits the entry via `setOutputMapping`.

**Alternatives considered:** A "Configure output" button that initializes the entry. Rejected — adds a click without adding signal; auto-creating on first edit matches the auto-save model.

### Decision 8: Pure helpers expose the reducer logic for unit testing

The four state mutations (set/delete for each map) are exported as pure helpers `applySetActionEntry`, `applyDeleteActionEntry`, `applySetOutputMapping`, `applyDeleteOutputMapping`. The hook callbacks pass these to `setDJActionTracks`. The helpers preserve referential equality on no-ops so callers can rely on `===` for change detection.

**Alternatives considered:** Inline the logic in `useCallback`s and test via `renderHook`. Rejected — the codebase has no `@testing-library/react` dep; exporting pure functions matches the style of the existing `isDJTrackAudible` / `isDJRowAudible` / `anyDJTrackSoloed` helpers.

## Risks / Trade-offs

- **Risk**: Output form's auto-create-on-first-edit means a stray click on the Channel input creates an entry the user didn't mean to make. → **Mitigation**: the hint copy ("Editing any field below will create the mapping") sets expectations. Delete output button reverses cleanly. A future toast-undo (separate backlog item) would harden this further.
- **Risk**: Outside-click handler depends on `[data-mr-dj-selection-region]` being on every keep-alive surface. A future Slice 9 Pressure panel could break the contract by forgetting the attribute. → **Mitigation**: documented in the spec; lints/grepping for the attribute is straightforward.
- **Risk**: With auto-save, rapid typing in the Channel input could thrash state on every keystroke. → **Mitigation**: `clampInt(1..16)` runs on every change but only triggers a re-render when the resulting integer differs. React's batching merges adjacent keystrokes within a tick.
- **Trade-off**: Permanent panels consume sidebar real estate. The Map Note panel sits above the existing MIDI Inputs / Outputs / Record Filter / Routing sections; it's only visible when a row is selected, so the cost is paid only during editing.
- **Trade-off**: The output form does not surface `trigger`, `pad`, `pressure`, etc. — those live on the input binding. The two surfaces are not symmetric (input is about *binding semantics*; output is about *MIDI emission*). This is intentional but means the user has to switch eyes between sides to see the full picture of a single row.

## Migration Plan

Not applicable for this slice — there is no existing user-facing feature being modified, only added. The new `trigger` field is optional and the new `outputMap` field defaults to `{}`; existing seeded data continues to validate. No archived spec changes need backporting.

## Open Questions

- **Should clicking the same row again toggle the selection off?** Today, clicking the already-selected row is a no-op. Clicking a *different* row retargets. Toggling off via repeated click might be useful; current design relies on outside-click + Esc (Esc is not yet wired since the editor was removed — the row can also be deselected via outside-click). Worth a usability pass.
- **Should Esc clear the selection?** Today, Esc does nothing (the global Esc handler died with the overlay). Adding `useEffect` for Esc → `setDJActionSelection(null)` would parallel the outside-click rule. Punted for now; the outside-click rule is sufficient for visible workflows.
- **Should the Inspector's tab strip respect the DJ selection?** The Note tab body branches on selection. The Pressure / Channel tabs are empty in both branches. When Slice 9 adds Pressure content, the rules will need to specify whether DJ selection takes precedence on the Pressure tab too.
