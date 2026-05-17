import type { ImageAiClient } from './ImageAiClient';
import type { GeneratedImage, ImageGenerationRequest } from './types';

export class GenericImageClient implements ImageAiClient {
  async generateImage(_request: ImageGenerationRequest): Promise<GeneratedImage> {
    throw new Error('Generic image client is reserved for future versions.');
  }
}
