# Summary Chat UI Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate image-mode forms, stabilize streaming scroll, keep video context fixed, expose only valid controls, and surface image bridge failures reliably.

**Architecture:** Keep structural `statechange` rendering, but route initial-summary `streamchange` into an in-place output patch on the existing scroll element. Derive toolbar/composer behavior from completed-summary state, enforce Shadow DOM hidden semantics, and provide a polling implementation behind the existing GM listener interface.

**Tech Stack:** TypeScript, native DOM and Shadow DOM, Tampermonkey GM APIs, Vitest, Vite.

---

### Task 1: Image Mode Field Groups

**Files:**
- Modify: `src/ui/settingsModal.ts`
- Modify: `src/ui/styles.ts`
- Test: `test/chatgptImageBridge.test.ts`

- [ ] Add a failing test proving inactive mode fields are hidden by a shared visibility helper and Shadow DOM CSS contains a generic hidden rule.
- [ ] Run `pnpm exec vitest run test/chatgptImageBridge.test.ts` and confirm the new assertion fails.
- [ ] Export and use `applyImageModeFieldVisibility(mode, apiFields, chatgptFields)`, setting `hidden` on each group, and add:

```css
[hidden] {
  display: none !important;
}
```

- [ ] Re-run the bridge tests and confirm API mode exposes only API fields while ChatGPT mode exposes only Project fields.

### Task 2: Static Context, Toolbar, And Empty Composer

**Files:**
- Modify: `src/ui/summaryView.ts`
- Modify: `src/ui/styles.ts`
- Test: `test/core.test.ts`

- [ ] Add failing pure-state tests for:

```ts
expect(summaryComposerState({ hasSummary: false, busy: false })).toEqual({
  disabled: true,
  placeholder: '请先生成总结',
  action: 'start_summary',
  label: '开始总结',
});
expect(shouldShowSummaryToolbar({ hasSummary: false, streaming: true })).toBe(false);
expect(shouldShowSummaryToolbar({ hasSummary: true, streaming: false })).toBe(true);
```

- [ ] Run the targeted tests and confirm the helpers are missing.
- [ ] Implement the state helpers and make the start-summary button call `controller.generateSummary()` while Enter does nothing when the textarea is disabled.
- [ ] Build the summary layout as:

```ts
return el('div', { class: 'vs-summary-layout' }, [
  el('div', { class: 'vs-summary-context' }, [
    renderVideoCard(controller),
    renderConfigurationRow(controller),
    renderSubtitleSelector(controller),
  ]),
  el('div', { class: 'vs-summary-scroll' }, [messages]),
  renderComposer(controller),
]);
```

- [ ] Render the summary toolbar only for a completed summary. Change `.vs-output-toolbar` to `justify-content: flex-start`, transparent background, no border, and no reserved height while absent.
- [ ] Run targeted tests and verify the fixed order, composer states, and toolbar states pass.

### Task 3: In-Place Summary Streaming

**Files:**
- Modify: `src/app/events.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/panel.ts`
- Modify: `src/ui/summaryView.ts`
- Test: `test/core.test.ts`

- [ ] Add a failing event test proving state and stream events can use different callbacks:

```ts
bindPanelRendering(events, render, renderStream);
events.emit('statechange');
events.emit('streamchange');
expect(render).toHaveBeenCalledTimes(1);
expect(renderStream).toHaveBeenCalledTimes(1);
```

- [ ] Add a failing DOM-level helper test proving `patchSummaryStream(controller, output)` keeps the same output element and replaces only its children.
- [ ] Implement optional `renderStream` routing in `bindPanelRendering` and bind `panel.renderStreamChange()` from `main.ts`.
- [ ] Implement `Panel.renderStreamChange()` so initial summary streaming calls `updateSummaryOutput()` on the connected `.vs-output-content`; other stream events retain structural rendering until separately optimized.
- [ ] Re-run core tests and confirm initial summary token updates no longer invoke structural render.

### Task 4: Scroll Stability And Image Failure Notification

**Files:**
- Modify: `src/ui/panel.ts`
- Modify: `src/app/AppController.ts`
- Test: `test/core.test.ts`

- [ ] Add failing scroll tests for an immediate bottom target and a monotonically increasing restore generation that rejects stale animation-frame corrections.
- [ ] Implement synchronous `scrollTop` restoration before scheduling a frame correction. Capture the current mounted scroll element and invalidate older scheduled corrections when a newer render or user scroll occurs.
- [ ] Remove the duplicate terminal `streamchange` emission from the image branch; one structural state emission owns the terminal image message.
- [ ] Add a failing controller test where image generation rejects with `当前脚本缺少 GM_addValueChangeListener 权限`, asserting both the assistant failure message and top toast contain the full error.
- [ ] In the image catch block, create one `生成图片失败：<reason>` message and call a forced-toast status path before committing it to history.
- [ ] Re-run core tests and verify image generation does not jump the conversation to the top and failures are visible in both surfaces.

### Task 5: GM Listener Polling Fallback

**Files:**
- Modify: `src/ai/image/chatgptBridgeRuntime.ts`
- Test: `test/chatgptImageBridge.test.ts`

- [ ] Add failing fake-timer tests that remove `GM_addValueChangeListener`, mutate a fake `GM_getValue`, advance the clock, and assert the callback runs only after a value change; then remove the listener and assert polling stops.
- [ ] Implement fallback listener IDs and timers inside the runtime module. Compare stable serialized snapshots and call the existing callback with the newly read value.
- [ ] Preserve the native listener path when `GM_addValueChangeListener` exists. If both native listeners and readable GM storage are missing, retain an actionable permission error.
- [ ] Re-run bridge tests and confirm native and polling paths pass.

### Task 6: Harness, Documentation, And Release Verification

**Files:**
- Modify: `src/harness/ui-panel-harness.ts`
- Modify: `harness.html`
- Modify: `FEATURES.md`
- Modify: `SPEC.md`
- Modify: `progress.md`
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] Add harness states for API settings, ChatGPT settings, empty summary, streaming summary, completed summary, and image failure.
- [ ] Document the fixed context region, completed-only controls, empty composer action, in-place streaming, and dual-surface image errors.
- [ ] Bump the userscript patch version in `package.json` and `vite.config.ts`.
- [ ] Run:

```bash
pnpm test
pnpm build
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8'))"
git diff --check
```

- [ ] Inspect the relevant harness scenarios and install the rebuilt userscript for a final Bilibili smoke test.
