import { createImageAiClient } from '../ai/image/createClient';
import { getLiveChatGptImageReceiver } from '../ai/image/ChatGptWebImageClient';
import { normalizeChatGptProjectUrl } from '../ai/image/chatgptBridgeProtocol';
import type { GeneratedImage } from '../ai/image/types';
import { createTextAiClient } from '../ai/text/createClient';
import { getActiveProvider, isSupportedVideoUrl } from '../sources/providers';
import { watchVideoRouteChange } from '../sources/routeWatcher';
import type { VideoInfo, VideoSourceProvider } from '../sources/VideoSourceProvider';
import { loadConfig, saveConfig } from '../store/configStore';
import { imageCache } from '../store/imageCache';
import { summaryCache } from '../store/summaryCache';
import type { LocalConfig } from '../store/types';
import { askSummaryChat, buildOneImagePrompt, isImageGenerationRequest } from '../summary/chatPipeline';
import { runSummaryPipeline } from '../summary/summaryPipeline';
import { finalizeReasoningTiming, updateReasoningTiming } from '../summary/reasoningTiming';
import type { SummaryResult } from '../summary/types';
import { getErrorMessage } from '../utils/errors';
import { stableHash } from '../utils/hash';
import {
  IMAGE_CONNECTIVITY_TEST_PROMPT,
  resolveImagePrompt,
  resolveSummaryPrompt,
  TEXT_CONNECTIVITY_TEST_PROMPT,
} from '../prompts/defaultPrompts.v2';
import { logger } from '../utils/logger';
import { sleep } from '../utils/sleep';
import { createInitialState, type AppState } from './AppState';
import { TinyEmitter } from './events';

export class AppController {
  readonly events = new TinyEmitter();
  config: LocalConfig = loadConfig();
  state: AppState = createInitialState();
  private unwatch?: () => void;
  private toastId = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private _pendingSummaryStreamUpdate = false;

  async mount(): Promise<void> {
    this.unwatch = watchVideoRouteChange(() => void this.refreshVideo());
    await this.refreshVideo();
  }

  destroy(): void {
    this.unwatch?.();
  }

  async refreshVideo(): Promise<void> {
    if (!isSupportedVideoUrl(location.href)) return;
    await this.runTask('读取视频信息', async () => {
      const provider = this.currentProvider();
      const previousVideo = this.state.video;
      const video = await this.readFreshVideoInfo(provider, previousVideo);
      const subtitleOptions = provider.getSubtitleOptions ? await provider.getSubtitleOptions(video) : [];
      const selectedSubtitleId = preferredSubtitleId(subtitleOptions, this.config.summary.language);
      const promptFingerprint = this.summaryPromptFingerprint();

      const cached = summaryCache.find(
        (summary) =>
          summary.video.source === video.source &&
          summary.video.sourceId === video.sourceId &&
          summary.promptId === this.config.summary.defaultPromptId &&
          summary.promptFingerprint === promptFingerprint &&
          summary.transcript.languageCode === selectedSubtitleId,
      );
      this.state = {
        ...createInitialState(),
        video,
        subtitleOptions,
        selectedSubtitleId,
        summary: cached,
        status: cached ? '已载入缓存摘要' : '已识别视频',
      };

      if (!cached && this.config.summary.autoRun && subtitleOptions.length > 0) {
        // Run generateSummary but don't await it to block the UI load
        setTimeout(() => this.generateSummary(), 0);
      }
    });
  }

