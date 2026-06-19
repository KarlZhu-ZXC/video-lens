import { DirectOpenAIImageClient } from '../ai/image/DirectOpenAIImageClient';
import { DirectOpenAITextClient } from '../ai/text/DirectOpenAITextClient';
import { runOnePagePipeline } from '../onePage/onePagePipeline';
import { getActiveProvider, isSupportedVideoUrl } from '../sources/providers';
import { watchVideoRouteChange } from '../sources/routeWatcher';
import type { VideoInfo, VideoSourceProvider } from '../sources/VideoSourceProvider';
import { loadConfig, saveConfig } from '../store/configStore';
import { imageCache } from '../store/imageCache';
import { summaryCache } from '../store/summaryCache';
import type { LocalConfig } from '../store/types';
import { askVideoInsight } from '../summary/videoInsightsPipeline';
import { runSummaryPipeline } from '../summary/summaryPipeline';
import type { SummaryResult } from '../summary/types';
import { getErrorMessage } from '../utils/errors';
import { stableHash } from '../utils/hash';
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
      const cached = summaryCache.find(
        (summary) =>
          summary.video.source === video.source &&
          summary.video.sourceId === video.sourceId &&
          summary.promptId === this.config.summary.defaultPromptId &&
          summary.transcript.languageCode === this.state.selectedSubtitleId,
      );
      this.state = { ...createInitialState(), video, summary: cached, status: cached ? '已载入缓存摘要' : '已识别视频' };
    });
  }

  async generateSummary(): Promise<void> {
    await this.runTask('获取字幕', async () => {
      const provider = this.currentProvider();
      const video = this.state.video ?? (await provider.getVideoInfo());
      const subtitleOptions = provider.getSubtitleOptions ? await provider.getSubtitleOptions(video) : [];
      const selectedSubtitleId =
        this.state.selectedSubtitleId ?? preferredSubtitleId(subtitleOptions, this.config.summary.language);
      const transcript = await provider.getTranscript(video, selectedSubtitleId);
      this.state.video = video;
      this.state.transcript = transcript;
      this.state.subtitleOptions = subtitleOptions;
      this.state.selectedSubtitleId = transcript.languageCode ?? selectedSubtitleId;
      this.state.summaryRequestPending = true;
      this.setStatus('生成摘要');
      const textAiClient = new DirectOpenAITextClient(this.config.textAi);
      const summary = await runSummaryPipeline({
        video,
        transcript,
        textAiClient,
        config: this.config,
        onProgress: (message) => this.setStatus(message),
        onDelta: (partial) => {
          this.state.summaryRequestPending = false;
          this.state.streamingSummary = {
            video,
            transcript,
            promptId: this.config.summary.defaultPromptId,
            content: partial.content,
            reasoning: partial.reasoning,
            createdAt: Date.now(),
          };
          this.emit();
        },
      });
      this.state.summary = summary;
      this.state.streamingSummary = undefined;
      this.state.summaryRequestPending = false;
      summaryCache.set(this.summaryCacheKey(video, this.state.selectedSubtitleId), summary);
      this.setStatus('摘要已生成');
    });
  }

  async askQuestion(question: string): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!this.state.summary) {
      await this.generateSummary();
      if (!this.state.summary) {
        this.setStatus('请先生成摘要');
        return;
      }
    }

    this.state.videoInsightsHistory.push({ role: 'user', content: trimmed });
    this.state.streamingVideoInsight = { role: 'assistant', content: '' };
    this.emit();

    await this.runTask('Video Insights', async () => {
      const answer = await askVideoInsight(
        new DirectOpenAITextClient(this.config.textAi),
        this.config,
        this.state.summary!,
        this.state.videoInsightsHistory,
        trimmed,
        {
          onDelta: (partial) => {
            this.state.streamingVideoInsight = {
              role: 'assistant',
              content: partial.content,
              reasoning: partial.reasoning,
            };
            this.emit();
          },
        },
      );
      this.state.videoInsightsHistory.push({ role: 'assistant', content: answer.content, reasoning: answer.reasoning });
      this.state.streamingVideoInsight = undefined;
      this.setStatus('已回答');
    });
  }

  async generateOneImage(options: { force?: boolean } = {}): Promise<void> {
    if (!this.state.summary) {
      const restored = await this.restoreCachedSummary();
      if (!restored) {
        this.setStatus('请先生成摘要');
        return;
      }
    }

    await this.runTask('生成一图流', async () => {
      const result = await runOnePagePipeline({
        summary: this.state.summary!,
        imageAiClient: new DirectOpenAIImageClient(this.config.imageAi),
        config: this.config,
        force: options.force,
        onProgress: (event) => this.setStatus(progressLabel(event.type)),
      });
      this.state.generatedImage = result.generatedImage;
      this.setStatus('一图流已生成');
    });
  }

  async generateOnePage(): Promise<void> {
    await this.generateOneImage();
  }

  async exportOneImage(): Promise<void> {
    if (!this.state.generatedImage) {
      await this.generateOneImage();
      if (!this.state.generatedImage) return;
    }
    const image = this.state.generatedImage;
    const href = image.dataUrl ?? image.url ?? (image.blob ? URL.createObjectURL(image.blob) : '');
    if (!href) throw new Error('没有可导出的图片');
    const link = document.createElement('a');
    link.href = href;
    link.download = `${sanitizeFileName(this.state.video?.title ?? 'video-summary')}.png`;
    link.click();
    if (image.blob) window.setTimeout(() => URL.revokeObjectURL(href), 0);
    this.setStatus('PNG 已导出');
  }

  async copySummary(): Promise<void> {
    const content = this.state.summary?.content;
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

  updateConfig(patch: Partial<LocalConfig>, options: { showStatus?: boolean } = {}): void {
    const previousSummaryLanguage = this.config.summary.language;
    this.config = { ...this.config, ...patch };
    saveConfig(this.config);
    if (patch.summary?.language && patch.summary.language !== previousSummaryLanguage) {
      this.state.selectedSubtitleId = undefined;
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
      await new DirectOpenAITextClient({ ...this.config.textAi, requestMode: 'auto' }).complete({
        model: this.config.textAi.model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        temperature: 0,
        maxTokens: 8,
        stream: false,
      });
      this.setStatus('文本模型连通性正常');
    });
  }

  async testImageConnection(): Promise<void> {
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
      await new DirectOpenAIImageClient({ ...this.config.imageAi, requestMode: 'auto' }).generateImage({
        model: this.config.imageAi.model,
        prompt: 'Connectivity test image. Simple neutral abstract background, no text, no logo.',
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
    this.setStatus('已清除此视频缓存');
  }

  clearAllCaches(): void {
    summaryCache.clear();
    imageCache.clear();
    this.state.summary = undefined;
    this.state.streamingSummary = undefined;
    this.state.generatedImage = undefined;
    this.setStatus('已清空全部缓存');
  }

  toggleCollapsed(): void {
    this.config = { ...this.config, ui: { ...this.config.ui, collapsed: !this.config.ui.collapsed } };
    this.emit();
  }

  async openFromLauncher(): Promise<void> {
    if (!this.config.ui.collapsed || this.state.busy) return;
    this.config = { ...this.config, ui: { ...this.config.ui, collapsed: false } };
    this.emit();
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
          summary.promptId === this.config.summary.defaultPromptId,
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
      this.state.streamingVideoInsight = undefined;
      this.setStatus(getErrorMessage(error));
    } finally {
      this.state.busy = false;
      this.emit();
    }
  }

  private setStatus(status: string): void {
    this.state.status = status;
    if (shouldToastStatus(status)) this.showToast(status);
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
      `${video.source}:${video.sourceId}:${this.config.summary.defaultPromptId}:${this.config.textAi.model}:${this.config.summary.language}:${subtitleId ?? ''}`,
    );
  }
}

const TOAST_DURATION_MS = 3600;

const TOAST_STATUSES = new Set([
  '已载入缓存摘要',
  '已识别视频',
  '摘要已生成',
  '已回答',
  '请先生成摘要',
  '一图流已生成',
  'PNG 已导出',
  '摘要已复制',
  '已清除此视频缓存',
  '已清空全部缓存',
  '文本模型连通性正常',
  '生图模型连通性正常',
  'MarkDown 已导出',
  '设置已保存',
]);

export function shouldToastStatus(status: string): boolean {
  return TOAST_STATUSES.has(status) || /失败|错误|failed|error/i.test(status);
}

function progressLabel(type: string): string {
  const labels: Record<string, string> = {
    preparing_prompt: '准备生图提示词',
    generating_image: '生成一图流图片',
    done: '一图流已生成',
  };
  return labels[type] ?? type;
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
  return `${sanitizeFileName(title || 'video-summary')}.md`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
