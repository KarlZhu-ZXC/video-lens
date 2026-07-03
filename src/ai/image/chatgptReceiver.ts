import { loadConfig } from '../../store/configStore';
import type { LocalConfig } from '../../store/types';
import { blobToDataUrl } from '../../utils/blob';
import { getErrorMessage } from '../../utils/errors';
import {
  CHATGPT_IMAGE_ACK_KEY,
  CHATGPT_IMAGE_CHUNK_SIZE,
  CHATGPT_IMAGE_HEARTBEAT_KEY,
  CHATGPT_IMAGE_JOB_KEY,
  CHATGPT_IMAGE_MAX_BYTES,
  CHATGPT_IMAGE_RESULT_KEY,
  chatGptImageChunkKey,
  isChatGptImageJobExpired,
  normalizeChatGptProjectUrl,
  parseChatGptProjectUrl,
  splitImageDataUrl,
  type ChatGptImageJob,
  type ChatGptImageAcknowledgement,
  type ChatGptImageResult,
} from './chatgptBridgeProtocol';
import {
  gmChatGptBridgeRuntime,
  parseBridgeValue,
  type ChatGptBridgeRuntime,
} from './chatgptBridgeRuntime';

const HEARTBEAT_INTERVAL_MS = 10_000;
const CLAIM_SETTLE_MS = 180;
const SUBMIT_TIMEOUT_MS = 45_000;
const PROJECT_RESET_DELAY_MS = 1_500;
const RESULT_ACK_TIMEOUT_MS = 30_000;

export const CHATGPT_COMPOSER_SELECTORS = [
  '#prompt-textarea',
  'textarea[aria-label="Chat with ChatGPT"]',
  '[contenteditable="true"][role="textbox"]',
] as const;

export const CHATGPT_SEND_BUTTON_SELECTORS = [
  '[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="发送提示"]',
  'button[aria-label="Send message"]',
] as const;

export const CHATGPT_ASSISTANT_MESSAGE_SELECTOR =
  '[data-message-author-role="assistant"], section[data-turn="assistant"]';
export const CHATGPT_USER_MESSAGE_SELECTOR =
  '[data-message-author-role="user"], section[data-turn="user"]';

export interface ImageCandidate {
  src: string;
  alt?: string;
  width: number;
  height: number;
  complete: boolean;
}

export interface UserMessageSnapshot {
  key: string;
  text: string;
}

export function isChatGptPage(url = location.href): boolean {
  try {
    return new URL(url).hostname === 'chatgpt.com';
  } catch {
    return false;
  }
}

export function isConfiguredProjectRoot(currentUrl: string, configuredUrl: string): boolean {
  try {
    return normalizeChatGptProjectUrl(currentUrl) === normalizeChatGptProjectUrl(configuredUrl);
  } catch {
    return false;
  }
}

export function isProjectChildRoute(input: {
  currentUrl: string;
  projectId: string;
  projectContextHref?: string;
}): boolean {
  let current: URL;
  try {
    current = new URL(input.currentUrl);
  } catch {
    return false;
  }
  if (current.protocol !== 'https:' || current.hostname !== 'chatgpt.com') return false;
  const embeddedProject = /^\/g\/(g-p-[^/]+)\/(?:project\/)?c\/[^/]+\/?$/.exec(current.pathname)?.[1];
  if (embeddedProject) return projectRouteSegmentMatches(embeddedProject, input.projectId);
  if (!/^\/c\/[^/]+\/?$/.test(current.pathname) || !input.projectContextHref) return false;
  try {
    return projectRouteSegmentMatches(
      parseChatGptProjectUrl(new URL(input.projectContextHref, current.origin).href).projectId,
      input.projectId,
    );
  } catch {
    return false;
  }
}

export function scheduleProjectReset(
  projectRootUrl: string,
  navigate: (url: string) => void,
  delayMs = PROJECT_RESET_DELAY_MS,
): ReturnType<typeof setTimeout> {
  return globalThis.setTimeout(() => navigate(projectRootUrl), delayMs);
}

export async function waitForJobAcknowledgement(
  runtime: ChatGptBridgeRuntime,
  jobId: string,
  timeoutMs = RESULT_ACK_TIMEOUT_MS,
  pollIntervalMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const acknowledgement = runtime.getValue<ChatGptImageAcknowledgement | undefined>(
      CHATGPT_IMAGE_ACK_KEY,
      undefined,
    );
    if (acknowledgement?.version === 1
      && acknowledgement.jobId === jobId
      && acknowledgement.status === 'consumed') return true;
    await sleep(pollIntervalMs);
  }
  return false;
}

