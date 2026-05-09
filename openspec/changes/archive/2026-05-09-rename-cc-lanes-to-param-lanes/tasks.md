## 1. Rename the type and hook surface

- [x] 1.1 In `src/hooks/useChannels.ts`: rename `interface CCLane` → `interface ParamLane`, `type CCLaneKind` → `type ParamLaneKind`. Drop `'vel'` from the `ParamLaneKind` union (becomes `'cc' | 'pb' | 'at'`). Keep `CCPoint` unchanged.
- [x] 1.2 In `src/hooks/useChannels.ts`: update the reducer's `Action` union type so `lane/add` accepts `kind: ParamLaneKind, cc?: number` (which now excludes `'vel'`).
- [x] 1.3 In `src/hooks/useChannels.ts`: rename the `addCCLane` action method on `UseChannelsReturn` to `addParamLane`. Update the `useCallback` binding and dispatch payload accordingly.
- [x] 1.4 In `src/hooks/useChannels.ts`: update internal helpers `flipLaneField`, `laneKey`, `laneKeyOf` signatures to take `ParamLaneKind`. Update `laneCCLabel` to drop the `'vel'` branch (return type narrows to the three remaining cases). Update `laneDefaultName` to drop the `'vel'` branch. Update `laneDefaultColor` to drop the `'vel'` branch. Keep `STANDARD_CCS` and `STANDARD_CC_BY_NUMBER` names unchanged.
- [x] 1.5 In `src/hooks/useChannels.ts`: remove the seeded "Note Velocity" lane from channel 1's `lanes` array. Channel 1 now seeds with two lanes (Mod Wheel + Pitch Bend). The `ccVelocity` import goes too.
- [x] 1.6 In `src/components/cc-lanes/ccPoints.ts` (which moves in step 2.1): delete the `ccVelocity` exported function. Keep `ccModWheel`, `ccPitchBend`, and `CCPoint`.
- [x] 1.7 In `src/hooks/useStage.ts`: update the import to bring in `ParamLane`, `ParamLaneKind`, `addParamLane`. Update the `StageState` interface fields: rename `addCCLane` → `addParamLane` and update toggle signatures' `kind: CCLaneKind` → `kind: ParamLaneKind`. Re-export `addParamLane` from the returned object.

## 2. Move the source folder

- [x] 2.1 Run `git mv src/components/cc-lanes src/components/param-lanes` to rename the folder while preserving git history.
- [x] 2.2 Inside the renamed folder, run `git mv CCLane.tsx ParamLane.tsx`, `git mv CCLane.css ParamLane.css`, `git mv CCMinimap.tsx ParamMinimap.tsx`. Leave `ccPoints.ts` with its current name.
- [x] 2.3 In `src/components/param-lanes/ParamLane.tsx`: rename the function `export function CCLane(...)` → `export function ParamLane(...)`. Rename the props interface `CCLaneProps` → `ParamLaneProps` and the type alias `CCLane as CCLaneType` (imported from `useChannels`) → `ParamLane as ParamLaneType`. Update the import path from `'./CCLane.css'` → `'./ParamLane.css'`. Update the `CCMinimap` import to `'./ParamMinimap'` and use `<ParamMinimap>` in JSX.
- [x] 2.4 In `src/components/param-lanes/ParamMinimap.tsx`: rename the function `export function CCMinimap(...)` → `export function ParamMinimap(...)`. Update the props interface name `CCMinimapProps` → `ParamMinimapProps`. Update the wrapper `className="mr-cc-lane__minimap"` → `className="mr-param-lane__minimap"`.
- [x] 2.5 In `src/components/param-lanes/ParamLane.css`: replace every `.mr-cc-lane*` selector with `.mr-param-lane*` (sed-style global replace; verify by grep that `cc-lane` is gone from the file). Update the file's leading comment to reference `param-lanes`.

## 3. Update the channels capability components

- [x] 3.1 `git mv src/components/channels/AddCCLaneRow.tsx src/components/channels/AddParamLaneRow.tsx`.
- [x] 3.2 `git mv src/components/channels/AddCCLanePopover.tsx src/components/channels/AddParamLanePopover.tsx`.
- [x] 3.3 In `AddParamLaneRow.tsx`: rename `function AddCCLaneRow` → `function AddParamLaneRow`, props interface and type imports. Change the button label text `"+ Add CC"` → `"+ Add Lane"`. Update the wrapper className `"mr-cc-lanes__add"` → `"mr-param-lanes__add"`. Update the button className `"mr-cc-lanes__add-btn"` → `"mr-param-lanes__add-btn"`. Update the popover import to `'./AddParamLanePopover'` and use `<AddParamLanePopover>` in JSX.
- [x] 3.4 In `AddParamLanePopover.tsx`: rename `function AddCCLanePopover` → `function AddParamLanePopover`, props interface, and type imports. Replace every `.mr-cc-lanes__popover*` className with `.mr-param-lanes__popover*` (the popover uses several: `__popover`, `__popover-row`, `__popover-divider`, `__popover-custom`). Remove the "Note Velocity" row from the rendered list — the kinds-section iterator becomes `(['pb', 'at'] as const).map(...)` (drop `'vel'` from the literal). The label/dispatch logic for `'pb'` and `'at'` is unchanged; the `'vel'` branch goes entirely.
- [x] 3.5 In `src/components/channels/ChannelGroup.tsx`: update imports — `Track`, `ParamLane` (from `../param-lanes/ParamLane`), `AddParamLaneRow` (from `./AddParamLaneRow`). Update the type imports from `useChannels` (`ParamLane`, `ParamLaneKind`). Rewire the lane-add prop name `onAddCCLane` → `onAddParamLane`. Replace `<CCLane>` JSX with `<ParamLane>`. Replace `<AddCCLaneRow>` JSX with `<AddParamLaneRow>`.
- [x] 3.6 In `src/components/channels/ChannelGroup.css`: replace every `.mr-cc-lane*` and `.mr-cc-lanes__*` selector with `.mr-param-lane*` / `.mr-param-lanes__*`. The global solo-dim selectors at the top of the file are the highest-impact ones — verify they're correctly updated to `.mr-param-lane[data-audible="false"] .mr-param-lane__plot` and `.mr-param-lane__collapsed`.

