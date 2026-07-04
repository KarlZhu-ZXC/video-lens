import { describe, expect, it, vi } from 'vitest';
import { chunkText } from '../src/ai/chunking';
import {
  normalizeImageRequestSize,
  normalizeImageResponseFormat,
  parseGeneratedImage,
  sanitizeImagePrompt,
} from '../src/ai/image/DirectOpenAIImageClient';
import { buildChatCompletionsPayload, normalizeChatCompletionsUrl } from '../src/ai/text/DirectOpenAITextClient';
import { normalizeAnthropicUrl } from '../src/ai/text/AnthropicTextClient';
import { applyTextConfig, normalizeApiKey, normalizeOpenAIBaseUrl } from '../src/ai/text/providers';
import { createAnthropicStreamParser, createOpenAIStreamParser, parseOpenAIStreamDeltas } from '../src/ai/text/streamParser';
import type { TextAiClient } from '../src/ai/text/TextAiClient';
import { bindPanelRendering, TinyEmitter } from '../src/app/events';
import {
  AppController,
  buildSummaryMarkdown,
  cacheGeneratedImage,
  generatedImageHref,
  imageGenerationCacheIdentity,
  shouldToastStatus,
  summaryMarkdownFileName,
} from '../src/app/AppController';

import { BUILT_IN_PROMPTS, getPromptTemplate } from '../src/prompts/defaultPrompts';
import * as V2Prompts from '../src/prompts/defaultPrompts.v2';
import { renderPrompt } from '../src/prompts/renderPrompt';
import {
  DEFAULT_CONFIG,
  loadConfig,
  mergeConfigForTest,
  saveConfig,
  stripSensitiveConfigForStorage,
} from '../src/store/configStore';
import {
  CONFIG_KEY,
  LEGACY_CONFIG_KEY,
  LEGACY_SUMMARY_CACHE_KEY,
  SUMMARY_CACHE_KEY,
} from '../src/store/types';
import { makeJsonCache } from '../src/store/makeJsonCache';
import { summaryCache } from '../src/store/summaryCache';
import { estimateSummaryMaxTokens, runSummaryPipeline } from '../src/summary/summaryPipeline';
import { askSummaryChat, buildOneImagePrompt, isImageGenerationRequest } from '../src/summary/chatPipeline';
import { extractThinkBlocks } from '../src/summary/think';
import {
  finalizeReasoningTiming,
  formatReasoningDuration,
  updateReasoningTiming,
} from '../src/summary/reasoningTiming';
import { getStatusText, getUiText } from '../src/ui/i18n';
import { reasoningDisclosureState } from '../src/ui/aiResponse';
import {
  clampPanelWidth,
  isDocumentFullscreen,
  panelIconPaths,
  resolveSummaryScrollTop,
  shouldApplySummaryScrollCorrection,
  SUMMARY_SCROLL_SELECTOR,
} from '../src/ui/panel';
import { shouldLeaveSettingsTab } from '../src/ui/panel';
import * as PanelModule from '../src/ui/panel';
import {
  formatTranscriptLanguage,
  formatCompactCount,
  hasRenderableSummaryOutput,
  FIXED_FOLLOW_UP_INTENTS,
  selectedSubtitleLabel,
  shouldRenderSubtitleSelect,
  shouldShowFollowUpIntents,
  videoStatItems,
  shouldShowSummaryToolbar,
  shouldSubmitComposerOnKeydown,
  summaryComposerState,
  SUMMARY_CONTEXT_ORDER,
  videoMetadataItems,
  videoMetadataIconSpec,
} from '../src/ui/summaryView';
import { isVideoLensHistoryWrapper } from '../src/sources/bilibili/routeWatcher';
import { CONNECTION_TEST_LABEL, resolveSecretInput, resolveSecretValueForSave } from '../src/ui/settingsModal';
import * as SettingsModal from '../src/ui/settingsModal';
import { normalizeAssetUrl } from '../src/utils/url';
import { DEV_HARNESS_COMMAND, HARNESS_ENTRY_SCRIPT } from '../src/harness/constants';
import { PANEL_STYLES } from '../src/ui/styles';
import {
  IMAGE_PREVIEW_ACTIONS,
  IMAGE_PREVIEW_SCALES,
  imagePreviewTransform,
  nextImagePreviewScale,
} from '../src/ui/imagePreview';
import { getActiveProvider, isSupportedVideoUrl } from '../src/sources/providers';
import {
  extractYoutubeVideoId,
  parseYoutubeCaptionTracks,
  parseYoutubePlayerResponse,
  readYoutubePlayerResponse,
  readYoutubePlayerResponseFromHtml,
} from '../src/sources/youtube/videoInfo';
import { getYoutubeVideoFromOfficialApi } from '../src/sources/youtube/officialApi';
import {
  fetchBilibiliFollowerCount,
  parseBilibiliPageFollowers,
  parseBilibiliStats,
} from '../src/sources/bilibili/videoInfo';
import {
  buildTargetLanguageTranslatedTracks,
  getYoutubeSubtitleOptions,
  getYoutubeTranscript,
  parseYoutubeJson3Transcript,
  parseYoutubeVttTranscript,
  parseYoutubeXmlTranscript,
  selectYoutubeCaptionTrack,
} from '../src/sources/youtube/subtitle';

describe('renderPrompt', () => {
  it('renders compatible localized prompt templates', () => {
    expect(renderPrompt('标题：{{title}} 作者：{{upName}} 空：{{missing}}', { title: '测试视频' })).toBe(
      '标题：测试视频 作者： 空：',
    );
    expect(
      renderPrompt('创作者：{{creatorName}} / {{upName}} 平台：{{platform}}', {
        creatorName: 'Demo Creator',
        platform: 'YouTube',
      }),
    ).toBe('创作者：Demo Creator / Demo Creator 平台：YouTube');
    const textPromptTypes = new Set(['summary', 'chunk_summary', 'merge_summary', 'video_insights']);
    const prompts = BUILT_IN_PROMPTS.filter((prompt) => textPromptTypes.has(prompt.type));

    expect(prompts.every((prompt) => Boolean(prompt.enTemplate))).toBe(true);
    expect(getPromptTemplate(prompts[0], 'en-US')).not.toBe(prompts[0].template);

    expect(Array.isArray(V2Prompts.BUILT_IN_PROMPTS)).toBe(false);
    const v2PromptMap = V2Prompts.BUILT_IN_PROMPTS as unknown as Record<string, { id: string }>;
    expect(v2PromptMap.summary_plain.id).toBe('summary_plain');
    const v2SummaryPrompts = V2Prompts.getSummaryPromptPresets();
    expect(v2SummaryPrompts.map((prompt) => prompt.id)).toEqual([
      'summary_plain',
      'summary_detailed',
      'summary_critical',
      'summary_action',
      'summary_timeline',
    ]);
    expect(v2SummaryPrompts.every((prompt) => prompt.template.includes('{{transcript}}'))).toBe(true);
    expect(v2SummaryPrompts.every((prompt) => Boolean(prompt.enTemplate?.includes('{{transcript}}')))).toBe(true);
  });

  it('formats timeline prompts only from real subtitle ranges', async () => {
    const formatTranscriptWithTimeline = (
      V2Prompts as unknown as {
        formatTranscriptWithTimeline: (transcript: {
          lines: Array<{ from: number; to: number; text: string }>;
          plainText: string;
          charCount: number;
        }) => string;
      }
    ).formatTranscriptWithTimeline;

    expect(formatTranscriptWithTimeline({
      lines: [
        { from: 5, to: 9.5, text: '第一点' },
        { from: 65, to: 70, text: '第二点' },
      ],
      plainText: '第一点 第二点',
      charCount: 7,
    })).toBe('[00:05-00:10] 第一点\n[01:05-01:10] 第二点');

    const resolveSummaryPrompt = (
      V2Prompts as unknown as {
        resolveSummaryPrompt: (
          id: string,
          custom: Array<{
            id: string;
            name: string;
            type: 'summary';
            template: string;
            builtIn: boolean;
          }>,
          language: 'zh-CN' | 'en-US',
        ) => { template: string; fingerprint: string };
      }
    ).resolveSummaryPrompt;
    const customBase = {
      id: 'summary_custom',
      name: '自定义',
      type: 'summary' as const,
      builtIn: false,
    };
    const first = resolveSummaryPrompt('summary_custom', [{ ...customBase, template: '版本 A：{{transcript}}' }], 'zh-CN');
    const second = resolveSummaryPrompt('summary_custom', [{ ...customBase, template: '版本 B：{{transcript}}' }], 'zh-CN');
    expect(first.template).toBe('版本 A：{{transcript}}');
    expect(second.fingerprint).not.toBe(first.fingerprint);

    let timelineRequest = '';
    const timelineResult = await runSummaryPipeline({
      video: {
        source: 'bilibili',
        sourceId: 'BV-timeline',
        title: '时间轴视频',
        url: 'https://www.bilibili.com/video/BV-timeline',
      },
      transcript: {
        lines: [{ from: 5, to: 9.5, text: '第一点' }],
        plainText: '第一点',
        charCount: 3,
      },
      textAiClient: {
        async complete(request) {
          timelineRequest = request.messages[0].content;
          return { content: '时间轴摘要' };
        },
      },
      config: {
        ...DEFAULT_CONFIG,
        summary: { ...DEFAULT_CONFIG.summary, defaultPromptId: 'summary_timeline' },
      },
    });
    expect(timelineRequest).toContain('[00:05-00:10] 第一点');
    expect(timelineResult).toMatchObject({ promptId: 'summary_timeline' });
    expect(timelineResult.promptFingerprint).toBeTruthy();
  });
});

describe('chunkText', () => {
  it('splits long text with overlap and max chunk limit', () => {
    const chunks = chunkText('abcdefghijklmnop', { targetChars: 6, overlapChars: 2, maxChunks: 3 });
    expect(chunks).toEqual(['abcdef', 'efghij', 'ijklmn']);
  });
});

describe('parseOpenAIStreamDeltas', () => {
  it('parses reasoning, partial lines, and compact SSE fields', () => {
    const deltas = parseOpenAIStreamDeltas(
      [
        'data: {"choices":[{"delta":{"reasoning_content":"想一下","content":""}}]}',
        'data: {"choices":[{"delta":{"content":"# 结论"}}]}',
        'data: [DONE]',
      ].join('\n'),
    );
    expect(deltas).toEqual([
      { content: '', reasoning: '想一下' },
      { content: '# 结论', reasoning: '' },
    ]);
    const parse = createOpenAIStreamParser();
    expect(parse('data: {"choices":[{"delta":{"content":"Hel')).toEqual([]);
    expect(parse('lo"}}]}\n')).toEqual([{ content: 'Hello', reasoning: '' }]);
    expect(parseOpenAIStreamDeltas('data:{"choices":[{"delta":{"content":"ok"}}]}')[0]?.content).toBe('ok');
  });
});

