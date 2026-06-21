import type { LocalConfig } from '../../store/types';
import { normalizeApiKey } from './providers';
import { createAnthropicStreamParser } from './streamParser';
import type { TextAiClient } from './TextAiClient';
import type { TextCompletionDelta, TextCompletionRequest, TextCompletionResult } from './types';

export class AnthropicTextClient implements TextAiClient {
  constructor(private readonly config: LocalConfig['textAi']) {}

  async complete(
    request: TextCompletionRequest,
    options?: { signal?: AbortSignal; onDelta?: (delta: TextCompletionDelta) => void },
  ): Promise<TextCompletionResult> {
    const apiKey = normalizeApiKey(this.config.apiKey);
    if (!apiKey) throw new Error('请先在设置中填写文本模型 API Key');

    if (this.config.requestMode === 'gm_xhr') return this.completeWithGmXhr(request, apiKey);
    if (this.config.requestMode === 'fetch') return this.completeWithFetch(request, apiKey, options);
    if (!request.stream && typeof GM_xmlhttpRequest === 'function') return this.completeWithGmXhr(request, apiKey);

    try {
      return await this.completeWithFetch(request, apiKey, options);
    } catch (error) {
      if (typeof GM_xmlhttpRequest !== 'function') throw error;
      return this.completeWithGmXhr(request, apiKey);
    }
  }

  private async completeWithFetch(
    request: TextCompletionRequest,
    apiKey: string,
    options?: { signal?: AbortSignal; onDelta?: (delta: TextCompletionDelta) => void },
  ): Promise<TextCompletionResult> {
    const res = await fetch(normalizeAnthropicUrl(this.config.apiUrl), {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(buildAnthropicPayload(request, this.config)),
    });

    if (!res.ok) throw new Error(`Text generation failed: ${res.status} ${await res.text()}`);

    if (request.stream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parseStream = createAnthropicStreamParser();
      let content = '';
      const consumeDeltas = (deltas: ReturnType<typeof parseStream>) => {
        deltas.forEach((delta) => {
          if (delta.content) content += delta.content;
          if (delta.content) options?.onDelta?.(delta);
        });
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        consumeDeltas(parseStream(decoder.decode(value, { stream: true })));
      }
      consumeDeltas(parseStream(decoder.decode()));
      consumeDeltas(parseStream('\n'));
      return { content, reasoning: '' };
    }

    const json = await res.json();
    const content = json.content?.map((c: any) => c.text).join('') ?? '';
    return {
      content,
      reasoning: '',
      raw: json,
    };
  }

  private completeWithGmXhr(request: TextCompletionRequest, apiKey: string): Promise<TextCompletionResult> {
    if (typeof GM_xmlhttpRequest !== 'function') throw new Error('GM_xmlhttpRequest 不可用');

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: normalizeAnthropicUrl(this.config.apiUrl),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        data: JSON.stringify(buildAnthropicPayload({ ...request, stream: false }, this.config)),
        onload: (res) => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`Text generation failed: ${res.status} ${res.responseText}`));
            return;
          }
          const json = JSON.parse(res.responseText);
          const content = json.content?.map((c: any) => c.text).join('') ?? '';
          resolve({ content, raw: json });
        },
        onerror: () => reject(new Error('Text generation request failed')),
      });
    });
  }
}

export function buildAnthropicPayload(request: TextCompletionRequest, config: LocalConfig['textAi']): object {
  const maxTokens = request.maxTokens ?? config.maxTokens;
  const messages = [...request.messages];
  let system = '';
  if (messages.length > 0 && messages[0].role === 'system') {
    system = messages[0].content;
    messages.shift();
  }

  const payload: Record<string, unknown> = {
    model: request.model,
    max_tokens: maxTokens,
    messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    temperature: request.temperature ?? config.temperature,
    stream: request.stream ?? false,
  };

  if (system) {
    payload.system = system;
  }

  return payload;
}

export function normalizeAnthropicUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  if (/\/v1\/messages$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/messages`;
  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/v1/messages';
      return url.toString();
    }
  } catch {
    // Preserve custom non-URL inputs for the request layer to report.
  }
  return trimmed;
}
