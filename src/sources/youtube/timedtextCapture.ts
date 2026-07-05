import type { YoutubeCaptionTrack } from './types';

const MESSAGE_SOURCE = 'video-lens-youtube-timedtext';
const MAX_CAPTURED_RESPONSES = 40;
const CAPTURE_TTL_MS = 10 * 60 * 1000;

export interface CapturedYoutubeTimedText {
  url: string;
  text: string;
  status: number;
  contentType?: string;
  capturedAt: number;
}

declare global {
  interface Window {
    __VIDEO_LENS_TIMEDTEXT_CAPTURE__?: boolean;
  }
}

const capturedTimedText: CapturedYoutubeTimedText[] = [];
let listenerStarted = false;

export function startYoutubeTimedTextCapture(): void {
  if (typeof window === 'undefined') return;
  startYoutubeTimedTextMessageListener();
  injectYoutubeTimedTextCapture();
}

export function startYoutubeTimedTextMessageListener(): void {
  if (listenerStarted || typeof window === 'undefined') return;
  listenerStarted = true;
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<CapturedYoutubeTimedText> & { source?: string; type?: string };
    if (data?.source !== MESSAGE_SOURCE || data.type !== 'response') return;
    if (typeof data.url !== 'string' || typeof data.text !== 'string') return;
    rememberYoutubeTimedTextCapture({
      url: data.url,
      text: data.text,
      status: typeof data.status === 'number' ? data.status : 0,
      contentType: typeof data.contentType === 'string' ? data.contentType : undefined,
      capturedAt: typeof data.capturedAt === 'number' ? data.capturedAt : Date.now(),
    });
  });
}

export function rememberYoutubeTimedTextCapture(input: Omit<CapturedYoutubeTimedText, 'capturedAt'> & { capturedAt?: number }): void {
  if (!isYoutubeTimedTextUrl(input.url) || !input.text.trim()) return;
  pruneCapturedTimedText();
  const capturedAt = input.capturedAt ?? Date.now();
  const existing = capturedTimedText.findIndex((item) => item.url === input.url);
  const item = { ...input, capturedAt };
  if (existing >= 0) {
    capturedTimedText.splice(existing, 1, item);
  } else {
    capturedTimedText.push(item);
  }
  if (capturedTimedText.length > MAX_CAPTURED_RESPONSES) {
    capturedTimedText.splice(0, capturedTimedText.length - MAX_CAPTURED_RESPONSES);
  }
}

export function findCapturedYoutubeTimedText(
  videoId: string,
  track: YoutubeCaptionTrack,
): CapturedYoutubeTimedText | undefined {
  pruneCapturedTimedText();
  return [...capturedTimedText]
    .reverse()
    .find((item) => item.status >= 200 && item.status < 300 && matchesYoutubeTimedTextTrack(item.url, videoId, track));
}

export function clearCapturedYoutubeTimedTextForTest(): void {
  capturedTimedText.length = 0;
  listenerStarted = false;
}

function injectYoutubeTimedTextCapture(): void {
  const pageWindow = readUnsafeWindow();
  if (pageWindow && pageWindow !== window) {
    installPageWindowCapture(pageWindow);
    return;
  }
  if (window.__VIDEO_LENS_TIMEDTEXT_CAPTURE__ || typeof document === 'undefined') return;
  const script = document.createElement('script');
  script.textContent = `(${installPageWindowCapture.toString()})(window);`;
  (document.documentElement || document.head || document.body)?.append(script);
  script.remove();
}

