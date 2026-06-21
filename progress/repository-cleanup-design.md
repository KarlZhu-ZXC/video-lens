# Repository Cleanup Design

## Goal

Reduce duplicated project-state documentation and remove confirmed dead files without changing the userscript's supported behavior.

## Documentation Structure

- Keep `FEATURES.md` as the single human-readable feature inventory. Merge useful status, dependency, and evidence details from `feature_list.json`, then delete the JSON file.
- Move `progress.md` to `progress/README.md` as the restart point and verification log.
- Move `PROJECT_REVIEW_RECOMMENDATIONS.md` to `progress/PROJECT_REVIEW_RECOMMENDATIONS.md` as the backlog.
- Update `AGENTS.md`, `README.md`, `SPEC.md`, and `init.sh` references to the new paths and remove requirements to parse `feature_list.json`.
- Remove obsolete handoff files that are already deleted in the current worktree.

## Generated Planning Files

- Remove tracked `docs/superpowers/` plans and specs from the repository.
- Ignore `.superpowers/` and `docs/superpowers/` going forward.
- Do not ignore the whole `docs/` directory, so product documentation can still be committed later.

## Code And Asset Cleanup

- Build a reference inventory with `rg`, imports, package usage, and TypeScript compilation.
- Delete only legacy modules, views, assets, and design files that have no runtime, test, build, or documentation consumer and clearly belong to superseded product paths.
- Preserve Bilibili and YouTube provider behavior, the UI harness, research documents, and any asset still referenced by runtime or documentation.

## Verification And Delivery

- Run `pnpm test`, `pnpm build`, JSON validation for remaining JSON files, and `git diff --check`.
- Review the complete branch diff and summarize all commits since the branch diverged from `main` in the pull request.
- Push the current branch, create a ready pull request against the default branch, merge it after checks pass, and verify the remote merge state.
