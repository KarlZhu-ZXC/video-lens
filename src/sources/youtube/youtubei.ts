import { parseYoutubeCaptionTracks } from './videoInfo';
import type { YoutubeCaptionTrack, YoutubePlayerResponse } from './types';

export async function fetchYoutubeiCaptionTracks(videoId: string): Promise<YoutubeCaptionTrack[]> {
  const response = await fetchYoutubeiPlayerResponse(videoId);
  return response ? parseYoutubeCaptionTracks(response) : [];
}

export async function fetchYoutubeiPlayerResponse(videoId: string): Promise<YoutubePlayerResponse | undefined> {
  if (!videoId || typeof fetch === 'undefined') return undefined;
  try {
    const res = await fetch(youtubeiPlayerUrl(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: readYtcfgString('INNERTUBE_CLIENT_NAME') ?? 'WEB',
            clientVersion: readYtcfgString('INNERTUBE_CLIENT_VERSION') ?? '2.20240517.00.00',
          },
        },
      }),
    });
    if (!res.ok) return undefined;
    return (await res.json()) as YoutubePlayerResponse;
  } catch {
    return undefined;
  }
}

function youtubeiPlayerUrl(): string {
  const origin = typeof location === 'undefined' ? 'https://www.youtube.com' : location.origin;
  const url = new URL('/youtubei/v1/player', origin);
  url.searchParams.set('prettyPrint', 'false');
  const key = readYtcfgString('INNERTUBE_API_KEY');
  if (key) url.searchParams.set('key', key);
  return url.toString();
}

function readYtcfgString(key: string): string | undefined {
  const getter = (globalThis as any).window?.ytcfg?.get;
  if (typeof getter !== 'function') return undefined;
  const value = getter(key);
  return typeof value === 'string' && value ? value : undefined;
}
