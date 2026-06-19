import type { GeneratedImage } from '../ai/image/types';
import type { VideoInfo, Transcript, SubtitleOption } from '../sources/VideoSourceProvider';
import type { SummaryResult, VideoInsightsMessage } from '../summary/types';

export interface AppState {
  video?: VideoInfo;
  transcript?: Transcript;
  subtitleOptions: SubtitleOption[];
  selectedSubtitleId?: string;
  summary?: SummaryResult;
  streamingSummary?: SummaryResult;
  summaryRequestPending: boolean;
  generatedImage?: GeneratedImage;
  videoInsightsHistory: VideoInsightsMessage[];
  streamingVideoInsight?: VideoInsightsMessage;
  status: string;
  toast?: {
    id: number;
    message: string;
  };
  busy: boolean;
}

export function createInitialState(): AppState {
  return {
    videoInsightsHistory: [],
    subtitleOptions: [],
    status: '等待操作',
    busy: false,
    summaryRequestPending: false,
  };
}
