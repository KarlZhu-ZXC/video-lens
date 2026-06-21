import type { SubtitleLine, Transcript, VideoInfo } from '../VideoSourceProvider';

export type { SubtitleLine, Transcript, VideoInfo };

export interface BilibiliInitialState {
  videoData?: {
    bvid?: string;
    aid?: number;
    cid?: number;
    title?: string;
    desc?: string;
    duration?: number;
    pic?: string;
    pubdate?: number;
    ctime?: number;
    owner?: {
      name?: string;
    };
    stat?: {
      view?: number;
      danmaku?: number;
      reply?: number;
      like?: number;
      coin?: number;
      favorite?: number;
    };
    pages?: Array<{
      cid: number;
      page: number;
      part?: string;
    }>;
    subtitle?: {
      list?: Array<{
        id: number;
        lan: string;
        lan_doc: string;
        subtitle_url: string;
      }>;
    };
  };
}