## 4. Update AppShell

- [x] 4.1 In `src/components/shell/AppShell.tsx`: update the prop pass-through `addCCLane: stage.addCCLane` → `addParamLane: stage.addParamLane`. Verify the `<ChannelGroup onAddCCLane={...}>` becomes `onAddParamLane={...}`.
- [x] 4.2 In `src/components/shell/AppShell.css`: update the bottom comment from `/* .mr-cc-lane styles live in components/cc-lanes/CCLane.css */` to `/* .mr-param-lane styles live in components/param-lanes/ParamLane.css */`.

## 5. Sweep for stragglers

- [x] 5.1 Grep `src/` for `CCLane`, `CCLaneKind`, `addCCLane`, `CCMinimap`, `AddCCLaneRow`, `AddCCLanePopover`, `cc-lane`, `cc-lanes`, `"+ Add CC"`. Each match SHALL be either:
  - In `STANDARD_CCS` / `laneCCLabel` / `STANDARD_CC_BY_NUMBER` / `ccPoints.ts` / `CCPoint` / `ccModWheel|ccPitchBend` (allowed — these still legitimately reference CC),
  - In a comment that explains the rename (allowed once),
  - or fixed by renaming.
- [x] 5.2a Grep `src/` for `ccVelocity`, `'vel'`, `kind === 'vel'`, `Note Velocity`. Expect zero matches anywhere in `src/`. The `--mr-aftertouch` token stays (used by `kind: 'at'` lanes, no longer the velocity color).
- [x] 5.2 Confirm the popover labels still read `"Mod Wheel (CC 1)"`, `"Volume (CC 7)"`, etc. — those use the literal `"CC N"` for `kind === 'cc'` rows and are correct.
- [x] 5.3 Update `BACKLOG.md`: in the entry "M/S chip jumps 1px to the left at the end of horizontal scroll", replace `.mr-cc-lane__hdr-right` → `.mr-param-lane__hdr-right` so the entry stays accurate.

## 6. Validation

- [x] 6.1 Run `yarn typecheck` — must be clean.
- [x] 6.2 Run `yarn build` — must produce a clean prod bundle.
- [x] 6.3 Run `openspec validate rename-cc-lanes-to-param-lanes --strict` — must report valid.
- [x] 6.4 Manual dev verify (`yarn dev`):
  - The button at the end of each channel reads `"+ Add Lane"`.
  - The popover does NOT contain a "Note Velocity" row.
  - Lead channel seeds with exactly 2 param lanes (Mod Wheel + Pitch Bend). No third "Note Velocity" lane.
  - Click `+ Add Lane` on Bass; popover opens; pick "Mod Wheel (CC 1)"; new lane appears.
  - The new lane's header reads `MOD WHEEL` / `CC 1`. The plot is empty (no bars).
  - DevTools: inspect any lane — it has `class="mr-param-lane"`, body has `.mr-param-lane__body`, plot has `.mr-param-lane__plot`. No `.mr-cc-lane*` class anywhere.
  - All three M/S levels still work (channel/roll/lane). Solo cascade still correct (soloed lane stays bright when its parent channel isn't soloed).
  - Collapsed view minimap + playhead still aligned with the expanded plot above.
  - Hover scrubbing on the plot still shows the readout. Empty (just-added) lane doesn't accept hover (no bars).

## 7. Documentation cleanup

- [x] 7.1 Update `design/deviations-from-prototype.md` entry #10 ("Timeline organized by channel groups"): the file paths and class names mentioned reference `src/components/cc-lanes/`, `<CCLane>`, `.mr-cc-lane*` — update to `src/components/param-lanes/`, `<ParamLane>`, `.mr-param-lane*`.
- [x] 7.2 Update `design/deviations-from-prototype.md` entry #9 ("M/S chips on the right edge of each CC lane row"): the file paths and CSS selectors mention `src/components/cc-lanes/CCLane.tsx` and `.mr-cc-lane__ms`. Either rename references throughout (`src/components/param-lanes/ParamLane.tsx`, `.mr-param-lane__ms`) or add a one-line addendum noting the rename.