export function shouldAcceptChatGptImageJob(
  job: ChatGptImageJob,
  receiverId: string,
  currentUrl: string,
  configuredUrl: string,
  now = Date.now(),
): boolean {
  if (!job || job.version !== 1 || !job.id || !job.prompt || isChatGptImageJobExpired(job, now)) return false;
  if (job.targetReceiverId && job.targetReceiverId !== receiverId) return false;
  return isConfiguredProjectRoot(currentUrl, configuredUrl);
}

export function isGeneratedImageCandidate(candidate: ImageCandidate): boolean {
  if (!candidate.complete || !candidate.src || candidate.width < 256 || candidate.height < 256) return false;
  if (/favicon|avatar|profile|emoji|icon/i.test(`${candidate.src} ${candidate.alt ?? ''}`)) return false;
  return /^(?:https?:|blob:|data:image\/)/i.test(candidate.src);
}

export function selectNewGeneratedImage(
  baselineSources: Set<string>,
  candidates: ImageCandidate[],
): ImageCandidate | undefined {
  return [...candidates].reverse().find((candidate) =>
    !baselineSources.has(candidate.src) && isGeneratedImageCandidate(candidate));
}

export function selectJobGeneratedImage(
  baselineSources: Set<string>,
  snapshots: Array<{ messageWasPresentBefore: boolean; images: ImageCandidate[] }>,
): ImageCandidate | undefined {
  return selectNewGeneratedImage(baselineSources, snapshots.flatMap((snapshot) => snapshot.images));
}

export function selectSubmittedUserMessage(
  baselineKeys: Set<string>,
  messages: UserMessageSnapshot[],
  prompt: string,
): UserMessageSnapshot | undefined {
  const expectedPrefix = normalizeMessageText(prompt).slice(0, 160);
  return [...messages].reverse().find((message) =>
    !baselineKeys.has(message.key) && normalizeMessageText(message.text).startsWith(expectedPrefix));
}

export function hasPromptSubmissionEvidence(input: {
  baselineKeys: Set<string>;
  messages: UserMessageSnapshot[];
  prompt: string;
  currentUrl: string;
  projectId: string;
  projectContextHref?: string;
}): boolean {
  return Boolean(selectSubmittedUserMessage(input.baselineKeys, input.messages, input.prompt))
    || isProjectChildRoute({
      currentUrl: input.currentUrl,
      projectId: input.projectId,
      projectContextHref: input.projectContextHref,
    });
}

export class ChatGptImageReceiver {
  readonly receiverId: string;
  private readonly queue: ChatGptImageJob[] = [];
  private readonly handledJobIds = new Set<string>();
  private listenerId?: number;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(
    private readonly runtime: ChatGptBridgeRuntime = gmChatGptBridgeRuntime,
    private readonly getConfig: () => LocalConfig = loadConfig,
    private readonly page: Document = document,
    private readonly pageWindow: Window = window,
    createId: () => string = defaultReceiverId,
    private readonly navigate: (url: string) => void = (url) => this.pageWindow.location.assign(url),
  ) {
    this.receiverId = createId();
  }

  start(): void {
    if (this.listenerId) return;
    this.listenerId = this.runtime.addValueChangeListener(CHATGPT_IMAGE_JOB_KEY, (value) => this.enqueue(value));
    this.writeHeartbeat();
    this.heartbeatTimer = globalThis.setInterval(() => this.writeHeartbeat(), HEARTBEAT_INTERVAL_MS);
    this.enqueue(this.runtime.getValue(CHATGPT_IMAGE_JOB_KEY, undefined));
  }

  destroy(): void {
    if (this.listenerId) this.runtime.removeValueChangeListener(this.listenerId);
    if (this.heartbeatTimer) globalThis.clearInterval(this.heartbeatTimer);
    this.listenerId = undefined;
    this.heartbeatTimer = undefined;
    const heartbeat = this.runtime.getValue<{ receiverId?: string } | undefined>(CHATGPT_IMAGE_HEARTBEAT_KEY, undefined);
    if (heartbeat?.receiverId === this.receiverId) this.runtime.deleteValue(CHATGPT_IMAGE_HEARTBEAT_KEY);
  }

  private writeHeartbeat(): void {
    const config = this.getConfig();
    if (config.imageAi.mode !== 'chatgpt_web') return;
    if (!isConfiguredProjectRoot(this.pageWindow.location.href, config.imageAi.chatgptConversationUrl)) return;
    this.runtime.setValue(CHATGPT_IMAGE_HEARTBEAT_KEY, {
      version: 1,
      receiverId: this.receiverId,
      url: normalizeChatGptProjectUrl(this.pageWindow.location.href),
      updatedAt: this.runtime.now(),
    });
  }

