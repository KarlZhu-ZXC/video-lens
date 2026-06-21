import type { LocalConfig } from '../store/types';

export type UiLanguage = LocalConfig['ui']['language'];

const ZH = {
  appName: '片语',
  launcherTitle: '打开片语',
  closePanel: '收起',
  waitingVideo: '等待识别支持的视频',
  modelUnset: '未配置模型',
  summaryReady: '缓存/摘要可用',
  summaryMissing: '摘要未生成',
  tabs: {
    summary: '摘要',
    settings: '设置',
    summaryEyebrow: 'Summary',
    settingsEyebrow: 'Config',
  },
  actions: {
    regenerate: '重新生成',
    getSummary: '获取摘要',
    startSummary: '开始总结',
    copySummary: '复制',
    exportMarkdown: '导出 MarkDown',
    discardChanges: '丢弃更改',
    sendQuestion: '发送问题',
    saveSettings: '保存设置',
  },
  summary: {
    title: '视频摘要',
    captionIdle: '识别字幕后生成摘要',
    upPrefix: 'UP：',
    configuration: '模型配置',
    toolbar: '摘要工具',
    pendingTitle: '请求已发出',
    pendingBody: '正在等待模型返回第一段内容。',
    emptyTitle: '还没有摘要',
    emptyBody: '先读取当前视频字幕，再生成一份可复制、可继续追问的结构化摘要。',
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
    textApiStyle: 'API 协议',
    apiStyleOpenAI: 'OpenAI 协议',
    apiStyleAnthropic: 'Anthropic (Claude) 风格',
    summaryAutoRun: '打开视频时自动提取并生成',
    statusOn: '开启',
    statusOff: '关闭',
    imageGroup: '生图模型',
    imageMode: '生图方式',
    imageModeApi: 'API 生图',
    imageModeChatGpt: 'ChatGPT 网页生图（实验）',
    model: '模型',
    baseUrl: 'Base URL',
    imageApiUrl: 'Base URL',
    imageApiKey: 'API Key',
    imageModel: '模型',
    chatgptConversationUrl: 'ChatGPT Project 地址',
    chatgptImageHint: '保持 Project 根页打开；每次生图会在该 Project 内新建独立聊天，完成后自动返回根页。',
  },
} as const;

type UiDict = WidenStrings<typeof ZH>;

const EN: UiDict = {
  appName: 'Video Lens',
  launcherTitle: 'Open Video Lens',
  closePanel: 'Collapse',
  waitingVideo: 'Waiting for a supported video',
  modelUnset: 'Model not configured',
  summaryReady: 'Summary available',
  summaryMissing: 'No summary',
  tabs: {
    summary: 'Summary',
    settings: 'Settings',
    summaryEyebrow: 'Brief',
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
    saveSettings: 'Save Settings',
  },
  summary: {
    title: 'Video Summary',
    captionIdle: 'Read subtitles before generating a summary',
    upPrefix: 'Creator: ',
    configuration: 'Model Configuration',
    toolbar: 'Summary tools',
    pendingTitle: 'Request sent',
    pendingBody: 'Waiting for the first tokens from the model.',
    emptyTitle: 'No summary yet',
    emptyBody: 'Read the current video subtitles, then generate a structured summary you can copy or ask about.',
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
    textApiStyle: 'API Protocol',
    apiStyleOpenAI: 'OpenAI Style',
    apiStyleAnthropic: 'Anthropic Style',
    summaryAutoRun: 'Auto-run summary on video load',
    statusOn: 'On',
    statusOff: 'Off',
    imageGroup: 'Image Gen Model',
    imageMode: 'Image Method',
    imageModeApi: 'Image API',
    imageModeChatGpt: 'ChatGPT Web (Experimental)',
    model: 'Model',
    baseUrl: 'Base URL',
    imageApiUrl: 'Base URL',
    imageApiKey: 'API Key',
    imageModel: 'Model',
    chatgptConversationUrl: 'ChatGPT Project URL',
    chatgptImageHint: 'Keep the Project root open. Every image request creates a new Project chat and returns to the root when complete.',
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
  已回答: 'Answered',
  摘要已复制: 'Summary copied',
  已清除此视频缓存: 'Cleared this video cache',
  已清空全部缓存: 'Cleared all caches',
  测试文本模型连通性: 'Testing text model connectivity',
  测试生图模型连通性: 'Testing image model connectivity',
  文本模型连通性正常: 'Text model connectivity OK',
  生图模型连通性正常: 'Image model connectivity OK',
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
