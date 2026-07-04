import type { LocalConfig } from '../../store/types';
import type { SubtitleLine, SubtitleOption, Transcript, VideoInfo } from '../VideoSourceProvider';
import {
  downloadOfficialYoutubeTranscript,
  listOfficialYoutubeCaptionOptions,
  type OfficialYoutubeCaptionOption,
} from './officialApi';
import { parseYoutubeCaptionTracks, readYoutubePlayerResponse, readYoutubePlayerResponseFromHtml } from './videoInfo';
import type { YoutubeCaptionTrack } from './types';
import { fetchYoutubeiCaptionTracks } from './youtubei';

export async function getYoutubeSubtitleOptions(video: VideoInfo, config?: LocalConfig): Promise<SubtitleOption[]> {
  const strategy = config?.source.youtube?.captionStrategy ?? 'auto';
  if (strategy !== 'official') {
    const tracks = await loadYoutubeCaptionTracks(video.sourceId);
    const options = toSubtitleOptions([...tracks, ...buildTargetLanguageTranslatedTracks(tracks, config?.summary.language ?? 'zh-CN')]);
    if (options.length) return options;
  }
  const officialOptions = await listOfficialYoutubeCaptionOptions(video.sourceId, config);
  return officialOptions;
}

export async function getYoutubeTranscript(
  video: VideoInfo,
  subtitleId?: string,
  language: LocalConfig['summary']['language'] = 'zh-CN',
  config?: LocalConfig,
): Promise<Transcript> {
  if (subtitleId?.includes('::official:')) {
    const officialOptions = await listOfficialYoutubeCaptionOptions(video.sourceId, config);
    const option = officialOptions.find((item) => item.id === subtitleId);
    const transcript = option ? await downloadOfficialYoutubeTranscript(option, config) : undefined;
    if (transcript) return transcript;
  }
  const tracks = await loadYoutubeCaptionTracks(video.sourceId);
  const candidates = youtubeCaptionTranscriptCandidates(tracks, subtitleId, language);
  if (!candidates.length) throw new Error('当前 YouTube 视频没有可读取字幕');

  let lastError: unknown;
  for (const track of candidates) {
    try {
      const transcript = await downloadYoutubeCaptionTrack(track);
      if (transcript.charCount > 0) return transcript;
      lastError = new Error(`YouTube 字幕为空：${track.label}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('当前 YouTube 视频没有可读取字幕');
}

export async function getOfficialYoutubeTranscriptById(
  video: VideoInfo,
  subtitleId: string,
  config?: LocalConfig,
): Promise<Transcript | undefined> {
  const option = (await listOfficialYoutubeCaptionOptions(video.sourceId, config)).find((item) => item.id === subtitleId);
  return option ? downloadOfficialYoutubeTranscript(option as OfficialYoutubeCaptionOption, config) : undefined;
}

export function getYoutubeCaptionTracks(): YoutubeCaptionTrack[] {
  return parseYoutubeCaptionTracks(readYoutubePlayerResponse() ?? {});
}

export async function loadYoutubeCaptionTracks(videoId?: string): Promise<YoutubeCaptionTrack[]> {
  const pageTracks = getYoutubeCaptionTracks();
  if (pageTracks.length || !videoId) return pageTracks;
  const youtubeiTracks = await fetchYoutubeiCaptionTracks(videoId);
  if (youtubeiTracks.length) return youtubeiTracks;
  return fetchYoutubeWatchCaptionTracks(videoId);
}

export function buildTargetLanguageTranslatedTracks(
  tracks: YoutubeCaptionTrack[],
  language: LocalConfig['summary']['language'],
): YoutubeCaptionTrack[] {
  const targetLanguage = targetTranslationLanguage(language);
  return tracks
    .filter((track) => track.isTranslatable && !isSameLanguageFamily(track.languageCode, targetLanguage))
    .map((track) => buildTranslatedTrack(tracks, track.id, targetLanguage))
    .filter((track: YoutubeCaptionTrack | undefined): track is YoutubeCaptionTrack => Boolean(track));
}

export function selectYoutubeCaptionTrack(
  tracks: YoutubeCaptionTrack[],
  subtitleId: string | undefined,
  language: LocalConfig['summary']['language'],
): YoutubeCaptionTrack | undefined {
  if (subtitleId) {
    const exact = tracks.find((track) => track.id === subtitleId);
    if (exact) return exact;
    const translated = buildTranslatedTrack(tracks, subtitleId);
    if (translated) return translated;
  }
  if (language === 'en-US') {
    return (
      tracks.find((track) => isEnglish(track.languageCode)) ??
      buildTranslatedTrack(tracks, tracks.find((track) => track.isTranslatable)?.id, 'en') ??
      tracks[0]
    );
  }
  return (
    tracks.find((track) => track.languageCode === 'zh-CN') ??
    tracks.find((track) => isChinese(track.languageCode)) ??
    tracks[0]
  );
}

export function parseYoutubeJson3Transcript(raw: any, track: YoutubeCaptionTrack): Transcript {
  const lines = (raw.events ?? [])
    .map((event: any) => {
      const text = (event.segs ?? [])
        .map((seg: any) => String(seg.utf8 ?? ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) return undefined;
      const from = Number(event.tStartMs ?? 0) / 1000;
      return {
        from,
        to: from + Number(event.dDurationMs ?? 0) / 1000,
        text,
      };
    })
    .filter((line: SubtitleLine | undefined): line is SubtitleLine => Boolean(line));
  const plainText = lines.map(formatLine).join('\n');
  return {
    language: track.label,
    languageCode: track.languageCode,
    lines,
    plainText,
    charCount: plainText.length,
  };
}

export function parseYoutubeXmlTranscript(input: string, track: YoutubeCaptionTrack): Transcript {
  const lines = parseYoutubeXmlLines(input);
  const plainText = lines.map(formatLine).join('\n');
  return {
    language: track.label,
    languageCode: track.languageCode,
    lines,
    plainText,
    charCount: plainText.length,
  };
}

export function parseYoutubeXmlLines(input: string): SubtitleLine[] {
  return Array.from(input.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi))
    .map((match) => {
      const attrs = match[1] ?? '';
      const from = Number(readXmlAttribute(attrs, 'start') ?? 0);
      const duration = Number(readXmlAttribute(attrs, 'dur') ?? 0);
      const text = decodeXmlEntities(stripXmlTags(match[2] ?? '')).replace(/\s+/g, ' ').trim();
      if (!text) return undefined;
      return { from, to: from + duration, text };
    })
    .filter((line: SubtitleLine | undefined): line is SubtitleLine => Boolean(line));
}

function buildTranslatedTrack(
  tracks: YoutubeCaptionTrack[],
  subtitleId: string | undefined,
  targetLanguage = 'en',
): YoutubeCaptionTrack | undefined {
  if (!subtitleId) return undefined;
  const source = tracks.find((track) => track.id === subtitleId);
  if (!source?.isTranslatable) return undefined;
  return {
    ...source,
    id: `${source.id}::tlang=${targetLanguage}`,
    label: `${targetLanguageLabel(targetLanguage)} (translated from ${source.label.replace(/ \(auto\)$/, '')})`,
    languageCode: targetLanguage,
    baseUrl: withCaptionTranslation(source.baseUrl, targetLanguage),
    translatedFrom: source.languageCode,
  };
}

function youtubeCaptionTranscriptCandidates(
  tracks: YoutubeCaptionTrack[],
  subtitleId: string | undefined,
  language: LocalConfig['summary']['language'],
): YoutubeCaptionTrack[] {
  const selected = selectYoutubeCaptionTrack(tracks, subtitleId, language);
  const targetLanguage = targetTranslationLanguage(language);
  const languageMatches = language === 'en-US'
    ? tracks.filter((track) => isEnglish(track.languageCode))
    : tracks.filter((track) => isChinese(track.languageCode));
  const translated = tracks
    .filter((track) => track.isTranslatable && !isSameLanguageFamily(track.languageCode, targetLanguage))
    .map((track) => buildTranslatedTrack(tracks, track.id, targetLanguage))
    .filter((track: YoutubeCaptionTrack | undefined): track is YoutubeCaptionTrack => Boolean(track));
  return uniqueCaptionTracks([
    selected,
    ...languageMatches,
    ...translated,
    ...tracks,
  ]);
}

function uniqueCaptionTracks(tracks: Array<YoutubeCaptionTrack | undefined>): YoutubeCaptionTrack[] {
  const seen = new Set<string>();
  return tracks.filter((track): track is YoutubeCaptionTrack => {
    if (!track || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

async function downloadYoutubeCaptionTrack(track: YoutubeCaptionTrack): Promise<Transcript> {
  const url = withCaptionFormat(track.baseUrl, 'json3');
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`YouTube 字幕请求失败：${res.status}`);
  const text = await res.text();
  try {
    return parseYoutubeJson3Transcript(JSON.parse(text), track);
  } catch {
    return parseYoutubeXmlTranscript(text, track);
  }
}

async function fetchYoutubeWatchCaptionTracks(videoId: string): Promise<YoutubeCaptionTrack[]> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    const response = readYoutubePlayerResponseFromHtml(await res.text(), `https://www.youtube.com/watch?v=${videoId}`);
    return response ? parseYoutubeCaptionTracks(response) : [];
  } catch {
    return [];
  }
}

function withCaptionFormat(baseUrl: string, format: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('fmt', format);
  return url.toString();
}

function withCaptionTranslation(baseUrl: string, language: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('tlang', language);
  return url.toString();
}

function toSubtitleOptions(tracks: YoutubeCaptionTrack[]): SubtitleOption[] {
  const seen = new Set<string>();
  return tracks
    .filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    })
    .map((track) => ({ id: track.id, label: track.label }));
}

function isEnglish(languageCode: string): boolean {
  return languageCode.toLowerCase().startsWith('en');
}

function isChinese(languageCode: string): boolean {
  const normalized = languageCode.toLowerCase();
  return normalized.startsWith('zh') || normalized.includes('hans') || normalized.includes('hant');
}

function targetLanguageLabel(language: string): string {
  if (language === 'en') return 'English';
  if (language === 'zh-Hans') return 'Simplified Chinese';
  return language;
}

function targetTranslationLanguage(language: LocalConfig['summary']['language']): string {
  return language === 'en-US' ? 'en' : 'zh-Hans';
}

function isSameLanguageFamily(languageCode: string, targetLanguage: string): boolean {
  return targetLanguage === 'en' ? isEnglish(languageCode) : isChinese(languageCode);
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

function readXmlAttribute(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match?.[1] ?? match?.[2];
}

function stripXmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

function decodeXmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  };
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    return named[normalized] ?? `&${entity};`;
  });
}
