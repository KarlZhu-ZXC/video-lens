import type { LocalConfig } from '../store/types';
import { BilibiliProvider } from './bilibili/BilibiliProvider';
import type { VideoSourceProvider } from './VideoSourceProvider';
import { YouTubeProvider } from './youtube/YouTubeProvider';

export function createVideoSourceProviders(getConfig?: () => LocalConfig): VideoSourceProvider[] {
  return [new BilibiliProvider(), new YouTubeProvider(getConfig)];
}

export function getActiveProvider(url: string, getConfig?: () => LocalConfig): VideoSourceProvider {
  const provider = createVideoSourceProviders(getConfig).find((item) => item.match(url));
  if (!provider) throw new Error('当前页面不是支持的视频页面');
  return provider;
}

export function isSupportedVideoUrl(url: string): boolean {
  return createVideoSourceProviders().some((provider) => provider.match(url));
}