describe('Anthropic stream parsing', () => {
  it('parses split text deltas', () => {
    const parse = createAnthropicStreamParser();
    expect(parse('data:{"type":"content_block_delta","delta":{"type":"text_')).toEqual([]);
    expect(parse('delta","text":"hello"}}\n')).toEqual([{ content: 'hello', reasoning: '' }]);
  });
});

describe('app event rendering', () => {
  it('routes structural and streaming changes to separate render callbacks', () => {
    const events = new TinyEmitter();
    let stateRenders = 0;
    let streamRenders = 0;
    const unbind = bindPanelRendering(
      events,
      () => { stateRenders += 1; },
      () => { streamRenders += 1; },
    );

    events.emit('statechange');
    events.emit('streamchange');
    unbind();
    events.emit('streamchange');

    expect(stateRenders).toBe(1);
    expect(streamRenders).toBe(1);
  });
});

describe('summary max tokens', () => {
  it('scales with transcript length and keeps a higher floor', () => {
    expect(estimateSummaryMaxTokens(2000, 2000)).toBe(3000);
    expect(estimateSummaryMaxTokens(2000, 20000)).toBe(9000);
  });
});

describe('long summary streaming', () => {
  it('does not publish chunk previews but streams the merge step to the UI', async () => {
    const deltas: Array<{ content: string; reasoning?: string }> = [];
    const client: TextAiClient = {
      async complete(request, options) {
        const content = request.messages[0].content;
        if (content.includes('第 1 /')) return { content: '第一段摘要' };
        if (content.includes('第 2 /')) return { content: '第二段摘要' };
        request.stream && options?.onDelta?.({ content: '', reasoning: '正在合并' });
        request.stream && options?.onDelta?.({ content: '# 合并结果' });
        return { content: '# 合并结果' };
      },
    };

    const result = await runSummaryPipeline({
      video: {
        source: 'bilibili',
        sourceId: 'BV-long',
        bvid: 'BV-long',
        cid: 1,
        title: '长视频',
        url: 'https://www.bilibili.com/video/BV-long',
      },
      transcript: { plainText: `${'a'.repeat(20)} ${'b'.repeat(20)}`, lines: [], charCount: 41 },
      textAiClient: client,
      config: { ...DEFAULT_CONFIG, summary: { ...DEFAULT_CONFIG.summary, chunkTargetChars: 10, chunkOverlapChars: 0, maxChunks: 2 } },
      onDelta: (partial) => deltas.push(partial),
    });

    // Chunk previews stay hidden (no deltas with "第一段摘要" / "第二段摘要"), but the merge step streams its deltas.
    expect(deltas.map((d) => d.content).join('')).toBe('# 合并结果');
    expect(deltas.some((d) => (d.reasoning ?? '').includes('正在合并'))).toBe(true);
    expect(result.content).toBe('# 合并结果');
  });

  it('runs at most two chunk requests concurrently and merges them in source order', async () => {
    let active = 0;
    let maxActive = 0;
    let mergePrompt = '';
    const progress: string[] = [];
    const deltas: string[] = [];
    const client: TextAiClient = {
      async complete(request) {
        const content = request.messages[0].content;
        const chunk = /第 (\d+) \/ 3 段字幕/.exec(content);
        if (!chunk) {
          mergePrompt = content;
          return { content: '合并完成' };
        }
        const index = Number(chunk[1]);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, index === 1 ? 30 : 5));
        active -= 1;
        return { content: `第${index}段摘要` };
      },
    };

    await runSummaryPipeline({
      video: { source: 'bilibili', sourceId: 'BV-concurrent', title: '并发', url: 'https://bilibili.com/video/BV-concurrent' },
      transcript: { plainText: 'a'.repeat(30), lines: [], charCount: 30 },
      textAiClient: client,
      config: {
        ...DEFAULT_CONFIG,
        summary: {
          ...DEFAULT_CONFIG.summary,
          defaultPromptId: 'summary_detailed',
          chunkTargetChars: 10,
          chunkOverlapChars: 0,
          maxChunks: 3,
        },
      },
      onProgress: (message) => progress.push(message),
      onDelta: (partial) => deltas.push(partial.content),
    });

    expect(maxActive).toBe(2);
    expect(progress).toEqual([
      '已完成 1/3 段字幕摘要',
      '已完成 2/3 段字幕摘要',
      '已完成 3/3 段字幕摘要',
      '合并长视频摘要',
    ]);
    expect(mergePrompt.indexOf('第1段摘要')).toBeLessThan(mergePrompt.indexOf('第2段摘要'));
    expect(mergePrompt.indexOf('第2段摘要')).toBeLessThan(mergePrompt.indexOf('第3段摘要'));
    expect(mergePrompt).toContain('## 主题概述');
    expect(deltas).toEqual([]);
  });

  it('retries an empty chunk once and rejects a second empty result', async () => {
    let firstChunkAttempts = 0;
    const retryingClient: TextAiClient = {
      async complete(request) {
        const content = request.messages[0].content;
        if (content.includes('第 1 / 2 段字幕')) {
          firstChunkAttempts += 1;
          return { content: firstChunkAttempts === 1 ? '  ' : '第一段摘要' };
        }
        if (content.includes('第 2 / 2 段字幕')) return { content: '第二段摘要' };
        return { content: '合并摘要' };
      },
    };
    const input = {
      video: { source: 'bilibili' as const, sourceId: 'BV-retry', title: '重试', url: 'https://bilibili.com/video/BV-retry' },
      transcript: { plainText: 'a'.repeat(20), lines: [], charCount: 20 },
      config: { ...DEFAULT_CONFIG, summary: { ...DEFAULT_CONFIG.summary, chunkTargetChars: 10, chunkOverlapChars: 0, maxChunks: 2 } },
    };

    await expect(runSummaryPipeline({ ...input, textAiClient: retryingClient })).resolves.toMatchObject({
      content: '合并摘要',
    });
    expect(firstChunkAttempts).toBe(2);

    const emptyClient: TextAiClient = {
      async complete(request) {
        return request.messages[0].content.includes('第 1 / 2 段字幕')
          ? { content: '' }
          : { content: '第二段摘要' };
      },
    };
    await expect(runSummaryPipeline({ ...input, textAiClient: emptyClient })).rejects.toThrow(
      '第 1/2 段未返回摘要内容',
    );
  });

  it('retries an incomplete merge and returns only the complete overall summary', async () => {
    let mergeAttempts = 0;
    const client: TextAiClient = {
      async complete(request) {
        const content = request.messages[0].content;
        if (content.includes('第 1 / 2 段字幕')) return { content: '第一段摘要' };
        if (content.includes('第 2 / 2 段字幕')) return { content: '第二段摘要' };
        mergeAttempts += 1;
        return { content: mergeAttempts === 1 ? '第 1/2 段字幕内容总结：第一段摘要' : '完整整体摘要' };
      },
    };
    const result = await runSummaryPipeline({
      video: { source: 'bilibili', sourceId: 'BV-fallback', title: '回退', url: 'https://bilibili.com/video/BV-fallback' },
      transcript: { plainText: 'a'.repeat(20), lines: [], charCount: 20 },
      textAiClient: client,
      config: { ...DEFAULT_CONFIG, summary: { ...DEFAULT_CONFIG.summary, chunkTargetChars: 10, chunkOverlapChars: 0, maxChunks: 2 } },
    });

    expect(mergeAttempts).toBe(2);
    expect(result.content).toBe('完整整体摘要');
  });

  it('resets the streaming surface between merge retries so old reasoning does not leak in', async () => {
    let mergeAttempts = 0;
    const deltas: Array<{ content: string; reasoning?: string }> = [];
    const client: TextAiClient = {
      async complete(request, options) {
        const content = request.messages[0].content;
        if (content.includes('第 1 / 2 段字幕')) return { content: '第一段摘要' };
        if (content.includes('第 2 / 2 段字幕')) return { content: '第二段摘要' };
        mergeAttempts += 1;
        // First attempt mimics an incomplete merge (echoes a chunk verbatim) so isIncompleteMerge triggers retry.
        const responseContent = mergeAttempts === 1 ? '第 1/2 段字幕内容总结：第一段摘要' : '完整整体摘要';
        request.stream && options?.onDelta?.({
          content: responseContent,
          reasoning: mergeAttempts === 1 ? '第一轮思路' : undefined,
        });
        return { content: responseContent };
      },
    };

    await runSummaryPipeline({
      video: { source: 'bilibili', sourceId: 'BV-merge-retry', title: '回退', url: 'https://bilibili.com/video/BV-merge-retry' },
      transcript: { plainText: 'a'.repeat(20), lines: [], charCount: 20 },
      textAiClient: client,
      config: { ...DEFAULT_CONFIG, summary: { ...DEFAULT_CONFIG.summary, chunkTargetChars: 10, chunkOverlapChars: 0, maxChunks: 2 } },
      onDelta: (partial) => deltas.push(partial),
    });

    // Reset is the empty delta emitted between the first attempt's content and the second attempt's content.
    const resetIndex = deltas.findIndex((d) => d.content === '' && d.reasoning === undefined);
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(deltas.slice(0, resetIndex).map((d) => d.content).join('')).toBe('第 1/2 段字幕内容总结：第一段摘要');
    // After the reset, only the second attempt's content should be visible.
    expect(deltas.slice(resetIndex + 1).map((d) => d.content).join('')).toBe('完整整体摘要');
    expect(deltas.slice(resetIndex + 1).some((d) => (d.reasoning ?? '').includes('第一轮思路'))).toBe(false);
  });

  it('fails instead of rendering chunks when both overall merges are incomplete', async () => {
    const client: TextAiClient = {
      async complete(request) {
        const content = request.messages[0].content;
        if (content.includes('第 1 / 2 段字幕')) return { content: '第一段摘要' };
        if (content.includes('第 2 / 2 段字幕')) return { content: '第二段摘要' };
        return { content: '第 1/2 段字幕内容总结：第一段摘要' };
      },
    };

    await expect(runSummaryPipeline({
      video: { source: 'bilibili', sourceId: 'BV-merge-fail', title: '合并失败', url: 'https://bilibili.com/video/BV-merge-fail' },
      transcript: { plainText: 'a'.repeat(20), lines: [], charCount: 20 },
      textAiClient: client,
      config: { ...DEFAULT_CONFIG, summary: { ...DEFAULT_CONFIG.summary, chunkTargetChars: 10, chunkOverlapChars: 0, maxChunks: 2 } },
    })).rejects.toThrow('整体摘要合并不完整');
  });

  it('does not publish late sibling results after a concurrent chunk fails', async () => {
    const deltas: string[] = [];
    const progress: string[] = [];
    const client: TextAiClient = {
      async complete(request) {
        const content = request.messages[0].content;
        if (content.includes('第 1 / 2 段字幕')) throw new Error('chunk failed');
        if (content.includes('第 2 / 2 段字幕')) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { content: '迟到的第二段' };
        }
        return { content: '不应合并' };
      },
    };

    await expect(runSummaryPipeline({
      video: { source: 'bilibili', sourceId: 'BV-fail-fast', title: '失败', url: 'https://bilibili.com/video/BV-fail-fast' },
      transcript: { plainText: 'a'.repeat(20), lines: [], charCount: 20 },
      textAiClient: client,
      config: { ...DEFAULT_CONFIG, summary: { ...DEFAULT_CONFIG.summary, chunkTargetChars: 10, chunkOverlapChars: 0, maxChunks: 2 } },
      onDelta: (partial) => deltas.push(partial.content),
      onProgress: (message) => progress.push(message),
    })).rejects.toThrow('chunk failed');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(deltas).toEqual([]);
    expect(progress).toEqual([]);
  });
});

