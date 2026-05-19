import type { LocalConfig } from '../store/types';

export type UiLanguage = LocalConfig['ui']['language'];

const ZH = {
  appName: 'AI总结',
  launcherTitle: '打开 AI总结',
  closePanel: '收起',
  waitingVideo: '等待识别支持的视频',
  modelUnset: '未配置模型',
  summaryReady: '缓存/摘要可用',
  summaryMissing: '摘要未生成',
  tabs: {
    summary: '摘要',
    videoInsights: '视频洞察',
    oneImage: '一图流',
    settings: '设置',
    summaryEyebrow: 'Summary',
    videoInsightsEyebrow: 'Insights',
    oneImageEyebrow: 'One Image',
    settingsEyebrow: 'Config',
  },
  actions: {
    regenerate: '重新生成',
    getSummary: '获取摘要',
    startSummary: '开始总结',
    copySummary: '复制摘要',
    exportMarkdown: '导出 MarkDown',
    discardChanges: '丢弃更改',
    sendQuestion: '发送问题',
    generateOneImage: '生成一图流',
    exportPng: '导出 PNG',
    saveSettings: '保存设置',
  },
  summary: {
    title: '视频摘要',
    captionIdle: '识别字幕后生成摘要',
    upPrefix: 'UP：',
    configuration: '模型配置',
    toolbar: '摘要工具',
    imageDisabled: '图片模型已关闭',
    thinking: '模型思考',
    pendingTitle: '请求已发出',
    pendingBody: '正在等待模型返回第一段内容。',
    emptyTitle: '还没有摘要',
    emptyBody: '先读取当前视频字幕，再生成一份可复制、可做 Video Insights 的结构化摘要。',
  },
  videoInsights: {
    title: '视频洞察',
    caption: '围绕当前视频摘要做上下文问答',
    contextPrefix: '当前视频：',
    placeholderReady: '围绕这个视频继续提问...',
    placeholderDisabled: '先生成摘要后再使用 Video Insights',
    me: '我',
    assistant: 'AI',
    emptyTitle: '还不能使用 Video Insights',
    emptyBody: '先生成摘要，系统会带着摘要上下文回答后续问题。',
  },
  oneImage: {
    title: '一图流',
    caption: '生成视频一图流与 PNG 导出',
    emptyTitle: '还没有一图流预览',
    emptyBody: '生成后可以在这里检查中文排版，再导出 PNG。',
    toolbar: '一图流工具',
    modeTextCard: '文字卡',
    modeAiBackground: 'AI 背景 + 中文排版',
    modeAiOnly: 'AI 图片模式',
    configuration: '生成模式',
  },
  settings: {
    title: '设置',
    caption: '配置本地模型服务、界面语言和导出方式',
    languageGroup: '语言',
    language: '界面显示语言',
    languageZh: '中文',
    languageEn: 'English',
    summaryLanguage: '字幕获取及总结语言',
    sourceGroup: '视频源',
    youtubeCaptionStrategy: 'YouTube 字幕策略',
    youtubeStrategyAuto: '自动',
    youtubeStrategyPage: '页面字幕',
    youtubeStrategyOfficial: '官方 API',
    youtubeApiKey: 'YouTube API Key',
    youtubeOauthToken: 'YouTube OAuth Token',
    textGroup: '文本模型',
    imageGroup: '生图模型',
    provider: '供应商',
    model: '模型',
    mode: '模式',
    baseUrl: 'Base URL',
    imageApiUrl: 'API URL',
    imageApiKey: 'API Key',
    imageModel: '模型',
    textCardOnly: '只生成文字卡',
  },
} as const;

type UiDict = WidenStrings<typeof ZH>;

