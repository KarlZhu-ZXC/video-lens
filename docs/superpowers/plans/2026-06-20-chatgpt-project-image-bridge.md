# ChatGPT Project Image Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate every ChatGPT Web image in a new chat inside the configured ChatGPT Project, return it to the video page, and reset the same tab to the Project root.

**Architecture:** Canonicalize a Project root URL and derive its Project ID in the bridge protocol. The receiver accepts work only at that root, binds the post-submit child route to the active job after verifying Project context, publishes the terminal result, and resets through an injected navigation callback after a propagation delay.

**Tech Stack:** TypeScript, Tampermonkey GM APIs, native DOM/MutationObserver, Vitest, Vite, Chrome extension browser control.

---

### Task 1: Project URL Protocol

**Files:**
- Modify: `src/ai/image/chatgptBridgeProtocol.ts`
- Modify: `src/ai/image/ChatGptWebImageClient.ts`
- Test: `test/chatgptImageBridge.test.ts`

- [ ] **Step 1: Write failing Project URL and heartbeat tests**

```ts
expect(normalizeChatGptProjectUrl('https://chatgpt.com/g/g-p-abc/project?x=1#top'))
  .toBe('https://chatgpt.com/g/g-p-abc/project');
expect(() => normalizeChatGptProjectUrl('https://chatgpt.com/c/abc')).toThrow('ChatGPT Project');
expect(getLiveChatGptImageReceiver('https://chatgpt.com/g/g-p-abc/project', runtime)?.receiverId)
  .toBe('receiver-live');
```

- [ ] **Step 2: Verify the tests fail for the missing Project canonicalizer**

Run: `pnpm test -- test/chatgptImageBridge.test.ts`

Expected: FAIL because ordinary `/c/...` URLs are still accepted and `normalizeChatGptProjectUrl` does not exist.

- [ ] **Step 3: Implement canonical Project parsing**

```ts
export interface ChatGptProjectLocation {
  projectId: string;
  rootUrl: string;
}

export function parseChatGptProjectUrl(value: string): ChatGptProjectLocation {
  const parsed = new URL(value.trim());
  const match = /^\/g\/(g-p-[^/]+)\/project\/?$/.exec(parsed.pathname);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'chatgpt.com' || !match) {
    throw new Error('请填写有效的 ChatGPT Project URL');
  }
  return { projectId: match[1], rootUrl: `${parsed.origin}/g/${match[1]}/project` };
}

export const normalizeChatGptProjectUrl = (value: string) => parseChatGptProjectUrl(value).rootUrl;
```

Replace conversation normalization in the web client and heartbeat lookup with Project normalization.

- [ ] **Step 4: Verify Project protocol tests pass**

Run: `pnpm test -- test/chatgptImageBridge.test.ts`

Expected: all bridge tests pass.

### Task 2: Job-Bound Project Route And Reset

**Files:**
- Modify: `src/ai/image/chatgptReceiver.ts`
- Test: `test/chatgptImageBridge.test.ts`

- [ ] **Step 1: Write failing route-binding tests**

```ts
expect(isConfiguredProjectRoot(projectRoot, projectRoot)).toBe(true);
expect(isConfiguredProjectRoot('https://chatgpt.com/c/child', projectRoot)).toBe(false);
expect(isProjectChildRoute({
  currentUrl: 'https://chatgpt.com/c/child',
  projectId: 'g-p-abc',
  projectContextHref: '/g/g-p-abc/project',
})).toBe(true);
expect(isProjectChildRoute({
  currentUrl: 'https://chatgpt.com/c/child',
  projectId: 'g-p-abc',
  projectContextHref: '/g/g-p-other/project',
})).toBe(false);
```

Add a receiver-level test with an injected `navigate(url)` callback and fake terminal result, asserting exactly one reset to the canonical Project root.

- [ ] **Step 2: Run tests and confirm root-only conversation logic fails them**

Run: `pnpm test -- test/chatgptImageBridge.test.ts`

Expected: FAIL because route-binding helpers and reset navigation do not exist.

- [ ] **Step 3: Implement root acceptance, child binding, and reset**

```ts
const PROJECT_RESET_DELAY_MS = 1_500;

export function isConfiguredProjectRoot(currentUrl: string, configuredUrl: string): boolean {
  return normalizeChatGptProjectUrl(currentUrl) === normalizeChatGptProjectUrl(configuredUrl);
}

export function isProjectChildRoute(input: {
  currentUrl: string;
  projectId: string;
  projectContextHref?: string;
}): boolean {
  const current = new URL(input.currentUrl);
  return current.hostname === 'chatgpt.com'
    && /^\/c\/[^/]+\/?$/.test(current.pathname)
    && Boolean(input.projectContextHref?.includes(`/g/${input.projectId}/project`));
}
```

