export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  responseFormat?: 'url' | 'b64_json' | 'auto';
  n?: number;
  context?: {
    source: string;
    sourceId: string;
  };
}

export interface GeneratedImage {
  blob?: Blob;
  dataUrl?: string;
  url?: string;
  mimeType?: string;
  raw?: unknown;
}
