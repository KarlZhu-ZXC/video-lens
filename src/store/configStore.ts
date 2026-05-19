import { safeJsonParse } from '../utils/json';
import { CONFIG_KEY, type LocalConfig } from './types';

export const DEFAULT_CONFIG: LocalConfig = {
  schemaVersion: 1,
  source: {
    enabledSources: ['bilibili', 'youtube'],
    youtube: { captionStrategy: 'auto', apiKey: '', oauthAccessToken: '' },
  },
  providerMode: 'direct',
  textAi: {
    provider: 'minimax',
    providerMode: 'direct',
    apiUrl: 'https://api.minimaxi.com/v1',
    apiKey: '',
    model: 'MiniMax-M2.7',
    modelList: [
      'MiniMax-M2.7',
      'MiniMax-M2.5',
      'MiniMax-M2.1',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2',
      'MiniMax-M1',
      'MiniMax-Text-01',
    ],
    temperature: 0.7,
    maxTokens: 2000,
    stream: true,
    requestMode: 'auto',
  },
  imageAi: {
    enabled: true,
    providerMode: 'direct',
    apiStyle: 'openai_images',
    apiUrl: 'https://api.openai.com/v1/images/generations',
    apiKey: '',
    model: 'gpt-image-1',
    size: '1024x1024',
    quality: 'medium',
    responseFormat: 'b64_json',
    requestMode: 'auto',
  },
  remote: { backendBaseUrl: '' },
  summary: {
    autoRun: false,
    defaultPromptId: 'summary_plain',
    language: 'zh-CN',
    chunkTargetChars: 8000,
    chunkOverlapChars: 500,
    maxChunks: 20,
  },
  videoInsights: { maxHistoryMessages: 8 },
  onePage: {
    enabled: true,
    mode: 'ai_image_background',
    defaultTemplate: 'classic',
    exportScale: 2,
    width: 900,
    includeQrCode: false,
  },
  oneImage: {
    enabled: true,
    mode: 'ai_image_background',
    defaultTemplate: 'classic',
    exportScale: 2,
    width: 900,
    includeQrCode: false,
  },
  ui: {
    language: 'zh-CN',
    position: 'right',
    panelWidth: 420,
    defaultTab: 'summary',
    collapsed: true,
  },
  prompts: { customPresets: [] },
};

export function loadConfig(): LocalConfig {
  const raw = typeof GM_getValue === 'function' ? GM_getValue(CONFIG_KEY, '') : localStorage.getItem(CONFIG_KEY);
  const parsed = safeJsonParse(String(raw || ''), DEFAULT_CONFIG);
  const config = mergeConfig(DEFAULT_CONFIG, typeof GM_getValue === 'function' ? parsed : stripSensitiveConfigForStorage(parsed));
  return {
    ...config,
    source: {
      ...config.source,
      enabledSources: config.source.enabledSources ?? ['bilibili', 'youtube'],
      youtube: {
        captionStrategy: config.source.youtube?.captionStrategy ?? 'auto',
        apiKey: config.source.youtube?.apiKey ?? '',
        oauthAccessToken: config.source.youtube?.oauthAccessToken ?? '',
      },
    },
    textAi: { ...config.textAi, requestMode: 'auto' },
    imageAi: { ...config.imageAi, enabled: true, requestMode: 'auto' },
    ui: { ...config.ui, collapsed: true },
  };
}

export function saveConfig(config: LocalConfig): void {
  const value = JSON.stringify(typeof GM_setValue === 'function' ? config : stripSensitiveConfigForStorage(config));
  if (typeof GM_setValue === 'function') GM_setValue(CONFIG_KEY, value);
  else localStorage.setItem(CONFIG_KEY, value);
}

export function stripSensitiveConfigForStorage(config: LocalConfig): LocalConfig {
  return {
    ...config,
    source: {
      ...config.source,
      youtube: {
        captionStrategy: config.source.youtube?.captionStrategy ?? 'auto',
        apiKey: '',
        oauthAccessToken: '',
      },
    },
    textAi: { ...config.textAi, apiKey: '' },
    imageAi: { ...config.imageAi, apiKey: '' },
  };
}

function mergeConfig(base: LocalConfig, partial: LocalConfig): LocalConfig {
  return {
    ...base,
    ...partial,
    source: { ...base.source, ...partial.source },
    textAi: { ...base.textAi, ...partial.textAi },
    imageAi: { ...base.imageAi, ...partial.imageAi },
    remote: { ...base.remote, ...partial.remote },
    summary: { ...base.summary, ...partial.summary },
    videoInsights: { ...base.videoInsights, ...partial.videoInsights },
    onePage: { ...base.onePage, ...partial.onePage },
    oneImage: { ...base.oneImage, ...partial.oneImage },
    ui: { ...base.ui, ...partial.ui },
    prompts: { ...base.prompts, ...partial.prompts },
  };
}
