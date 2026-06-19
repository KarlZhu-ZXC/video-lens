import { Panel } from '../ui/panel';
import { DEFAULT_CONFIG } from '../store/configStore';
import { createInitialState } from '../app/AppState';
import type { AppController } from '../app/AppController';

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
      coverUrl:
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 240 160%22%3E%3Crect width=%22240%22 height=%22160%22 fill=%22%2309090b%22/%3E%3Ccircle cx=%22178%22 cy=%2252%22 r=%2244%22 fill=%22%237c3aed%22 opacity=%22.45%22/%3E%3Cpath d=%22M30 118h180%22 stroke=%22%2334d399%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M44 86h94%22 stroke=%22%23a78bfa%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
      duration: 754,
      publishedAt: 1717200000,
      url: 'https://www.bilibili.com/video/BV-harness',
    },
    transcript: { language: 'English', plainText: 'Mock transcript', lines: [], charCount: 15 },
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
  askQuestion() {
    controller.state = {
      ...controller.state,
      videoInsightsHistory: [
        { role: 'user', content: 'What is the main tradeoff?' },
        { role: 'assistant', content: 'The main tradeoff is quality versus latency and operating cost.' },
      ],
    };
    panel.render();
  },
  async generateOneImage() {
    controller.state = { ...controller.state, generatedImage: { dataUrl: ONE_IMAGE_FIXTURE }, status: 'One page generated' };
    panel.render();
  },
  async generateOnePage() {
    await controller.generateOneImage();
  },
  exportOneImage() {},
  exportOnePage() {},
  clearCurrentSummaryCache() {
    controller.state = { ...controller.state, summary: undefined, status: 'Cleared this video cache' };
    panel.render();
  },
  clearAllCaches() {
    controller.state = { ...controller.state, summary: undefined, generatedImage: undefined, status: 'Cleared all caches' };
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

const ONE_IMAGE_FIXTURE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#18181b"/><circle cx="620" cy="180" r="130" fill="#7c3aed"/><text x="72" y="570" fill="#a78bfa" font-family="sans-serif" font-size="34">VIDEO SUMMARY</text><text x="72" y="650" fill="#fafafa" font-family="sans-serif" font-size="64" font-weight="700">Core Insight</text></svg>');

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
      content: Array.from(
        { length: 96 },
        (_, index) =>
          `第 ${index + 1} 点：这是一段用于验证长中文摘要滚动行为的内容。它应该只让摘要输出卡片滚动，而不是让右侧导航栏左边再出现一层外部滚动条。`,
      ).join('\n\n'),
      createdAt: Date.now(),
    },
  };
}
if (scenario === 'settings') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false, defaultTab: 'settings' } };
}
if (scenario === 'one-image') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false, defaultTab: 'oneImage' } };
  void controller.generateOneImage();
}
if (scenario === 'error') {
  controller.config = { ...controller.config, ui: { ...controller.config.ui, collapsed: false } };
  controller.state = { ...controller.state, status: 'Text generation failed: 401 Unauthorized' };
}

const panel = new Panel(controller);
panel.render();
(window as any).__VIDEO_SUMMARY_PANEL_HARNESS__ = { controller, panel, listeners };
