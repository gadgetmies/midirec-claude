# Design — outbound to Claude Design

This folder is the **outbound** half of the round-trip workflow described in `design_handoff_midi_recorder/README.md` §Sync Workflow:

> **Code → Design (when implementation reveals new components/states):**
> 1. Commit the new component spec (CSS + a one-page README) into the codebase's `design/` folder.
> 2. In the design project, use the **Import** menu → "Import a GitHub repo" and paste the repo URL.
> 3. The design will reconcile against the imported source.

Drop the docs in this folder into the design project's import flow to reconcile design-source state with what shipped in code.

## What's in here

| File | What it covers |
| --- | --- |
| [`deviations-from-prototype.md`](./deviations-from-prototype.md) | Itemized list of every visual/structural choice in the codebase that diverges from `design_handoff_midi_recorder/prototype/`. Each entry has the why, the where (file path), and a recommendation for whether to back-port to the design source. |
| [`session-model.md`](./session-model.md) | A conceptual addition that does not yet exist in the design source: sessions are unbounded, with user-addable loop markers that wrap playback. Cross-references the formal OpenSpec proposal at `openspec/changes/session-model/`. |
| [`loop-markers.md`](./loop-markers.md) | One-page component spec for the new visual element introduced by the session-model concept. Glyph details deferred to design owner's call. |
| [`real-time-correctness.md`](./real-time-correctness.md) | Cross-cutting non-functional constraint: the system is real-time. UI render load must not drop messages, delay playback, or offset recorded timestamps. Applies to every slice; will become a formal capability spec when Slice 10 wires the audio engine. |

## What's NOT in here (and why)

- **Existing components ported verbatim from the prototype** (Titlebar, Toast, AppShell layout, PianoRoll lanes/keys/notes core, Ruler) — the design source already has these. Only deviations are flagged.
- **`tokens.css`** — there is one local override in `src/styles/tokens.css` (the `--mr-note-sel` value); see `deviations-from-prototype.md`. The expectation is that the design source absorbs the override into the next outbound bundle, after which the codebase removes its local-deviation comment.
- **Screenshots** — no screenshot updates yet because Slice 2 is the latest implemented slice and screenshot 04 in the inbound bundle still represents the visual target. When Slice 3+ start to materially drift from the inbound screenshots, add captures here under `design/screenshots/`.

## Conventions

- One Markdown file per topic. Keep each file ≤ a screen or two of reading; link out for depth.
- For any deviation that should be back-ported into the design source, end the section with `**Recommendation:** back-port to prototype/...`.
- For any addition the design owner has not yet seen, end the section with `**Status:** new — needs design owner sign-off`.
- Formal contract / spec changes live in `openspec/specs/` and `openspec/changes/`. This folder paraphrases for the design project; `openspec/` is the source of truth.

## When to update this folder

- After landing a slice (per `design_handoff_midi_recorder/IMPLEMENTATION_PLAN.md`), if the slice produced any visual/structural deviation OR introduced a new component/state not covered by the inbound bundle.
- Before requesting a design source refresh (so the design project has current code-side context to reconcile against).
- Whenever a token in `src/styles/tokens.css` is locally overridden — the override needs to flow back to `design_handoff_midi_recorder/prototype/tokens.css` upstream, with the local deviation comment removed once it does.