function installPageWindowCapture(pageWindow: Window): void {
  const win = pageWindow as Window & { __VIDEO_LENS_TIMEDTEXT_CAPTURE__?: boolean };
  if (win.__VIDEO_LENS_TIMEDTEXT_CAPTURE__) return;
  win.__VIDEO_LENS_TIMEDTEXT_CAPTURE__ = true;
  const messageSource = 'video-lens-youtube-timedtext';

  const isTimedTextUrl = (input: unknown): boolean => {
    const value = requestUrl(input);
    try {
      return new URL(value, win.location.href).pathname === '/api/timedtext';
    } catch {
      return value.includes('/api/timedtext');
    }
  };
  const emit = (url: string, text: string, status: number, contentType?: string): void => {
    if (!text || !text.trim()) return;
    win.postMessage({
      source: messageSource,
      type: 'response',
      url,
      text,
      status,
      contentType,
      capturedAt: Date.now(),
    }, '*');
  };

  const originalFetch = win.fetch;
  if (typeof originalFetch === 'function') {
    win.fetch = async function videoLensFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const response = await originalFetch.call(this, input, init);
      const inputUrl = requestUrl(input);
      const responseUrl = response.url || inputUrl;
      if (isTimedTextUrl(responseUrl) || isTimedTextUrl(inputUrl)) {
        response.clone().text().then((text) => {
          emit(responseUrl, text, response.status, response.headers.get('content-type') ?? undefined);
        }).catch(() => undefined);
      }
      return response;
    };
  }

  const OriginalXHR = (win as any).XMLHttpRequest as typeof XMLHttpRequest | undefined;
  if (typeof OriginalXHR === 'function') {
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;
    OriginalXHR.prototype.open = function videoLensOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ): void {
      (this as XMLHttpRequest & { __videoLensUrl?: string }).__videoLensUrl = String(url);
      return originalOpen.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
    };
    OriginalXHR.prototype.send = function videoLensSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
      this.addEventListener('load', function videoLensLoad(this: XMLHttpRequest) {
        const xhr = this as XMLHttpRequest & { __videoLensUrl?: string };
        const url = xhr.responseURL || xhr.__videoLensUrl || '';
        if (!isTimedTextUrl(url) || typeof xhr.responseText !== 'string') return;
        emit(url, xhr.responseText, xhr.status, xhr.getResponseHeader('content-type') ?? undefined);
      });
      return originalSend.call(this, body);
    };
  }

  function requestUrl(input: unknown): string {
    if (typeof input === 'string') return input;
    if (input && typeof (input as { url?: unknown }).url === 'string') return (input as { url: string }).url;
    if (input && typeof (input as { href?: unknown }).href === 'string') return (input as { href: string }).href;
    return String(input ?? '');
  }
}

function readUnsafeWindow(): Window | undefined {
  try {
    return (globalThis as { unsafeWindow?: Window }).unsafeWindow;
  } catch {
    return undefined;
  }
}

function matchesYoutubeTimedTextTrack(url: string, videoId: string, track: YoutubeCaptionTrack): boolean {
  let captured: URL;
  let trackUrl: URL | undefined;
  try {
    captured = new URL(url, 'https://www.youtube.com');
  } catch {
    return false;
  }
  try {
    trackUrl = new URL(track.baseUrl);
  } catch {
    trackUrl = undefined;
  }

  const capturedVideoId = captured.searchParams.get('v');
  if (capturedVideoId && capturedVideoId !== videoId) return false;

  const capturedTargetLanguage = captured.searchParams.get('tlang');
  const trackTargetLanguage = trackUrl?.searchParams.get('tlang') ?? (track.translatedFrom ? track.languageCode : undefined);
  if (trackTargetLanguage) {
    return sameLanguage(capturedTargetLanguage, trackTargetLanguage);
  }
  if (capturedTargetLanguage && !sameLanguage(capturedTargetLanguage, track.languageCode)) return false;

  const capturedLanguage = captured.searchParams.get('lang');
  const trackLanguage = trackUrl?.searchParams.get('lang') ?? track.languageCode;
  if (!sameLanguage(capturedLanguage, trackLanguage) && !sameLanguage(capturedLanguage, track.languageCode)) return false;

  const capturedKind = captured.searchParams.get('kind');
  const trackKind = trackUrl?.searchParams.get('kind') ?? (track.isAutoGenerated ? 'asr' : undefined);
  return !capturedKind || !trackKind || capturedKind === trackKind;
}

function sameLanguage(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return normalizeLanguage(left) === normalizeLanguage(right);
}

function normalizeLanguage(language: string): string {
  return language.toLowerCase().replace(/_/g, '-');
}

function isYoutubeTimedTextUrl(url: string): boolean {
  try {
    return new URL(url, 'https://www.youtube.com').pathname === '/api/timedtext';
  } catch {
    return url.includes('/api/timedtext');
  }
}

function pruneCapturedTimedText(): void {
  const minCapturedAt = Date.now() - CAPTURE_TTL_MS;
  const firstFreshIndex = capturedTimedText.findIndex((item) => item.capturedAt >= minCapturedAt);
  if (firstFreshIndex > 0) capturedTimedText.splice(0, firstFreshIndex);
  if (firstFreshIndex < 0 && capturedTimedText.length) capturedTimedText.length = 0;
}
