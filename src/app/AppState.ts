import type { VideoInfo, Transcript, SubtitleOption } from '../sources/VideoSourceProvider';
import type { SummaryResult, ChatMessage } from '../summary/types';

export interface AppState {
  video?: VideoInfo;
  transcript?: Transcript;
  subtitleOptions: SubtitleOption[];
  selectedSubtitleId?: string;
  summary?: SummaryResult;
  streamingSummary?: SummaryResult;
  summaryRequestPending: boolean;
  summaryChatHistory: ChatMessage[];
  streamingSummaryInsight?: ChatMessage;
  status: string;
  toast?: {
    id: number;
    message: string;
  };
  busy: boolean;
}

export function createInitialState(): AppState {
  return {
    summaryChatHistory: [],
    subtitleOptions: [],
    status: '等待操作',
    busy: false,
    summaryRequestPending: false,
  };
}
