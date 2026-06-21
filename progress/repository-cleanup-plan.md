# Repository Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate project-state documentation, remove generated planning history and proven dead code/assets, then publish and merge the complete feature branch.

**Architecture:** `FEATURES.md` becomes the single feature inventory, while restart state and backlog live under `progress/`. Runtime cleanup is reference-driven: only modules and assets with no import, build, test, or documentation consumer are removed. The existing harness remains a development browser entry.

**Tech Stack:** TypeScript, Vite, Vitest, pnpm, Tampermonkey, Git, GitHub CLI.

---

### Task 1: Consolidate Project Documentation

**Files:**
- Modify: `FEATURES.md`
- Delete: `feature_list.json`
- Move: `progress.md` to `progress/README.md`
- Move: `PROJECT_REVIEW_RECOMMENDATIONS.md` to `progress/PROJECT_REVIEW_RECOMMENDATIONS.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `init.sh`

- [x] Merge feature status, dependencies, evidence, ASR research, WBI backlog, and ChatGPT bridge completion gate into `FEATURES.md`.
- [x] Move the progress log and backlog into `progress/` without losing current content.
- [x] Delete `feature_list.json` and update all active references to point at `FEATURES.md` or `progress/README.md`.
- [x] Update startup and handoff instructions so new sessions use the consolidated files.

### Task 2: Remove Generated Planning History

**Files:**
- Modify: `.gitignore`
- Delete: `docs/superpowers/`

- [x] Add `/.superpowers/` and `/docs/superpowers/` ignore rules while leaving the rest of `docs/` trackable.
- [x] Delete all tracked generated plans/specs under `docs/superpowers/`.
- [x] Confirm no active documentation requires those historical files.

### Task 3: Delete Proven Dead Runtime And Design Files

**Files:**
- Delete: `src/ai/text/RemoteTextClient.ts`
- Delete: `src/ai/image/GenericImageClient.ts`
- Delete: `src/ai/image/RemoteImageClient.ts`
- Delete: `src/backend/`
- Delete: unused `assets/mascot/` files except `assets/mascot/flat/logo.svg`
- Delete: `design/`

- [x] Re-run reference searches for every candidate.
- [x] Delete modules that have no consumer outside their own legacy group.
- [x] Keep `assets/mascot/flat/logo.svg`, which is imported by `src/ui/panel.ts`, and delete unreferenced mascot variants.
- [x] Delete superseded static design mockups with no build or documentation consumer.

### Task 4: Verify Repository Integrity

**Files:**
- Modify: `progress/README.md`

- [x] Run `rg` checks for deleted paths and stale root-level progress references.
- [x] Run `pnpm test` and require zero failures.
- [x] Run `pnpm build` and require a successful TypeScript/Vite build with userscript version 0.2.11.
- [x] Run `git diff --check` and parse remaining project JSON files.
- [x] Record verification evidence in `progress/README.md`.

### Task 5: Commit And Publish

**Files:**
- Review: complete branch diff from `main...HEAD`

- [ ] Stage the intended complete worktree and verify the staged file list.
- [ ] Commit the implementation and repository cleanup with a summary that covers the full product change.
- [ ] Push `codex/providerless-direct-image` to `origin`.
- [ ] Create a ready pull request against `main` summarizing every branch commit and current verification.
- [ ] Merge the pull request, delete the remote feature branch when supported, and verify the merge commit on `origin/main`.
