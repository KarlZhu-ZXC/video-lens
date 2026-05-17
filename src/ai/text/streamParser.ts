import type { TextCompletionDelta } from './types';

export function parseOpenAIStreamDeltas(chunk: string): TextCompletionDelta[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))
    .filter((line) => line && line !== '[DONE]')
    .map((line) => {
      try {
        const json = JSON.parse(line);
        const delta = json.choices?.[0]?.delta ?? {};
        return {
          content: delta.content ?? '',
          reasoning: delta.reasoning_content ?? delta.reasoningContent ?? delta.thinking ?? '',
        };
      } catch {
        return { content: '' };
      }
    });
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
