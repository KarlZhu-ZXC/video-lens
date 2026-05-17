import type { LocalConfig } from '../../store/types';
import { normalizeApiKey, normalizeMiniMaxBaseUrl } from './providers';
import { createOpenAIStreamParser } from './streamParser';
import type { TextAiClient } from './TextAiClient';
import type { TextCompletionDelta, TextCompletionRequest, TextCompletionResult } from './types';

export class DirectOpenAITextClient implements TextAiClient {
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
    const res = await fetch(normalizeChatCompletionsUrl(this.config.apiUrl), {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        stream: request.stream ?? false,
        tools: request.tools,
        tool_choice: request.toolChoice,
      }),
    });

    if (!res.ok) throw new Error(`Text generation failed: ${res.status} ${await res.text()}`);

    if (request.stream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parseStream = createOpenAIStreamParser();
      let content = '';
      let reasoning = '';
      const consumeDeltas = (deltas: ReturnType<typeof parseStream>) => {
        deltas.forEach((delta) => {
          if (delta.reasoning) reasoning += delta.reasoning;
          if (delta.content) content += delta.content;
          if (delta.content || delta.reasoning) options?.onDelta?.(delta);
        });
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        consumeDeltas(parseStream(decoder.decode(value, { stream: true })));
      }
      consumeDeltas(parseStream(decoder.decode()));
      consumeDeltas(parseStream('\n'));
      return { content, reasoning };
    }

    const json = await res.json();
    const message = json.choices?.[0]?.message ?? {};
    const toolArguments = message.tool_calls?.[0]?.function?.arguments;
    return {
      content: toolArguments ?? message.content ?? '',
      reasoning: message.reasoning_content ?? message.reasoningContent,
      raw: json,
    };
  }

  private completeWithGmXhr(request: TextCompletionRequest, apiKey: string): Promise<TextCompletionResult> {
    if (typeof GM_xmlhttpRequest !== 'function') throw new Error('GM_xmlhttpRequest 不可用');

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: normalizeChatCompletionsUrl(this.config.apiUrl),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
          data: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? this.config.temperature,
            max_tokens: request.maxTokens ?? this.config.maxTokens,
            stream: false,
            tools: request.tools,
            tool_choice: request.toolChoice,
          }),
        onload: (res) => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`Text generation failed: ${res.status} ${res.responseText}`));
            return;
          }
          const json = JSON.parse(res.responseText);
          const message = json.choices?.[0]?.message ?? {};
          resolve({ content: message.tool_calls?.[0]?.function?.arguments ?? message.content ?? '', raw: json });
        },
        onerror: () => reject(new Error('Text generation request failed')),
      });
    });
  }
}

export function normalizeChatCompletionsUrl(apiUrl: string): string {
  const trimmed = normalizeMiniMaxBaseUrl(apiUrl);
  if (!trimmed) return trimmed;
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return trimmed;
}
