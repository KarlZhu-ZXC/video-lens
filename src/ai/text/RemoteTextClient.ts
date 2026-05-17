import type { TextAiClient } from './TextAiClient';
import type { TextCompletionRequest, TextCompletionResult } from './types';

export class RemoteTextClient implements TextAiClient {
  async complete(_request: TextCompletionRequest): Promise<TextCompletionResult> {
    throw new Error('Remote text client is reserved for future versions.');
  }
}
