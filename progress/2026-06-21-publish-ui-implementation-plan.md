# Video Lens Publish UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore persistent subtitle selection, compact the navigation rail, introduce the requested title and AI icon, and prove the published userscript contains no real credentials.

**Architecture:** Keep the existing native DOM and Shadow DOM structure. Add one testable subtitle-select predicate, one summary header translation, and CSS sizing variables so the rail and shell calculations stay synchronized; retain runtime-only secret storage and validate the final bundle with pattern scans.

**Tech Stack:** TypeScript, native DOM, Shadow DOM CSS, Vitest, Vite, vite-plugin-monkey.

---

### Task 1: Persistent subtitle dropdown

**Files:**
- Modify: `src/ui/summaryView.ts`
- Test: `test/core.test.ts`

- [x] Add a failing unit test proving a single available subtitle option requires a select control while zero options do not.
- [x] Run `pnpm test -- test/core.test.ts` and confirm the new assertion fails.
- [x] Export and use `shouldRenderSubtitleSelect(optionCount: number): boolean`, returning `optionCount > 0`.
- [x] Run `pnpm test -- test/core.test.ts` and confirm it passes.

### Task 2: Summary title and AI navigation icon

**Files:**
- Modify: `src/ui/i18n.ts`
- Modify: `src/ui/panel.ts`
- Test: `test/core.test.ts`

- [x] Add failing assertions for Chinese `summary.pageTitle` equal to `片语-AI总结`, English `summary.pageTitle` equal to `Video Lens - AI Summary`, and a sparkle-based summary icon path set.
- [x] Run the targeted test and confirm failure.
- [x] Add the translations, use `summary.pageTitle` only for the summary header, and replace the document paths with a compact AI sparkle path set.
- [x] Run the targeted test and confirm it passes.

### Task 3: Compact navigation rail

**Files:**
- Modify: `src/ui/styles.ts`
- Test: `test/core.test.ts`

- [x] Add a failing stylesheet assertion for `--vs-rail-width: 56px`, 40px navigation buttons, and 20px icons.
- [x] Run the targeted test and confirm failure.
- [x] Define `--vs-rail-width`, replace hard-coded 72px shell/panel calculations, and size the rail, mascot, buttons, divider, padding, and icons proportionally.
- [x] Run the targeted test and confirm it passes.

### Task 4: Publishing security audit and documentation

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `FEATURES.md`
- Modify: `progress/README.md`

- [x] Scan tracked source and configuration files for private keys, JWTs, provider key prefixes, authorization literals, and assigned secret values; distinguish test placeholders from usable credentials.
- [x] Document that release bundles contain no embedded credentials and runtime secrets remain in Tampermonkey storage.
- [x] Run `pnpm test` and expect all tests to pass with the opt-in MiniMax integration test skipped.
- [x] Run `pnpm build` and expect `dist/video-lens.user.js` to build successfully.
- [x] Scan the final userscript for real credential signatures and confirm no matches.
- [x] Run `git diff --check`.
- [x] Inspect the summary harness at desktop and narrow widths, confirming the subtitle arrow remains visible and the compact rail does not overlap content.
