# Summary Presets And Panel Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global v2 summary-preset picker with a folded custom editor and timeline support, and animate the mascot-to-panel open/close transition.

**Architecture:** Keep v1 prompts untouched and make v2 the runtime catalog. Resolve every selected prompt to an effective preset plus content fingerprint, feed that target through both short and long summary paths, and use the fingerprint for cache matching. Keep animation state inside `Panel`, with small pure timing helpers and CSS keyframes.

**Tech Stack:** TypeScript, native DOM, Shadow DOM, Vite, Vitest, Tampermonkey storage.

---

### Task 1: V2 Prompt Catalog And Timeline Source

**Files:**
- Modify: `src/prompts/defaultPrompts.v2.ts`
- Modify: `src/prompts/promptTypes.ts`
- Modify: `src/sources/VideoSourceProvider.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing catalog and timeline tests**

Add assertions that v2 exposes exactly five selectable `summary` presets including `summary_timeline`, that every template contains its required transcript variable, and that:

```ts
formatTranscriptWithTimeline({
  lines: [
    { from: 5, to: 9.5, text: '第一点' },
    { from: 65, to: 70, text: '第二点' },
  ],
  plainText: '第一点 第二点',
  charCount: 7,
})
```

returns:

```text
[00:05-00:10] 第一点
[01:05-01:10] 第二点
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect missing `summary_timeline` and timeline formatter failures.

- [ ] **Step 3: Optimize all v2 prompts and add timeline helpers**

Keep `src/prompts/defaultPrompts.ts` byte-for-byte unchanged. In v2, improve plain, detailed, critical, action, chunk, merge, and chat templates; add `summary_timeline`; export:

```ts
export function getSummaryPromptPresets(): PromptPreset[] {
  return BUILT_IN_PROMPTS.filter((prompt) => prompt.type === 'summary');
}

export function formatTranscriptWithTimeline(transcript: Transcript): string {
  return transcript.lines
    .filter((line) => line.text.trim())
    .map((line) => `[${formatTime(line.from)}-${formatTime(line.to)}] ${line.text.trim()}`)
    .join('\n');
}
```

Add `targetPrompt?: string` to `PromptVariables` for the merge wrapper.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect all focused assertions to pass.

### Task 2: Effective Prompt Resolution And Cache Fingerprints

**Files:**
- Modify: `src/prompts/defaultPrompts.v2.ts`
- Modify: `src/summary/types.ts`
- Modify: `src/summary/summaryPipeline.ts`
- Modify: `src/app/AppController.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing resolution and long-summary tests**

Cover built-in selection, a deterministic `summary_custom` preset, prompt fingerprint changes when custom text changes, timeline input selection, and a long transcript whose final API request contains the selected detailed target structure rather than only the generic merge structure.

- [ ] **Step 2: Run focused tests and verify RED**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect missing effective-prompt resolver, fingerprint, and target-prompt propagation failures.

- [ ] **Step 3: Implement prompt resolution**

Resolve the selected prompt with:

```ts
export interface EffectiveSummaryPrompt {
  preset: PromptPreset;
  template: string;
  fingerprint: string;
}
```

Use `stableHash(template)` for the fingerprint. Build `summary_custom` from the single saved custom preset and use its template verbatim.

- [ ] **Step 4: Apply selected targets to both pipeline branches**

For timeline selection, use `formatTranscriptWithTimeline(transcript)` when non-empty. For long summaries, preserve ranges in chunk evidence and render the selected template against joined chunk summaries, then pass that rendered target through `merge_summary` as `targetPrompt`.

Store `promptFingerprint` on `SummaryResult`. Require both ID and fingerprint for cache restoration and include the fingerprint in `summaryCacheKey`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect resolution, long-summary, and cache assertions to pass.

### Task 3: Compact Global Preset Setting

**Files:**
- Modify: `src/store/configStore.ts`
- Modify: `src/store/types.ts`
- Modify: `src/ui/i18n.ts`
- Modify: `src/ui/settingsModal.ts`
- Modify: `src/ui/styles.ts`
- Modify: `src/harness/ui-panel-harness.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing state-helper tests**

Test that `shouldExpandCustomPrompt(previousId, nextId, hasSavedText)` expands when switching to Custom with no saved text, while `customPromptStartsExpanded(selectedId, hasSavedText)` is false for a saved Custom preset. Test empty custom validation and localized labels.

- [ ] **Step 2: Run focused tests and verify RED**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect missing helpers and i18n keys.

- [ ] **Step 3: Implement the General setting**

Render one field containing a wrapping native-radio chip group for the five v2 presets plus Custom. Use real radio inputs for accessibility. Selecting Custom with no saved content opens the editor; saved Custom starts with a collapsed `Edit custom prompt` disclosure. Other selections hide it.

Save the custom entry in `config.prompts.customPresets` under stable ID `summary_custom`; reject an empty value only when Custom is selected. Include preset and textarea state in reset and dirty detection.

- [ ] **Step 4: Style compact and expanded states**

Add `.vs-preset-radio-group`, `.vs-preset-radio`, `.vs-custom-prompt-disclosure`, and textarea rules. Keep the chips wrapping within the current settings width and use existing surface, outline, primary, and focus tokens.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect settings helpers and localization assertions to pass.

### Task 4: Mascot And Panel Scale Transition

**Files:**
- Modify: `src/ui/panel.ts`
- Modify: `src/ui/styles.ts`
- Modify: `src/harness/ui-panel-harness.ts`
- Test: `test/core.test.ts`

- [ ] **Step 1: Write failing transition-helper tests**

Test `panelTransitionDuration(false) === 200`, `panelTransitionDuration(true) === 0`, and an animation guard that rejects a second transition while one is active.

- [ ] **Step 2: Run focused tests and verify RED**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect missing transition helpers.

- [ ] **Step 3: Implement staged open and close**

On a launcher click, add `is-opening`, wait for the launcher exit duration, then call `openFromLauncher`; render the new shell with `is-entering`. On close, add `is-closing`, wait, then call `toggleCollapsed`; render the launcher with `is-entering`. Guard repeated actions and clear timers in `destroy()`.

Read reduced-motion with `matchMedia('(prefers-reduced-motion: reduce)')`; use zero delay and no animation in that mode.

- [ ] **Step 4: Add directional keyframes**

Use right/left transform origins and opacity/scale keyframes. Do not animate width, height, top, or layout properties. Keep launcher dragging styles dominant over entrance transforms.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run `pnpm test -- test/core.test.ts --runInBand`. Expect transition assertions to pass.

### Task 5: Documentation, Harness, And Release Verification

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `FEATURES.md`
- Modify: `progress/README.md`
- Modify: `package.json`

- [ ] **Step 1: Update behavior documentation**

Document the five built-ins plus Custom, global preset behavior, timeline timestamp guarantees, v1/v2 separation, folded custom editor, prompt-aware long-summary merge, cache fingerprinting, and scale transition.

- [ ] **Step 2: Bump the userscript version**

Increment `package.json` from `0.3.4` to `0.3.5` so Tampermonkey recognizes the new artifact.

- [ ] **Step 3: Run harness checks**

Run `pnpm dev:harness`. Verify settings built-in selection, first Custom expansion, saved Custom collapse/reopen, empty validation, open/close animation, left/right origins, reduced motion, and retained subtitle dropdown.

- [ ] **Step 4: Run final automated verification**

Run `pnpm test && pnpm build && git diff --check`. Expect 0 failed tests, a successful TypeScript/Vite build, `dist/video-lens.user.js` at version `0.3.5`, and no whitespace errors.
