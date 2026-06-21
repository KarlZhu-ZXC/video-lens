import type { LocalConfig } from '../../store/types';
import { ChatGptWebImageClient } from './ChatGptWebImageClient';
import { DirectOpenAIImageClient } from './DirectOpenAIImageClient';
import type { ImageAiClient } from './ImageAiClient';

export function createImageAiClient(config: LocalConfig['imageAi']): ImageAiClient {
  return config.mode === 'chatgpt_web' ? new ChatGptWebImageClient(config) : new DirectOpenAIImageClient(config);
}
