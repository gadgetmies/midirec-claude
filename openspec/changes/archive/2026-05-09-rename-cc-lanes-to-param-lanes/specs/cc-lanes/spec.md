## REMOVED Requirements

### Requirement: CCLane renders a 56px header strip with right-aligned M/S chips

**Reason**: The `cc-lanes` capability is renamed to `param-lanes`. Two of the three remaining `kind` values it carries (`'pb'`, `'at'`) aren't Control Change messages in MIDI, so the "CC" name is misleading. (The previous fourth kind `'vel'` is also dropped — see the channels capability delta for details.) The full set of rendering responsibilities moves to `param-lanes` with `ParamLane` / `<ParamLane>` / `.mr-param-lane*` identifiers.

**Migration**: Use `<ParamLane>` from the `param-lanes` capability. The component shape (props, data-attrs, layout) is unchanged — only the names rename, and `kind: 'vel'` is no longer accepted.

### Requirement: CCLane renders a 64-cell discrete-bar SVG plot

**Reason**: Moves to `param-lanes` capability under the same shape, with one substantive update: empty `points` arrays now render zero `<g>` elements (no bars/caps) instead of 64 zero-height bars + caps along the bottom. This matches the user-visible behavior introduced in `channel-grouped-timeline` for freshly-added empty lanes.

**Migration**: Use the equivalent requirement under `param-lanes`. The 64-cell behavior for non-empty `points` is preserved.

### Requirement: CCLane shows a hover scrubbing readout

**Reason**: Moves to `param-lanes` under the same shape, with `<div className="mr-cc-lane__readout">` renamed to `<div className="mr-param-lane__readout">`. Hover is also gated on `lane.points.length > 0` and `!lane.collapsed`.

**Migration**: Use the equivalent requirement under `param-lanes`.

### Requirement: CCLane mute and solo composition matches data-attribute rules

**Reason**: Moves to `param-lanes`. The selector classes rename `.mr-cc-lane__plot` / `.mr-cc-lane__collapsed` → `.mr-param-lane__plot` / `.mr-param-lane__collapsed`. The mute selector also adds `.mr-param-lane__collapsed` so muted lanes dim in the collapsed-minimap view too.

**Migration**: Use the equivalent requirement under `param-lanes`.

### Requirement: CCLane forward-compat props for paint and interp are inert

**Reason**: Moves to `param-lanes` under the same shape. The future-slice `.mr-cc-cursor` class name renames to `.mr-param-cursor` for consistency with the rest of the rename.

**Migration**: Use the equivalent requirement under `param-lanes`.
