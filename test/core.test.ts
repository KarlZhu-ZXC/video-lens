import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/ai/chunking';
import { normalizeImageResponseFormat, parseGeneratedImage, sanitizeImagePrompt } from '../src/ai/image/DirectOpenAIImageClient';
import { normalizeChatCompletionsUrl } from '../src/ai/text/DirectOpenAITextClient';
import { applyTextProviderConfig, getTextProvider, normalizeApiKey, normalizeMiniMaxBaseUrl } from '../src/ai/text/providers';
import { createOpenAIStreamParser, parseOpenAIStreamDeltas } from '../src/ai/text/streamParser';
import type { TextAiClient } from '../src/ai/text/TextAiClient';
import {
  AppController,
  buildSummaryMarkdown,
  shouldToastStatus,
  summaryMarkdownFileName,
} from '../src/app/AppController';
import {
  generateImagePrompt,
  isMetaImagePrompt,
  normalizeImagePromptOutput,
} from '../src/onePage/imagePromptPipeline';
import { runOnePagePipeline } from '../src/onePage/onePagePipeline';
import { IMAGE_PROMPT_MAX_CHARS } from '../src/prompts/toolPrompts';
import { BUILT_IN_PROMPTS, getPromptTemplate } from '../src/prompts/defaultPrompts';
import { parseOnePageJson } from '../src/onePage/onePageSchema';
import { renderPrompt } from '../src/prompts/renderPrompt';
import {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  stripSensitiveConfigForStorage,
} from '../src/store/configStore';
import { CONFIG_KEY } from '../src/store/types';
import { summaryCache } from '../src/store/summaryCache';
import { onePageCache } from '../src/store/onePageCache';
import { estimateSummaryMaxTokens, runSummaryPipeline } from '../src/summary/summaryPipeline';
import { extractThinkBlocks } from '../src/summary/think';
import { getStatusText, getUiText } from '../src/ui/i18n';
import { resolveOneImageStatus } from '../src/ui/oneImageView';
import { clampPanelWidth, panelIconPaths } from '../src/ui/panel';
import { formatTranscriptLanguage, resolveThinkingOpen } from '../src/ui/summaryView';
import { isVideoSummaryHistoryWrapper } from '../src/sources/bilibili/routeWatcher';
import { CONNECTION_TEST_LABEL, resolveSecretInput, resolveSecretValueForSave } from '../src/ui/settingsModal';
import { normalizeAssetUrl } from '../src/utils/url';
import { resolveThinkingPresentation } from '../src/ui/aiResponse';
import { DEV_HARNESS_COMMAND, HARNESS_ENTRY_SCRIPT } from '../src/harness/constants';
import { PANEL_STYLES } from '../src/ui/styles';

describe('renderPrompt', () => {
  it('replaces known variables and leaves missing variables empty', () => {
    expect(renderPrompt('标题：{{title}} 作者：{{upName}} 空：{{missing}}', { title: '测试视频' })).toBe(
      '标题：测试视频 作者： 空：',
    );
  });

  it('provides English templates for all built-in text generation prompts used by summary flows', () => {
    const textPromptTypes = new Set(['summary', 'chunk_summary', 'merge_summary', 'video_insights', 'one_page_json']);
    const prompts = BUILT_IN_PROMPTS.filter((prompt) => textPromptTypes.has(prompt.type));

    expect(prompts.every((prompt) => Boolean(prompt.enTemplate))).toBe(true);
    expect(getPromptTemplate(prompts[0], 'en-US')).not.toBe(prompts[0].template);
  });
});

describe('chunkText', () => {
  it('splits long text with overlap and max chunk limit', () => {
    const chunks = chunkText('abcdefghijklmnop', { targetChars: 6, overlapChars: 2, maxChunks: 3 });
    expect(chunks).toEqual(['abcdef', 'efghij', 'ijklmn']);
  });
});

describe('parseOpenAIStreamDeltas', () => {
  it('extracts streamed content and reasoning deltas', () => {
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
  });

  it('keeps partial SSE lines until the next chunk arrives', () => {
    const parse = createOpenAIStreamParser();
    expect(parse('data: {"choices":[{"delta":{"content":"Hel')).toEqual([]);
    expect(parse('lo"}}]}\n')).toEqual([{ content: 'Hello', reasoning: '' }]);
  });
});

