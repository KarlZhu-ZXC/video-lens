import type { GeneratedImage, ImageGenerationRequest } from './types';

export interface ImageAiClient {
  generateImage(request: ImageGenerationRequest, options?: { signal?: AbortSignal }): Promise<GeneratedImage>;
}