describe('video source providers', () => {
  it('selects the right provider for Bilibili and YouTube video URLs', () => {
    expect(getActiveProvider('https://www.bilibili.com/video/BV1xx').name).toBe('bilibili');
    expect(getActiveProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ').name).toBe('youtube');
    expect(getActiveProvider('https://www.youtube.com/shorts/abc123xyz90').name).toBe('youtube');
    expect(isSupportedVideoUrl('https://www.youtube.com/feed/subscriptions')).toBe(false);
  });

  it('maps available Bilibili engagement statistics', () => {
    expect(parseBilibiliStats({
      view: 123_456,
      danmaku: 7_890,
      reply: 456,
      like: 12_345,
      coin: 6_789,
      favorite: 9_876,
    })).toEqual({
      views: 123_456,
      danmaku: 7_890,
      comments: 456,
      likes: 12_345,
      coins: 6_789,
      favorites: 9_876,
    });
  });

  it('reads creator followers from Bilibili page state', () => {
    expect(parseBilibiliPageFollowers({ upData: { fans: 456_789 } })).toBe(456_789);
    expect(parseBilibiliPageFollowers({ upData: { fans: -1 } })).toBeUndefined();
  });

  it('fetches Bilibili creator followers by owner mid', async () => {
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ data: { follower: 987_654 } }),
      url,
    })) as unknown as typeof fetch;

    await expect(fetchBilibiliFollowerCount(12345, fetcher)).resolves.toBe(987_654);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.bilibili.com/x/relation/stat?vmid=12345',
      { credentials: 'include' },
    );
  });

  it('keeps Bilibili video metadata usable when follower lookup fails', async () => {
    const fetcher = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    await expect(fetchBilibiliFollowerCount(12345, fetcher)).resolves.toBeUndefined();
  });
});