  async generateSummary(): Promise<void> {
    await this.runTask('获取字幕', async () => {
      const provider = this.currentProvider();
      const video = this.state.video ?? (await provider.getVideoInfo());
      const subtitleOptions = this.state.subtitleOptions.length > 0
        ? this.state.subtitleOptions
        : (provider.getSubtitleOptions ? await provider.getSubtitleOptions(video) : []);
      const selectedSubtitleId =
        this.state.selectedSubtitleId ?? preferredSubtitleId(subtitleOptions, this.config.summary.language);
      const transcript = await provider.getTranscript(video, selectedSubtitleId);
      this.state.video = video;
      this.state.transcript = transcript;
      this.state.subtitleOptions = subtitleOptions;
      this.state.selectedSubtitleId = transcript.languageCode ?? selectedSubtitleId;
      this.state.summaryRequestPending = true;
      this.setStatus('生成摘要');
      const textAiClient = createTextAiClient(this.config.textAi);
      const summary = await runSummaryPipeline({
        video,
        transcript,
        textAiClient,
        config: this.config,
        onProgress: (message) => this.setStatus(message),
        onDelta: (partial) => {
          this.state.summaryRequestPending = false;
          const reasoningTiming = updateReasoningTiming(this.state.streamingSummary ?? {}, partial);
          this.state.streamingSummary = {
            video,
            transcript,
            promptId: this.config.summary.defaultPromptId,
            content: partial.content,
            reasoning: partial.reasoning,
            createdAt: Date.now(),
            ...reasoningTiming,
          };
          if (!this._pendingSummaryStreamUpdate) {
            this._pendingSummaryStreamUpdate = true;
            requestAnimationFrame(() => {
              this._pendingSummaryStreamUpdate = false;
              this.events.emit('streamchange');
            });
          }
        },
      });
      Object.assign(summary, finalizeReasoningTiming(this.state.streamingSummary ?? {}));
      this.state.summary = summary;
      this.state.streamingSummary = undefined;
      this.state.summaryRequestPending = false;
      summaryCache.set(this.summaryCacheKey(video, this.state.selectedSubtitleId), summary);
      this.setStatus('摘要已生成');
    });
  }


