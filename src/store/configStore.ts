import { safeJsonParse } from '../utils/json';
import { CONFIG_KEY, type LocalConfig } from './types';

export const DEFAULT_CONFIG: LocalConfig = {
  schemaVersion: 1,
  source: {
    enabledSources: ['bilibili', 'youtube'],
    youtube: { captionStrategy: 'auto', apiKey: '', oauthAccessToken: '' },
  },
  textAi: {
    apiStyle: 'openai',
    apiUrl: 'https://api.minimaxi.com/v1',
    apiKey: '',
    model: 'MiniMax-M3',
    temperature: 0.7,
    maxTokens: 2000,
    stream: true,
    requestMode: 'auto',
  },
  imageAi: {
    mode: 'api',
    apiStyle: 'openai_images',
    apiUrl: 'https://api.openai.com/v1/images/generations',
    apiKey: '',
    model: 'gpt-image-1',
    size: '1024x1024',
    quality: 'medium',
    responseFormat: 'b64_json',
    requestMode: 'auto',
    chatgptConversationUrl: '',
  },
  summary: {
    autoRun: true,
    defaultPromptId: 'summary_plain',
    language: 'zh-CN',
    chunkTargetChars: 8000,
    chunkOverlapChars: 500,
    maxChunks: 20,
  },
  chat: { maxHistoryMessages: 8 },
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
    textAi: pickTextAi(config.textAi),
    imageAi: pickImageAi(config.imageAi),
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
    schemaVersion: base.schemaVersion,
    source: { ...base.source, ...partial.source },
    textAi: pickTextAi({ ...base.textAi, ...partial.textAi }),
    imageAi: pickImageAi({ ...base.imageAi, ...partial.imageAi }),
    summary: { ...base.summary, ...partial.summary },
    chat: { ...base.chat, ...partial.chat },
    ui: { ...base.ui, ...partial.ui },
    prompts: { ...base.prompts, ...partial.prompts },
  };
}

export function mergeConfigForTest(
  partial: Partial<Omit<LocalConfig, 'imageAi'>> & { imageAi?: Partial<LocalConfig['imageAi']> },
): LocalConfig {
  return mergeConfig(DEFAULT_CONFIG, partial as LocalConfig);
}

function pickTextAi(value: LocalConfig['textAi']): LocalConfig['textAi'] {
  return {
    apiStyle: value.apiStyle ?? 'openai',
    apiUrl: value.apiUrl,
    apiKey: value.apiKey,
    model: value.model,
    temperature: value.temperature,
    maxTokens: value.maxTokens,
    stream: value.stream,
    requestMode: 'auto',
  };
}

function pickImageAi(value: LocalConfig['imageAi']): LocalConfig['imageAi'] {
  return {
    mode: value.mode === 'chatgpt_web' ? 'chatgpt_web' : 'api',
    apiStyle: value.apiStyle,
    apiUrl: value.apiUrl,
    apiKey: value.apiKey,
    model: value.model,
    size: value.size,
    quality: value.quality,
    responseFormat: value.responseFormat,
    requestMode: 'auto',
    chatgptConversationUrl: value.chatgptConversationUrl ?? '',
  };
}