  private enqueue(raw: unknown): void {
    const job = parseBridgeValue<ChatGptImageJob | undefined>(raw, undefined);
    const config = this.getConfig();
    if (config.imageAi.mode !== 'chatgpt_web' || !job) return;
    if (!shouldAcceptChatGptImageJob(
      job,
      this.receiverId,
      this.pageWindow.location.href,
      config.imageAi.chatgptConversationUrl,
      this.runtime.now(),
    )) return;
    if (this.handledJobIds.has(job.id) || this.queue.some((item) => item.id === job.id)) return;
    this.queue.push(job);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length) {
      const job = this.queue.shift()!;
      this.handledJobIds.add(job.id);
      await this.processJob(job);
      if (this.handledJobIds.size > 100) {
        const recent = [...this.handledJobIds].slice(-50);
        this.handledJobIds.clear();
        recent.forEach((id) => this.handledJobIds.add(id));
      }
    }
    this.processing = false;
  }

  private async processJob(job: ChatGptImageJob): Promise<void> {
    let projectRootUrl: string | undefined;
    let shouldReset = false;
    let resultPublished = false;
    try {
      const project = parseChatGptProjectUrl(this.getConfig().imageAi.chatgptConversationUrl);
      projectRootUrl = project.rootUrl;
      this.publish(job, 'accepted');
      if (!job.targetReceiverId) {
        await sleep(CLAIM_SETTLE_MS);
        const claim = this.runtime.getValue<ChatGptImageResult | undefined>(CHATGPT_IMAGE_RESULT_KEY, undefined);
        if (claim?.jobId !== job.id || claim.receiverId !== this.receiverId) return;
      }
      shouldReset = true;

      const baselineSources = new Set(this.assistantImages(this.assistantMessages()).map((candidate) => candidate.src));
      const baselineUserMessageKeys = new Set(this.userMessages().map((message) => message.key));
      const composer = await this.waitForComposer(SUBMIT_TIMEOUT_MS);
      this.fillPrompt(composer, job.prompt);
      this.publish(job, 'submitting');
      await this.submitPrompt(composer, baselineUserMessageKeys, job.prompt, project.projectId);
      const jobChatUrl = await this.waitForProjectChildRoute(project.projectId, project.rootUrl, SUBMIT_TIMEOUT_MS);
      this.publish(job, 'generating');

      const candidate = await this.waitForGeneratedImage(job, baselineSources, jobChatUrl, project.projectId);
      let dataUrl: string | undefined;
      let downloadError: unknown;
      try {
        dataUrl = await downloadImageDataUrl(candidate.src);
      } catch (error) {
        downloadError = error;
      }

      let chunkCount: number | undefined;
      let mimeType: string | undefined;
      if (dataUrl && dataUrlByteSize(dataUrl) <= CHATGPT_IMAGE_MAX_BYTES) {
        const split = splitImageDataUrl(dataUrl);
        mimeType = split.mimeType;
        split.chunks.forEach((chunk, index) => this.runtime.setValue(chatGptImageChunkKey(job.id, index), chunk));
        chunkCount = split.chunks.length;
      }
      const fallbackUrl = /^https?:/i.test(candidate.src) ? candidate.src : undefined;
      if (!chunkCount && !fallbackUrl) {
        throw downloadError ?? new Error('ChatGPT 图片无法转换为可回传的数据');
      }
      this.publish(job, 'succeeded', {
        image: { mimeType, chunkCount, url: fallbackUrl },
      });
      resultPublished = true;
    } catch (error) {
      this.cleanupChunks(job.id);
      this.publish(job, 'failed', { error: getErrorMessage(error) });
    } finally {
      if (shouldReset && resultPublished && projectRootUrl
        && !isConfiguredProjectRoot(this.pageWindow.location.href, projectRootUrl)
        && await waitForJobAcknowledgement(this.runtime, job.id)) {
        this.runtime.deleteValue(CHATGPT_IMAGE_ACK_KEY);
        scheduleProjectReset(projectRootUrl, this.navigate);
      }
    }
  }

  private publish(
    job: ChatGptImageJob,
    status: ChatGptImageResult['status'],
    details: Pick<ChatGptImageResult, 'error' | 'image'> = {},
  ): void {
    const result = {
      version: 1,
      jobId: job.id,
      receiverId: this.receiverId,
      status,
      updatedAt: this.runtime.now(),
      ...details,
    } satisfies ChatGptImageResult;
    this.runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, result);
    this.page.documentElement.setAttribute('data-video-lens-chatgpt-bridge', JSON.stringify({
      jobId: job.id,
      receiverId: this.receiverId,
      status,
      error: details.error,
      updatedAt: result.updatedAt,
    }));
    console.info('[Video Lens][ChatGPT Bridge]', status, job.id, details.error ?? '');
  }

  private async waitForComposer(timeoutMs: number): Promise<HTMLElement> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const composer = findFirstElement(this.page, CHATGPT_COMPOSER_SELECTORS);
      if (composer) return composer;
      await sleep(150);
    }
    throw new Error('未找到 ChatGPT 输入框，请确认账号已登录且专用会话可用');
  }

  private fillPrompt(composer: HTMLElement, prompt: string): void {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(composer, prompt);
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
      return;
    }

    const selection = this.pageWindow.getSelection();
    const range = this.page.createRange();
    range.selectNodeContents(composer);
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.page.execCommand?.('insertText', false, prompt);
    if ((composer.textContent ?? '').trim() !== prompt.trim()) {
      const paragraph = this.page.createElement('p');
      paragraph.textContent = prompt;
      composer.replaceChildren(paragraph);
    }
    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }

  private async submitPrompt(
    composer: HTMLElement,
    baselineUserMessageKeys: Set<string>,
    prompt: string,
    projectId: string,
  ): Promise<void> {
    const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
    let button: HTMLButtonElement | undefined;
    while (Date.now() <= deadline) {
      button = findEnabledSendButton(this.page);
      if (button) break;
      await sleep(150);
    }
    if (button) button.click();
    else composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));

    while (Date.now() <= deadline) {
      if (hasPromptSubmissionEvidence({
        baselineKeys: baselineUserMessageKeys,
        messages: this.userMessages(),
        prompt,
        currentUrl: this.pageWindow.location.href,
        projectId,
        projectContextHref: this.projectContextHref(projectId),
      })) return;
      await sleep(150);
    }
    throw new Error('ChatGPT 未接受生图提示词，发送按钮或页面结构可能已变化');
  }

  private waitForGeneratedImage(
    job: ChatGptImageJob,
    baselineSources: Set<string>,
    jobChatUrl: string,
    projectId: string,
  ): Promise<ImageCandidate> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const remaining = Math.max(1, job.expiresAt - this.runtime.now());
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        globalThis.clearInterval(scanTimer);
        globalThis.clearTimeout(timeout);
        action();
      };
      const scan = () => {
        const currentUrl = this.pageWindow.location.href;
        if (!samePageUrl(currentUrl, jobChatUrl) || !isProjectChildRoute({
          currentUrl,
          projectId,
          projectContextHref: this.projectContextHref(projectId),
        })) {
          finish(() => reject(new Error('ChatGPT Project 新聊天在生成过程中发生了切换')));
          return;
        }
        const candidate = selectJobGeneratedImage(
          baselineSources,
          this.assistantMessages().map((message) => ({
            messageWasPresentBefore: false,
            images: this.assistantImages([message]),
          })),
        );
        if (candidate) finish(() => resolve(candidate));
      };
      const observer = new MutationObserver(scan);
      observer.observe(this.page.body ?? this.page.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset'],
      });
      const scanTimer = globalThis.setInterval(scan, 1_000);
      const timeout = globalThis.setTimeout(
        () => finish(() => reject(new Error('等待 ChatGPT 生成图片超时'))),
        remaining,
      );
      scan();
    });
  }

  private assistantMessages(): Element[] {
    return Array.from(this.page.querySelectorAll(CHATGPT_ASSISTANT_MESSAGE_SELECTOR));
  }

  private async waitForProjectChildRoute(
    projectId: string,
    projectRootUrl: string,
    timeoutMs: number,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const currentUrl = this.pageWindow.location.href;
      if (isProjectChildRoute({
        currentUrl,
        projectId,
        projectContextHref: this.projectContextHref(projectId),
      })) return canonicalPageUrl(currentUrl);
      if (!isConfiguredProjectRoot(currentUrl, projectRootUrl)) {
        throw new Error('ChatGPT 未进入配置的 Project 新聊天');
      }
      await sleep(150);
    }
    throw new Error('ChatGPT 未创建 Project 新聊天');
  }

  private projectContextHref(projectId: string): string | undefined {
    return Array.from(this.page.querySelectorAll<HTMLAnchorElement>('a[href*="/g/"][href*="/project"]'))
      .find((anchor) => {
        try {
          return projectRouteSegmentMatches(parseChatGptProjectUrl(anchor.href).projectId, projectId);
        } catch {
          return false;
        }
      })?.href;
  }

  private userMessages(): UserMessageSnapshot[] {
    return Array.from(this.page.querySelectorAll(CHATGPT_USER_MESSAGE_SELECTOR)).map((message, index) => {
      const messageWithId = message.matches('[data-message-id], [data-turn-id]')
        ? message
        : message.querySelector('[data-message-id], [data-turn-id]');
      const stableId = messageWithId?.getAttribute('data-message-id')
        ?? messageWithId?.getAttribute('data-turn-id');
      const text = message.textContent ?? '';
      return {
        key: stableId ? `id:${stableId}` : `fallback:${index}:${normalizeMessageText(text)}`,
        text,
      };
    });
  }

  private assistantImages(messages: Element[]): ImageCandidate[] {
    return messages.flatMap((message) => Array.from(message.querySelectorAll('img')).map((image) => ({
      src: image.currentSrc || image.src,
      alt: image.alt,
      width: image.naturalWidth,
      height: image.naturalHeight,
      complete: image.complete,
    })));
  }

  private cleanupChunks(jobId: string): void {
    for (let index = 0; index < Math.ceil((CHATGPT_IMAGE_MAX_BYTES * 4 / 3) / CHATGPT_IMAGE_CHUNK_SIZE) + 2; index += 1) {
      this.runtime.deleteValue(chatGptImageChunkKey(jobId, index));
    }
  }
}

