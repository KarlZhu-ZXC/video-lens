import type { GeneratedImage } from '../ai/image/types';
import type { SummaryResult } from '../summary/types';
import type { LocalConfig } from '../store/types';
import type { TextAiClient } from '../ai/text/TextAiClient';
import type { ImageAiClient } from '../ai/image/ImageAiClient';
import type { OnePageSummaryData } from './onePageSchema';

export type OnePageProgressEvent =
  | { type: 'generating_json' }
  | { type: 'validating_json' }
  | { type: 'generating_image_prompt' }
  | { type: 'generating_ai_image' }
  | { type: 'rendering_card' }
  | { type: 'composing' }
  | { type: 'done' }
  | { type: 'error'; error: Error };

export interface OnePagePipelineInput {
  summary: SummaryResult;
  textAiClient: TextAiClient;
  imageAiClient?: ImageAiClient;
  config: LocalConfig;
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: OnePageProgressEvent) => void;
}

export interface OnePagePipelineResult {
  data: OnePageSummaryData;
  imagePrompt?: string;
  generatedImage?: GeneratedImage;
  composedElement: HTMLElement;
}
