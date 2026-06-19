# Providerless Direct Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove model-provider configuration, generate one-image output directly from the image model, and start cached-or-new summarization when the launcher is clicked.

**Architecture:** Keep the existing OpenAI-compatible text and image clients, but normalize both from user-entered endpoint/key/model triplets. Replace structured one-page data and DOM composition with a focused direct-image pipeline whose only transformation is fixed-template prompt interpolation. Let `AppController` own cache-aware launcher behavior and expose a generated image to a simplified preview.

**Tech Stack:** TypeScript, native DOM/Shadow DOM, Vitest, Vite, Tampermonkey APIs

---

## File Map

- `src/store/types.ts`, `src/store/configStore.ts`: simplified persisted configuration and legacy normalization.
- `src/ai/text/providers.ts`: replace provider registry with generic key and Base URL normalization helpers.
- `src/ui/settingsModal.ts`, `src/ui/i18n.ts`: two independent endpoint/key/model settings groups.
- `src/onePage/onePagePipeline.ts`, `src/onePage/types.ts`: fixed prompt interpolation, direct image request, image caching.
- `src/ui/oneImageView.ts`, `src/app/AppState.ts`, `src/app/AppController.ts`: image preview/download and launcher-triggered summary.
- `src/ui/panel.ts`: launcher click orchestration.
- `test/core.test.ts`: regression coverage.
- `README.md`, `SPEC.md`, `FEATURES.md`, `PROJECT_REVIEW_RECOMMENDATIONS.md`, `feature_list.json`, `progress.md`: behavior documentation and project state.

### Task 1: Simplify AI Configuration

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/configStore.ts`
- Modify: `src/ai/text/providers.ts`
- Modify: `src/ai/text/DirectOpenAITextClient.ts`
- Modify: `src/ui/settingsModal.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing provider-free configuration tests**

Replace provider-default assertions with tests equivalent to:

```ts
expect(applyTextConfig(DEFAULT_CONFIG.textAi, {
  baseUrl: 'https://llm.example/v1/chat/completions',
  apiKey: 'Bearer key',
  model: 'custom-model',
})).toMatchObject({ apiUrl: 'https://llm.example/v1', apiKey: 'key', model: 'custom-model' });
expect(loadConfig().textAi).not.toHaveProperty('provider');
expect(loadConfig().textAi).not.toHaveProperty('modelList');
```

- [ ] **Step 2: Run targeted tests and confirm failure**

Run: `pnpm test -- test/core.test.ts --runInBand`
Expected: FAIL because `applyTextConfig` and the simplified shape do not exist.

- [ ] **Step 3: Implement generic normalization and legacy migration**

Use a provider-free helper:

```ts
export function applyTextConfig(current: LocalConfig['textAi'], input: ModelConnectionInput): LocalConfig['textAi'] {
  return {
    ...current,
    apiUrl: normalizeOpenAIBaseUrl(input.baseUrl),
    apiKey: normalizeApiKey(input.apiKey),
    model: input.model.trim(),
  };
}
```

Remove provider, model-list, remote-provider, and one-image mode/template fields from `LocalConfig`. Make `loadConfig()` merge legacy stored values into the new shape and make `saveConfig()` serialize only current fields. Update settings inputs to free text Base URL, API Key, and model fields for both AI sections.

- [ ] **Step 4: Run targeted tests**

Run: `pnpm test -- test/core.test.ts --runInBand`
Expected: provider-free configuration tests PASS.

### Task 2: Replace Structured One-Image With Direct Image Generation

**Files:**
- Modify: `src/onePage/onePagePipeline.ts`
- Modify: `src/onePage/types.ts`
- Modify: `src/store/imageCache.ts`
- Delete: `src/onePage/onePageSchema.ts`
- Delete: `src/onePage/composeOnePage.ts`
- Delete: `src/onePage/imagePromptPipeline.ts`
- Delete: `src/onePage/templates/classicTemplate.ts`
- Delete: `src/onePage/templates/denseTemplate.ts`
- Delete: `src/onePage/templates/posterTemplate.ts`
- Remove obsolete one-image tools/prompts from: `src/prompts/defaultPrompts.ts`, `src/prompts/toolPrompts.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing direct-image tests**

Cover exact interpolation and cache behavior:

```ts
expect(buildOneImagePrompt('核心总结')).toBe(
  '根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：\n\n核心总结',
);
expect(imageClient.generateImage).toHaveBeenCalledWith(
  expect.objectContaining({ prompt: buildOneImagePrompt(summary.content) }),
  expect.anything(),
);
```

Also assert a cached result skips the image request and `force: true` sends a new request.

- [ ] **Step 2: Run targeted tests and confirm failure**

Run: `pnpm test -- test/core.test.ts --runInBand`
Expected: FAIL because the old pipeline requests JSON and composes a DOM card.

- [ ] **Step 3: Implement the focused pipeline**

Define:

```ts
export const ONE_IMAGE_PROMPT_TEMPLATE =
  '根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：\n\n{summary}';

