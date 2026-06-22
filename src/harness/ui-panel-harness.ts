import { Panel } from '../ui/panel';
import { DEFAULT_CONFIG } from '../store/configStore';
import { createInitialState } from '../app/AppState';
import type { AppController } from '../app/AppController';

const GENERATED_IMAGE_FIXTURE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#18181b"/><circle cx="620" cy="180" r="130" fill="#7c3aed"/><text x="72" y="570" fill="#a78bfa" font-family="sans-serif" font-size="34">VIDEO LENS</text><text x="72" y="650" fill="#fafafa" font-family="sans-serif" font-size="64" font-weight="700">Core Insight</text></svg>');

const listeners = new Set<() => void>();
const controller = {
  config: {
    ...DEFAULT_CONFIG,
    ui: { ...DEFAULT_CONFIG.ui, collapsed: true, language: 'en-US' },
  },
  state: {
    ...createInitialState(),
    video: {
      source: 'bilibili',
      sourceId: 'BV-harness',
      bvid: 'BV-harness',
      cid: 1,
      title: 'Understanding Large Language Models in 2024',
      upName: 'AI Research Lab',
      creatorFollowers: 128_600,
      coverUrl:
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 240 160%22%3E%3Crect width=%22240%22 height=%22160%22 fill=%22%2309090b%22/%3E%3Ccircle cx=%22178%22 cy=%2252%22 r=%2244%22 fill=%22%237c3aed%22 opacity=%22.45%22/%3E%3Cpath d=%22M30 118h180%22 stroke=%22%2334d399%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M44 86h94%22 stroke=%22%23a78bfa%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
      duration: 754,
      publishedAt: 1717200000,
      stats: {
        views: 1_234_567,
        danmaku: 45_678,
        comments: 8_765,
        likes: 234_567,
        coins: 56_789,
        favorites: 98_765,
      },
      url: 'https://www.bilibili.com/video/BV-harness',
    },
    transcript: { language: 'English', plainText: 'Mock transcript', lines: [], charCount: 15 },
    subtitleOptions: [
      { id: 'zh', label: '中文', languageCode: 'zh' },
      { id: 'en', label: 'English', languageCode: 'en' },
      { id: 'ja', label: '日本語', languageCode: 'ja' },
    ],
    selectedSubtitleId: 'en',
    status: 'Ready',
  },
  events: {
    on(_event: string, callback: () => void) {
      listeners.add(callback);
    },
  },
  toggleCollapsed() {
    controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: !controller.config.ui.collapsed } };
    panel.render();
  },
  async openFromLauncher() {
    if (!controller.config.ui.collapsed) return;
    controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
    panel.render();
    if (!controller.state.summary) await controller.generateSummary();
  },
  async generateSummary() {
    controller.state = {
      ...controller.state,
      status: 'Summary generated',
      summary: {
        video: controller.state.video!,
        transcript: controller.state.transcript!,
        promptId: controller.config.summary.defaultPromptId,
        content: '# Conclusion\n\nThe video explains how model architecture choices affect latency, cost, and integration decisions.',
        createdAt: Date.now(),
      },
    };
    panel.render();
  },
  async copySummary() {},
  exportSummaryMarkdown() {},
  downloadGeneratedImage() {},
  async askSummaryQuestion(question: string) {
    controller.state = {
      ...controller.state,
      summaryChatHistory: [
        ...controller.state.summaryChatHistory,
        { role: 'user' as const, content: question },
        question === '生图'
          ? { role: 'assistant' as const, content: '', generatedImage: { dataUrl: GENERATED_IMAGE_FIXTURE } }
          : { role: 'assistant' as const, content: 'The main tradeoff is quality versus latency and operating cost.' },
      ],
    };
    panel.render();
  },
  updateSelectedSubtitle(subtitleId: string) {
    controller.state = { ...controller.state, selectedSubtitleId: subtitleId };
    panel.render();
  },

  clearCurrentSummaryCache() {
    controller.state = { ...controller.state, summary: undefined, status: 'Cleared this video cache' };
    panel.render();
  },
  clearAllCaches() {
    controller.state = { ...controller.state, summary: undefined, status: 'Cleared all caches' };
    panel.render();
  },
  testTextConnection() {
    controller.state = { ...controller.state, status: 'Text model settings ready' };
    panel.render();
  },
  testImageConnection() {
    controller.state = { ...controller.state, status: 'Image model settings ready' };
    panel.render();
  },
  updateConfig(patch: Partial<typeof DEFAULT_CONFIG>) {
    controller.config = { ...controller.config, ...patch };
    panel.render();
  },
} as unknown as AppController;



