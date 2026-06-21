import type { PromptPreset } from '../prompts/promptTypes';

export const CONFIG_KEY = 'video_lens_config_v1';
export const SUMMARY_CACHE_KEY = 'video_lens_summary_cache_v1';
export const IMAGE_CACHE_KEY = 'video_lens_image_cache_v1';
export const LEGACY_CONFIG_KEY = 'video_summary_config_v1';
export const LEGACY_SUMMARY_CACHE_KEY = 'video_summary_summary_cache_v1';
export const LEGACY_IMAGE_CACHE_KEY = 'video_summary_image_cache_v1';

export interface LocalConfig {
  schemaVersion: 1;
  source: {
    enabledSources: Array<'bilibili' | 'youtube'>;
    youtube?: {
      captionStrategy: 'auto' | 'page' | 'official';
      apiKey?: string;
      oauthAccessToken?: string;
    };
  };
  textAi: {
    apiStyle: 'openai' | 'anthropic';
    apiUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    stream: boolean;
    requestMode: 'fetch' | 'gm_xhr' | 'auto';
  };
  imageAi: {
    mode: 'api' | 'chatgpt_web';
    apiStyle: 'openai_images' | 'generic';
    apiUrl: string;
    apiKey: string;
    model: string;
    size: string;
    quality?: string;
    responseFormat: 'url' | 'b64_json' | 'auto';
    requestMode: 'fetch' | 'gm_xhr' | 'auto';
    chatgptConversationUrl: string;
  };
  summary: {
    autoRun: boolean;
    defaultPromptId: string;
    language: 'zh-CN' | 'en-US';
    chunkTargetChars: number;
    chunkOverlapChars: number;
    maxChunks: number;
  };
  chat: { maxHistoryMessages: number };
  ui: {
    language: 'zh-CN' | 'en-US';
    position: 'right' | 'left';
    panelWidth: number;
    defaultTab: 'summary' | 'settings';
    collapsed: boolean;
    launcherPosition?: { x: number; y: number };
  };
  prompts: { customPresets: PromptPreset[] };
}

export interface CacheEnvelope<T> {
  updatedAt: number;
  value: T;
}