export function startChatGptImageReceiver(): ChatGptImageReceiver {
  const receiver = new ChatGptImageReceiver();
  receiver.start();
  return receiver;
}

function findFirstElement(root: ParentNode, selectors: readonly string[]): HTMLElement | undefined {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) return element;
  }
  return undefined;
}

function findEnabledSendButton(root: ParentNode): HTMLButtonElement | undefined {
  for (const selector of CHATGPT_SEND_BUTTON_SELECTORS) {
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') return button;
  }
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.trim();
    return /^(?:Send prompt|Send message|发送提示|发送)$/i.test(label)
      && !button.disabled
      && button.getAttribute('aria-disabled') !== 'true';
  });
}

function samePageUrl(left: string, right: string): boolean {
  try {
    return canonicalPageUrl(left) === canonicalPageUrl(right);
  } catch {
    return false;
  }
}

function canonicalPageUrl(value: string): string {
  const parsed = new URL(value);
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
}

function projectRouteSegmentMatches(routeSegment: string, configuredProjectId: string): boolean {
  const stableIdPattern = /^(g-p-[0-9a-f]{32})(?:-|$)/i;
  const routeStableId = stableIdPattern.exec(routeSegment)?.[1];
  const configuredStableId = stableIdPattern.exec(configuredProjectId)?.[1];
  if (routeStableId && configuredStableId) {
    return routeStableId.toLowerCase() === configuredStableId.toLowerCase();
  }
  return routeSegment === configuredProjectId;
}

