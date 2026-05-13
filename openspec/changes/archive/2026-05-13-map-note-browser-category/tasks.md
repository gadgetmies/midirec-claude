## 1. Data model and defaults

- [x] 1.1 Extend `CategoryId` in `src/data/dj.ts` with `'browser'`; add `browser: { label: 'Browser' }` to `DJ_CATEGORIES` in key order **`deck`, `browser`, `mixer`, `fx`, `global`** (insertion order is the canonical chip order).
- [x] 1.2 Change `DEFAULT_ACTION_MAP` pitches for `load_a` and `load_b` from `cat: 'mixer'` to `cat: 'browser'` (keep **`device: 'mixer'`** and all other fields).
- [x] 1.3 In `normalizeActionMapEntry` (same module), coerce legacy rows: **`id`** is `'load_a'` or `'load_b'` and **`cat`** is `'mixer'` → **`cat: 'browser'`** before the rest of normalization so existing maps self-heal on read/write paths.

## 2. Verification and docs in repo

- [x] 2.1 Update unit tests touched by fixtures: `src/data/dj.test.ts`, `src/hooks/useDJActionTracks.test.ts`, and any test that asserts `load_*` categories or mixer row counts strictly.
- [x] 2.2 Run the full workspace test suite; fix regressions tied to chip counts, demo seeds, or `DEFAULT_ACTION_MAP` snapshot expectations.
- [x] 2.3 After implementation merges, archive this change (`/opsx:archive`-style workflow): fold deltas under `openspec/changes/map-note-browser-category/specs/` into root `openspec/specs/` per project convention.
