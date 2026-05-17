import type { Transcript, VideoInfo } from '../sources/VideoSourceProvider';

export interface SummaryResult {
  video: VideoInfo;
  transcript: Transcript;
  promptId: string;
  content: string;
  reasoning?: string;
  chunkSummaries?: string[];
  createdAt: number;
}

export interface VideoInsightsMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
}
