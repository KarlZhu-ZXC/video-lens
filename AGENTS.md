# AGENTS.md

`video-summary` is a Tampermonkey userscript for Bilibili and YouTube video summaries, insights, and one-image exports.

## Startup Workflow

Before writing code:

1. Read this file.
2. Read `README.md` for usage and project scope.
3. Read `SPEC.md` for architecture, data flow, and UI behavior.
4. Read `PROJECT_REVIEW_RECOMMENDATIONS.md` for completed work and current backlog.
5. Run `./init.sh` when the task can affect build, tests, or runtime behavior.
6. Check `feature_list.json` and `progress.md` before choosing implementation order.

## Working Rules

- Work one feature or bugfix at a time.
- Preserve Bilibili behavior unless the task explicitly changes it.
- Treat YouTube changes as provider-specific when possible.
- Do not revert user changes or unrelated dirty worktree files.
- Use `rg` / `rg --files` for search.
- Use `apply_patch` for manual file edits.
- Update relevant docs when behavior changes: `README.md`, `SPEC.md`, `FEATURES.md`, or `PROJECT_REVIEW_RECOMMENDATIONS.md`.
- For UI/layout changes, verify with the harness when practical: `pnpm dev:harness` and `harness.html`.

## Key Project Context

- Runtime: Tampermonkey userscript.
- Build: Vite + TypeScript + `vite-plugin-monkey`.
- UI: native DOM + Shadow DOM.
- Package manager: pnpm.
- Supported pages: Bilibili video/list pages and YouTube `watch` / `shorts`.
- YouTube subtitles: page `captionTracks`, youtubei fallback, JSON3/XML parsing, translated tracks.
- Bilibili compatibility: one-image JSON/footer use `upName` as the main source field.

## Verification

Use the smallest command that proves the change, then run broader checks before finalizing.

Required before claiming code completion:

```bash
pnpm test
pnpm build
```

Useful targeted checks:

```bash
pnpm test -- test/core.test.ts --runInBand
pnpm dev:harness
```

For documentation-only changes, at minimum inspect the rendered/changed Markdown and run syntax checks for any changed scripts.

## Definition of Done

A change is done when:

- Implementation matches the requested scope.
- Bilibili and YouTube behavior boundaries are respected.
- Tests/build or an explicit verification alternative has passed.
- Relevant documentation is updated.
- `progress.md` and `feature_list.json` reflect the new state when the work changes project direction or backlog status.
- The final response states what changed and what was verified.

## Session Handoff

Before ending a long or stateful session:

1. Update `progress.md` with completed work, verification evidence, and open risks.
2. Update `feature_list.json` if feature status changed.
3. If work is incomplete, write a short handoff using `session-handoff.md`.
4. Leave the repository restartable for the next agent.
