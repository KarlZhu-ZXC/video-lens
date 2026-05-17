import type { ImageAiClient } from './ImageAiClient';
import type { GeneratedImage, ImageGenerationRequest } from './types';

export class RemoteImageClient implements ImageAiClient {
  async generateImage(_request: ImageGenerationRequest): Promise<GeneratedImage> {
    throw new Error('Remote image client is reserved for future versions.');
  }
}
