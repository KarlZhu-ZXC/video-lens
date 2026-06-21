# Video Lens Brand And Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product to 片语 / Video Lens, migrate legacy user data, add creator follower statistics, align video-card icons with Bilibili, and restore animated reasoning disclosure controls.

**Architecture:** Extend platform-neutral video metadata with creator followers and let the Bilibili provider enrich that field without making video loading fail. Keep the Shadow DOM CSS namespace stable while replacing all product identity, runtime, storage, and bridge identifiers. Centralize old-key fallback in storage helpers so migration is deterministic and testable.

**Tech Stack:** TypeScript, Vite, Vitest, Tampermonkey GM APIs, native DOM/Shadow DOM, inline SVG.

---

### Task 1: Bilibili Creator Followers

**Files:**
- Modify: `src/sources/VideoSourceProvider.ts`
- Modify: `src/sources/bilibili/types.ts`
- Modify: `src/sources/bilibili/videoInfo.ts`
- Test: `test/core.test.ts`

- [x] Add failing tests for owner `mid`, page-state follower parsing, relation API parsing, and non-fatal follower-request failure.
- [x] Add `creatorId` and `creatorFollowers` to `VideoInfo` and the relevant Bilibili state types.
- [x] Parse page-state followers when available; otherwise request relation statistics by `mid` and enrich the result.
- [x] Run focused Bilibili metadata tests.

### Task 2: 3×3 Metadata And Bilibili Icons

**Files:**
- Modify: `src/ui/summaryView.ts`
- Modify: `src/ui/styles.ts`
- Modify: `src/harness/ui-panel-harness.ts`
- Test: `test/core.test.ts`

- [x] Add failing tests for the order UP 主, 粉丝, 上传时间, 播放, 弹幕, 评论, 点赞, 投币, 收藏 and a three-column desktop grid.
- [x] Add a follower icon and replace stat SVG paths with normalized Bilibili-style paths.
- [x] Render the nine metadata descriptors in the required order and preserve omission of unavailable values.
- [x] Update the harness fixture and inspect desktop/narrow layouts.

### Task 3: Reasoning Chevron And Shimmer

**Files:**
- Modify: `src/ui/aiResponse.ts`
- Modify: `src/ui/styles.ts`
- Test: `test/core.test.ts`

- [x] Add failing tests for an explicit chevron, open-state rotation, streaming-only label class, 4-second animation, and reduced-motion fallback.
- [x] Render a custom chevron inside `<summary>` instead of relying on the native marker.
- [x] Add a 2-second sweep plus 2-second pause keyframe cycle only for streaming `Thinking`.
- [x] Run focused reasoning UI tests.

### Task 4: Legacy Storage Migration

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/configStore.ts`
- Modify: `src/store/makeJsonCache.ts`
- Modify: `src/store/summaryCache.ts`
- Modify: `src/store/imageCache.ts`
- Modify: `src/ai/image/chatgptBridgeProtocol.ts`
- Test: `test/core.test.ts`
- Test: `test/chatgptImageBridge.test.ts`

- [x] Add failing tests proving new keys win, legacy config/cache values migrate when new values are absent, sensitive localStorage behavior remains unchanged, and bridge keys use the new prefix.
- [x] Introduce `video_lens_*` keys with exported legacy constants.
- [x] Add read-through migration for GM storage and localStorage without deleting legacy values.
- [x] Change transient ChatGPT bridge keys and chunks to the new prefix.
- [x] Run storage and bridge tests.

### Task 5: Product And Runtime Rename

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/main.ts`
- Modify: `src/runtime/singleton.ts`
- Modify: `src/utils/logger.ts`
- Modify: `src/ui/i18n.ts`
- Modify: `src/harness/ui-panel-harness.ts`
- Modify: `harness.html`
- Modify: `assets/mascot/flat/logo.svg`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `FEATURES.md`
- Modify: `AGENTS.md`
- Modify: `init.sh`
- Test: `test/buildConfig.test.ts`
- Test: `test/chatgptImageBridge.test.ts`
- Test: `test/core.test.ts`

- [x] Add or update tests for package name, userscript name/file, runtime globals, attributes, and duplicate-script compatibility.
- [x] Rename visible Chinese UI to `片语`, English prose to `Video Lens`, and code identifiers to `video-lens` / `VIDEO_LENS`.
- [x] Preserve compatibility with an already-active legacy runtime singleton while claiming the new singleton.
- [x] Update documentation and generated artifact references to `video-lens.user.js`.

### Task 6: Verification And Delivery

**Files:**
- Modify: `progress/README.md`
- Modify: `progress/video-lens-implementation-plan.md`

- [x] Run strict TypeScript unused checks, `pnpm test`, `pnpm build`, JSON parsing, stale-name scans, and `git diff --check`.
- [x] Record verification evidence and commit all implementation changes.
- [x] Push a ready PR, merge it, and rerun tests/build on merged `main`.
- [x] Rename the GitHub repository to `video-lens`, update local `origin`, and verify the new URL and default branch.
