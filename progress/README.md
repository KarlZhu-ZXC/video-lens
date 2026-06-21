# Progress

This file is the restart point for future agent sessions. Keep entries short, factual, and evidence-based.

## 2026-05-19

- Created project harness files: `AGENTS.md`, the original feature/progress trackers, and `init.sh`.
- Harness purpose: preserve project-specific rules, current feature state, verification commands, and session continuity.
- Current known backlog lives in [`PROJECT_REVIEW_RECOMMENDATIONS.md`](./PROJECT_REVIEW_RECOMMENDATIONS.md).

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
- Unified summary chat handles follow-up questions and explicit image requests. Image generation uses a fixed prompt plus summary; JSON and DOM card composition are removed.
- Text connections support OpenAI-compatible and native Anthropic protocols. Reasoning (DeepSeek `<think>`) is now explicitly parsed and visualized in the UI inside an expandable `<details>` block.

## Verification Log

- 2026-05-19: `bash -n init.sh` passed.
- 2026-05-19: the original feature tracker JSON parsed successfully.
- 2026-06-19: `pnpm test` passed (81 tests, 1 opt-in integration test skipped); `pnpm build` passed; settings and one-image harness scenarios inspected successfully.

## Open Risks

- Bilibili subtitle endpoint still uses unsigned `x/player/wbi/v2`.
- GM XHR fallback is non-streaming and has no explicit downgrade notice.

## 2026-06-20

