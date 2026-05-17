import type { OneImageSummaryData } from '../onePage/onePageSchema';
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
  oneImage?: OneImageSummaryData;
  oneImageElement?: HTMLElement;
  oneImageZoom: number;
  onePage?: OneImageSummaryData;
  onePageElement?: HTMLElement;
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
    oneImageZoom: 1,
    status: '等待操作',
    busy: false,
    summaryRequestPending: false,
  };
}
