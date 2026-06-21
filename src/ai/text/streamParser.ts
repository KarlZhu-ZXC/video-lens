import type { TextCompletionDelta } from './types';

export function parseOpenAIStreamDeltas(chunk: string): TextCompletionDelta[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('[DONE]'))
    .map((line) => {
      let payload = line;
      if (payload.startsWith('data:')) {
        payload = payload.slice(5).trimStart();
      } else if (!payload.startsWith('{')) {
        return null;
      }

      try {
        const json = JSON.parse(payload);
        if (json.error) {
          throw new Error(json.error.message || JSON.stringify(json.error));
        }
        const delta = json.choices?.[0]?.delta ?? {};
        return {
          content: delta.content ?? '',
          reasoning: delta.reasoning_content ?? delta.reasoningContent ?? delta.thinking ?? '',
        };
      } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
      }
    })
    .filter((delta) => delta !== null) as TextCompletionDelta[];
}

export function parseOpenAIStreamChunk(chunk: string): string {
  return parseOpenAIStreamDeltas(chunk)
    .map((delta) => delta.content)
    .join('');
}

export function createOpenAIStreamParser(): (chunk: string) => TextCompletionDelta[] {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    return parseOpenAIStreamDeltas(lines.join('\n'));
  };
}

export function parseAnthropicStreamDeltas(chunk: string): TextCompletionDelta[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('[DONE]'))
    .map((line) => {
      let payload = line;
      if (payload.startsWith('data:')) {
        payload = payload.slice(5).trimStart();
      } else if (!payload.startsWith('{')) {
        return null;
      }

      try {
        const json = JSON.parse(payload);
        if (json.type === 'error') {
          throw new Error(json.error?.message || JSON.stringify(json.error));
        }
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          return { content: json.delta.text ?? '', reasoning: '' };
        }
        return { content: '' };
      } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
      }
    })
    .filter((delta): delta is TextCompletionDelta => delta !== null);
}

export function createAnthropicStreamParser(): (chunk: string) => TextCompletionDelta[] {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    return parseAnthropicStreamDeltas(lines.join('\n'));
  };
}
