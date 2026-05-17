import type { PromptPreset } from '../prompts/promptTypes';

export const CONFIG_KEY = 'video_summary_config_v1';
export const SUMMARY_CACHE_KEY = 'video_summary_summary_cache_v1';
export const ONE_PAGE_CACHE_KEY = 'video_summary_one_page_cache_v1';
export const IMAGE_CACHE_KEY = 'video_summary_image_cache_v1';

export interface LocalConfig {
  schemaVersion: 1;
  source: { enabledSources: ['bilibili'] };
  providerMode: 'direct' | 'remote';
  textAi: {
    provider?: 'minimax' | 'deepseek' | 'custom';
    providerMode: 'direct' | 'remote';
    apiUrl: string;
    apiKey: string;
    model: string;
    modelList: string[];
    temperature: number;
    maxTokens: number;
    stream: boolean;
    requestMode: 'fetch' | 'gm_xhr' | 'auto';
  };
  imageAi: {
    enabled: boolean;
    providerMode: 'direct' | 'remote';
    apiStyle: 'openai_images' | 'generic';
    apiUrl: string;
    apiKey: string;
    model: string;
    size: string;
    quality?: string;
    responseFormat: 'url' | 'b64_json' | 'auto';
    requestMode: 'fetch' | 'gm_xhr' | 'auto';
  };
  remote: { backendBaseUrl?: string };
  summary: {
    autoRun: boolean;
    defaultPromptId: string;
    language: 'zh-CN' | 'en-US';
    chunkTargetChars: number;
    chunkOverlapChars: number;
    maxChunks: number;
  };
  videoInsights: { maxHistoryMessages: number };
  onePage: {
    enabled: boolean;
    mode: 'text_card_only' | 'ai_image_background' | 'ai_image_only';
    defaultTemplate: 'classic' | 'dense' | 'poster';
    exportScale: number;
    width: number;
    includeQrCode: boolean;
  };
  oneImage: {
    enabled: boolean;
    mode: 'text_card_only' | 'ai_image_background' | 'ai_image_only';
    defaultTemplate: 'classic' | 'dense' | 'poster';
    exportScale: number;
    width: number;
    includeQrCode: boolean;
  };
  ui: {
    language: 'zh-CN' | 'en-US';
    position: 'right' | 'left';
    panelWidth: number;
    defaultTab: 'summary' | 'videoInsights' | 'oneImage' | 'settings';
    collapsed: boolean;
    launcherPosition?: { x: number; y: number };
  };
  prompts: { customPresets: PromptPreset[] };
}

export interface CacheEnvelope<T> {
  updatedAt: number;
  value: T;
}
