import type { GeneratedImage } from '../ai/image/types';
import type { ImageAiClient } from '../ai/image/ImageAiClient';
import type { LocalConfig } from '../store/types';
import type { SummaryResult } from '../summary/types';

export type OnePageProgressEvent =
  | { type: 'preparing_prompt' }
  | { type: 'generating_image' }
  | { type: 'done' }
  | { type: 'error'; error: Error };

export interface OnePagePipelineInput {
  summary: SummaryResult;
  imageAiClient: ImageAiClient;
  config: LocalConfig;
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: OnePageProgressEvent) => void;
}

export interface OnePagePipelineResult {
  prompt: string;
  generatedImage: GeneratedImage;
}
