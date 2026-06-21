import type { VideoInfo, VideoStats } from '../VideoSourceProvider';
import type { BilibiliInitialState } from './types';

declare global {
  interface Window {
    __INITIAL_STATE__?: BilibiliInitialState;
  }
}

export async function getBilibiliVideoInfo(): Promise<VideoInfo> {
  const stateInfo = fromInitialState();
  if (stateInfo) return enrichCreatorFollowers(stateInfo, window.__INITIAL_STATE__);

  const bvid = extractBvid(location.href);
  if (!bvid) throw new Error('无法从当前页面识别 BVID');

  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Bilibili 视频信息请求失败：${res.status}`);
  const json = await res.json();
  const data = json.data;
  if (!data?.cid) throw new Error('Bilibili API 未返回 cid');

  return enrichCreatorFollowers({
    source: 'bilibili',
    sourceId: data.bvid,
    bvid: data.bvid,
    aid: data.aid,
    cid: data.cid,
    title: data.title ?? document.title.replace(/_哔哩哔哩_bilibili$/, ''),
    creatorId: parseCreatorId(data.owner?.mid),
    upName: data.owner?.name,
    description: data.desc,
    duration: data.duration,
    coverUrl: data.pic,
    publishedAt: data.pubdate ?? data.ctime,
    stats: parseBilibiliStats(data.stat),
    url: location.href,
  });
}

function fromInitialState(): VideoInfo | undefined {
  const data = window.__INITIAL_STATE__?.videoData;
  const bvid = data?.bvid ?? extractBvid(location.href);
  const cid = data?.cid ?? data?.pages?.[0]?.cid;
  if (!bvid || !cid) return undefined;

  return {
    source: 'bilibili',
    sourceId: bvid,
    bvid,
    aid: data?.aid,
    cid,
    title: data?.title ?? document.title.replace(/_哔哩哔哩_bilibili$/, ''),
    creatorId: parseCreatorId(data?.owner?.mid ?? window.__INITIAL_STATE__?.upData?.mid),
    upName: data?.owner?.name,
    creatorFollowers: parseBilibiliPageFollowers(window.__INITIAL_STATE__),
    description: data?.desc,
    duration: data?.duration,
    coverUrl: data?.pic,
    publishedAt: data?.pubdate ?? data?.ctime,
    stats: parseBilibiliStats(data?.stat),
    url: location.href,
  };
}

async function enrichCreatorFollowers(
  video: VideoInfo,
  state?: BilibiliInitialState,
): Promise<VideoInfo> {
  const pageFollowers = video.creatorFollowers ?? parseBilibiliPageFollowers(state);
  if (pageFollowers !== undefined) return { ...video, creatorFollowers: pageFollowers };
  if (!video.creatorId) return video;
  const creatorFollowers = await fetchBilibiliFollowerCount(video.creatorId);
  return creatorFollowers === undefined ? video : { ...video, creatorFollowers };
}

export function parseBilibiliPageFollowers(state: BilibiliInitialState | undefined): number | undefined {
  return parseCount(state?.upData?.fans);
}

export async function fetchBilibiliFollowerCount(
  creatorId: string | number,
  fetcher: typeof fetch = fetch,
): Promise<number | undefined> {
  try {
    const response = await fetcher(
      `https://api.bilibili.com/x/relation/stat?vmid=${encodeURIComponent(String(creatorId))}`,
      { credentials: 'include' },
    );
    if (!response.ok) return undefined;
    const json = await response.json();
    return parseCount(json?.data?.follower);
  } catch {
    return undefined;
  }
}

export function parseBilibiliStats(stat: Record<string, unknown> | undefined): VideoStats | undefined {
  const stats: VideoStats = {
    views: parseCount(stat?.view),
    danmaku: parseCount(stat?.danmaku),
    comments: parseCount(stat?.reply),
    likes: parseCount(stat?.like),
    coins: parseCount(stat?.coin),
    favorites: parseCount(stat?.favorite),
  };
  return Object.values(stats).some((value) => value !== undefined) ? stats : undefined;
}

function parseCount(value: unknown): number | undefined {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : undefined;
}

function parseCreatorId(value: unknown): string | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? String(id) : undefined;
}

export function extractBvid(url: string): string | undefined {
  const match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  return match?.[1];
}