describe('YouTube source parsing', () => {
  it('extracts watch and shorts video ids', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('https://www.youtube.com/shorts/abc123xyz90')).toBe('abc123xyz90');
    expect(extractYoutubeVideoId('https://www.youtube.com/feed/subscriptions')).toBeUndefined();
  });

  it('parses player response metadata and caption tracks', () => {
    const parsed = parseYoutubePlayerResponse(
      {
        videoDetails: {
          videoId: 'yt-1',
          title: 'YouTube Title',
          author: 'Creator Name',
          shortDescription: 'Description',
          lengthSeconds: '123',
          viewCount: '123456',
          thumbnail: { thumbnails: [{ url: 'small.jpg' }, { url: 'large.jpg' }] },
        },
        microformat: {
          playerMicroformatRenderer: {
            publishDate: '2024-01-02',
          },
        },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              { baseUrl: 'https://caption.example/en', languageCode: 'en', name: { simpleText: 'English' } },
              {
                baseUrl: 'https://caption.example/zh',
                languageCode: 'zh-Hans',
                kind: 'asr',
                name: { runs: [{ text: 'Chinese' }] },
                isTranslatable: true,
              },
            ],
          },
        },
      },
      'https://www.youtube.com/watch?v=yt-1',
    );

    expect(parsed.video.source).toBe('youtube');
    expect(parsed.video.sourceId).toBe('yt-1');
    expect(parsed.video.creatorName).toBe('Creator Name');
    expect(parsed.video.duration).toBe(123);
    expect(parsed.video.coverUrl).toBe('large.jpg');
    expect(parsed.video.stats).toEqual({ views: 123_456 });
    expect(parsed.tracks.map((track) => track.id)).toEqual(['en', 'zh-Hans']);
    expect(parsed.tracks[1].label).toBe('Chinese (auto)');
  });

  it('prefers the current YouTube player response that contains captions', () => {
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: 'https://www.youtube.com/watch?v=current-video' },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        ytInitialPlayerResponse: {
          videoDetails: { videoId: 'current-video', title: 'No captions on direct response' },
        },
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        scripts: [{
          textContent: `var ytInitialPlayerResponse = ${JSON.stringify({
            videoDetails: { videoId: 'current-video', title: 'With captions' },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [{
                  baseUrl: 'https://caption.example/current',
                  languageCode: 'en',
                  name: { simpleText: 'English' },
                }],
              },
            },
          })};`,
        }],
        querySelector: () => undefined,
        title: 'Current - YouTube',
      },
    });

    expect(parseYoutubeCaptionTracks(readYoutubePlayerResponse() ?? {}).map((track) => track.id)).toEqual(['en']);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
  });

  it('extracts YouTube caption tracks from fetched watch HTML', () => {
    const html = `ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { videoId: 'html-video', title: 'HTML Video' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{
            baseUrl: 'https://caption.example/html',
            languageCode: 'en-US',
            name: { simpleText: 'English (United States)' },
          }],
        },
      },
    })};`;

    expect(parseYoutubeCaptionTracks(
      readYoutubePlayerResponseFromHtml(html, 'https://www.youtube.com/watch?v=html-video') ?? {},
    ).map((track) => track.id)).toEqual(['en-US']);
  });

  it('maps statistics returned by the configured YouTube official API', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        items: [{
          id: 'yt-stats',
          snippet: { title: 'Stats', channelTitle: 'Creator' },
          contentDetails: { duration: 'PT1M' },
          statistics: { viewCount: '1000', likeCount: '200', commentCount: '30' },
        }],
      }), { status: 200 });
    }) as typeof fetch;

    const video = await getYoutubeVideoFromOfficialApi('yt-stats', {
      ...DEFAULT_CONFIG,
      source: {
        ...DEFAULT_CONFIG.source,
        youtube: { ...DEFAULT_CONFIG.source.youtube, captionStrategy: 'auto', apiKey: 'test-key' },
      },
    });

    expect(new URL(requestedUrl).searchParams.get('part')).toContain('statistics');
    expect(video?.stats).toEqual({ views: 1000, likes: 200, comments: 30 });
    globalThis.fetch = originalFetch;
  });

  it('parses JSON3 captions into timestamped transcript lines', () => {
    const transcript = parseYoutubeJson3Transcript(
      {
        events: [
          { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: 'Hello' }, { utf8: ' world' }] },
          { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: '\n' }] },
          { tStartMs: 62000, dDurationMs: 2000, segs: [{ utf8: 'Next line' }] },
        ],
      },
      { id: 'en', label: 'English', languageCode: 'en', baseUrl: 'https://caption.example/en' },
    );

    expect(transcript.language).toBe('English');
    expect(transcript.languageCode).toBe('en');
    expect(transcript.lines).toHaveLength(2);
    expect(transcript.plainText).toContain('[00:00] Hello world');
    expect(transcript.plainText).toContain('[01:02] Next line');
  });

  it('parses XML captions without DOMParser for Trusted Types restricted pages', () => {
    const originalDomParser = (globalThis as any).DOMParser;
    Object.defineProperty(globalThis, 'DOMParser', {
      configurable: true,
      value: class BlockedDomParser {
        parseFromString() {
          throw new TypeError("This document requires 'TrustedHTML' assignment.");
        }
      },
    });

    const transcript = parseYoutubeXmlTranscript(
      '<transcript><text start="0" dur="1.5">Hello &amp; welcome</text><text start="62" dur="2">Next line</text></transcript>',
      { id: 'en', label: 'English', languageCode: 'en', baseUrl: 'https://caption.example/en' },
    );

    expect(transcript.plainText).toContain('[00:00] Hello & welcome');
    expect(transcript.plainText).toContain('[01:02] Next line');
    Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: originalDomParser });
  });

  it('parses VTT captions into transcript lines', () => {
    const transcript = parseYoutubeVttTranscript(
      `WEBVTT

00:00:00.000 --> 00:00:01.500
Hello <b>there</b>

00:01:02.000 --> 00:01:04.000
Next &amp; line`,
      { id: 'en', label: 'English', languageCode: 'en', baseUrl: 'https://caption.example/en' },
    );

    expect(transcript.lines).toHaveLength(2);
    expect(transcript.plainText).toContain('[00:00] Hello there');
    expect(transcript.plainText).toContain('[01:02] Next & line');
  });

  it('prefers English captions, translated English captions, then fallback captions', () => {
    const tracks = [
      {
        id: 'zh-Hans',
        label: 'Chinese',
        languageCode: 'zh-Hans',
        baseUrl: 'https://caption.example/zh',
        isTranslatable: true,
      },
      { id: 'ja', label: 'Japanese', languageCode: 'ja', baseUrl: 'https://caption.example/ja' },
    ];

    expect(selectYoutubeCaptionTrack(tracks, undefined, 'en-US')?.id).toBe('zh-Hans::tlang=en');
    expect(selectYoutubeCaptionTrack(tracks, undefined, 'zh-CN')?.id).toBe('zh-Hans');
    expect(selectYoutubeCaptionTrack(tracks, 'ja', 'en-US')?.id).toBe('ja');
  });

  it('builds target-language translated subtitle options for translatable tracks', () => {
    const translated = buildTargetLanguageTranslatedTracks(
      [
        {
          id: 'zh-Hans',
          label: 'Chinese (auto)',
          languageCode: 'zh-Hans',
          baseUrl: 'https://caption.example/zh?x=1',
          isTranslatable: true,
        },
        { id: 'en', label: 'English', languageCode: 'en', baseUrl: 'https://caption.example/en' },
      ],
      'en-US',
    );

    expect(translated).toHaveLength(1);
    expect(translated[0].id).toBe('zh-Hans::tlang=en');
    expect(translated[0].label).toBe('English (translated from Chinese)');
    expect(translated[0].baseUrl).toContain('tlang=en');
  });

  it('falls back to youtubei player captions when page captions are unavailable', async () => {
    const originalFetch = globalThis.fetch;
    const originalLocation = globalThis.location;
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://www.youtube.com', href: 'https://www.youtube.com/watch?v=yt-fallback' },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { ytcfg: { get: (key: string) => (key === 'INNERTUBE_API_KEY' ? 'test-key' : undefined) } },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { scripts: [], querySelector: () => undefined, title: 'Fallback - YouTube' },
    });
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toContain('/youtubei/v1/player');
      expect(String(url)).toContain('key=test-key');
      expect(JSON.parse(String(init?.body)).videoId).toBe('yt-fallback');
      return new Response(
        JSON.stringify({
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: 'https://caption.example/en',
                  languageCode: 'en',
                  name: { simpleText: 'English' },
                },
              ],
            },
          },
        }),
        { status: 200 },
      );
    }) as any;

    const options = await getYoutubeSubtitleOptions(
      {
        source: 'youtube',
        sourceId: 'yt-fallback',
        title: 'Fallback',
        url: 'https://www.youtube.com/watch?v=yt-fallback',
      },
      DEFAULT_CONFIG,
    );

    expect(options).toEqual([{ id: 'en', label: 'English' }]);
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  });

  it('uses youtubei fallback captions when reading a transcript', async () => {
    const originalFetch = globalThis.fetch;
    const originalLocation = globalThis.location;
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://www.youtube.com', href: 'https://www.youtube.com/watch?v=yt-transcript' },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { ytcfg: { get: () => undefined } },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { scripts: [], querySelector: () => undefined, title: 'Transcript - YouTube' },
    });
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('/youtubei/v1/player')) {
        return new Response(
          JSON.stringify({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: 'https://caption.example/en',
                    languageCode: 'en',
                    name: { simpleText: 'English' },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      expect(String(url)).toContain('fmt=json3');
      return new Response(JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'From youtubei' }] }] }), {
        status: 200,
      });
    }) as any;

    const transcript = await getYoutubeTranscript(
      {
        source: 'youtube',
        sourceId: 'yt-transcript',
        title: 'Transcript',
        url: 'https://www.youtube.com/watch?v=yt-transcript',
      },
      undefined,
      'en-US',
      DEFAULT_CONFIG,
    );

    expect(transcript.plainText).toContain('From youtubei');
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  });

  it('skips empty YouTube caption tracks and tries the next candidate', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { ytInitialPlayerResponse: undefined } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { scripts: [], querySelector: () => undefined, title: '' } });
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const textUrl = String(url);
      if (textUrl.includes('/youtubei/v1/player')) {
        return new Response(
          JSON.stringify({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: 'https://caption.example/empty',
                    languageCode: 'en',
                    name: { simpleText: 'English (auto-generated)' },
                    kind: 'asr',
                  },
                  {
                    baseUrl: 'https://caption.example/full',
                    languageCode: 'en-US',
                    name: { simpleText: 'English (United States)' },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      if (textUrl.startsWith('https://caption.example/empty')) {
        return new Response(JSON.stringify({ events: [] }), { status: 200 });
      }
      if (textUrl.startsWith('https://caption.example/full')) {
        return new Response(JSON.stringify({
          events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Readable subtitle' }] }],
        }), { status: 200 });
      }
      throw new Error(`Unexpected URL ${textUrl}`);
    }) as any;

    const transcript = await getYoutubeTranscript(
      {
        source: 'youtube',
        sourceId: 'yt-empty-first',
        title: 'Transcript',
        url: 'https://www.youtube.com/watch?v=yt-empty-first',
      },
      undefined,
      'en-US',
      DEFAULT_CONFIG,
    );

    expect(transcript.languageCode).toBe('en-US');
    expect(transcript.plainText).toContain('Readable subtitle');
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  });

  it('falls back to the YouTube transcript panel when caption downloads are empty', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    const originalLocation = globalThis.location;
    const segmentNode = (timestamp: string, text: string) => ({
      textContent: `${timestamp} ${text}`,
      querySelector: (selector: string) => {
        if (selector.includes('segment-text') || selector.includes('yt-formatted-string')) return { textContent: text };
        if (selector.includes('timestamp')) return { textContent: timestamp };
        return undefined;
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: 'https://www.youtube.com/watch?v=yt-panel' },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        ytInitialPlayerResponse: {
          videoDetails: { videoId: 'yt-panel' },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: 'https://caption.example/panel?v=yt-panel&lang=en-US',
                  languageCode: 'en-US',
                  name: { simpleText: 'English (United States)' },
                },
              ],
            },
          },
        },
        setTimeout,
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        scripts: [],
        title: 'Panel - YouTube',
        querySelector: () => undefined,
        querySelectorAll: (selector: string) => {
          if (selector === 'ytd-transcript-segment-renderer') {
            return [
              segmentNode('0:00', 'Transcript panel line'),
              segmentNode('0:04', 'Second panel line'),
            ] as any;
          }
          return [] as any;
        },
      },
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })) as any;

    const transcript = await getYoutubeTranscript(
      {
        source: 'youtube',
        sourceId: 'yt-panel',
        title: 'Panel',
        url: 'https://www.youtube.com/watch?v=yt-panel',
      },
      'en-US',
      'en-US',
      DEFAULT_CONFIG,
    );

    expect(transcript.languageCode).toBe('en-US');
    expect(transcript.plainText).toContain('[00:00] Transcript panel line');
    expect(transcript.plainText).toContain('[00:04] Second panel line');
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
  });

  it('expands YouTube description before opening the transcript panel fallback', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    const originalLocation = globalThis.location;
    const originalGetComputedStyle = (globalThis as any).getComputedStyle;
    let descriptionExpanded = false;
    let transcriptOpened = false;
    const actionNode = (text: string, onClick: () => void, visible = true) => ({
      textContent: text,
      getAttribute: () => '',
      getBoundingClientRect: () => ({ width: visible ? 80 : 0, height: visible ? 32 : 0 }),
      click: onClick,
    });
    const segmentNode = (timestamp: string, text: string) => ({
      textContent: `${timestamp} ${text}`,
      querySelector: (selector: string) => {
        if (selector.includes('segment-text') || selector.includes('yt-formatted-string')) return { textContent: text };
        if (selector.includes('timestamp')) return { textContent: timestamp };
        return undefined;
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: 'https://www.youtube.com/watch?v=yt-panel-expand' },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        ytInitialPlayerResponse: {
          videoDetails: { videoId: 'yt-panel-expand' },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: 'https://caption.example/panel?v=yt-panel-expand&lang=en-US',
                  languageCode: 'en-US',
                  name: { simpleText: 'English (United States)' },
                },
              ],
            },
          },
        },
        setTimeout: (callback: () => void) => {
          callback();
          return 0 as any;
        },
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        scripts: [],
        title: 'Panel - YouTube',
        querySelector: () => undefined,
        querySelectorAll: (selector: string) => {
          if (selector === 'ytd-transcript-segment-renderer') {
            return transcriptOpened
              ? [segmentNode('0:00', 'Opened after description expand')]
              : [] as any;
          }
          if (selector.includes('button') || selector.includes('tp-yt-paper-button')) {
            return [
              actionNode('...更多', () => { descriptionExpanded = true; }),
              ...(descriptionExpanded
                ? [actionNode('内容转文字', () => { transcriptOpened = true; })]
                : []),
            ] as any;
          }
          return [] as any;
        },
      },
    });
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: () => ({ display: 'block', visibility: 'visible' }),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })) as any;

    const transcript = await getYoutubeTranscript(
      {
        source: 'youtube',
        sourceId: 'yt-panel-expand',
        title: 'Panel',
        url: 'https://www.youtube.com/watch?v=yt-panel-expand',
      },
      'en-US',
      'en-US',
      DEFAULT_CONFIG,
    );

    expect(descriptionExpanded).toBe(true);
    expect(transcriptOpened).toBe(true);
    expect(transcript.plainText).toContain('Opened after description expand');
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
    Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: originalGetComputedStyle });
  });

  it('uses YouTube chapter outline when captions and transcript panel are unavailable', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    const originalDocument = globalThis.document;
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: 'https://www.youtube.com/watch?v=yt-chapters' },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        ytInitialPlayerResponse: {
          videoDetails: { videoId: 'yt-chapters' },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: 'https://caption.example/chapters?v=yt-chapters&lang=en-US',
                  languageCode: 'en-US',
                  name: { simpleText: 'English (United States)' },
                },
              ],
            },
          },
        },
        setTimeout: (callback: () => void) => {
          callback();
          return 0 as any;
        },
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        scripts: [],
        title: 'Chapters - YouTube',
        querySelector: () => undefined,
        querySelectorAll: (selector: string) => {
          if (selector === 'ytd-macro-markers-list-item-renderer') {
            return [
              { textContent: 'Intro Intro 0:00 Intro 0:00' },
              { textContent: 'Thing 1 Thing 1 0:15 Thing 1 0:15' },
            ] as any;
          }
          return [] as any;
        },
      },
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })) as any;

    const transcript = await getYoutubeTranscript(
      {
        source: 'youtube',
        sourceId: 'yt-chapters',
        title: 'Chapters',
        url: 'https://www.youtube.com/watch?v=yt-chapters',
      },
      'en-US',
      'en-US',
      DEFAULT_CONFIG,
    );

    expect(transcript.language).toBe('English (United States) chapters');
    expect(transcript.plainText).toContain('using the video chapter outline as fallback');
    expect(transcript.plainText).toContain('[00:00] Intro');
    expect(transcript.plainText).toContain('[00:15] Thing 1');
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
  });
});

describe('extractThinkBlocks', () => {
  it('extracts complete and split think blocks', () => {
    expect(extractThinkBlocks('<think>推理过程</think># 结论')).toEqual({
      content: '# 结论',
      reasoning: '推理过程',
      inThink: false,
    });
    const first = extractThinkBlocks('<think>推理', false);
    const second = extractThinkBlocks('过程</think># 结论', first.inThink);
    expect(first).toEqual({ content: '', reasoning: '推理', inThink: true });
    expect(second).toEqual({ content: '# 结论', reasoning: '过程', inThink: false });
  });
});

describe('reasoning timing', () => {
  it('tracks, finalizes, and safely spreads reasoning timing', () => {
    expect(updateReasoningTiming({}, { reasoning: '分析' }, 1_000)).toEqual({
      reasoningStartedAt: 1_000,
    });
    expect(updateReasoningTiming(
      { reasoningStartedAt: 1_000 },
      { reasoning: '继续分析' },
      2_000,
    )).toEqual({ reasoningStartedAt: 1_000 });
    expect(updateReasoningTiming(
      { reasoningStartedAt: 1_000 },
      { content: '正文' },
      4_500,
    )).toEqual({ reasoningStartedAt: 1_000, reasoningDurationMs: 3_500 });
    expect(finalizeReasoningTiming({ reasoningStartedAt: 2_000 }, 99_000)).toEqual({
      reasoningStartedAt: 2_000,
      reasoningDurationMs: 97_000,
    });
    expect(formatReasoningDuration(97_000)).toBe('1m 37s');
    expect(formatReasoningDuration(400)).toBe('<1s');
    const polluted = {
      content: 'stale content',
      reasoning: 'stale reasoning',
      createdAt: 0,
      reasoningStartedAt: 1_000,
    };
    const timing = updateReasoningTiming(polluted, { content: 'fresh' }, 2_000);
    expect(timing).toEqual({ reasoningStartedAt: 1_000, reasoningDurationMs: 1_000 });
    expect('content' in timing).toBe(false);
    expect('reasoning' in timing).toBe(false);

    const next = { content: 'fresh content', reasoning: 'fresh reasoning', createdAt: 9, ...timing };
    expect(next.content).toBe('fresh content');
    expect(next.reasoning).toBe('fresh reasoning');
    expect(next.createdAt).toBe(9);
    expect(next.reasoningStartedAt).toBe(1_000);
    expect(next.reasoningDurationMs).toBe(1_000);

    const finalized = finalizeReasoningTiming(polluted, 5_000);
    expect(finalized).toEqual({ reasoningStartedAt: 1_000, reasoningDurationMs: 4_000 });
    expect('content' in finalized).toBe(false);
  });
});

