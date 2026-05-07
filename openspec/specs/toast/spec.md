### Requirement: Toast viewport renders at the bottom-center of the app shell

The app SHALL render a single `.mr-toast-viewport` element absolutely positioned within the `.mr-shell`. The viewport itself SHALL have `pointer-events: none` so the underlying app remains interactive when no toast is present. When a toast is shown, the toast element (`.mr-toast`) SHALL be a child of the viewport and SHALL position itself 16px above the bottom edge, horizontally centered, with `pointer-events: auto`.

#### Scenario: Viewport mounted

- **WHEN** the app is rendered
- **THEN** `.mr-shell` SHALL contain a child `.mr-toast-viewport`
- **AND** the viewport's `pointer-events` SHALL be `none`

#### Scenario: Toast positioning

- **WHEN** a toast is visible
- **THEN** `.mr-toast` SHALL have `position: absolute`
- **AND** its `bottom` SHALL be 16px
- **AND** it SHALL be horizontally centered via `left: 50%; transform: translateX(-50%)`
- **AND** its `pointer-events` SHALL be `auto`

### Requirement: useToast hook provides show and dismiss

The codebase SHALL expose a `useToast()` hook returning `{ show(message, opts?), dismiss() }`. The `opts` object SHALL accept `kind?: 'info' | 'ok' | 'warn'` (default `'ok'`) and `durationMs?: number` (default `2000`; pass `0` for sticky). Calling `show` while another toast is visible SHALL replace it (no queuing).

#### Scenario: Show then auto-dismiss

- **WHEN** `show('Hello')` is called
- **THEN** within one render frame a `.mr-toast` element SHALL be present in the DOM
- **AND** approximately 2000ms later the toast SHALL be unmounted

#### Scenario: Replace on second show

- **WHEN** `show('First')` is called and `show('Second')` is called within 100ms
- **THEN** at most one `.mr-toast` SHALL be present in the DOM at any time
- **AND** its rendered text SHALL be `Second`

#### Scenario: Sticky toast

- **WHEN** `show('Persistent', { durationMs: 0 })` is called
- **THEN** the toast SHALL remain mounted until `dismiss()` is called

### Requirement: Toast renders dot, message, and optional shortcut hint

A visible toast SHALL render a `.mr-toast__dot` (8px circle, `var(--mr-ok)` for `kind: 'ok'`, with a 6px glow) followed by the message text in `var(--mr-fs-11)`. A toast MAY include a trailing shortcut hint chip (e.g. `⌘Z`) rendered in mono with reduced opacity.

#### Scenario: Default OK toast structure

- **WHEN** `show('Recording saved · 1.4 MB · 1,238 events')` is called
- **THEN** the rendered `.mr-toast` SHALL contain, in order, an element with class `mr-toast__dot`, then the message text
- **AND** the dot's computed `background-color` SHALL match `var(--mr-ok)`

#### Scenario: Toast with shortcut hint

- **WHEN** `show('Recording saved …', { shortcut: '⌘Z' })` is called
- **THEN** the `.mr-toast` SHALL contain a trailing element rendering `⌘Z` in `var(--mr-font-mono)`

### Requirement: Transport actions emit appropriate toasts

When `useTransport().play()` is called, a toast `Started · 124 BPM` (substituting the current BPM) SHALL be shown. When the transport is in `record` mode and `stop()` is called, a toast `Recording saved · <size> · <events>` SHALL be shown with a placeholder size and event count synthesized from the transport's elapsed time, and with the `⌘Z` shortcut hint.

#### Scenario: Play emits started toast

- **WHEN** the transport is idle and `play()` is called with `bpm === 124`
- **THEN** within one render frame a toast SHALL be visible with text `Started · 124 BPM`

#### Scenario: Stop after record emits saved toast

- **WHEN** the transport is recording with `timecodeMs === 12345` and `stop()` is called
- **THEN** within one render frame a toast SHALL be visible whose text begins with `Recording saved`
- **AND** the toast SHALL include the `⌘Z` shortcut hint