async function downloadImageDataUrl(url: string): Promise<string> {
  if (/^data:image\//i.test(url)) return url;
  try {
    return blobToDataUrl(await fetchBlobWithTimeout(url));
  } catch (fetchError) {
    if (typeof GM_xmlhttpRequest !== 'function') throw fetchError;
    const blob = await new Promise<Blob>((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        timeout: 30_000,
        onload: (response) => {
          if (response.status < 200 || response.status >= 300 || !(response.response instanceof Blob)) {
            reject(new Error(`ChatGPT 图片下载失败：HTTP ${response.status}`));
            return;
          }
          resolve(response.response);
        },
        onerror: () => reject(new Error('ChatGPT 图片下载失败')),
        ontimeout: () => reject(new Error('ChatGPT 图片下载超时')),
      });
    });
    return blobToDataUrl(blob);
  }
}

export async function fetchBlobWithTimeout(
  url: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
): Promise<Blob> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetcher(url, { credentials: 'include', signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timeout = globalThis.setTimeout(() => {
          controller.abort();
          reject(new Error('ChatGPT 图片下载超时'));
        }, timeoutMs);
      }),
    ]);
    if (!response.ok) throw new Error(`ChatGPT 图片下载失败：HTTP ${response.status}`);
    return response.blob();
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
  }
}

function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const base64 = dataUrl.slice(comma + 1).replace(/=+$/, '');
  return Math.floor(base64.length * 3 / 4);
}

function normalizeMessageText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function defaultReceiverId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `receiver_${uuid}` : `receiver_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