After prompt submission, wait for either the verified Project child route or an assistant response while the Project context link remains present. Bind the resulting URL to the active job and use that bound URL during image observation. Inject `navigate` into the receiver constructor, and after terminal publication schedule `navigate(projectRoot)`.

- [ ] **Step 4: Keep submission confirmation independent of turn count**

Retain `selectSubmittedUserMessage` with stable `data-message-id` matching so ChatGPT virtualization cannot leave the receiver in `submitting`.

- [ ] **Step 5: Verify receiver tests pass**

Run: `pnpm test -- test/chatgptImageBridge.test.ts`

Expected: all bridge tests pass, including route mismatch and reset coverage.

### Task 3: Settings, Cache Identity, And Documentation

**Files:**
- Modify: `src/ui/settingsModal.ts`
- Modify: `src/ui/i18n.ts`
- Modify: `src/app/AppController.ts`
- Modify: `src/harness/ui-panel-harness.ts`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `FEATURES.md`
- Modify: `PROJECT_REVIEW_RECOMMENDATIONS.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Test: `test/chatgptImageBridge.test.ts`

- [ ] **Step 1: Write failing UI validation tests**

```ts
expect(validateImageSettings({
  ...DEFAULT_CONFIG.imageAi,
  mode: 'chatgpt_web',
  chatgptConversationUrl: 'https://chatgpt.com/g/g-p-abc/project',
})).toBe('');
expect(validateImageSettings({
  ...DEFAULT_CONFIG.imageAi,
  mode: 'chatgpt_web',
  chatgptConversationUrl: 'https://chatgpt.com/c/abc',
})).toContain('Project');
```

- [ ] **Step 2: Verify UI tests fail**

Run: `pnpm test -- test/chatgptImageBridge.test.ts`

Expected: FAIL because validation still requires a dedicated conversation URL.

- [ ] **Step 3: Update labels, validation, status text, harness, and cache identity**

Use `ChatGPT Project URL` / `ChatGPT Project 地址`, explain that every request creates a new Project chat, and report an offline root receiver as `未检测到 ChatGPT Project 接收端，请打开 Project 根页并刷新`.

Canonicalize the Project URL in `imageGenerationCacheIdentity`:

```ts
return config.mode === 'chatgpt_web'
  ? `chatgpt_web:${normalizeChatGptProjectUrl(config.chatgptConversationUrl)}`
  : `api:${config.apiUrl}:${config.model}:${config.size}`;
```

- [ ] **Step 4: Update behavioral documentation and backlog state**

Document Project-root readiness, one chat per generation, no API fallback, terminal reset, and the real Chrome completion gate. Keep `feat-011` in progress until both real generations return successfully.

- [ ] **Step 5: Run bridge and core tests**

Run: `pnpm test`

Expected: all non-opt-in tests pass; MiniMax integration remains skipped.

### Task 4: Build, Install, And Two-Generation Chrome Verification

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify after evidence: `feature_list.json`
- Modify after evidence: `progress.md`

- [ ] **Step 1: Bump userscript version and build**

Set both metadata versions to the next patch version, then run:

```bash
pnpm build
```

Expected: TypeScript and Vite build succeed and `dist/video-summary.user.js` contains the new version.

- [ ] **Step 2: Install the build in Tampermonkey**

Serve the repository with `pnpm dev:harness`, open `http://127.0.0.1:5173/dist/video-summary.user.js`, and have the user confirm the Tampermonkey extension update page when browser security policy blocks extension-page interaction.

- [ ] **Step 3: Run first real generation**

Configure `https://chatgpt.com/g/g-p-6a357a38342081918dad2ca18bb9f9c7/project`, verify the Project heartbeat, trigger Bilibili image generation, and observe `accepted → submitting → generating → succeeded`. Verify a new Project chat, a generated image, a Bilibili `.vs-chat-image img`, and Project-root reset.

- [ ] **Step 4: Run second real generation**

Trigger generation again from the Project root. Verify the child-chat URL differs from the first, the second image returns to Bilibili, and the same ChatGPT tab resets again.

- [ ] **Step 5: Record completion and run final verification**

Mark `feat-011` done only after both runs, record the two child URLs and returned-image evidence in `progress.md`, then run:

```bash
pnpm test
pnpm build
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8'))"
git diff --check
```

Expected: tests and build pass, JSON parses, and no whitespace errors remain.