describe('reasoning disclosure', () => {
  it('expands while thinking and collapses to a timed label when complete', () => {
    expect(reasoningDisclosureState({ reasoning: '', streaming: true })).toEqual({ visible: false });
    expect(reasoningDisclosureState({ reasoning: '分析中', streaming: true })).toEqual({
      visible: true,
      open: true,
      label: 'Thinking',
    });
    expect(reasoningDisclosureState({
      reasoning: '分析完成',
      streaming: false,
      durationMs: 3_400,
    })).toEqual({
      visible: true,
      open: false,
      label: 'Thought for 3s',
    });
  });
});

describe('summary scroll preservation', () => {
  it('preserves manual scroll and applies only valid bottom corrections', () => {
    expect(SUMMARY_SCROLL_SELECTOR).toBe('.vs-summary-scroll');
    expect(resolveSummaryScrollTop(false, 240, 1000)).toBe(240);
    expect(resolveSummaryScrollTop(true, 240, 1000)).toBe(1000);
    expect(shouldApplySummaryScrollCorrection(2, 1, true, true)).toBe(false);
    expect(shouldApplySummaryScrollCorrection(2, 2, false, true)).toBe(false);
    expect(shouldApplySummaryScrollCorrection(2, 2, true, false)).toBe(false);
    expect(shouldApplySummaryScrollCorrection(2, 2, true, true)).toBe(true);
  });

  it('keeps summary layout, controls, metadata, and reasoning styles aligned', () => {
    expect(PANEL_STYLES).toContain('.vs-summary-scroll {\n  display: flex;');
    expect(PANEL_STYLES).toContain('.vs-output {\n  flex: 1 1 auto;');
    const userRule = /\.vs-message\.user > p \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    const composerRule = /\.vs-chat-composer \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(userRule).toContain('background: var(--vs-surface-highest);');
    expect(composerRule).toContain('background: var(--vs-surface-highest);');
    expect(PANEL_STYLES).not.toContain('.vs-avatar {');
    const thinkingRule = /\.vs-thinking \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(thinkingRule).toContain('border-bottom: 1px solid var(--vs-outline-variant);');
    expect(PANEL_STYLES).toContain('.vs-intent-suggestions {');
    expect(PANEL_STYLES).toContain('.vs-intent-option {');
    expect(PANEL_STYLES).toContain('.vs-thinking summary::-webkit-details-marker');
    expect(PANEL_STYLES).toContain('.vs-thinking-chevron');
    expect(PANEL_STYLES).toContain('.vs-thinking[open] .vs-thinking-chevron');
    expect(PANEL_STYLES).toContain('.vs-thinking-label.streaming');
    expect(PANEL_STYLES).toContain('animation: vs-thinking-shimmer 4s linear infinite;');
    expect(PANEL_STYLES).toContain('@keyframes vs-thinking-shimmer');
    expect(PANEL_STYLES).toContain('50%, 100% { background-position: -120% 0; }');
    const assistantRule = /\.vs-message\.assistant \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    const chipRule = /\.vs-config-chip \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    const subtitleRule = /\.vs-subtitle-chip \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(assistantRule).toContain('width: 100%;');
    expect(chipRule).toContain('min-height: 26px;');
    expect(subtitleRule).toContain('width: auto;');
    expect(subtitleRule).toContain('max-width: min(170px, 40%);');
    const metaRule = /\.vs-video-meta \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(metaRule).toContain('display: grid;');
    expect(metaRule).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(PANEL_STYLES).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    const chipTextRule = /\.vs-config-chip span \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    const intentRule = /\.vs-intent-option \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(chipTextRule).toContain('color: var(--vs-text);');
    expect(PANEL_STYLES).toContain('.vs-subtitle-chip select {');
    expect(intentRule).toContain('color: var(--vs-text);');
    expect(PANEL_STYLES).not.toContain('.vs-intent-label {');
    expect(PANEL_STYLES).toContain('--vs-rail-width: 56px;');
    expect(PANEL_STYLES).toContain('width: var(--vs-rail-width);');
    expect(PANEL_STYLES).toContain('width: calc(100% - var(--vs-rail-width));');
    expect(PANEL_STYLES).toContain('.vs-rail-tab {\n  width: 40px;\n  height: 40px;');
    expect(PANEL_STYLES).toContain('.vs-rail-tab svg {\n  width: 20px;\n  height: 20px;');
    expect(PANEL_STYLES).not.toContain('\nbutton:hover:not(:disabled)');
    expect(PANEL_STYLES).toContain('.vs-rail-tab:hover:not(:disabled)');
    expect(PANEL_STYLES).toContain('.vs-settings-select-menu {');
    const settingsMenuRule = /\.vs-settings-select-menu \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(settingsMenuRule).toContain('position: static;');
    expect(settingsMenuRule).toContain('margin-top: 4px;');
    expect(PANEL_STYLES).toContain('.vs-settings-select-chevron {');
    expect(PANEL_STYLES).toContain('right: 12px;');
  });
});

