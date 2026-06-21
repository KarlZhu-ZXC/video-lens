import type { LocalConfig } from '../../store/types';

export function normalizeOpenAIBaseUrl(input: string): string {
  const raw = input.trim();
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

export function normalizeApiKey(input: string): string {
  return input.trim().replace(/^Bearer\s+/i, '').trim();
}

export function applyTextConfig(
  current: LocalConfig['textAi'],
  input: { apiStyle: 'openai' | 'anthropic'; baseUrl: string; apiKey: string; model: string },
): LocalConfig['textAi'] {
  return {
    ...current,
    apiStyle: input.apiStyle,
    apiUrl: input.apiStyle === 'openai' ? normalizeOpenAIBaseUrl(input.baseUrl) : input.baseUrl.trim(),
    apiKey: normalizeApiKey(input.apiKey),
    model: input.model.trim(),
    requestMode: 'auto',
  };
}
