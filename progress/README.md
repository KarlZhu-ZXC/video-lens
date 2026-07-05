# Progress

This file is the restart point for future agent sessions. Keep it short, current, and evidence-based.

## Current State

- Project supports Bilibili video/list pages and YouTube `watch` / `shorts` userscript flows.
- YouTube subtitle loading uses page caption tracks, youtubei/watch fallback, translated tracks, JSON3/SRV3/VTT/XML parsing, unsigned timedtext fallback, captured player timedtext responses, and current-page Transcript panel fallback.
- Bilibili one-image JSON/footer compatibility should remain `upName`-first.
- Text and image AI each use independent Base URL, API Key, and model settings without a provider selector.
- Clicking the launcher performs cache-first summary generation; automatic summary can be controlled in settings.
- Unified summary chat handles follow-up questions and explicit image requests. Image generation uses the selected global image style prompt and image ratio in cache identity.
- ChatGPT Web image generation is experimental. Protocol, chunk transfer, ACK handling, and DOM submission are covered by tests; full installed-userscript cross-tab verification remains the completion gate.
- ASR is researched but not implemented. Research lives in [`docs/research/asr-integration.md`](../docs/research/asr-integration.md).

## Open Risks

- Bilibili subtitle endpoint still uses unsigned `x/player/wbi/v2`.
- GM XHR fallback is non-streaming and has no explicit downgrade notice.
- ChatGPT Web mode depends on ChatGPT DOM stability and logged-in browser state.

## Recent Verification

- 2026-06-19: `pnpm test` passed (81 tests, 1 opt-in integration test skipped); `pnpm build` passed; settings and one-image harness scenarios inspected successfully.
- 2026-06-20: ChatGPT bridge, streaming parser, reasoning extraction, summary UI, bounded long-summary concurrency, and Video Lens 0.3.0 work passed repeated `pnpm test`, `pnpm build`, harness, JSON/diff, and credential-scan checks.
- 2026-06-21: Summary presets, reduced-motion panel transition, settings listboxes, product rename follow-ups, and generated-image preview passed targeted harness checks plus `pnpm test` and `pnpm build`.
- 2026-07-03: ChatGPT web image submission confirmation accepts Project child-route navigation, and image job timeout increased to 10 minutes.
- 2026-07-04: Image style presets, IME-safe Enter handling, image ratio selection, ratio-aware image cache keys, and YouTube caption fallback ordering were implemented and verified.
- 2026-07-05: YouTube subtitle loading now also tries JSON3, SRV3, VTT, unsigned timedtext URLs, and finally the current page's Transcript panel DOM when caption downloads return empty content; clearing the current video cache now removes all summary variants for that video and resets transcript/runtime summary state.
- 2026-07-05: Settings labels now use Text Configuration, Image Configuration, Summary Style Preset, and Model Connectivity Test; the summary style preset control moved from General into Text Configuration.
- 2026-07-05: Summary style and image style controls now appear first in their settings sections; legacy square image size `1024x1024` now migrates to the 16:9 default; YouTube transcript fallback recognizes Chinese transcript controls. Chapter outlines are no longer accepted as transcript fallback because they do not provide enough content for a useful summary.
- 2026-07-05: Settings and summary tabs now share the same outer Shell width; tab switching only replaces panel content and no longer applies a summary-specific width offset. Verification used `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/vite build` because `./init.sh` hit pnpm's ignored-builds guard for esbuild.
- 2026-07-05: Removed YouTube chapter-outline transcript fallback after testing `8rxbO0ogtk0`: the page exposes caption track metadata but timedtext returns empty content and the player reports subtitles unavailable, so chapter titles produced misleading summaries. Verification: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/vite build` passed; built userscript version is 0.3.15.
- 2026-07-05: Added a YouTube page-context timedtext capture fallback based on GreasyFork/GitHub subtitle downloader practice: if direct caption downloads return empty, the summary flow can reuse the current player page's successful `/api/timedtext` response before falling back to the Transcript panel. Verification: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/vite build` passed; built userscript version is 0.3.16.
- 2026-07-05: Documentation was reorganized so durable specs live under `docs/`, `progress/` contains only this restart file, and obsolete one-off implementation/design plans were removed. Verification: Markdown link scan and `bash -n init.sh`.
