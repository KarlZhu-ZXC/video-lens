export interface VideoInfo {
  source: VideoSource;
  sourceId: string;
  platform?: string;
  bvid?: string;
  aid?: number;
  cid?: number;
  title: string;
  creatorName?: string;
  upName?: string;
  description?: string;
  duration?: number;
  coverUrl?: string;
  publishedAt?: number;
  stats?: VideoStats;
  url: string;
}

export interface VideoStats {
  views?: number;
  danmaku?: number;
  comments?: number;
  likes?: number;
  coins?: number;
  favorites?: number;
}

export type VideoSource = 'bilibili' | 'youtube';

export interface SubtitleLine {
  from: number;
  to: number;
  text: string;
}

export interface Transcript {
  language?: string;
  languageCode?: string;
  lines: SubtitleLine[];
  plainText: string;
  charCount: number;
}

export interface SubtitleOption {
  id: string;
  label: string;
}

export interface VideoSourceProvider {
  name: string;
  match(url: string): boolean;
  getVideoInfo(): Promise<VideoInfo>;
  getTranscript(video: VideoInfo, subtitleId?: string): Promise<Transcript>;
  getSubtitleOptions?(video: VideoInfo): Promise<SubtitleOption[]>;
  watchRouteChange(callback: () => void): () => void;
}
