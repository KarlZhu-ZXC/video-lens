import type { GeneratedImage } from '../ai/image/types';
import type { Transcript, VideoInfo } from '../sources/VideoSourceProvider';
import type { ReasoningTiming } from './reasoningTiming';

export interface SummaryResult extends ReasoningTiming {
  video: VideoInfo;
  transcript: Transcript;
  promptId: string;
  content: string;
  reasoning?: string;
  chunkSummaries?: string[];
  createdAt: number;
}

export interface ChatMessage extends ReasoningTiming {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  generatedImage?: GeneratedImage;
}
