import type { LocalConfig } from '../../store/types';

export type TextProviderId = 'minimax' | 'deepseek' | 'custom';

export interface TextProvider {
  id: TextProviderId;
  label: string;
  defaultBaseUrl: string;
  models: Array<{ id: string; label: string }>;
}

export const TEXT_PROVIDERS: TextProvider[] = [
  {
    id: 'minimax',
    label: 'MiniMax-CN',
    defaultBaseUrl: 'https://api.minimaxi.com/v1',
    models: [
      { id: 'MiniMax-M2.7', label: 'MiniMax-M2.7' },
      { id: 'MiniMax-M2.5', label: 'MiniMax-M2.5' },
      { id: 'MiniMax-M2.1', label: 'MiniMax-M2.1' },
      { id: 'MiniMax-M2.1-highspeed', label: 'MiniMax-M2.1-highspeed' },
      { id: 'MiniMax-M2', label: 'MiniMax-M2' },
      { id: 'MiniMax-M1', label: 'MiniMax-M1' },
      { id: 'MiniMax-Text-01', label: 'MiniMax-Text-01' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', label: 'deepseek-chat' },
      { id: 'deepseek-reasoner', label: 'deepseek-reasoner' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    defaultBaseUrl: '',
    models: [{ id: '', label: 'Custom model' }],
  },
];

export function getTextProvider(providerId?: string): TextProvider {
  return TEXT_PROVIDERS.find((provider) => provider.id === providerId) ?? TEXT_PROVIDERS[0];
}

export function normalizeOpenAIBaseUrl(input: string, providerId: TextProviderId = 'minimax'): string {
  const raw = input.trim() || getTextProvider(providerId).defaultBaseUrl;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw.replace(/\/+$/, '');
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = url.pathname.replace(/\/chat\/completions$/i, '');
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
  return url.toString().replace(/\/+$/, '');
}

export const normalizeMiniMaxBaseUrl = normalizeOpenAIBaseUrl;

export function normalizeTextModel(provider: TextProvider, model: string): string {
  if (provider.id === 'custom') return model.trim();
  if (provider.models.some((item) => item.id === model)) return model;
  return provider.models[0]?.id ?? model;
}

export function normalizeApiKey(input: string): string {
  return input.trim().replace(/^Bearer\s+/i, '').trim();
}

export function applyTextProviderConfig(
  current: LocalConfig['textAi'],
  input: {
    providerId: TextProviderId;
    baseUrl: string;
    apiKey: string;
    model: string;
    requestMode?: LocalConfig['textAi']['requestMode'];
  },
): LocalConfig['textAi'] {
  const provider = getTextProvider(input.providerId);
  const model = normalizeTextModel(provider, input.model);
  return {
    ...current,
    provider: provider.id,
    apiUrl: normalizeOpenAIBaseUrl(input.baseUrl, provider.id),
    apiKey: normalizeApiKey(input.apiKey),
    model,
    modelList: provider.models.map((item) => item.id),
    requestMode: input.requestMode ?? current.requestMode,
  };
}