export function buildOneImagePrompt(summary: string): string {
  return ONE_IMAGE_PROMPT_TEMPLATE.replace('{summary}', summary.trim());
}
```

Compute a cache key from video source/id, summary, prompt version, image model, and image API URL. Call only `imageAiClient.generateImage()`, cache the successful `GeneratedImage`, and return it. Remove JSON parsing, tool calling, text-client dependency, generated prompt calls, and DOM composition.

- [ ] **Step 4: Run targeted tests**

Run: `pnpm test -- test/core.test.ts --runInBand`
Expected: direct-image tests PASS.

### Task 3: Simplify Preview And Launcher-Triggered Summary

**Files:**
- Modify: `src/app/AppState.ts`
- Modify: `src/app/AppController.ts`
- Modify: `src/ui/oneImageView.ts`
- Modify: `src/ui/panel.ts`
- Modify: `src/ui/styles.ts`
- Modify: `src/ui/i18n.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing controller and UI tests**

Add tests proving:

```ts
await controller.openFromLauncher();
expect(controller.state.activeTab).toBe('summary');
expect(generateSummarySpy).toHaveBeenCalledTimes(1);
```

For a matching cached summary, assert `openFromLauncher()` leaves the cached summary visible and does not call the text client. Assert multiple calls while `state.busy` do not duplicate work.

- [ ] **Step 2: Run targeted tests and confirm failure**

Run: `pnpm test -- test/core.test.ts --runInBand`
Expected: FAIL because launcher click only expands the panel.

- [ ] **Step 3: Implement launcher orchestration and image preview**

Add `openFromLauncher()` to set `collapsed: false`, switch to summary, emit, and call `generateSummary()` only when no cached summary exists and no task is active. Bind the launcher click to this method while preserving drag suppression.

Replace `oneImageElement` with `generatedImage`. Render an `<img>` from normalized `dataUrl` or URL, keep regeneration and download controls, and remove card mode chips and DOM zoom logic. Download the generated data directly, fetching remote URLs through the supported request path when required.

- [ ] **Step 4: Run targeted tests**

Run: `pnpm test -- test/core.test.ts --runInBand`
Expected: launcher, preview, and status tests PASS.

### Task 4: Remove Dead Surface And Update Documentation

**Files:**
- Delete: `src/store/onePageCache.ts`
- Delete: `src/store/makeJsonCache.ts`
- Keep the existing OpenAI-compatible image client implementations; configuration simplification does not require changing their transport behavior.
- Modify: `src/harness/ui-panel-harness.ts`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `FEATURES.md`
- Modify: `PROJECT_REVIEW_RECOMMENDATIONS.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `src/prompts/README.md`

- [ ] **Step 1: Search for obsolete concepts**

Run:

```bash
rg -n "text_card_only|ai_image_background|ai_image_only|one_page_json|一图流 JSON|文本供应商|TextProvider|composeOnePage|onePageCache" src test README.md SPEC.md FEATURES.md PROJECT_REVIEW_RECOMMENDATIONS.md
```

Expected: only files scheduled for cleanup contain matches.

- [ ] **Step 2: Remove dead code and update harness fixtures**

Delete unreferenced JSON/card modules and update the one-image harness scenario with a generated image data URL. Preserve Bilibili/YouTube source-provider code unchanged.

- [ ] **Step 3: Update project documentation and state**

Document the two independent connection triplets, cache-aware launcher summary, and direct image flow. Mark the old structured one-image feature superseded in `feature_list.json`, and record verification evidence in `progress.md`.

- [ ] **Step 4: Verify no obsolete runtime references remain**

Run the `rg` command from Step 1.
Expected: no runtime or user-facing documentation matches except historical design/plan records.

### Task 5: Final Verification

**Files:**
- Test: `test/core.test.ts`
- Verify: all changed source and documentation files

- [ ] **Step 1: Run the complete test suite**

Run: `pnpm test`
Expected: all non-integration tests PASS; the opt-in integration test may remain skipped.

- [ ] **Step 2: Run the production build**

Run: `pnpm build`
Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Inspect harness scenarios**

Run: `pnpm dev:harness`
Inspect: `settings`, `long-summary`, and `one-image` scenarios for the simplified settings, stable summary layout, and direct image preview.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check && git status --short && git diff --stat`
Expected: no whitespace errors, only scoped source/test/docs changes, and no generated `dist` file tracked.
