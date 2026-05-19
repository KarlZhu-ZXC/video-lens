import type { LocalConfig } from '../../store/types';
import type { Transcript, VideoInfo, VideoSourceProvider } from '../VideoSourceProvider';
import { watchVideoRouteChange } from '../routeWatcher';
import { getYoutubeSubtitleOptions, getYoutubeTranscript } from './subtitle';
import { extractYoutubeVideoId, getYoutubeVideoInfo } from './videoInfo';

export class YouTubeProvider implements VideoSourceProvider {
  name = 'youtube';

  constructor(private readonly getConfig?: () => LocalConfig) {}

  match(url: string): boolean {
    return Boolean(extractYoutubeVideoId(url));
  }

  getVideoInfo(): Promise<VideoInfo> {
    return getYoutubeVideoInfo(this.getConfig?.());
  }

  getTranscript(video: VideoInfo, subtitleId?: string): Promise<Transcript> {
    const config = this.getConfig?.();
    return getYoutubeTranscript(video, subtitleId, config?.summary.language, config);
  }

  getSubtitleOptions(video: VideoInfo) {
    return getYoutubeSubtitleOptions(video, this.getConfig?.());
  }

  watchRouteChange(callback: () => void): () => void {
    return watchVideoRouteChange(callback);
  }
}
