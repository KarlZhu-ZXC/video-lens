export interface TextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TextCompletionRequest {
  model: string;
  messages: TextMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: unknown;
    };
  }>;
  toolChoice?: 'auto' | { type: 'function'; function: { name: string } };
}

export interface TextCompletionResult {
  content: string;
  reasoning?: string;
  raw?: unknown;
}

export interface TextCompletionDelta {
  content: string;
  reasoning?: string;
}
