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
import { findCapturedYoutubeTimedText } from './timedtextCapture';

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
  for (const track of candidates) {
    const capturedTranscript = readCapturedYoutubeTimedText(video.sourceId, track);
    if (capturedTranscript?.charCount) return capturedTranscript;
  }
  const panelTranscript = await readYoutubeTranscriptPanel(video.sourceId, candidates[0]);
  if (panelTranscript?.charCount) return panelTranscript;
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
  let lastError: unknown;
  for (const url of youtubeCaptionDownloadUrls(track)) {
    try {
      const transcript = await downloadYoutubeCaptionUrl(url, track);
      if (transcript.charCount > 0) return transcript;
      lastError = new Error(`YouTube 字幕为空：${track.label}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`YouTube 字幕为空：${track.label}`);
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

function youtubeCaptionDownloadUrls(track: YoutubeCaptionTrack): string[] {
  return uniqueStrings([
    withCaptionFormat(track.baseUrl, 'json3'),
    withCaptionFormat(track.baseUrl, 'srv3'),
    withCaptionFormat(track.baseUrl, 'vtt'),
    ...buildUnsignedTimedTextUrls(track),
  ]);
}

async function downloadYoutubeCaptionUrl(url: string, track: YoutubeCaptionTrack): Promise<Transcript> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`YouTube 字幕请求失败：${res.status}`);
  const text = await res.text();
  if (!text.trim()) return emptyYoutubeTranscript(track);
  return parseYoutubeCaptionText(text, track);
}

function readCapturedYoutubeTimedText(videoId: string, track: YoutubeCaptionTrack): Transcript | undefined {
  const captured = findCapturedYoutubeTimedText(videoId, track);
  if (!captured) return undefined;
  const transcript = parseYoutubeCaptionText(captured.text, track);
  return transcript.charCount > 0 ? transcript : undefined;
}

function parseYoutubeCaptionText(text: string, track: YoutubeCaptionTrack): Transcript {
  try {
    return parseYoutubeJson3Transcript(JSON.parse(text), track);
  } catch {
    const xmlTranscript = parseYoutubeXmlTranscript(text, track);
    if (xmlTranscript.charCount > 0) return xmlTranscript;
    return parseYoutubeVttTranscript(text, track);
  }
}

function buildUnsignedTimedTextUrls(track: YoutubeCaptionTrack): string[] {
  let source: URL;
  try {
    source = new URL(track.baseUrl);
  } catch {
    return [];
  }
  const videoId = source.searchParams.get('v');
  const lang = source.searchParams.get('lang') ?? track.languageCode;
  if (!videoId || !lang) return [];
  const formats = ['json3', 'srv3', 'vtt'];
  return formats.map((format) => {
    const url = new URL('/api/timedtext', 'https://www.youtube.com');
    url.searchParams.set('v', videoId);
    url.searchParams.set('lang', lang);
    url.searchParams.set('fmt', format);
    const name = source.searchParams.get('name');
    const kind = source.searchParams.get('kind');
    const tlang = source.searchParams.get('tlang');
    if (name) url.searchParams.set('name', name);
    if (kind) url.searchParams.set('kind', kind);
    if (tlang) url.searchParams.set('tlang', tlang);
    return url.toString();
  });
}

export function parseYoutubeVttTranscript(input: string, track: YoutubeCaptionTrack): Transcript {
  const lines = input
    .split(/\n{2,}/)
    .map((block) => {
      const parts = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const timeIndex = parts.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) return undefined;
      const [fromRaw, toRaw] = parts[timeIndex].split('-->').map((part) => part.trim());
      const text = parts.slice(timeIndex + 1)
        .map((line) => decodeXmlEntities(stripXmlTags(line)))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) return undefined;
      return {
        from: parseVttTimestamp(fromRaw),
        to: parseVttTimestamp(toRaw),
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

function emptyYoutubeTranscript(track: YoutubeCaptionTrack): Transcript {
  return {
    language: track.label,
    languageCode: track.languageCode,
    lines: [],
    plainText: '',
    charCount: 0,
  };
}

function parseVttTimestamp(input: string): number {
  const normalized = input.split(/\s+/)[0] ?? '';
  const parts = normalized.split(':');
  const seconds = Number(parts.pop()?.replace(',', '.') ?? 0);
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  return (Number.isFinite(hours) ? hours : 0) * 3600 +
    (Number.isFinite(minutes) ? minutes : 0) * 60 +
    (Number.isFinite(seconds) ? seconds : 0);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

async function readYoutubeTranscriptPanel(
  videoId: string,
  track: YoutubeCaptionTrack | undefined,
): Promise<Transcript | undefined> {
  if (!isCurrentYoutubeVideo(videoId) || typeof document === 'undefined') return undefined;
  const existing = parseYoutubeTranscriptPanel(track);
  if (existing.charCount > 0) return existing;

  clickYoutubeTranscriptPanelControl();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await wait(250);
    const transcript = parseYoutubeTranscriptPanel(track);
    if (transcript.charCount > 0) return transcript;
    clickYoutubeTranscriptPanelControl();
  }
  return undefined;
}

function isCurrentYoutubeVideo(videoId: string): boolean {
  if (typeof location === 'undefined' || !videoId) return false;
  try {
    const url = new URL(location.href);
    return /(^|\.)youtube\.com$/.test(url.hostname) &&
      (url.searchParams.get('v') === videoId || url.pathname === `/shorts/${videoId}`);
  } catch {
    return false;
  }
}

function clickYoutubeTranscriptPanelControl(): void {
  const transcriptPattern = /(show transcript|transcript|内容转文字|转写文稿|显示文字稿|显示转录|文字稿|字幕稿)/i;
  const visibleTranscriptTarget = findYoutubeActionElement(
    transcriptPattern,
    true,
  );
  if (visibleTranscriptTarget) {
    visibleTranscriptTarget.click();
    return;
  }
  const visibleExpandTarget = findYoutubeActionElement(/(\.\.\.\s*more|\.\.\.更多|show more|显示更多)/i, true);
  if (visibleExpandTarget) {
    visibleExpandTarget.click();
    return;
  }
  findYoutubeActionElement(
    transcriptPattern,
    false,
  )?.click();
}

function findYoutubeActionElement(pattern: RegExp, visibleOnly: boolean): HTMLElement | undefined {
  const closePattern = /(close transcript|关闭)/i;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    'button, ytd-button-renderer, tp-yt-paper-button, yt-chip-cloud-chip-renderer',
  ));
  return candidates
    .map((element) => ({ element, label: youtubeElementLabel(element), visible: isElementVisible(element) }))
    .filter((item) =>
      pattern.test(item.label) &&
      !closePattern.test(item.label) &&
      (!visibleOnly || item.visible))
    .sort((a, b) => Number(b.visible) - Number(a.visible))[0]?.element;
}

function youtubeElementLabel(element: HTMLElement): string {
  return [
    element.getAttribute('aria-label') ?? '',
    element.getAttribute('title') ?? '',
    element.textContent ?? '',
  ].join(' ').replace(/\s+/g, ' ').trim();
}

function isElementVisible(element: HTMLElement): boolean {
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : undefined;
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect?.();
  return Boolean(rect && (rect.width > 0 || rect.height > 0));
}

function parseYoutubeTranscriptPanel(track: YoutubeCaptionTrack | undefined): Transcript {
  const segments = readYoutubeTranscriptSegments();
  if (!segments.length) return emptyYoutubeTranscript(track ?? {
    id: 'youtube-transcript-panel',
    label: 'YouTube transcript',
    languageCode: 'und',
    baseUrl: '',
  });
  const lines = segments.map((segment, index) => ({
    from: segment.from,
    to: segments[index + 1]?.from ?? segment.from + 4,
    text: segment.text,
  }));
  const plainText = lines.map(formatLine).join('\n');
  return {
    language: track?.label ?? 'YouTube transcript',
    languageCode: track?.languageCode,
    lines,
    plainText,
    charCount: plainText.length,
  };
}

function readYoutubeTranscriptSegments(): Array<{ from: number; text: string }> {
  const segmentNodes = Array.from(document.querySelectorAll<HTMLElement>('ytd-transcript-segment-renderer'));
  const fromSegmentNodes = segmentNodes
    .map(readYoutubeTranscriptSegmentNode)
    .filter((line: { from: number; text: string } | undefined): line is { from: number; text: string } => Boolean(line));
  if (fromSegmentNodes.length) return fromSegmentNodes;

  const panels = Array.from(document.querySelectorAll<HTMLElement>(
    'ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id*="transcript"]',
  ));
  return panels.flatMap((panel) => readYoutubeTranscriptLinesFromText(panel.textContent ?? ''));
}

function readYoutubeTranscriptSegmentNode(node: HTMLElement): { from: number; text: string } | undefined {
  const timestamp = textFromSelector(node, '#timestamp, .segment-timestamp, [class*="timestamp"]') ??
    readFirstTimestamp(node.textContent ?? '');
  const rawText = textFromSelector(node, '#segment-text, .segment-text, yt-formatted-string:not(#timestamp)') ??
    stripLeadingTimestamp(node.textContent ?? '');
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (!timestamp || !text) return undefined;
  return { from: parseYoutubeTimestamp(timestamp), text };
}

function readYoutubeTranscriptLinesFromText(input: string): Array<{ from: number; text: string }> {
  return input
    .split(/\n|\r|(?=\b\d{1,2}:\d{2}(?::\d{2})?\b)/)
    .map((line) => {
      const match = line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (!match) return undefined;
      const text = match[2].replace(/\s+/g, ' ').trim();
      return text ? { from: parseYoutubeTimestamp(match[1]), text } : undefined;
    })
    .filter((line: { from: number; text: string } | undefined): line is { from: number; text: string } => Boolean(line));
}

function textFromSelector(node: HTMLElement, selector: string): string | undefined {
  return node.querySelector<HTMLElement>(selector)?.textContent?.trim() || undefined;
}

function readFirstTimestamp(input: string): string | undefined {
  return input.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0];
}

function stripLeadingTimestamp(input: string): string {
  return input.replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*/, '');
}

function parseYoutubeTimestamp(input: string): number {
  const parts = input.split(':').map((part) => Number(part));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