const EN: UiDict = {
  appName: 'AI Summary',
  launcherTitle: 'Open AI Summary',
  closePanel: 'Collapse',
  waitingVideo: 'Waiting for a supported video',
  modelUnset: 'Model not configured',
  summaryReady: 'Summary available',
  summaryMissing: 'No summary',
  tabs: {
    summary: 'Summary',
    videoInsights: 'Video Insights',
    oneImage: 'One Image',
    settings: 'Settings',
    summaryEyebrow: 'Brief',
    videoInsightsEyebrow: 'Ask',
    oneImageEyebrow: 'Poster',
    settingsEyebrow: 'Config',
  },
  actions: {
    regenerate: 'Regenerate',
    getSummary: 'Get Summary',
    startSummary: 'Start Summary',
    copySummary: 'Copy Summary',
    exportMarkdown: 'Export MarkDown',
    discardChanges: 'Discard Changes',
    sendQuestion: 'Send',
    generateOneImage: 'Generate One Image',
    exportPng: 'Export PNG',
    saveSettings: 'Save Settings',
  },
  summary: {
    title: 'Video Summary',
    captionIdle: 'Read subtitles before generating a summary',
    upPrefix: 'Creator: ',
    configuration: 'Model Configuration',
    toolbar: 'Summary tools',
    imageDisabled: 'Image model off',
    thinking: 'Model reasoning',
    pendingTitle: 'Request sent',
    pendingBody: 'Waiting for the first tokens from the model.',
    emptyTitle: 'No summary yet',
    emptyBody: 'Read the current video subtitles, then generate a structured summary you can copy or ask about.',
  },
  videoInsights: {
    title: 'Video Insights',
    caption: 'Inspect the video with summary-aware context',
    contextPrefix: 'Insights on: ',
    placeholderReady: 'Ask about this video...',
    placeholderDisabled: 'Generate a summary before asking',
    me: 'Me',
    assistant: 'AI',
    emptyTitle: 'Questions are not available yet',
    emptyBody: 'Generate a summary first, then follow up with context-aware questions.',
  },
  oneImage: {
    title: 'One Image',
    caption: 'Generate a video one-image summary and export PNG',
    emptyTitle: 'No one-image preview yet',
    emptyBody: 'Generate it here, review the Chinese layout, then export a PNG.',
    toolbar: 'One-image tools',
    modeTextCard: 'Text card',
    modeAiBackground: 'AI background + Chinese layout',
    modeAiOnly: 'AI image mode',
    configuration: 'Generation mode',
  },
  settings: {
    title: 'Settings',
    caption: 'Configure local model services, interface language, and export behavior',
    languageGroup: 'Language',
    language: 'Interface Language',
    languageZh: '中文',
    languageEn: 'English',
    summaryLanguage: 'Subtitle and Summary Language',
    sourceGroup: 'Video Sources',
    youtubeCaptionStrategy: 'YouTube Caption Strategy',
    youtubeStrategyAuto: 'Auto',
    youtubeStrategyPage: 'Page captions',
    youtubeStrategyOfficial: 'Official API',
    youtubeApiKey: 'YouTube API Key',
    youtubeOauthToken: 'YouTube OAuth Token',
    textGroup: 'Text Model',
    imageGroup: 'Image Gen Model',
    provider: 'Provider',
    model: 'Model',
    mode: 'Mode',
    baseUrl: 'Base URL',
    imageApiUrl: 'API URL',
    imageApiKey: 'API Key',
    imageModel: 'Model',
    textCardOnly: 'Text card only',
  },
};

const DICTS = {
  'zh-CN': ZH,
  'en-US': EN,
} as const;

const EN_STATUS: Record<string, string> = {
  等待操作: 'Ready',
  已载入缓存摘要: 'Loaded cached summary',
  已识别视频: 'Video detected',
  读取视频信息: 'Reading video info',
  获取字幕: 'Fetching subtitles',
  生成摘要: 'Generating summary',
  摘要已生成: 'Summary generated',
  请先生成摘要: 'Generate a summary first',
  'Video Insights': 'Video Insights',
  已回答: 'Answered',
  等待生成一图流: 'Ready to generate one page',
  生成一图流: 'Generating one page',
  '生成一图流 JSON': 'Generating one-page JSON',
  '校验一图流 JSON': 'Validating one-page JSON',
  '生成图片 prompt': 'Generating image prompt',
  '生成 AI 背景图': 'Generating AI background',
  渲染中文信息图: 'Rendering Chinese infographic',
  合成图片: 'Compositing image',
  一图流已生成: 'One page generated',
  'PNG 已导出': 'PNG exported',
  摘要已复制: 'Summary copied',
  已清除此视频缓存: 'Cleared this video cache',
  已清空全部缓存: 'Cleared all caches',
  测试文本模型连通性: 'Testing text model connectivity',
  测试生图模型连通性: 'Testing image model connectivity',
  文本模型连通性正常: 'Text model connectivity OK',
  生图模型连通性正常: 'Image model connectivity OK',
  当前一图流模式不需要生图模型: 'Current one-image mode does not need an image model',
  'MarkDown 已导出': 'MarkDown exported',
  设置已保存: 'Settings saved',
};

export type UiTextKey = DotPath<typeof ZH>;

export function getUiText(language: string | undefined, key: UiTextKey): string {
  const dict = language === 'en-US' ? DICTS['en-US'] : DICTS['zh-CN'];
  return readPath(dict, key) ?? readPath(DICTS['zh-CN'], key) ?? key;
}

export function createUiText(language: string | undefined): (key: UiTextKey) => string {
  return (key) => getUiText(language, key);
}

export function getStatusText(language: string | undefined, status: string): string {
  if (language !== 'en-US') return status;
  return EN_STATUS[status] ?? status;
}

type DotPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPath<T[K]>}`;
}[keyof T & string];

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenStrings<T[K]>;
};

function readPath(source: UiDict, path: string): string | undefined {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}