describe('summary chat UI states', () => {
  it('derives summary output, composer, and toolbar states', () => {
    expect(hasRenderableSummaryOutput({ content: '', reasoning: '正在分析' })).toBe(true);
    expect(hasRenderableSummaryOutput({ content: '', reasoning: '' })).toBe(false);
    expect(summaryComposerState({ hasSummary: false, busy: false })).toEqual({
      textareaDisabled: true,
      placeholder: '请先生成总结',
      action: 'start_summary',
      label: '开始总结',
    });
    expect(summaryComposerState({ hasSummary: true, busy: false })).toEqual({
      textareaDisabled: false,
      placeholder: '问问关于视频的内容... 或输入"画图"',
      action: 'send',
      label: '发送',
    });
    expect(shouldShowSummaryToolbar({ hasSummary: false, streaming: false })).toBe(false);
    expect(shouldShowSummaryToolbar({ hasSummary: false, streaming: true })).toBe(false);
    expect(shouldShowSummaryToolbar({ hasSummary: true, streaming: false })).toBe(true);
    expect(SUMMARY_CONTEXT_ORDER).toEqual(['video', 'configuration']);
    expect(shouldSubmitComposerOnKeydown({ key: 'Enter', shiftKey: false })).toBe(true);
    expect(shouldSubmitComposerOnKeydown({ key: 'Enter', shiftKey: true })).toBe(false);
    expect(shouldSubmitComposerOnKeydown({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false);
    expect(shouldSubmitComposerOnKeydown({ key: 'Enter', shiftKey: false, keyCode: 229 })).toBe(false);
    expect(shouldSubmitComposerOnKeydown({ key: 'Enter', shiftKey: false }, true)).toBe(false);
  });

  it('offers fixed intents only on the latest completed assistant response', () => {
    expect(FIXED_FOLLOW_UP_INTENTS.map((item) => item.label)).toEqual([
      '提炼核心观点',
      '列出行动建议',
      '生成配图',
    ]);
    expect(shouldShowFollowUpIntents({ busy: false, isLatestAssistant: true, streaming: false })).toBe(true);
    expect(shouldShowFollowUpIntents({ busy: true, isLatestAssistant: true, streaming: false })).toBe(false);
    expect(shouldShowFollowUpIntents({ busy: false, isLatestAssistant: false, streaming: false })).toBe(false);
    expect(shouldShowFollowUpIntents({ busy: false, isLatestAssistant: true, streaming: true })).toBe(false);
  });
});

describe('asset URL normalization', () => {
  it('normalizes remote assets without changing safe inline URLs', () => {
    expect(normalizeAssetUrl('http://i0.hdslb.com/bfs/archive/cover.jpg')).toBe(
      'https://i0.hdslb.com/bfs/archive/cover.jpg',
    );
    expect(normalizeAssetUrl('//i0.hdslb.com/bfs/archive/cover.jpg')).toBe(
      'https://i0.hdslb.com/bfs/archive/cover.jpg',
    );
    expect(normalizeAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(normalizeAssetUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
  });
});

describe('normalizeChatCompletionsUrl', () => {
  it('expands OpenAI-compatible base URLs to the chat completions endpoint', () => {
    expect(normalizeChatCompletionsUrl('https://api.minimax.io/v1')).toBe(
      'https://api.minimax.io/v1/chat/completions',
    );
    expect(normalizeChatCompletionsUrl('https://api.minimax.io/v1/')).toBe(
      'https://api.minimax.io/v1/chat/completions',
    );
    expect(normalizeChatCompletionsUrl('https://api.minimax.io/v1/chat/completions')).toBe(
      'https://api.minimax.io/v1/chat/completions',
    );
  });
});

describe('OpenAI-compatible text config', () => {
  it('normalizes arbitrary endpoints and copied credentials', () => {
    const config = applyTextConfig(DEFAULT_CONFIG.textAi, {
      apiStyle: 'openai',
      baseUrl: 'https://llm.example.com/openai/v1/chat/completions',
      apiKey: 'Bearer custom-key',
      model: 'my-custom-model',
    });

    expect(config.apiUrl).toBe('https://llm.example.com/openai/v1');
    expect(config.apiKey).toBe('custom-key');
    expect(config.model).toBe('my-custom-model');
    expect(normalizeApiKey(' sk-test ')).toBe('sk-test');
    expect(normalizeApiKey('Bearer sk-test')).toBe('sk-test');
    expect(normalizeOpenAIBaseUrl('https://api.minimaxi.com/v1/chat/completions')).toBe(
      'https://api.minimaxi.com/v1',
    );
    expect(normalizeOpenAIBaseUrl('https://example.com/proxy/v1/')).toBe('https://example.com/proxy/v1');
  });

  it('selects the compatible MiniMax token field by model generation', () => {
    const m3Payload = buildChatCompletionsPayload(
      {
        model: 'MiniMax-M3',
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        maxTokens: 128,
        stream: false,
      },
      DEFAULT_CONFIG.textAi,
    ) as Record<string, unknown>;

    expect(m3Payload.max_completion_tokens).toBe(128);
    expect(m3Payload.max_tokens).toBeUndefined();
    const legacyPayload = buildChatCompletionsPayload(
      {
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        maxTokens: 8,
        stream: false,
      },
      DEFAULT_CONFIG.textAi,
    ) as Record<string, unknown>;

    expect(legacyPayload.max_tokens).toBe(8);
    expect(legacyPayload.max_completion_tokens).toBeUndefined();
  });

});

describe('Anthropic text config', () => {
  it('expands an Anthropic host or v1 base URL to the messages endpoint', () => {
    expect(normalizeAnthropicUrl('https://api.anthropic.com')).toBe('https://api.anthropic.com/v1/messages');
    expect(normalizeAnthropicUrl('https://api.anthropic.com/v1')).toBe('https://api.anthropic.com/v1/messages');
    expect(normalizeAnthropicUrl('https://proxy.example/v1/messages')).toBe('https://proxy.example/v1/messages');
  });
});

describe('summary chat', () => {
  it('does not duplicate the current user question in history and the rendered prompt', async () => {
    let messages: Array<{ role: string; content: string }> = [];
    const client: TextAiClient = {
      async complete(request) {
        messages = request.messages;
        return { content: '回答' };
      },
    };
    const summary = {
      video: { source: 'bilibili' as const, sourceId: 'BV-chat', title: '测试', url: 'https://bilibili.com/video/BV-chat' },
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '摘要',
      createdAt: Date.now(),
    };

    await askSummaryChat(client, DEFAULT_CONFIG, summary, [
      { role: 'user', content: '之前的问题' },
      { role: 'assistant', content: '之前的回答' },
      { role: 'user', content: '当前问题' },
    ], '当前问题');

    expect(messages.filter((message) => message.content.includes('当前问题'))).toHaveLength(1);
    expect(messages[messages.length - 1]?.content).toContain('字幕中未提及');
  });

  it('detects image requests locally and keeps the legacy default image prompt available', () => {
    expect(isImageGenerationRequest('请根据这个视频画一张图')).toBe(true);
    expect(isImageGenerationRequest('画一个苹果')).toBe(true);
    expect(isImageGenerationRequest('生成配图')).toBe(true);
    expect(isImageGenerationRequest('这段视频是什么意思')).toBe(false);
    expect(buildOneImagePrompt('核心摘要')).toBe(
      '根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：\n\n核心摘要',
    );
    const centralizedPrompts = V2Prompts as unknown as {
      ONE_IMAGE_PROMPT_TEMPLATE: string;
      TEXT_CONNECTIVITY_TEST_PROMPT: string;
      IMAGE_CONNECTIVITY_TEST_PROMPT: string;
    };
    expect(centralizedPrompts.ONE_IMAGE_PROMPT_TEMPLATE).toContain('{{summary}}');
    expect(centralizedPrompts.TEXT_CONNECTIVITY_TEST_PROMPT).toBe('Reply with OK.');
    expect(centralizedPrompts.IMAGE_CONNECTIVITY_TEST_PROMPT).toContain('neutral abstract background');
  });

  it('renders configured image prompt styles and isolates them by fingerprint', () => {
    const prompts = V2Prompts as unknown as {
      getImagePromptPresets: () => Array<{ id: string; name: string; template: string }>;
      resolveImagePrompt: (
        id: string,
        custom?: Array<{ id: string; name: string; type: string; template: string; builtIn: boolean }>,
      ) => { preset: { id: string }; template: string; fingerprint: string };
    };
    const imagePrompts = prompts.getImagePromptPresets();

    expect(imagePrompts.map((prompt) => prompt.id)).toEqual([
      'image_infographic',
      'image_cover',
      'image_poster',
      'image_illustration',
      'image_minimal',
      'image_pixel_rpg',
    ]);
    const pixelTemplate = imagePrompts.find((prompt) => prompt.id === 'image_pixel_rpg')?.template ?? '';
    expect(pixelTemplate).toContain('像素 RPG');
    expect(pixelTemplate).not.toMatch(/tier\s*list/i);
    const pixelPrompt = buildOneImagePrompt('核心摘要', {
      ...DEFAULT_CONFIG,
      imageAi: { ...DEFAULT_CONFIG.imageAi, promptId: 'image_pixel_rpg' },
    });
    expect(pixelPrompt).toContain('像素 RPG');
    expect(pixelPrompt).toContain('画幅比例：16:9 横屏');
    expect(buildOneImagePrompt('core summary', {
      ...DEFAULT_CONFIG,
      summary: { ...DEFAULT_CONFIG.summary, language: 'en-US' },
      imageAi: { ...DEFAULT_CONFIG.imageAi, promptId: 'image_cover', size: '9:16' },
    })).toContain('Aspect ratio: 9:16 portrait');

    const defaultPrompt = prompts.resolveImagePrompt('image_infographic');
    const pixelPromptConfig = prompts.resolveImagePrompt('image_pixel_rpg');
    expect(defaultPrompt.fingerprint).not.toBe(pixelPromptConfig.fingerprint);
    expect(DEFAULT_CONFIG.imageAi.size).toBe('16:9');
    expect(mergeConfigForTest({ imageAi: { size: '1024x1024' } }).imageAi.size).toBe('16:9');
    expect(mergeConfigForTest({ imageAi: { size: '1536x1024' } }).imageAi.size).toBe('16:9');
    expect(imageGenerationCacheIdentity({ ...DEFAULT_CONFIG.imageAi, size: '16:9' }))
      .not.toBe(imageGenerationCacheIdentity({ ...DEFAULT_CONFIG.imageAi, size: '9:16' }));
  });

  it('does not discard a generated image when cache storage is full', () => {
    expect(() => cacheGeneratedImage(
      { set: () => { throw new Error('quota exceeded'); } },
      'cache-key',
      { dataUrl: 'data:image/png;base64,abc' },
      'prompt',
    )).not.toThrow();
  });
});


describe('image generation client helpers', () => {
  it('normalizes requests, responses, prompts, and download URLs', () => {
    expect(normalizeImageResponseFormat('https://api.minimaxi.com/v1/image_generation', 'b64_json')).toBe('base64');
    expect(normalizeImageResponseFormat('https://api.openai.com/v1/images/generations', 'b64_json')).toBe('b64_json');
    expect(normalizeImageRequestSize('https://api.openai.com/v1/images/generations', '16:9')).toBe('1536x1024');
    expect(normalizeImageRequestSize('https://api.openai.com/v1/images/generations', '9:21')).toBe('1024x1536');
    expect(normalizeImageRequestSize('https://api.minimaxi.com/v1/image_generation', '16:9')).toBe('16:9');
    expect(parseGeneratedImage({ data: [{ base64: 'abc' }] }).dataUrl).toBe('data:image/png;base64,abc');
    expect(parseGeneratedImage({ data: { image_base64: ['def'] } }).dataUrl).toBe('data:image/png;base64,def');
    expect(parseGeneratedImage({ data: { image_base64: 'ghi' } }).dataUrl).toBe('data:image/png;base64,ghi');
    expect(parseGeneratedImage({ image_base64: ['jkl'] }).dataUrl).toBe('data:image/png;base64,jkl');
    expect(sanitizeImagePrompt('a'.repeat(1600)).length).toBe(1200);
    expect(generatedImageHref({ dataUrl: 'data:image/png;base64,abc', url: 'https://example.com/image.png' })).toBe(
      'data:image/png;base64,abc',
    );
    expect(generatedImageHref({ url: 'https://example.com/image.png' })).toBe('https://example.com/image.png');
  });
});

describe('image preview controls', () => {
  it('keeps the complete action set and bounded transform state', () => {
    expect(IMAGE_PREVIEW_ACTIONS).toEqual([
      'zoomOut',
      'zoomIn',
      'rotateLeft',
      'rotateRight',
      'reset',
      'download',
    ]);
    expect(IMAGE_PREVIEW_SCALES).toContain(1);
    expect(nextImagePreviewScale(1, 'in')).toBe(1.1);
    expect(nextImagePreviewScale(1, 'out')).toBe(0.9);
    expect(nextImagePreviewScale(5, 'in')).toBe(5);
    expect(nextImagePreviewScale(0.25, 'out')).toBe(0.25);
    expect(imagePreviewTransform({ scale: 1.5, rotation: 90, x: 12, y: -8 })).toBe(
      'translate(12px, -8px) rotate(90deg) scale(1.5)',
    );
  });
});




describe('AppController video refresh', () => {
  it('retries briefly when SPA navigation still exposes stale video info', async () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: 'https://www.youtube.com/watch?v=new-video' },
    });
    const controller = new AppController();
    controller.state.video = {
      source: 'youtube',
      sourceId: 'old-video',
      title: 'Old video',
      url: 'https://www.youtube.com/watch?v=old-video',
    };
    const videos = [
      controller.state.video,
      {
        source: 'youtube' as const,
        sourceId: 'new-video',
        title: 'New video',
        url: 'https://www.youtube.com/watch?v=new-video',
      },
    ];
    let calls = 0;
    (controller as any).currentProvider = () => ({
      name: 'youtube',
      match: () => true,
      getVideoInfo: async () => videos[Math.min(calls++, videos.length - 1)],
      getTranscript: async () => ({ plainText: '', lines: [], charCount: 0 }),
      watchRouteChange: () => () => undefined,
    });

    await controller.refreshVideo();

    expect(calls).toBe(2);
    expect(controller.state.video?.sourceId).toBe('new-video');
    expect(controller.state.transcript).toBeUndefined();
    expect(controller.state.selectedSubtitleId).toBeUndefined();
  });
});

