## ADDED Requirements

### Requirement: DJ value editor mounts as a sticky footer between the timeline and the Statusbar

When the DJ value editor's derived mode (see `dj-value-editor` capability, "Editor mode is derived from selection state") is non-hidden, an element with class `.mr-dj-value-editor` SHALL be mounted as a direct child of `.mr-shell` (or the equivalent app-shell root) positioned **between** the timeline body / center column and the `.mr-statusbar` footer.

The editor SHALL stack ABOVE `.mr-statusbar` (i.e. `.mr-statusbar` remains the absolute bottom of the viewport) and BELOW the center column containing the Toolstrip and Timeline. The editor SHALL span the full width of the viewport (full-width like the Titlebar and Statusbar). The editor's vertical space SHALL NOT be reclaimed from `.mr-timeline`'s growable area when mounted; instead, the editor SHALL reduce the center column's available height by its rendered height (default 96px, user-resizable per the `dj-value-editor` capability).

When the editor's derived mode is `hidden`, the DOM SHALL NOT contain any `.mr-dj-value-editor` element, and the center column SHALL fill the full vertical space between the Titlebar and the Statusbar as before.

#### Scenario: Editor footer absent without a value-bearing selection

- **WHEN** the app is rendered AND no DJ value-bearing selection exists (the editor's derived mode is `hidden`)
- **THEN** the DOM SHALL NOT contain any `.mr-dj-value-editor` element
- **AND** `.mr-statusbar` SHALL be the immediate sibling beneath the center column

#### Scenario: Editor footer present and pinned above Statusbar with a CC selection

- **WHEN** `useStage().djActionSelection` is set on a CC-output row AND `djEventSelection === null`
- **THEN** the DOM SHALL contain exactly one `.mr-dj-value-editor` element
- **AND** that element SHALL be a sibling of `.mr-statusbar` rendered immediately before `.mr-statusbar`
- **AND** `.mr-statusbar` SHALL be the absolute bottom of the viewport (no element below it inside `.mr-shell`)

#### Scenario: Editor footer reduces center column height

- **WHEN** the editor mounts with default height `96px`
- **THEN** the center column's resolved height SHALL be `viewportHeight - titlebarHeight - editorHeight - statusbarHeight` (where the heights resolve through their respective size tokens / persisted editor height)
- **AND** `.mr-timeline` SHALL absorb the new center-column height and SHALL NOT overlap the editor footer
