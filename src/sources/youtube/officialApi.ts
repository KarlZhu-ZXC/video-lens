import type { LocalConfig } from '../../store/types';
import type { SubtitleLine, SubtitleOption, Transcript, VideoInfo } from '../VideoSourceProvider';

interface YoutubeVideosListResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      publishedAt?: string;
      title?: string;
      description?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url?: string; width?: number; height?: number }>;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
}

type YoutubeThumbnail = { url?: string; width?: number; height?: number };

export async function getYoutubeVideoFromOfficialApi(
  videoId: string,
  config?: LocalConfig,
): Promise<VideoInfo | undefined> {
  const apiKey = config?.source.youtube?.apiKey?.trim();
  const strategy = config?.source.youtube?.captionStrategy ?? 'auto';
  if (!apiKey || strategy === 'page') return undefined;

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url);
  if (!res.ok) return undefined;
  const json = (await res.json()) as YoutubeVideosListResponse;
  const item = json.items?.[0];
  if (!item?.id || !item.snippet?.title) return undefined;

  const creatorName = item.snippet.channelTitle;
  return {
    source: 'youtube',
    sourceId: item.id,
    platform: 'YouTube',
    title: item.snippet.title,
    creatorName,
    upName: creatorName,
    description: item.snippet.description,
    duration: parseIsoDuration(item.contentDetails?.duration),
    coverUrl: bestThumbnail(item.snippet.thumbnails),
    publishedAt: parsePublishedAt(item.snippet.publishedAt),
    url: `https://www.youtube.com/watch?v=${item.id}`,
  };
}

export interface OfficialYoutubeCaptionOption extends SubtitleOption {
  officialCaptionId: string;
  languageCode?: string;
}

export async function listOfficialYoutubeCaptionOptions(
  videoId: string,
  config?: LocalConfig,
): Promise<OfficialYoutubeCaptionOption[]> {
  const token = config?.source.youtube?.oauthAccessToken?.trim();
  const strategy = config?.source.youtube?.captionStrategy ?? 'auto';
  if (!token || strategy === 'page') return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/captions');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', videoId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items ?? [])
    .filter((item: any) => item.id)
    .map((item: any) => {
      const languageCode = String(item.snippet?.language ?? '');
      const name = String(item.snippet?.name ?? (languageCode || item.id));
      return {
        id: `${languageCode || 'official'}::official:${item.id}`,
        officialCaptionId: item.id,
        languageCode,
        label: name,
      };
    });
}

export async function downloadOfficialYoutubeTranscript(
  option: OfficialYoutubeCaptionOption,
  config?: LocalConfig,
): Promise<Transcript | undefined> {
  const token = config?.source.youtube?.oauthAccessToken?.trim();
  const strategy = config?.source.youtube?.captionStrategy ?? 'auto';
  if (!token || strategy === 'page') return undefined;

  const url = new URL(`https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(option.officialCaptionId)}`);
  url.searchParams.set('tfmt', 'srt');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return undefined;
  const text = await res.text();
  const lines = parseSrtLines(text);
  const plainText = lines.map(formatLine).join('\n');
  return {
    language: option.label,
    languageCode: option.languageCode,
    lines,
    plainText,
    charCount: plainText.length,
  };
}

function bestThumbnail(thumbnails: Record<string, YoutubeThumbnail> | undefined): string | undefined {
  return Object.values(thumbnails ?? {})
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
    .find((item) => item.url)?.url;
}

function parsePublishedAt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.floor(time / 1000) : undefined;
}

function parseIsoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function parseSrtLines(input: string): SubtitleLine[] {
  return input
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.trim().split(/\r?\n/);
      const timing = lines.find((line) => line.includes('-->'));
      if (!timing) return undefined;
      const text = lines.slice(lines.indexOf(timing) + 1).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) return undefined;
      const [start, end] = timing.split('-->').map((part) => parseSrtTime(part.trim()));
      return { from: start, to: end, text };
    })
    .filter((line: SubtitleLine | undefined): line is SubtitleLine => Boolean(line));
}

function parseSrtTime(value: string): number {
  const match = value.match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function formatLine(line: SubtitleLine): string {
  return `[${formatTime(line.from)}] ${line.text}`;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
