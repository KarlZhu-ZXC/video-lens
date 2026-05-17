export interface VideoInfo {
  source: 'bilibili';
  sourceId: string;
  bvid: string;
  aid?: number;
  cid: number;
  title: string;
  upName?: string;
  description?: string;
  duration?: number;
  coverUrl?: string;
  publishedAt?: number;
  url: string;
}

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
