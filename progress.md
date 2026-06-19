# Progress

This file is the restart point for future agent sessions. Keep entries short, factual, and evidence-based.

## 2026-05-19

- Created project harness files: `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, and `init.sh`.
- Harness purpose: preserve project-specific rules, current feature state, verification commands, and session continuity.
- Current known backlog lives in `PROJECT_REVIEW_RECOMMENDATIONS.md`.

## 2026-05-30

- Added cross-platform fullscreen visibility handling for the panel host.
- Bilibili and YouTube browser fullscreen playback now hide the launcher and expanded panel until fullscreen exits.

## Current State

- Project supports Bilibili and YouTube userscript flows.
- YouTube subtitles use page tracks, youtubei fallback, translated tracks, JSON3/XML parsing, and optional official API configuration.
- Bilibili one-image behavior should remain `upName`-first.
- ASR is researched but not implemented.
- Text and image AI each use independent Base URL, API Key, and model settings without a model-provider selector.
- Clicking the launcher performs cache-first summary generation.
- One-image generation directly sends a fixed prompt plus summary to the image model; JSON and DOM card composition are removed.

## Verification Log

- 2026-05-19: `bash -n init.sh` passed.
- 2026-05-19: `node -e "JSON.parse(...feature_list.json...)"` passed.
- 2026-06-19: `pnpm test` passed (81 tests, 1 opt-in integration test skipped); `pnpm build` passed; settings and one-image harness scenarios inspected successfully.

## Open Risks

- Bilibili subtitle endpoint still uses unsigned `x/player/wbi/v2`.
- One-image preview still uses CSS `zoom`.
- GM XHR fallback is non-streaming and has no explicit downgrade notice.
- PNG export errors need better CSP/canvas diagnostic messages.
