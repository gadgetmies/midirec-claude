## 1. Project bootstrap

- [x] 1.1 Create root `package.json` with name `midirec`, private, type `module`, scripts `dev`, `build`, `preview`, `typecheck`.
- [x] 1.2 Add dev dependencies: `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `typescript`, `@fontsource/inter`, `@fontsource/jetbrains-mono`.
- [x] 1.3 Add `tsconfig.json` (strict, jsx `react-jsx`, module `ESNext`, target `ES2022`, moduleResolution `bundler`).
- [x] 1.4 Add `vite.config.ts` with the React plugin.
- [x] 1.5 Add `index.html` at repo root with `<div id="root">` and `<script type="module" src="/src/main.tsx">`.
- [x] 1.6 Add `.gitignore` covering `node_modules/`, `dist/`, `.DS_Store`, `*.log`.
- [x] 1.7 Run `npm install` and confirm clean install.

## 2. Tokens and fonts

- [x] 2.1 Copy `design_handoff_midi_recorder/prototype/tokens.css` to `src/styles/tokens.css` byte-identically.
- [x] 2.2 Prepend a single header comment to the codebase copy: `/* Synced from design_handoff_midi_recorder/prototype/tokens.css — DO NOT EDIT here. */`.
- [x] 2.3 Verify `diff` of the two files (excluding the header) returns no output.
- [x] 2.4 In `src/main.tsx`, import `@fontsource/inter` (weights 400/500/600/700) and `@fontsource/jetbrains-mono` (weights 400/500/600).
- [x] 2.5 Import `./styles/tokens.css` from `src/main.tsx` before any component CSS.

## 3. Global styles

- [x] 3.1 Create `src/styles/global.css`: reset (margin/padding 0 on body), `html, body, #root { height: 100%; background: var(--mr-bg-app); color: var(--mr-text-1); font-family: var(--mr-font-ui); font-size: var(--mr-fs-12); }`.
- [x] 3.2 Define utility class `.mr-mono { font-family: var(--mr-font-mono); font-variant-numeric: tabular-nums; }` in `global.css`.
- [x] 3.3 Import `./styles/global.css` from `main.tsx` after `tokens.css`.

## 4. App shell skeleton

- [x] 4.1 Create `src/App.tsx` rendering `<div className="mr-app" data-mr-theme="console">` containing the six regions.
- [x] 4.2 Create `src/components/shell/AppShell.tsx` (or render directly in `App.tsx`) with the structure: `.mr-app` → `.mr-titlebar`, `.mr-body` (`.mr-sidebar`, `.mr-center` (`.mr-toolstrip`, `.mr-ruler`, `.mr-stage`, `.mr-cc-lanes` containing 3× `.mr-cc-slot`), `.mr-inspector`), `.mr-statusbar`.
- [x] 4.3 Add a faint placeholder label inside each region (`<span className="mr-stub">Titlebar</span>` etc.) for dev visibility — colored `var(--mr-text-3)`.
- [x] 4.4 Create `src/components/shell/AppShell.css` with the grid layout per design.md §D4: outer grid `var(--mr-h-toolbar) 1fr auto`, body grid `var(--mr-w-sidebar) 1fr var(--mr-w-inspector)`, center column flex with toolstrip / ruler / stage / cc-lanes heights from tokens.
- [x] 4.5 Apply panel surface backgrounds (`var(--mr-bg-panel)` for titlebar/sidebar/inspector/statusbar; `var(--mr-bg-panel-2)` for toolstrip; `var(--mr-bg-timeline)` for stage; `var(--mr-bg-app)` outer) and `1px solid var(--mr-line-2)` dividers between regions.
- [x] 4.6 Style `.mr-cc-slot` with `height: var(--mr-h-cc-lane)` and a hairline top border so the three slots are visible.
- [x] 4.7 Style `.mr-stub` as `font-family: var(--mr-font-mono); font-size: var(--mr-fs-10); color: var(--mr-text-3); padding: var(--mr-sp-3); text-transform: uppercase; letter-spacing: var(--mr-tracking-cap);`.

## 5. Entry wiring

- [x] 5.1 In `src/main.tsx`, render `<App />` into `#root` via `createRoot`.
- [x] 5.2 Import order in `main.tsx`: fontsource imports → `./styles/tokens.css` → `./styles/global.css` → React render.

## 6. Verification

- [x] 6.1 `npm run dev` boots Vite without errors and serves the app.
- [x] 6.2 Open the dev URL, confirm the six regions are visible at the geometry defined by the size tokens.
- [x] 6.3 In DevTools, inspect the root element and confirm `data-mr-theme="console"` is present.
- [x] 6.4 In DevTools, confirm computed style of `.mr-titlebar` height equals the computed value of `--mr-h-toolbar`, sidebar width equals `--mr-w-sidebar`, inspector width equals `--mr-w-inspector`.
- [x] 6.5 Confirm `font-variant-numeric` on `.mr-mono` (or the timecode placeholder, if present) resolves to `tabular-nums`.
- [x] 6.6 Visual compare against `design_handoff_midi_recorder/screenshots/` screenshot 01 for layout / surfaces / divider weights. Report in the apply summary whether parity is achieved or what differs.
- [x] 6.7 `npm run typecheck` passes (or `tsc --noEmit` if no script alias).
- [x] 6.8 Grep `src/` for hex literals and `oklch(` calls outside `tokens.css` — none expected.