describe('AppController cache management and clipboard', () => {
  it('restores a cached summary before generating on launcher open', async () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const controller = new AppController();
    controller.config = { ...DEFAULT_CONFIG, ui: { ...DEFAULT_CONFIG.ui, collapsed: true } };
    const restore = vi.spyOn(controller, 'restoreCachedSummary').mockResolvedValue(true);
    const generate = vi.spyOn(controller, 'generateSummary').mockResolvedValue();

    await controller.openFromLauncher();

    expect(restore).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(controller.config.ui.collapsed).toBe(false);
  });

  it('includes source, language, and subtitle id in summary cache keys', () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const controller = new AppController();
    const baseVideo = {
      source: 'youtube' as const,
      sourceId: 'yt-cache',
      title: 'Cache Video',
      url: 'https://www.youtube.com/watch?v=yt-cache',
    };

    const englishKey = (controller as any).summaryCacheKey(baseVideo, 'en');
    const chineseKey = (controller as any).summaryCacheKey(
      { ...baseVideo, source: 'bilibili' as const },
      'zh-CN',
    );
    controller.config = { ...controller.config, summary: { ...controller.config.summary, language: 'en-US' } };
    const languageKey = (controller as any).summaryCacheKey(baseVideo, 'en');

    expect(englishKey).not.toBe(chineseKey);
    expect(englishKey).not.toBe(languageKey);
  });

  it('clears the current video summary caches and runtime summary state', () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const controller = new AppController();
    controller.state.video = {
      source: 'bilibili',
      sourceId: 'BV-clear',
      bvid: 'BV-clear',
      cid: 1,
      title: '清理缓存视频',
      url: 'https://www.bilibili.com/video/BV-clear',
    };
    controller.state.summary = {
      video: controller.state.video,
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '缓存摘要',
      createdAt: Date.now(),
    };
    controller.state.transcript = controller.state.summary.transcript;
    controller.state.selectedSubtitleId = 'zh-CN';
    controller.state.streamingSummary = { ...controller.state.summary, content: '流式摘要' };
    controller.state.summaryRequestPending = true;
    controller.state.summaryChatHistory = [{ role: 'user', content: '旧问题' }];
    controller.state.streamingSummaryInsight = { role: 'assistant', content: '旧回答' };
    const currentKey = (controller as any).summaryCacheKey(controller.state.video, 'zh-CN');
    const otherSubtitleKey = (controller as any).summaryCacheKey(controller.state.video, 'en-US');
    const otherVideoKey = (controller as any).summaryCacheKey({
      ...controller.state.video,
      sourceId: 'BV-other',
      bvid: 'BV-other',
    }, 'zh-CN');
    summaryCache.set(currentKey, controller.state.summary);
    summaryCache.set(otherSubtitleKey, {
      ...controller.state.summary,
      transcript: { plainText: '英文字幕', lines: [], charCount: 4 },
    });
    summaryCache.set(otherVideoKey, {
      ...controller.state.summary,
      video: { ...controller.state.video, sourceId: 'BV-other', bvid: 'BV-other' },
    });

    controller.clearCurrentSummaryCache();

    expect(controller.state.summary).toBeUndefined();
    expect(controller.state.streamingSummary).toBeUndefined();
    expect(controller.state.summaryRequestPending).toBe(false);
    expect(controller.state.summaryChatHistory).toEqual([]);
    expect(controller.state.streamingSummaryInsight).toBeUndefined();
    expect(controller.state.transcript).toBeUndefined();
    expect(controller.state.selectedSubtitleId).toBeUndefined();
    expect(summaryCache.get(currentKey)).toBeUndefined();
    expect(summaryCache.get(otherSubtitleKey)).toBeUndefined();
    expect(summaryCache.get(otherVideoKey)).toBeTruthy();
    expect(controller.state.status).toBe('已清除此视频缓存');
  });

  it('clears transient chat output when a task fails', async () => {
    const controller = new AppController();
    controller.state.streamingSummaryInsight = { role: 'assistant', content: 'partial' };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await (controller as any).runTask('chat', async () => { throw new Error('boom'); });

    expect(controller.state.streamingSummaryInsight).toBeUndefined();
    consoleError.mockRestore();
  });

  it('shows a top toast for task errors that do not contain failure keywords', async () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const controller = new AppController();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await (controller as any).runTask('获取字幕', async () => {
      throw new Error('当前视频没有公开字幕');
    });

    expect(controller.state.status).toBe('当前视频没有公开字幕');
    expect(controller.state.toast?.message).toBe('当前视频没有公开字幕');
    consoleError.mockRestore();
  });

  it('shows ChatGPT image bridge failures in both the conversation and top toast', async () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    Object.defineProperty(globalThis, 'GM_addValueChangeListener', { configurable: true, value: undefined });
    const controller = new AppController();
    controller.config = {
      ...controller.config,
      imageAi: {
        ...controller.config.imageAi,
        mode: 'chatgpt_web',
        chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project',
      },
    };
    controller.state.video = {
      source: 'bilibili',
      sourceId: 'BV-image-error',
      bvid: 'BV-image-error',
      cid: 1,
      title: 'Image Error',
      url: 'https://www.bilibili.com/video/BV-image-error',
    };
    controller.state.summary = {
      video: controller.state.video,
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: controller.config.summary.defaultPromptId,
      content: '唯一的生图失败测试摘要',
      createdAt: Date.now(),
    };

    await controller.askSummaryQuestion('生图');

    const message = controller.state.summaryChatHistory[controller.state.summaryChatHistory.length - 1]?.content ?? '';
    expect(message).toContain('生成图片失败');
    expect(message).toContain('GM_addValueChangeListener');
    expect(controller.state.toast?.message).toBe(message);
  });

  it('reports clipboard write failures instead of claiming success', async () => {
    Object.defineProperty(globalThis, 'GM_setClipboard', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async () => { throw new Error('denied'); } } },
    });
    const controller = new AppController();
    controller.state.summary = {
      video: {
        source: 'bilibili',
        sourceId: 'BV-copy',
        bvid: 'BV-copy',
        cid: 1,
        title: '复制失败视频',
        url: 'https://www.bilibili.com/video/BV-copy',
      },
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '摘要',
      createdAt: Date.now(),
    };

    await controller.copySummary();

    expect(controller.state.status).toBe('摘要复制失败：denied');
  });

  it('reports missing connection settings before sending test requests', async () => {
    const controller = new AppController();
    controller.config = {
      ...DEFAULT_CONFIG,
      textAi: { ...DEFAULT_CONFIG.textAi, apiKey: '' },
      imageAi: { ...DEFAULT_CONFIG.imageAi, apiKey: '' },
    };

    await controller.testTextConnection();
    expect(controller.state.status).toBe('请先在设置中填写文本模型 API Key');
    await controller.testImageConnection();
    expect(controller.state.status).toBe('请先在设置中填写图片模型 API Key');
  });
});

describe('ui i18n', () => {
  it('starts collapsed even when legacy config saved an expanded panel', () => {
    expect(DEFAULT_CONFIG.ui.collapsed).toBe(true);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => JSON.stringify({ ...DEFAULT_CONFIG, ui: { ...DEFAULT_CONFIG.ui, collapsed: false } }),
        setItem: () => undefined,
      },
    });

    expect(loadConfig().ui.collapsed).toBe(true);
  });

  it('loads legacy AI values without keeping provider or one-image mode fields', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => JSON.stringify({
          ...DEFAULT_CONFIG,
          textAi: { ...DEFAULT_CONFIG.textAi, provider: 'custom', apiUrl: 'https://legacy.example/v1', model: 'legacy-model' },
          oneImage: { mode: 'text_card_only' },
        }),
        setItem: () => undefined,
      },
    });

    const config = loadConfig() as unknown as Record<string, any>;
    expect(config.textAi.apiUrl).toBe('https://legacy.example/v1');
    expect(config.textAi.model).toBe('legacy-model');
    expect(config.textAi.provider).toBeUndefined();
    expect(config.textAi.modelList).toBeUndefined();
    expect(config.oneImage).toBeUndefined();
  });

  it('selects localized UI and status text with Chinese fallback', () => {
    expect(getUiText('zh-CN', 'appName')).toBe('片语');
    expect(getUiText('en-US', 'appName')).toBe('Video Lens');
    expect(getUiText('zh-CN', 'tabs.summary')).toBe('摘要');
    expect(getUiText('en-US', 'tabs.summary')).toBe('Summary');
    expect(getUiText('zh-CN', 'summary.pageTitle')).toBe('片语-AI总结');
    expect(getUiText('en-US', 'summary.pageTitle')).toBe('Video Lens - AI Summary');
    expect(getUiText('en-US', 'summary.emptyTitle')).toBe('No summary yet');
    expect(getUiText('zh-CN', 'settings.generalGroup')).toBe('通用');
    expect(getUiText('zh-CN', 'settings.summaryPreset')).toBe('总结风格预设');
    expect(getUiText('zh-CN', 'settings.summaryPresetCustom')).toBe('自定义');
    expect(getUiText('zh-CN', 'settings.imagePromptPreset')).toBe('生图风格预设');
    expect(getUiText('zh-CN', 'settings.imagePresetPixelRpg')).toBe('Pixel RPG');
    expect(getUiText('zh-CN', 'settings.imageSize')).toBe('图片比例');
    expect(getUiText('en-US', 'settings.imageSizeWide')).toBe('Landscape 16:9');
    expect(getUiText('zh-CN', 'settings.summaryLanguage')).toBe('偏好字幕获取及总结语言');
    expect(getUiText('zh-CN', 'settings.chatgptImageHint')).toBe('保持根页打开，完成后自动返回');
    expect(getUiText('fr-FR', 'actions.saveSettings')).toBe('保存设置');
    expect(getStatusText('en-US', '生成摘要')).toBe('Generating summary');
    expect(getStatusText('en-US', 'MarkDown 已导出')).toBe('MarkDown exported');
    expect(getStatusText('en-US', '网络请求失败')).toBe('网络请求失败');
  });

});

describe('panel resizing', () => {
  it('clamps and persists panel width without a settings toast', () => {
    expect(DEFAULT_CONFIG.ui.panelWidth).toBe(420);
    expect(clampPanelWidth(260)).toBe(300);
    expect(clampPanelWidth(960)).toBe(900);
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const controller = new AppController();

    controller.updateConfig({ ui: { ...controller.config.ui, panelWidth: 520 } }, { showStatus: false });

    expect(controller.config.ui.panelWidth).toBe(520);
    expect(controller.state.status).not.toBe('设置已保存');
    expect(controller.state.toast).toBeUndefined();
  });
});

describe('harness entrypoint', () => {
  it('uses a root harness html entry and a dedicated dev script outside /test', () => {
    expect(DEV_HARNESS_COMMAND).toBe('vite --host 127.0.0.1');
    expect(HARNESS_ENTRY_SCRIPT).toBe('/src/harness/ui-panel-harness.ts');
    expect(HARNESS_ENTRY_SCRIPT).not.toContain('/test/');
  });
});

describe('route watcher wrappers', () => {
  it('marks wrapped history functions so repeated watchers can avoid double wrapping', () => {
    const wrapped = Object.assign(function pushState() {}, { __videoLensRouteWatcher: true });
    const legacyWrapped = Object.assign(function pushState() {}, { __videoSummaryRouteWatcher: true });

    expect(isVideoLensHistoryWrapper(wrapped)).toBe(true);
    expect(isVideoLensHistoryWrapper(legacyWrapped)).toBe(true);
    expect(isVideoLensHistoryWrapper(function pushState() {})).toBe(false);
  });
});