  async askSummaryQuestion(question: string): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!this.state.summary) {
      this.setStatus('请先生成摘要');
      return;
    }

    this.state.summaryChatHistory.push({ role: 'user', content: trimmed });
    this.state.streamingSummaryInsight = { role: 'assistant', content: '' };
    this.emit();

    await this.runTask('Summary Chat', async () => {
      const textClient = createTextAiClient(this.config.textAi);
      const summaryContent = this.state.summary!.content;

      if (isImageGenerationRequest(trimmed)) {
        const imagePrompt = buildOneImagePrompt(summaryContent, this.config);
        const imagePromptFingerprint = this.imagePromptFingerprint();
        const cacheKey = stableHash(
          `${this.state.summary!.video.source}:${this.state.summary!.video.sourceId}:${summaryContent}:${imageGenerationCacheIdentity(this.config.imageAi)}:${imagePromptFingerprint}`,
        );
        this.state.streamingSummaryInsight!.content = '正在呼叫画师，请稍候...';
        this.emit();

        try {
          const cached = imageCache.get(cacheKey);
          const imageResult = cached
            ? { dataUrl: cached.dataUrl, url: cached.url }
            : await createImageAiClient(this.config.imageAi).generateImage({
                model: this.config.imageAi.model,
                prompt: imagePrompt,
                size: this.config.imageAi.size,
                quality: this.config.imageAi.quality,
                responseFormat: this.config.imageAi.responseFormat,
                context: {
                  source: this.state.summary!.video.source,
                  sourceId: this.state.summary!.video.sourceId,
                },
              });
          this.state.streamingSummaryInsight!.content = '';
          this.state.streamingSummaryInsight!.generatedImage = imageResult;
          if (!cached) cacheGeneratedImage(imageCache, cacheKey, imageResult, imagePrompt);
        } catch (error) {
          const failureMessage = `生成图片失败: ${getErrorMessage(error)}`;
          this.state.streamingSummaryInsight!.content = failureMessage;
          this.setStatus(failureMessage, true);
        }

        this.state.summaryChatHistory.push(this.state.streamingSummaryInsight!);
        this.state.streamingSummaryInsight = undefined;
        return;
      }

      const answer = await askSummaryChat(
        textClient,
        this.config,
        this.state.summary!,
        this.state.summaryChatHistory,
        trimmed,
        {
          onDelta: (partial) => {
            const reasoningTiming = updateReasoningTiming(this.state.streamingSummaryInsight ?? {}, partial);
            this.state.streamingSummaryInsight = {
              role: 'assistant',
              content: partial.content,
              reasoning: partial.reasoning,
              ...reasoningTiming,
            };
            if (!this._pendingSummaryStreamUpdate) {
              this._pendingSummaryStreamUpdate = true;
              requestAnimationFrame(() => {
                this._pendingSummaryStreamUpdate = false;
                this.events.emit('streamchange');
              });
            }
          },
        },
      );
      const reasoningTiming = finalizeReasoningTiming(this.state.streamingSummaryInsight ?? {});
      this.state.summaryChatHistory.push({
        role: 'assistant',
        content: answer.content,
        reasoning: answer.reasoning,
        ...reasoningTiming,
      });
      this.state.streamingSummaryInsight = undefined;
    });
  }


  async copySummary(text?: string): Promise<void> {
    const content = text ?? this.state.summary?.content;
    if (!content) return;
    try {
      if (typeof GM_setClipboard === 'function') GM_setClipboard(content);
      else await navigator.clipboard?.writeText(content);
      this.setStatus('摘要已复制');
    } catch (error) {
      this.setStatus(`摘要复制失败：${getErrorMessage(error)}`);
    }
  }

  exportSummaryMarkdown(): void {
    const summary = this.state.summary;
    if (!summary) return;
    const blob = new Blob([buildSummaryMarkdown(summary)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = summaryMarkdownFileName(summary.video.title);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    this.setStatus('MarkDown 已导出');
  }

  downloadGeneratedImage(image: GeneratedImage): void {
    const href = generatedImageHref(image);
    if (!href) {
      this.setStatus('图片下载失败：没有可用图片');
      return;
    }
    const link = document.createElement('a');
    link.href = href;
    link.download = `${sanitizeFileName(this.state.video?.title ?? 'video-lens')}.png`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.click();
    this.setStatus('图片已下载');
  }

  updateConfig(patch: Partial<LocalConfig>, options: { showStatus?: boolean } = {}): void {
    const previousSummaryLanguage = this.config.summary.language;
    this.config = { ...this.config, ...patch };
    saveConfig(this.config);
    if (patch.summary?.language && patch.summary.language !== previousSummaryLanguage) {
      this.state.selectedSubtitleId = preferredSubtitleId(
        this.state.subtitleOptions,
        patch.summary.language,
      );
      this.state.transcript = undefined;
    }
    if (options.showStatus ?? true) this.setStatus('设置已保存');
    else this.emit();
  }

  async testTextConnection(): Promise<void> {
    if (!this.config.textAi.apiKey.trim()) {
      this.setStatus('请先在设置中填写文本模型 API Key');
      return;
    }
    if (!this.config.textAi.model.trim()) {
      this.setStatus('请填写文本模型名称');
      return;
    }
    if (!this.config.textAi.apiUrl.trim()) {
      this.setStatus('请填写文本模型 Base URL');
      return;
    }
    await this.runTask('测试文本模型连通性', async () => {
      await createTextAiClient({ ...this.config.textAi, requestMode: 'auto' }).complete({
        model: this.config.textAi.model,
        messages: [{ role: 'user', content: TEXT_CONNECTIVITY_TEST_PROMPT }],
        temperature: 0,
        maxTokens: 8,
        stream: false,
      });
      this.setStatus('文本模型连通性正常');
    });
  }

  async testImageConnection(): Promise<void> {
    if (this.config.imageAi.mode === 'chatgpt_web') {
      try {
        normalizeChatGptProjectUrl(this.config.imageAi.chatgptConversationUrl);
      } catch (error) {
        this.setStatus(getErrorMessage(error));
        return;
      }
      await this.runTask('测试 ChatGPT 网页接收端', async () => {
        if (!getLiveChatGptImageReceiver(this.config.imageAi.chatgptConversationUrl)) {
          throw new Error('未检测到 ChatGPT Project 接收端，请打开 Project 根页并刷新');
        }
        this.setStatus('ChatGPT Project 接收端在线');
      });
      return;
    }
    if (!this.config.imageAi.apiKey.trim()) {
      this.setStatus('请先在设置中填写图片模型 API Key');
      return;
    }
    if (!this.config.imageAi.model.trim()) {
      this.setStatus('请填写生图模型名称');
      return;
    }
    if (!this.config.imageAi.apiUrl.trim()) {
      this.setStatus('请填写生图模型 API URL');
      return;
    }
    await this.runTask('测试生图模型连通性', async () => {
      await createImageAiClient({ ...this.config.imageAi, requestMode: 'auto' }).generateImage({
        model: this.config.imageAi.model,
        prompt: IMAGE_CONNECTIVITY_TEST_PROMPT,
        size: this.config.imageAi.size,
        quality: this.config.imageAi.quality,
        responseFormat: this.config.imageAi.responseFormat,
        n: 1,
      });
      this.setStatus('生图模型连通性正常');
    });
  }

  clearCurrentSummaryCache(): void {
    const video = this.state.video;
    if (video) summaryCache.delete(this.summaryCacheKey(video, this.state.selectedSubtitleId));
    this.state.summary = undefined;
    this.state.streamingSummary = undefined;
    this.state.summaryRequestPending = false;
    this.state.summaryChatHistory = [];
    this.state.streamingSummaryInsight = undefined;
    this.setStatus('已清除此视频缓存');
  }

  clearAllCaches(): void {
    summaryCache.clear();
    imageCache.clear();
    this.state.summary = undefined;
    this.state.streamingSummary = undefined;
    this.state.summaryRequestPending = false;
    this.state.summaryChatHistory = [];
    this.state.streamingSummaryInsight = undefined;
    this.setStatus('已清空全部缓存');
  }

  toggleCollapsed(): void {
    this.config = { ...this.config, ui: { ...this.config.ui, collapsed: !this.config.ui.collapsed } };
    this.emit();
  }

  async openFromLauncher(): Promise<void> {
    if (!this.config.ui.collapsed) return;
    this.config = { ...this.config, ui: { ...this.config.ui, collapsed: false } };
    this.emit();
    if (this.state.busy) return;
    if (this.state.summary) return;
    if (await this.restoreCachedSummary()) return;
    await this.generateSummary();
  }

  updateLauncherPosition(position: { x: number; y: number }): void {
    this.config = { ...this.config, ui: { ...this.config.ui, launcherPosition: position } };
    saveConfig(this.config);
    this.emit();
  }

  updateSelectedSubtitle(subtitleId: string): void {
    this.state.selectedSubtitleId = subtitleId;
    this.emit();
  }

  async restoreCachedSummary(): Promise<boolean> {
    const video = this.state.video ?? (await this.currentProvider().getVideoInfo());
    const exact = summaryCache.get(this.summaryCacheKey(video, this.state.selectedSubtitleId));
    const cached =
      exact ??
      summaryCache.find(
        (summary) =>
          summary.video.source === video.source &&
          summary.video.sourceId === video.sourceId &&
          summary.promptId === this.config.summary.defaultPromptId &&
          summary.promptFingerprint === this.summaryPromptFingerprint(),
      );
    if (!cached) return false;
    this.state.video = video;
    this.state.summary = cached;
    this.setStatus('已载入缓存摘要');
    return true;
  }

  private async runTask(label: string, task: () => Promise<void>): Promise<void> {
    this.state.busy = true;
    this.setStatus(label);
    try {
      await task();
    } catch (error) {
      logger.error(error);
      this.state.summaryRequestPending = false;
      this.state.streamingSummaryInsight = undefined;
      this.setStatus(getErrorMessage(error), true);
    } finally {
      this.state.busy = false;
      this.emit();
    }
  }

  private setStatus(status: string, forceToast = false): void {
    this.state.status = status;
    if (forceToast || shouldToastStatus(status)) this.showToast(status);
    this.emit();
  }

  private showToast(message: string): void {
    this.toastId += 1;
    const id = this.toastId;
    this.state.toast = { id, message };
    if (this.toastTimer) globalThis.clearTimeout(this.toastTimer);
    this.toastTimer = globalThis.setTimeout(() => {
      if (this.state.toast?.id !== id) return;
      this.state.toast = undefined;
      this.emit();
    }, TOAST_DURATION_MS);
  }

  private emit(): void {
    this.events.emit('statechange');
  }

  private currentProvider(): VideoSourceProvider {
    return getActiveProvider(location.href, () => this.config);
  }

  private async readFreshVideoInfo(provider: VideoSourceProvider, previousVideo: VideoInfo | undefined): Promise<VideoInfo> {
    let video = await provider.getVideoInfo();
    if (!previousVideo || previousVideo.url === location.href || previousVideo.source !== video.source) return video;
    for (let attempt = 0; attempt < 8 && video.sourceId === previousVideo.sourceId; attempt += 1) {
      await sleep(150);
      video = await provider.getVideoInfo();
    }
    return video;
  }

  private summaryCacheKey(videoOrSourceId: VideoInfo | string, subtitleId?: string): string {
    const video =
      typeof videoOrSourceId === 'string'
        ? { source: this.state.video?.source ?? 'bilibili', sourceId: videoOrSourceId }
        : videoOrSourceId;
    return stableHash(
      `${video.source}:${video.sourceId}:${this.config.summary.defaultPromptId}:${this.summaryPromptFingerprint()}:${this.config.textAi.model}:${this.config.summary.language}:${subtitleId ?? ''}`,
    );
  }

  private summaryPromptFingerprint(): string {
    return resolveSummaryPrompt(
      this.config.summary.defaultPromptId,
      this.config.prompts.customPresets,
      this.config.summary.language,
    ).fingerprint;
  }

  private imagePromptFingerprint(): string {
    return resolveImagePrompt(
      this.config.imageAi.promptId,
      this.config.prompts.customPresets,
      this.config.summary.language,
    ).fingerprint;
  }
}

const TOAST_DURATION_MS = 3600;

const TOAST_STATUSES = new Set([
  '已载入缓存摘要',
  '已识别视频',
  '摘要已生成',
  '已回答',
  '请先生成摘要',
  '摘要已复制',
  '已清除此视频缓存',
  '已清空全部缓存',
  '文本模型连通性正常',
  '生图模型连通性正常',
  'ChatGPT 网页接收端在线',
  'MarkDown 已导出',
  '设置已保存',
]);

export function shouldToastStatus(status: string): boolean {
  return TOAST_STATUSES.has(status) || /失败|错误|failed|error/i.test(status);
}

function preferredSubtitleId(options: Array<{ id: string }>, language: LocalConfig['summary']['language']): string | undefined {
  if (language === 'en-US') return options.find((item) => item.id.toLowerCase().startsWith('en'))?.id;
  return options.find((item) => item.id === 'zh-CN')?.id ?? options.find((item) => item.id.toLowerCase().startsWith('zh'))?.id;
}

export function buildSummaryMarkdown(summary: SummaryResult): string {
  const lines = [
    `# ${summary.video.title}`,
    '',
    `- Creator: ${summary.video.creatorName ?? summary.video.upName ?? summary.video.platform ?? summary.video.source}`,
    `- Platform: ${summary.video.platform ?? summary.video.source}`,
    `- 原链接: ${summary.video.url}`,
    `- 生成时间: ${new Date(summary.createdAt).toLocaleString()}`,
    '',
    summary.content.trim(),
    '',
  ];
  return lines.join('\n');
}

export function summaryMarkdownFileName(title: string): string {
  return `${sanitizeFileName(title || 'video-lens')}.md`;
}

export function generatedImageHref(image: GeneratedImage): string {
  return image.dataUrl ?? image.url ?? '';
}

export function cacheGeneratedImage(
  cache: { set: (key: string, value: { dataUrl?: string; url?: string; prompt: string }) => void },
  key: string,
  image: GeneratedImage,
  prompt: string,
): void {
  try {
    cache.set(key, { dataUrl: image.dataUrl, url: image.url, prompt });
  } catch {
    // Cache failures must not discard an image that was generated successfully.
  }
}

export function imageGenerationCacheIdentity(config: LocalConfig['imageAi']): string {
  return config.mode === 'chatgpt_web'
    ? `chatgpt_web:${normalizeChatGptProjectUrl(config.chatgptConversationUrl)}:${config.size}`
    : `api:${config.apiUrl}:${config.model}:${config.size}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
