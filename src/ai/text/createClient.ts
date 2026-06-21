import type { LocalConfig } from '../../store/types';
import type { TextAiClient } from './TextAiClient';
import { DirectOpenAITextClient } from './DirectOpenAITextClient';
import { AnthropicTextClient } from './AnthropicTextClient';

export function createTextAiClient(config: LocalConfig['textAi']): TextAiClient {
  if (config.apiStyle === 'anthropic') {
    return new AnthropicTextClient(config);
  }
  return new DirectOpenAITextClient(config);
}
