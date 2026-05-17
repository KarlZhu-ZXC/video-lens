import type { Transcript, VideoInfo, VideoSourceProvider } from '../VideoSourceProvider';
import { getBilibiliSubtitleOptions, getBilibiliTranscript } from './subtitle';
import { getBilibiliVideoInfo } from './videoInfo';
import { watchBilibiliRouteChange } from './routeWatcher';

export class BilibiliProvider implements VideoSourceProvider {
  name = 'bilibili';

  match(url: string): boolean {
    return url.includes('bilibili.com/video/') || url.includes('bilibili.com/list/');
  }

  getVideoInfo(): Promise<VideoInfo> {
    return getBilibiliVideoInfo();
  }

  getTranscript(video: VideoInfo, subtitleId?: string): Promise<Transcript> {
    return getBilibiliTranscript(video, subtitleId);
  }

  getSubtitleOptions(video: VideoInfo) {
    return getBilibiliSubtitleOptions(video);
  }

  watchRouteChange(callback: () => void): () => void {
    return watchBilibiliRouteChange(callback);
  }
}
