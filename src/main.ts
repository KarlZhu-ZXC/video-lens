import { AppController } from './app/AppController';
import { bindPanelRendering } from './app/events';
import { isSupportedVideoUrl } from './sources/providers';
import { Panel } from './ui/panel';
import { logger } from './utils/logger';
import { isChatGptPage, startChatGptImageReceiver } from './ai/image/chatgptReceiver';
import { claimVideoLensDocumentRuntime } from './runtime/singleton';

declare global {
  interface Window {
    __VIDEO_LENS_BOOT__?: {
      href: string;
      loadedAt: string;
      matched: boolean;
      error?: string;
    };
  }
}

function showBootError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  window.__VIDEO_LENS_BOOT__ = { ...(window.__VIDEO_LENS_BOOT__ ?? bootState()), error: message };
  document.documentElement.setAttribute('data-video-lens-error', message);

  const badge = document.createElement('div');
  badge.textContent = `片语启动失败：${message}`;
  badge.style.cssText = [
    'position:fixed',
    'right:18px',
    'top:84px',
    'z-index:2147483647',
    'max-width:420px',
    'padding:10px 12px',
    'background:#b42318',
    'color:#fff',
    'font:13px/1.45 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif',
    'box-shadow:0 12px 40px rgba(0,0,0,.24)',
  ].join(';');
  document.documentElement.append(badge);
}

function bootState() {
  const matched = isSupportedVideoUrl(location.href);
  return {
    href: location.href,
    loadedAt: new Date().toISOString(),
    matched,
  };
}

async function bootstrap(): Promise<void> {
  window.__VIDEO_LENS_BOOT__ = bootState();
  document.documentElement.setAttribute('data-video-lens-boot', JSON.stringify(window.__VIDEO_LENS_BOOT__));
  console.info('[Video Lens] userscript loaded', window.__VIDEO_LENS_BOOT__);

  if (isChatGptPage(location.href)) {
    startChatGptImageReceiver();
    return;
  }
  if (!isSupportedVideoUrl(location.href)) return;

  const controller = new AppController();
  const panel = new Panel(controller);
  bindPanelRendering(
    controller.events,
    () => panel.render(),
    () => panel.renderStreamChange(),
  );
  panel.render();
  await controller.mount();
}

if (claimVideoLensDocumentRuntime(document)) {
  void bootstrap().catch((error) => {
    logger.error(error);
    showBootError(error);
  });
}