describe('summary max tokens', () => {
  it('scales with transcript length and keeps a higher floor', () => {
    expect(estimateSummaryMaxTokens(2000, 2000)).toBe(3000);
    expect(estimateSummaryMaxTokens(2000, 20000)).toBe(9000);
  });
});

describe('long summary streaming', () => {
  it('keeps chunk summaries visible while merging long videos', async () => {
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

    await runSummaryPipeline({
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

    expect(deltas[0].content).toContain('第一段摘要');
    expect(deltas[1].content).toContain('第二段摘要');
    expect(deltas[2].content).toContain('第一段摘要');
    expect(deltas[2].content).toContain('第二段摘要');
    expect(deltas[deltas.length - 1]?.content).toBe('# 合并结果');
  });
});

describe('extractThinkBlocks', () => {
  it('moves think tags out of visible content', () => {
    expect(extractThinkBlocks('<think>推理过程</think># 结论')).toEqual({
      content: '# 结论',
      reasoning: '推理过程',
      inThink: false,
    });
  });

  it('tracks split think tags across streamed chunks', () => {
    const first = extractThinkBlocks('<think>推理', false);
    const second = extractThinkBlocks('过程</think># 结论', first.inThink);
    expect(first).toEqual({ content: '', reasoning: '推理', inThink: true });
    expect(second).toEqual({ content: '# 结论', reasoning: '过程', inThink: false });
  });
});

describe('summary thinking panel', () => {
  it('does not reopen during streaming after the user collapses it', () => {
    expect(resolveThinkingOpen(true, false)).toBe(false);
  });

  it('defaults to open during streaming before the user changes it', () => {
    expect(resolveThinkingOpen(true, undefined)).toBe(true);
  });

  it('shows only an inline thinking status before visible content streams', () => {
    expect(resolveThinkingPresentation('模型正在分析结构', false, true)).toEqual({
      mode: 'active-inline',
      text: '模型正在分析结构',
    });
  });

  it('hides thinking once visible content starts streaming', () => {
    expect(resolveThinkingPresentation('模型正在分析结构', true, true)).toEqual({
      mode: 'hidden',
      text: '',
    });
  });

  it('collapses thinking after streaming completes', () => {
    expect(resolveThinkingPresentation('模型正在分析结构', true, false)).toEqual({
      mode: 'complete-collapsed',
      text: '模型正在分析结构',
    });
  });
});

describe('asset URL normalization', () => {
  it('upgrades insecure display assets to HTTPS', () => {
    expect(normalizeAssetUrl('http://i0.hdslb.com/bfs/archive/cover.jpg')).toBe(
      'https://i0.hdslb.com/bfs/archive/cover.jpg',
    );
  });

  it('resolves protocol-relative assets as HTTPS', () => {
    expect(normalizeAssetUrl('//i0.hdslb.com/bfs/archive/cover.jpg')).toBe(
      'https://i0.hdslb.com/bfs/archive/cover.jpg',
    );
  });

  it('preserves data URLs and existing HTTPS URLs', () => {
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

describe('MiniMax provider config', () => {
  it('accepts raw API keys or copied Authorization header values', () => {
    expect(normalizeApiKey(' sk-test ')).toBe('sk-test');
    expect(normalizeApiKey('Bearer sk-test')).toBe('sk-test');
  });

  it('normalizes complete endpoints without changing the user-provided host', () => {
    expect(normalizeMiniMaxBaseUrl('https://api.minimaxi.com/v1/chat/completions')).toBe(
      'https://api.minimaxi.com/v1',
    );
    expect(normalizeMiniMaxBaseUrl('https://example.com/proxy/v1/')).toBe('https://example.com/proxy/v1');
  });

  it('applies MiniMax defaults and rejects unknown models', () => {
    const config = applyTextProviderConfig(
      {
        provider: 'minimax',
        providerMode: 'direct',
        apiUrl: '',
        apiKey: '',
        model: '',
        modelList: [],
        temperature: 0.7,
        maxTokens: 2000,
        stream: true,
        requestMode: 'auto',
      },
      { providerId: 'minimax', baseUrl: 'https://api.minimaxi.com/v1', apiKey: ' key ', model: 'unknown' },
    );
    expect(config.apiUrl).toBe('https://api.minimaxi.com/v1');
    expect(config.apiKey).toBe('key');
    expect(config.model).toBe('MiniMax-M2.7');
    expect(config.modelList).toContain('MiniMax-M2.7');
  });

  it('shows provider labels correctly and applies DeepSeek defaults', () => {
    expect(getTextProvider('minimax').label).toBe('MiniMax-CN');
    const config = applyTextProviderConfig(
      {
        provider: 'minimax',
        providerMode: 'direct',
        apiUrl: '',
        apiKey: '',
        model: '',
        modelList: [],
        temperature: 0.7,
        maxTokens: 2000,
        stream: true,
        requestMode: 'auto',
      },
      { providerId: 'deepseek', baseUrl: '', apiKey: 'Bearer ds-test', model: 'deepseek-reasoner' },
    );

    expect(config.provider).toBe('deepseek');
    expect(config.apiUrl).toBe('https://api.deepseek.com/v1');
    expect(config.apiKey).toBe('ds-test');
    expect(config.model).toBe('deepseek-reasoner');
  });

  it('preserves custom Base URL values when saving provider settings', () => {
    const config = applyTextProviderConfig(
      {
        provider: 'minimax',
        providerMode: 'direct',
        apiUrl: 'https://old.example/v1',
        apiKey: '',
        model: 'MiniMax-M2.1',
        modelList: [],
        temperature: 0.7,
        maxTokens: 2000,
        stream: true,
        requestMode: 'auto',
      },
      {
        providerId: 'minimax',
        baseUrl: 'https://my-proxy.example.com/minimax/v1/',
        apiKey: 'sk-test',
        model: 'MiniMax-M2.1',
      },
    );
    expect(config.apiUrl).toBe('https://my-proxy.example.com/minimax/v1');
  });

  it('supports custom OpenAI-compatible text providers with user supplied base URL and model', () => {
    const config = applyTextProviderConfig(
      {
        provider: 'minimax',
        providerMode: 'direct',
        apiUrl: '',
        apiKey: '',
        model: '',
        modelList: [],
        temperature: 0.7,
        maxTokens: 2000,
        stream: true,
        requestMode: 'auto',
      },
      {
        providerId: 'custom',
        baseUrl: 'https://llm.example.com/openai/v1/chat/completions',
        apiKey: ' custom-key ',
        model: 'my-custom-model',
      },
    );

    expect(config.provider).toBe('custom');
    expect(config.apiUrl).toBe('https://llm.example.com/openai/v1');
    expect(config.apiKey).toBe('custom-key');
    expect(config.model).toBe('my-custom-model');
  });
});

describe('parseOnePageJson', () => {
  it('extracts JSON from markdown fences and validates the one page schema', () => {
    const parsed = parseOnePageJson(`\`\`\`json
{
  "title": "视频核心",
  "conclusion": "这是一个结论",
  "keyPoints": [
    { "title": "第一点", "detail": "详细说明一" },
    { "title": "第二点", "detail": "详细说明二" },
    { "title": "第三点", "detail": "详细说明三" }
  ],
  "takeaways": ["立刻可用"],
  "tags": ["总结"],
  "source": { "title": "原视频", "url": "https://www.bilibili.com/video/BV1" }
}
\`\`\``);

    expect(parsed.title).toBe('视频核心');
    expect(parsed.keyPoints).toHaveLength(3);
  });

  it('removes think blocks before parsing one page JSON', () => {
    const parsed = parseOnePageJson(`<think>先分析结构</think>{
      "title": "视频核心",
      "conclusion": "这是一个结论",
      "keyPoints": [
        { "title": "第一点", "detail": "详细说明一" },
        { "title": "第二点", "detail": "详细说明二" },
        { "title": "第三点", "detail": "详细说明三" }
      ],
      "takeaways": ["立刻可用"],
      "tags": ["总结"],
      "source": { "title": "原视频", "url": "https://www.bilibili.com/video/BV1" }
    }`);

    expect(parsed.title).toBe('视频核心');
  });

  it('throws a readable error when one page JSON is not valid JSON', () => {
    expect(() => parseOnePageJson('{ title: "视频核心" }')).toThrow('一图流 JSON 解析失败');
  });
});

describe('one page regeneration', () => {
  it('bypasses cached JSON when force regeneration is requested', async () => {
    const createNode = (tagName: string): any => ({
      tagName: tagName.toUpperCase(),
      style: {},
      children: [],
      className: '',
      append(...children: unknown[]) {
        this.children.push(...children);
      },
      setAttribute(key: string, value: string) {
        this[key] = value;
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: createNode, createTextNode: (text: string) => ({ text }) },
    });
    Object.defineProperty(globalThis, 'Node', {
      configurable: true,
      value: function TestNode() {},
    });
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const summary = {
      video: {
        source: 'bilibili' as const,
        sourceId: 'BV-force',
        bvid: 'BV-force',
        cid: 1,
        title: '强制重新生成',
        url: 'https://www.bilibili.com/video/BV-force',
      },
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '摘要',
      createdAt: Date.now(),
    };
    let calls = 0;
    const client: TextAiClient = {
      async complete() {
        calls += 1;
        return {
          content: JSON.stringify({
            title: calls === 1 ? '旧一图流' : '新一图流',
            conclusion: '结论',
            keyPoints: [
              { title: '一', detail: '一' },
              { title: '二', detail: '二' },
              { title: '三', detail: '三' },
            ],
            takeaways: ['行动'],
            tags: ['标签'],
            source: { title: '源', url: 'https://www.bilibili.com/video/BV-force' },
          }),
        };
      },
    };

    await runOnePagePipeline({ summary, textAiClient: client, config: DEFAULT_CONFIG });
    const forced = await runOnePagePipeline({ summary, textAiClient: client, config: DEFAULT_CONFIG, force: true });

    expect(forced.data.title).toBe('新一图流');
    expect(calls).toBe(2);
    onePageCache.clear();
  });
});

describe('generateImagePrompt', () => {
  it('removes think blocks before sending prompt text to image generation', async () => {
    const client: TextAiClient = {
      async complete() {
        return { content: '<think>分析用户视频内容和风格</think>cinematic market risk poster, clean Chinese layout' };
      },
    };

    const prompt = await generateImagePrompt(
      {
        title: '视频核心',
        conclusion: '这是一个结论',
        keyPoints: [
          { title: '第一点', detail: '详细说明一' },
          { title: '第二点', detail: '详细说明二' },
          { title: '第三点', detail: '详细说明三' },
        ],
        takeaways: ['立刻可用'],
        tags: ['总结'],
        source: { title: '原视频', url: 'https://www.bilibili.com/video/BV1' },
      },
      client,
      DEFAULT_CONFIG,
    );

    expect(prompt).toBe('cinematic market risk poster, clean Chinese layout');
  });

  it('uses the original English background prompt instruction', async () => {
    let message = '';
    const client: TextAiClient = {
      async complete(request) {
        message = request.messages.map((item) => item.content).join('\n');
        return { content: 'cinematic market risk poster background, no text, no logo' };
      },
    };

    await generateImagePrompt(
      {
        title: '视频核心',
        conclusion: '这是一个结论',
        keyPoints: [
          { title: '第一点', detail: '详细说明一' },
          { title: '第二点', detail: '详细说明二' },
          { title: '第三点', detail: '详细说明三' },
        ],
        takeaways: ['立刻可用'],
        tags: ['总结'],
        source: { title: '原视频', url: 'https://www.bilibili.com/video/BV1' },
      },
      client,
      DEFAULT_CONFIG,
    );

    expect(message).toContain('英文 prompt');
    expect(message).toContain('抽象视觉背景');
  });

  it('unwraps tool-style prompt JSON and detects meta answers', () => {
    expect(normalizeImagePromptOutput('{"prompt":"cinematic beach camping infographic background"}')).toBe(
      'cinematic beach camping infographic background',
    );
    expect(isMetaImagePrompt('The user wants an English prompt, so we need to craft one.')).toBe(true);
    expect(isMetaImagePrompt('Cinematic beach camping scene, soft morning light')).toBe(false);
  });

  it('falls back when the text model returns analysis instead of an image prompt', async () => {
    const client: TextAiClient = {
      async complete() {
        return { content: 'The user wants an English image prompt, so we need to craft it carefully.' };
      },
    };

    const prompt = await generateImagePrompt(
      {
        title: '赶海露营',
        conclusion: '记录海边赶海、露营和抓螃蟹',
        keyPoints: [
          { title: '赶海', detail: '在海滩挖贝壳和蛤蜊' },
          { title: '露营', detail: '搭帐篷做饭' },
          { title: '抓螃蟹', detail: '夜晚寻找螃蟹' },
        ],
        takeaways: ['适合海边户外玩家'],
        tags: ['赶海', '露营', '螃蟹'],
        source: { title: '海边生活', url: 'https://www.bilibili.com/video/BV1' },
      },
      client,
      DEFAULT_CONFIG,
    );

    expect(prompt).toContain('Abstract editorial infographic background');
    expect(prompt).toContain('赶海露营');
    expect(prompt).not.toMatch(/^The user wants/i);
  });
});

describe('image generation client helpers', () => {
  it('maps OpenAI b64_json response format to MiniMax base64', () => {
    expect(normalizeImageResponseFormat('https://api.minimaxi.com/v1/image_generation', 'b64_json')).toBe('base64');
    expect(normalizeImageResponseFormat('https://api.openai.com/v1/images/generations', 'b64_json')).toBe('b64_json');
  });

  it('parses MiniMax base64 image responses', () => {
    expect(parseGeneratedImage({ data: [{ base64: 'abc' }] }).dataUrl).toBe('data:image/png;base64,abc');
    expect(parseGeneratedImage({ data: { image_base64: ['def'] } }).dataUrl).toBe('data:image/png;base64,def');
    expect(parseGeneratedImage({ data: { image_base64: 'ghi' } }).dataUrl).toBe('data:image/png;base64,ghi');
    expect(parseGeneratedImage({ image_base64: ['jkl'] }).dataUrl).toBe('data:image/png;base64,jkl');
  });

  it('keeps image prompts under the provider-safe limit', () => {
    expect(sanitizeImagePrompt('a'.repeat(1600)).length).toBe(IMAGE_PROMPT_MAX_CHARS);
  });
});

describe('one image status', () => {
  it('does not show stale follow-up status on the one image page', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const controller = new AppController();
    controller.state.status = '已回答';

    expect(resolveOneImageStatus(controller)).toBe('等待生成一图流');
  });
});

describe('AppController one page generation', () => {
  it('does not auto-regenerate a summary when one page is requested without a summary', async () => {
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
      sourceId: 'BV-empty',
      bvid: 'BV-empty',
      cid: 1,
      title: '空缓存视频',
      url: 'https://www.bilibili.com/video/BV-empty',
    };
    let summaryCalls = 0;
    controller.generateSummary = async () => {
      summaryCalls += 1;
    };

    await controller.generateOnePage();

    expect(summaryCalls).toBe(0);
    expect(controller.state.status).toBe('请先生成摘要');
  });

  it('restores a summary from cache before generating one page', async () => {
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
      sourceId: 'BV-cache',
      bvid: 'BV-cache',
      cid: 1,
      title: '缓存视频',
      url: 'https://www.bilibili.com/video/BV-cache',
    };
    summaryCache.set('legacy-cache-key', {
      video: controller.state.video,
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '缓存摘要',
      createdAt: Date.now(),
    });

    const restored = await (controller as any).restoreCachedSummary();

    expect(restored).toBe(true);
    expect(controller.state.summary?.content).toBe('缓存摘要');
  });
});

describe('AppController cache management and clipboard', () => {
  it('clears the current video summary cache and state summary', () => {
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
    summaryCache.set((controller as any).summaryCacheKey(controller.state.video.sourceId), controller.state.summary);

    controller.clearCurrentSummaryCache();

    expect(controller.state.summary).toBeUndefined();
    expect(summaryCache.get((controller as any).summaryCacheKey('BV-clear'))).toBeUndefined();
    expect(controller.state.status).toBe('已清除此视频缓存');
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
  it('starts from the floating mascot launcher instead of an expanded panel', () => {
    expect(DEFAULT_CONFIG.ui.collapsed).toBe(true);
  });

  it('does not restore an expanded panel from saved configuration on startup', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => JSON.stringify({ ...DEFAULT_CONFIG, ui: { ...DEFAULT_CONFIG.ui, collapsed: false } }),
        setItem: () => undefined,
      },
    });

    expect(loadConfig().ui.collapsed).toBe(true);
  });

  it('returns Chinese by default and English when requested', () => {
    expect(getUiText('zh-CN', 'appName')).toBe('AI总结');
    expect(getUiText('zh-CN', 'tabs.summary')).toBe('摘要');
    expect(getUiText('en-US', 'tabs.summary')).toBe('Summary');
    expect(getUiText('en-US', 'summary.emptyTitle')).toBe('No summary yet');
  });

  it('falls back to Chinese for unknown language values', () => {
    expect(getUiText('fr-FR', 'actions.saveSettings')).toBe('保存设置');
  });

  it('translates known status messages and preserves unknown details', () => {
    expect(getStatusText('en-US', '生成摘要')).toBe('Generating summary');
    expect(getStatusText('en-US', 'MarkDown 已导出')).toBe('MarkDown exported');
    expect(getStatusText('en-US', '网络请求失败')).toBe('网络请求失败');
  });
});

describe('panel resizing', () => {
  it('keeps panel width in config without exposing a settings dropdown', () => {
    expect(DEFAULT_CONFIG.ui.panelWidth).toBe(420);
  });

  it('uses wider resize bounds for all tabs', () => {
    expect(clampPanelWidth(260)).toBe(300);
    expect(clampPanelWidth(960)).toBe(900);
  });

  it('can persist resize changes without showing a settings-saved toast', () => {
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
    const wrapped = Object.assign(function pushState() {}, { __videoSummaryRouteWatcher: true });

    expect(isVideoSummaryHistoryWrapper(wrapped)).toBe(true);
    expect(isVideoSummaryHistoryWrapper(function pushState() {})).toBe(false);
  });
});

describe('summary transcript language label', () => {
  it('makes selected subtitle language visible in the summary view', () => {
    expect(formatTranscriptLanguage({ language: '中文（自动生成）' })).toBe(
      '字幕：中文（自动生成）',
    );
    expect(formatTranscriptLanguage(undefined)).toBe('字幕：未读取');
  });

  it('clears the previous subtitle selection when summary language changes', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const controller = new AppController();
    controller.state.selectedSubtitleId = 'zh-CN';
    controller.state.transcript = {
      language: '中文（自动生成）',
      languageCode: 'zh-CN',
      plainText: '字幕',
      lines: [],
      charCount: 2,
    };

    controller.updateConfig({ summary: { ...controller.config.summary, language: 'en-US' } });

    expect(controller.state.selectedSubtitleId).toBeUndefined();
    expect(controller.state.transcript).toBeUndefined();
  });
});

