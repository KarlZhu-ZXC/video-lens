import { AppController } from './app/AppController';
import { Panel } from './ui/panel';
import { logger } from './utils/logger';

declare global {
  interface Window {
    __VIDEO_SUMMARY_BOOT__?: {
      href: string;
      loadedAt: string;
      matched: boolean;
      error?: string;
    };
  }
}

function showBootError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  window.__VIDEO_SUMMARY_BOOT__ = { ...(window.__VIDEO_SUMMARY_BOOT__ ?? bootState()), error: message };
  document.documentElement.setAttribute('data-video-summary-error', message);

  const badge = document.createElement('div');
  badge.textContent = `Video Summary 启动失败：${message}`;
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
  const matched = location.href.includes('bilibili.com/video/') || location.href.includes('bilibili.com/list/');
  return {
    href: location.href,
    loadedAt: new Date().toISOString(),
    matched,
  };
}

async function bootstrap(): Promise<void> {
  window.__VIDEO_SUMMARY_BOOT__ = bootState();
  document.documentElement.setAttribute('data-video-summary-boot', JSON.stringify(window.__VIDEO_SUMMARY_BOOT__));
  console.info('[Video Summary] userscript loaded', window.__VIDEO_SUMMARY_BOOT__);

  if (!location.href.includes('bilibili.com/video/') && !location.href.includes('bilibili.com/list/')) return;

  const controller = new AppController();
  const panel = new Panel(controller);
  controller.events.on('statechange', () => panel.render());
  panel.render();
  await controller.mount();
}

void bootstrap().catch((error) => {
  logger.error(error);
  showBootError(error);
});