describe('summary transcript language label', () => {
  it('formats and selects visible subtitle labels', () => {
    expect(formatTranscriptLanguage({ language: '中文（自动生成）' })).toBe(
      '字幕：中文（自动生成）',
    );
    expect(formatTranscriptLanguage(undefined)).toBe('字幕：未读取');
    const options = [
      { id: 'zh', label: '中文', languageCode: 'zh' },
      { id: 'en', label: 'English', languageCode: 'en' },
    ];
    expect(selectedSubtitleLabel(options, 'en', { language: '中文' })).toBe('English');
    expect(selectedSubtitleLabel(options, 'missing', { language: '中文' })).toBe('中文');
    expect(shouldRenderSubtitleSelect(0)).toBe(false);
    expect(shouldRenderSubtitleSelect(1)).toBe(true);
    expect(shouldRenderSubtitleSelect(2)).toBe(true);
  });

  it('applies the preferred language to the current subtitle options', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const controller = new AppController();
    controller.state.subtitleOptions = [
      { id: 'zh-CN', label: '中文' },
      { id: 'en', label: 'English' },
    ];
    controller.state.selectedSubtitleId = 'zh-CN';
    controller.state.transcript = {
      language: '中文（自动生成）',
      languageCode: 'zh-CN',
      plainText: '字幕',
      lines: [],
      charCount: 2,
    };

    controller.updateConfig({ summary: { ...controller.config.summary, language: 'en-US' } });

    expect(controller.state.selectedSubtitleId).toBe('en');
    expect(controller.state.transcript).toBeUndefined();
  });
});

describe('video statistics presentation', () => {
  it('formats counts and uses readable line icons', () => {
    const followers = videoMetadataIconSpec('followers');
    const coin = videoMetadataIconSpec('coin');
    expect(followers).toMatchObject({ viewBox: '0 0 24 24', filled: false });
    expect(coin).toMatchObject({ viewBox: '0 0 24 24', filled: false });
    expect(followers.paths).toHaveLength(4);
    expect(coin.paths).toHaveLength(6);
    expect(formatCompactCount(9_876, 'zh-CN')).toBe('9876');
    expect(formatCompactCount(12_300, 'zh-CN')).toBe('1.2万');
    expect(formatCompactCount(123_000_000, 'zh-CN')).toBe('1.2亿');
    expect(formatCompactCount(12_300, 'en-US')).toBe('12.3K');
  });

  it('orders available metadata and omits invalid statistics', () => {
    expect(videoStatItems({
      favorites: 600,
      views: 100,
      danmaku: 200,
      comments: Number.NaN,
      likes: 400,
      coins: 500,
    }, 'zh-CN').map((item) => item.key)).toEqual([
      'views',
      'danmaku',
      'likes',
      'coins',
      'favorites',
    ]);
    const items = videoMetadataItems({
      source: 'bilibili',
      sourceId: 'BV-meta',
      title: 'Video',
      upName: '测试 UP',
      creatorFollowers: 123_456,
      publishedAt: 1_735_689_600,
      stats: {
        views: 1,
        danmaku: 2,
        comments: 3,
        likes: 4,
        coins: 5,
        favorites: 6,
      },
      url: 'https://www.bilibili.com/video/BV-meta',
    }, 'zh-CN');

    expect(items.map((item) => item.key)).toEqual([
      'creator',
      'followers',
      'uploaded',
      'views',
      'danmaku',
      'comments',
      'likes',
      'coins',
      'favorites',
    ]);
    expect(items[1]).toMatchObject({ icon: 'followers', label: '12.3万' });
  });
});

describe('sensitive config storage', () => {
  it('migrates legacy config to the new key without exposing localStorage secrets', () => {
    const data = new Map<string, string>();
    data.set(LEGACY_CONFIG_KEY, JSON.stringify({
      ...DEFAULT_CONFIG,
      textAi: { ...DEFAULT_CONFIG.textAi, model: 'legacy-model', apiKey: 'legacy-secret' },
    }));
    Object.defineProperty(globalThis, 'GM_getValue', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'GM_setValue', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });

    expect(loadConfig().textAi.model).toBe('legacy-model');
    expect(data.get(CONFIG_KEY)).toBeTruthy();
    expect(data.get(CONFIG_KEY)).not.toContain('legacy-secret');
    expect(data.get(LEGACY_CONFIG_KEY)).toContain('legacy-secret');
  });

  it('prefers new configuration over legacy configuration', () => {
    const data = new Map<string, string>([
      [CONFIG_KEY, JSON.stringify({ ...DEFAULT_CONFIG, textAi: { ...DEFAULT_CONFIG.textAi, model: 'new-model' } })],
      [LEGACY_CONFIG_KEY, JSON.stringify({ ...DEFAULT_CONFIG, textAi: { ...DEFAULT_CONFIG.textAi, model: 'old-model' } })],
    ]);
    Object.defineProperty(globalThis, 'GM_getValue', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });

    expect(loadConfig().textAi.model).toBe('new-model');
  });

  it('migrates legacy JSON caches without deleting the old cache', () => {
    const data = new Map<string, string>();
    data.set(LEGACY_SUMMARY_CACHE_KEY, JSON.stringify({
      key: { updatedAt: 1, value: { content: 'legacy summary' } },
    }));
    Object.defineProperty(globalThis, 'GM_getValue', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'GM_setValue', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const cache = makeJsonCache<{ content: string }>(SUMMARY_CACHE_KEY, LEGACY_SUMMARY_CACHE_KEY);

    expect(cache.get('key')).toEqual({ content: 'legacy summary' });
    expect(data.get(SUMMARY_CACHE_KEY)).toBe(data.get(LEGACY_SUMMARY_CACHE_KEY));
    expect(data.has(LEGACY_SUMMARY_CACHE_KEY)).toBe(true);
  });

  it('strips API keys before falling back to page localStorage', () => {
    const config = {
      ...DEFAULT_CONFIG,
      textAi: { ...DEFAULT_CONFIG.textAi, apiKey: 'text-secret' },
      imageAi: { ...DEFAULT_CONFIG.imageAi, apiKey: 'image-secret' },
    };

    expect(stripSensitiveConfigForStorage(config).textAi.apiKey).toBe('');
    expect(stripSensitiveConfigForStorage(config).imageAi.apiKey).toBe('');
  });

  it('does not persist API keys into localStorage when GM storage is unavailable', () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'GM_setValue', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });

    saveConfig({
      ...DEFAULT_CONFIG,
      textAi: { ...DEFAULT_CONFIG.textAi, apiKey: 'text-secret' },
      imageAi: { ...DEFAULT_CONFIG.imageAi, apiKey: 'image-secret' },
    });

    const stored = data.get(CONFIG_KEY) ?? '';
    expect(stored).not.toContain('text-secret');
    expect(stored).not.toContain('image-secret');
    expect(JSON.parse(stored).textAi.apiKey).toBe('');
    expect(JSON.parse(stored).imageAi.apiKey).toBe('');
  });
});

describe('settings secret fields', () => {
  it('hides, preserves, replaces, and labels saved API credentials', () => {
    expect(resolveSecretInput('saved-secret')).toEqual({
      value: '',
      placeholder: '已保存；留空则继续使用',
    });
    expect(resolveSecretValueForSave('saved-secret', '')).toBe('saved-secret');
    expect(resolveSecretValueForSave('saved-secret', ' Bearer new-secret ')).toBe('new-secret');
    expect(CONNECTION_TEST_LABEL).toBe('模型连通测试');

    const helpers = SettingsModal as unknown as {
      customPromptStartsExpanded: (selectedId: string, customText: string) => boolean;
      shouldExpandCustomPrompt: (previousId: string, nextId: string, hasSavedText: boolean) => boolean;
      validateCustomPrompt: (selectedId: string, customText: string) => string;
    };
    expect(helpers.customPromptStartsExpanded('summary_custom', '')).toBe(true);
    expect(helpers.customPromptStartsExpanded('summary_custom', '已保存')).toBe(false);
    expect(helpers.shouldExpandCustomPrompt('summary_plain', 'summary_custom', false)).toBe(true);
    expect(helpers.validateCustomPrompt('summary_custom', '   ')).toBe('请输入自定义 Prompt');
    expect(helpers.validateCustomPrompt('summary_plain', '')).toBe('');
  });
});

describe('toast notifications', () => {
  it('only turns user-facing reminders into transient toasts', () => {
    expect(shouldToastStatus('摘要已复制')).toBe(true);
    expect(shouldToastStatus('MarkDown 已导出')).toBe(true);
    expect(shouldToastStatus('请先生成摘要')).toBe(true);
    expect(shouldToastStatus('生成摘要')).toBe(false);
    expect(shouldToastStatus('获取字幕')).toBe(false);
  });
});

describe('panel navigation icons', () => {
  it('uses inline svg paths for navigation and collapse controls', () => {
    expect(panelIconPaths('summary')).toHaveLength(3);
    expect(panelIconPaths('summary')[0]).toContain('L16.5 7.5');
    expect(panelIconPaths('settings')).toHaveLength(2);
    expect(panelIconPaths('collapse')).toHaveLength(2);
  });
});

describe('panel fullscreen visibility', () => {
  it('detects standard and WebKit fullscreen state', () => {
    expect(isDocumentFullscreen({ fullscreenElement: {} as Element })).toBe(true);
    expect(isDocumentFullscreen({ webkitFullscreenElement: {} as Element })).toBe(true);
    expect(isDocumentFullscreen({ fullscreenElement: null, webkitFullscreenElement: null })).toBe(false);
  });
});

describe('panel settings navigation guard', () => {
  it('handles clean, confirmed, and cancelled settings navigation', () => {
    let prompts = 0;
    expect(shouldLeaveSettingsTab(false, () => {
      prompts += 1;
      return true;
    })).toBe(true);
    expect(prompts).toBe(0);
    let saved = 0;
    expect(shouldLeaveSettingsTab(true, () => true, () => {
      saved += 1;
      return true;
    })).toBe(true);
    expect(saved).toBe(1);
    expect(shouldLeaveSettingsTab(true, () => false, () => true)).toBe(false);

    const animation = PanelModule as unknown as {
      panelTransitionDuration: (reducedMotion: boolean) => number;
      canStartPanelTransition: (transitionActive: boolean) => boolean;
    };
    expect(animation.panelTransitionDuration(false)).toBe(200);
    expect(animation.panelTransitionDuration(true)).toBe(0);
    expect(animation.canStartPanelTransition(false)).toBe(true);
    expect(animation.canStartPanelTransition(true)).toBe(false);
    expect(PANEL_STYLES).toContain('@keyframes vs-panel-enter');
    expect(PANEL_STYLES).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('summary markdown export', () => {
  const video = {
    source: 'bilibili' as const,
    sourceId: 'BV-export',
    bvid: 'BV-export',
    cid: 1,
    title: '测试/视频:标题',
    upName: 'Demo Creator',
    url: 'https://www.bilibili.com/video/BV-export',
  };

  it('builds markdown content and a safe filename', () => {
    const markdown = buildSummaryMarkdown({
      video,
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '# 结论\n\n核心内容',
      createdAt: 1,
    });

    expect(markdown).toContain('# 测试/视频:标题');
    expect(markdown).toContain('- Creator: Demo Creator');
    expect(markdown).toContain('- Platform: bilibili');
    expect(markdown).toContain('- 原链接: https://www.bilibili.com/video/BV-export');
    expect(markdown).toContain('# 结论\n\n核心内容');
    expect(summaryMarkdownFileName(video.title)).toBe('测试_视频_标题.md');
  });
});