describe('video insights chat styling', () => {
  it('only styles direct message paragraphs as chat bubbles', () => {
    expect(PANEL_STYLES).toContain('.vs-message > p');
    expect(PANEL_STYLES).toContain('.vs-message.assistant > p');
    expect(PANEL_STYLES).not.toContain('.vs-message p {');
    expect(PANEL_STYLES).not.toContain('.vs-message.assistant p {');
  });
});

describe('sensitive config storage', () => {
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
  it('does not expose saved API keys as input values', () => {
    expect(resolveSecretInput('saved-secret')).toEqual({
      value: '',
      placeholder: '已保存；留空则继续使用',
    });
  });

  it('preserves saved API keys when the input is left blank', () => {
    expect(resolveSecretValueForSave('saved-secret', '')).toBe('saved-secret');
    expect(resolveSecretValueForSave('saved-secret', ' Bearer new-secret ')).toBe('new-secret');
  });

  it('uses one explicit label for real API connectivity tests', () => {
    expect(CONNECTION_TEST_LABEL).toBe('连通性测试');
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
    expect(panelIconPaths('summary')).toHaveLength(5);
    expect(panelIconPaths('videoInsights')).toHaveLength(2);
    expect(panelIconPaths('oneImage')).toHaveLength(3);
    expect(panelIconPaths('settings')).toHaveLength(2);
    expect(panelIconPaths('collapse')).toHaveLength(2);
  });
});

describe('summary markdown export', () => {
  const video = {
    source: 'bilibili' as const,
    sourceId: 'BV-export',
    bvid: 'BV-export',
    cid: 1,
    title: '测试/视频:标题',
    upName: 'Karl',
    url: 'https://www.bilibili.com/video/BV-export',
  };

  it('builds a markdown document with video metadata and summary content', () => {
    const markdown = buildSummaryMarkdown({
      video,
      transcript: { plainText: '字幕', lines: [], charCount: 2 },
      promptId: DEFAULT_CONFIG.summary.defaultPromptId,
      content: '# 结论\n\n核心内容',
      createdAt: 1,
    });

    expect(markdown).toContain('# 测试/视频:标题');
    expect(markdown).toContain('- UP: Karl');
    expect(markdown).toContain('- 原链接: https://www.bilibili.com/video/BV-export');
    expect(markdown).toContain('# 结论\n\n核心内容');
  });

  it('uses a safe filename for exported markdown', () => {
    expect(summaryMarkdownFileName(video.title)).toBe('测试_视频_标题.md');
  });
});
