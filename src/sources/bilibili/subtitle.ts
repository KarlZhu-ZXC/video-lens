import type { SubtitleLine, SubtitleOption, Transcript, VideoInfo } from '../VideoSourceProvider';

interface SubtitleMeta {
  lan: string;
  lan_doc: string;
  subtitle_url: string;
}

export async function getBilibiliTranscript(video: VideoInfo, subtitleId?: string): Promise<Transcript> {
  const subtitles = await getSubtitleList(video);
  const selected = selectSubtitle(subtitles, subtitleId);
  if (!selected) throw new Error('当前视频没有公开字幕');

  const url = normalizeSubtitleUrl(selected.subtitle_url);
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`字幕请求失败：${res.status}`);

  const json = await res.json();
  const lines: SubtitleLine[] = (json.body ?? []).map((item: any) => ({
    from: Number(item.from ?? 0),
    to: Number(item.to ?? 0),
    text: String(item.content ?? '').trim(),
  }));
  const plainText = lines.map(formatLine).join('\n');
  return {
    language: selected.lan_doc || selected.lan,
    languageCode: selected.lan,
    lines,
    plainText,
    charCount: plainText.length,
  };
}

export async function getBilibiliSubtitleOptions(video: VideoInfo): Promise<SubtitleOption[]> {
  return (await getSubtitleList(video)).map((item) => ({ id: item.lan, label: item.lan_doc || item.lan }));
}

async function getSubtitleList(video: VideoInfo): Promise<SubtitleMeta[]> {
  const res = await fetch(
    `https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(video.bvid)}&cid=${video.cid}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`字幕列表请求失败：${res.status}`);
  const json = await res.json();
  return json.data?.subtitle?.subtitles ?? json.data?.subtitle?.list ?? [];
}

function selectSubtitle(subtitles: SubtitleMeta[], subtitleId?: string): SubtitleMeta | undefined {
  return (
    (subtitleId ? subtitles.find((item) => item.lan === subtitleId) : undefined) ??
    subtitles.find((item) => item.lan === 'zh-CN') ??
    subtitles.find((item) => item.lan.startsWith('zh')) ??
    subtitles[0]
  );
}

function normalizeSubtitleUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url;
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
