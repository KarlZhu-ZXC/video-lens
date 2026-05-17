import type { TextCompletionDelta, TextCompletionRequest, TextCompletionResult } from './types';

export interface TextAiClient {
  complete(
    request: TextCompletionRequest,
    options?: { signal?: AbortSignal; onDelta?: (delta: TextCompletionDelta) => void },
  ): Promise<TextCompletionResult>;
}