- Reviewed the unified summary chat refactor and fixed stream-event rendering, duplicate current questions, deterministic image intent, fixed-prompt image caching, Anthropic endpoint/SSE compatibility, failure-state cleanup, conversation scroll preservation, and restored summary/image actions.
- Reasoning (DeepSeek `<think>`) is explicitly parsed and visualized in the UI inside an expandable `<details>` block, deviating from earlier product direction.
- Implemented the ChatGPT web image bridge protocol, client factory, Project-root receiver, one-new-chat-per-job route binding, automatic DOM submission, delayed root reset, generated-image filtering, 512 KiB GM storage chunk transfer, settings mode, heartbeat connectivity check, and userscript permissions.
- Task exceptions now always show the existing top toast. Bilibili videos without public subtitles surface `当前视频没有公开字幕` instead of appearing unresponsive.
- Stabilized summary UI rendering: image-mode fields are mutually exclusive; video/config/subtitle context is fixed above the chat scroll; initial summary streaming patches the existing output; scroll restoration is synchronous and stale-frame guarded; completed-only toolbars are transparent and left aligned; empty summaries expose a visible start-summary action; image errors reach both chat and toast; GM listeners have a polling fallback.
- Fixed ChatGPT Project child-route recognition for real URLs whose stable `g-p-<id>` is followed by a Project slug, preventing a successfully created image chat from being rejected as outside the configured Project.
- Fixed cross-key GM storage propagation races by waiting for all declared image chunks after a success result; summary quick-action buttons are now borderless transparent icons.
- Verification: `pnpm test` passed with 112 tests and one opt-in integration skip; `pnpm build` passed for userscript version 0.2.9.
- Automated coverage reached 94 passing tests before final documentation changes; build passed with ChatGPT metadata included.
- Live Chrome validation generated a 1254x1254 PNG in ChatGPT and confirmed the current `data-turn="assistant"` result container and downloadable same-origin image URL. Full installed-userscript cross-tab return remains the completion gate.
- Fixed the premature Project-root reset race: the ChatGPT receiver now waits for an explicit successful-consumption ACK from the video page before navigating. Failed or unacknowledged transfers remain on the generated chat instead of navigating away and masking the bridge error.
- Refactored `streamParser.ts` to actively throw API errors returned mid-stream, preventing the UI from silently hanging on partial generations.
- Refactored `<think>` block extraction in pipelines to parse from the accumulated `rawContent` instead of individual deltas, preventing split closing tags from causing the actual content to be mistakenly classified as reasoning.
- Enabled `autoRun` by default to automatically fetch subtitle languages and trigger the summary upon entering a video page, and added a user toggle in the settings.
- Verification after the ACK fix: `pnpm test` passed with 115 tests and one opt-in integration skip; `pnpm build` passed for userscript version 0.2.10; the original feature tracker parsed successfully.
- Fixed userscript metadata version drift by sourcing `vite.config.ts` from `package.json`; the previous hardcoded `0.2.9` caused the built header to lag behind package version `0.2.10`. Verification: 116 tests passed, one opt-in integration test skipped, build passed, and the generated header reports `@version 0.2.10`.
- Consolidated summary interactions: subtitle selection now lives in the configuration chip; reasoning streams in an expanded timed disclosure and collapses on completion; Agent avatars were removed; user bubbles match the composer surface; and the latest completed response exposes three fixed follow-up intents.
- Verification after summary interaction consolidation: `pnpm test` passed with 124 tests and one opt-in integration skip; `pnpm build` passed for userscript version 0.2.10; harness screenshots and interactions passed at normal and narrow widths.
- Added bounded concurrency (2) for long-summary chunks and empty-result retry. Chunk bodies no longer render; incomplete overall merges retry once and then fail explicitly. Mapped available Bilibili/YouTube video statistics into a 4×2 Description grid; centered empty/pending states; compacted configuration chips; and removed the visible intent heading while using white control text.
- Verification after concurrency/stats work: `pnpm test` passed with 134 tests and one opt-in integration skip; `pnpm build` passed for userscript version 0.2.10; JSON/diff checks and normal/narrow harness screenshots passed.
- Removed all long-summary chunk previews from the summary DOM. Only a validated overall merge becomes visible; incomplete merges retry once and then fail explicitly. Video metadata now uses a 4×2 Description grid with a two-column narrow fallback, and the subtitle chip target width is 130px.
- Verification after the final-only summary fix: `pnpm test` passed with 136 tests and one opt-in integration skip; `pnpm build` passed for userscript version 0.2.10; JSON/diff checks and Description-grid harness inspection passed.
- Replayed a real MiniMax-M3 SSE response: all 53 `data:` events parsed successfully, including 51 content deltas totaling 1252 characters. Confirmed the reported truncation was not caused by bounded chunk concurrency; the installable `dist` artifact was stale and lacked the current merge-stage streaming accumulator. Rebuilt and bumped the userscript to 0.2.11 so Tampermonkey can recognize the corrected artifact as an update.
- Consolidated feature state into `FEATURES.md`, moved progress and backlog under `progress/`, ignored and removed generated Superpowers planning history, and deleted unreferenced remote/backend clients, duplicate harness files, legacy design mockups, unused mascot variants, and dead local code. Verification: strict TypeScript unused checks passed; `pnpm test` passed with 138 tests and one opt-in integration skip; `pnpm build` produced userscript version 0.2.11; two remaining JSON files parsed; `git diff --check` passed.
- Renamed the product to 片语 / Video Lens (`video-lens`) with legacy config, summary-cache, image-cache, runtime-singleton, and route-wrapper compatibility. Added Bilibili creator follower lookup, a 3×3 metadata grid with Bilibili-derived inline SVG icons, and an explicit reasoning chevron with a streaming-only 2-second sweep plus 2-second pause. Harness verification confirmed nine desktop metadata cells, two-column narrow fallback without overflow, a downward animated `Thinking` state, and a static right-pointing completed state.
- Verification for Video Lens 0.3.0: strict TypeScript unused checks passed; `pnpm test` passed with 149 tests and one opt-in integration skip; `pnpm build` produced `dist/video-lens.user.js` with `@name 片语 · Video Lens`; two JSON files parsed; stale-name scans contained only intentional compatibility constants/tests and the generic English content label; `git diff --check` passed.
- PR #3 merged as `ae59b4a`; merged `main` passed 149 tests and the production build. The GitHub repository was renamed to `video-lens`, and local/remote `main` matched after the rename.
- Restored the subtitle language select for single-option videos, added the dedicated `片语-AI总结` summary header and AI sparkle icon, and compacted the right navigation rail from 72px to 56px with synchronized shell calculations. Release credential scans found no embedded API keys, tokens, JWTs, or private keys; the local MiniMax integration `.env.local` remains ignored and is not referenced by production code. Version 0.3.1 passed 151 tests with one opt-in integration skip, built `dist/video-lens.user.js`, and passed desktop/480px harness layout checks.
- Replaced the follower action icon with a Lucide group icon and the undersized solid Bilibili coin with a Tabler line coin. Version 0.3.2 preserves the existing 15px metadata slot and 3x3 layout; desktop and 480px harness checks showed clear icons without overflow or console warnings.
- Added an Arco-inspired generated-image preview with full-screen zoom, drag, rotation, reset, download, mask/Esc/close controls, plus default metadata cursors and a close lower-right quick-action tooltip. Consolidated fragmented synchronous assertions while preserving independent high-risk async coverage, reducing the suite from 159 to 111 passing tests. Version 0.3.3 keeps the preview inside the userscript Shadow Root without adding a UI framework dependency. Verification: 111 tests passed with one opt-in integration skip; the production build passed; desktop and 480px harness interactions confirmed zoom, rotation, reset, Esc close, toolbar fit, and no console warnings.