const scenario = new URL(location.href).searchParams.get('scenario');
if (scenario === 'long-summary') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = {
    ...controller.state,
    busy: true,
    status: '生成摘要',
    streamingSummary: {
      video: controller.state.video!,
      transcript: controller.state.transcript!,
      promptId: controller.config.summary.defaultPromptId,
      reasoning: '模型正在分析视频结构、提炼论点和生成中文总结。',
      reasoningStartedAt: Date.now() - 4_000,
      content: Array.from(
        { length: 96 },
        (_, index) =>
          `第 ${index + 1} 点：这是一段用于验证长中文摘要滚动行为的内容。它应该只让摘要输出卡片滚动，而不是让右侧导航栏左边再出现一层外部滚动条。`,
      ).join('\n\n'),
      createdAt: Date.now(),
    },
  };
}
if (scenario === 'thinking-summary') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = {
    ...controller.state,
    busy: true,
    status: '生成摘要',
    streamingSummary: {
      video: controller.state.video!,
      transcript: controller.state.transcript!,
      promptId: controller.config.summary.defaultPromptId,
      reasoning: '正在分析字幕结构，识别视频的核心论点与支撑信息。',
      reasoningStartedAt: Date.now() - 4_000,
      content: '',
      createdAt: Date.now(),
    },
  };
}
if (scenario === 'pending-summary') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = {
    ...controller.state,
    busy: true,
    summary: undefined,
    streamingSummary: undefined,
    summaryRequestPending: true,
    status: '生成摘要',
  };
}
if (scenario === 'settings') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false, defaultTab: 'settings' } };
}

if (scenario === 'settings-chatgpt') {
  controller.config = {
    ...controller.config,
    imageAi: {
      ...controller.config.imageAi,
      mode: 'chatgpt_web',
      chatgptConversationUrl: 'https://chatgpt.com/g/g-p-video-lens/project',
    },
    ui: { ...controller.config.ui, collapsed: false, defaultTab: 'settings' },
  };
}

if (scenario === 'settings-custom') {
  controller.config = {
    ...controller.config,
    summary: { ...controller.config.summary, defaultPromptId: 'summary_custom' },
    prompts: {
      customPresets: [{
        id: 'summary_custom',
        name: 'Custom',
        type: 'summary',
        template: 'Summarize with this custom structure:\n\n{{transcript}}',
        builtIn: false,
      }],
    },
    ui: { ...controller.config.ui, collapsed: false, defaultTab: 'settings' },
  };
}

if (scenario === 'empty-summary') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = { ...controller.state, summary: undefined, streamingSummary: undefined, busy: false };
}

if (scenario === 'completed-summary') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = {
    ...controller.state,
    summary: {
      video: controller.state.video!,
      transcript: controller.state.transcript!,
      promptId: controller.config.summary.defaultPromptId,
      content: '# Conclusion\n\nCompleted summary with left-aligned actions and a normal chat composer.',
      reasoning: 'I compared the transcript sections and selected the recurring claims.',
      reasoningDurationMs: 12_000,
      createdAt: Date.now(),
    },
  };
}

if (scenario === 'chat-image') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = {
    ...controller.state,
    summary: {
      video: controller.state.video!,
      transcript: controller.state.transcript!,
      promptId: controller.config.summary.defaultPromptId,
      content: '# Conclusion\n\nArchitecture choices trade quality against latency and cost.',
      createdAt: Date.now(),
    },
    summaryChatHistory: [
      { role: 'user', content: 'What is the main tradeoff?' },
      { role: 'assistant', content: 'The main tradeoff is quality versus latency and operating cost.' },
      { role: 'user', content: '生图' },
      { role: 'assistant', content: '', generatedImage: { dataUrl: GENERATED_IMAGE_FIXTURE } },
    ],
  };
}

if (scenario === 'error') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = { ...controller.state, status: 'Text generation failed: 401 Unauthorized' };
}

if (scenario === 'image-error') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  const errorMessage = '生成图片失败: 当前脚本缺少 GM_addValueChangeListener 和 GM_getValue 权限';
  controller.state = {
    ...controller.state,
    summary: {
      video: controller.state.video!,
      transcript: controller.state.transcript!,
      promptId: controller.config.summary.defaultPromptId,
      content: '# Conclusion\n\nA completed summary before an image request.',
      createdAt: Date.now(),
    },
    summaryChatHistory: [
      { role: 'user', content: '生图' },
      { role: 'assistant', content: errorMessage },
    ],
    toast: { id: 1, message: errorMessage },
  };
}

const panel = new Panel(controller);
panel.render();
(window as any).__VIDEO_LENS_PANEL_HARNESS__ = { controller, panel, listeners };
