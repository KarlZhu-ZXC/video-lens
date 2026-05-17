import type { AppController } from '../app/AppController';
import { emptyState } from './components';
import { el } from '../utils/dom';
import { createUiText, getStatusText } from './i18n';

export function renderOneImageView(controller: AppController): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const preview = el('div', { class: 'vs-preview-wrap' });
  const previewContent = el('div', { class: 'vs-preview-content' });
  if (controller.state.oneImageElement) {
    const zoom = resolveViewerZoom(controller);
    const stage = el('div', {
      class: 'vs-image-viewer-stage',
      style: `--vs-zoom:${zoom};--vs-card-width:${controller.config.oneImage.width || 900}px`,
    }, [controller.state.oneImageElement.cloneNode(true)]);
    previewContent.append(stage);
  }
  else previewContent.append(emptyState(t('oneImage.emptyTitle'), t('oneImage.emptyBody')));
  preview.append(renderPreviewToolbar(controller, t), previewContent);

  const scrollContent = el('div', { class: 'vs-one-image-scroll' }, [
    renderConfigurationRow(controller, t),
    el('div', { class: `vs-status ${controller.state.busy ? 'busy' : ''}` }, [
      getStatusText(controller.config.ui.language, resolveOneImageStatus(controller)),
    ]),
    el('div', { class: `vs-progress ${controller.state.busy ? '' : 'idle'}`, 'aria-label': 'Loading' }, [el('span')]),
    preview,
  ]);

  return el('div', { class: 'vs-one-image-layout' }, [
    scrollContent,
    el('div', { class: 'vs-bottom-actions' }, [
      generateButton(
        controller.state.oneImageElement ? t('actions.regenerate') : t('actions.generateOneImage'),
        () => controller.generateOneImage({ force: Boolean(controller.state.oneImageElement) }),
        controller.state.busy,
      ),
    ]),
  ]);
}

export function resolveOneImageStatus(controller: AppController): string {
  const status = controller.state.status;
  if (controller.state.busy) return status;
  if (/失败|错误|failed|error/i.test(status)) return status;
  if (isOneImageStatus(status)) return status;
  if (controller.state.oneImageElement) return '一图流已生成';
  return '等待生成一图流';
}

function isOneImageStatus(status: string): boolean {
  return [
    '生成一图流',
    '生成一图流 JSON',
    '校验一图流 JSON',
    '生成图片 prompt',
    '生成 AI 背景图',
    '渲染中文信息图',
    '合成图片',
    '一图流已生成',
    'PNG 已导出',
    '请先生成摘要',
  ].includes(status);
}

function resolveViewerZoom(controller: AppController): number {
  if (controller.state.oneImageZoom !== 1) return controller.state.oneImageZoom;
  const viewportWidth = typeof window === 'undefined' ? 822 : window.innerWidth;
  const shellWidth = Math.min(822, viewportWidth - 16);
  const availableWidth = Math.max(320, shellWidth - 72 - 32 - 32);
  const cardWidth = controller.config.oneImage.width || 900;
  return Math.max(0.35, Math.min(1, availableWidth / cardWidth));
}

function generateButton(label: string, onClick: () => void | Promise<void>, disabled: boolean): HTMLButtonElement {
  const button = el('button', { class: 'primary vs-start-button', disabled }, [
    viewerIcon('ai'),
    el('span', {}, [label]),
  ]);
  button.addEventListener('click', () => void onClick());
  return button;
}

function renderConfigurationRow(controller: AppController, t: ReturnType<typeof createUiText>): HTMLElement {
  const modeLabel = modeText(controller.config.oneImage.mode, t);
  return el('section', { class: 'vs-config-row', 'aria-label': t('oneImage.configuration') }, [
    el('span', { class: 'vs-config-label' }, [t('oneImage.configuration')]),
    el('div', { class: 'vs-config-chips' }, [
      el('span', { class: 'vs-config-chip', title: modeLabel }, [viewerIcon('image'), el('span', {}, [modeLabel])]),
    ]),
  ]);
}

function modeText(mode: AppController['config']['oneImage']['mode'], t: ReturnType<typeof createUiText>): string {
  if (mode === 'text_card_only') return t('settings.textCardOnly');
  if (mode === 'ai_image_only') return t('oneImage.modeAiOnly');
  return t('oneImage.modeAiBackground');
}

function renderPreviewToolbar(controller: AppController, t: ReturnType<typeof createUiText>): HTMLElement {
  const viewerZoom = controller.state.oneImageElement ? resolveViewerZoom(controller) : controller.state.oneImageZoom;
  const zoomOut = viewerTool('zoomOut', '缩小', () => controller.setOneImageZoom(viewerZoom - 0.1), !controller.state.oneImageElement);
  const reset = viewerTool(
    'reset',
    `${Math.round(viewerZoom * 100)}%`,
    () => controller.setOneImageZoom(1),
    !controller.state.oneImageElement,
  );
  const zoomIn = viewerTool('zoomIn', '放大', () => controller.setOneImageZoom(viewerZoom + 0.1), !controller.state.oneImageElement);
  const button = el('button', {
    class: 'vs-output-tool',
    title: t('actions.exportPng'),
    'aria-label': t('actions.exportPng'),
    'data-tooltip': t('actions.exportPng'),
    disabled: !controller.state.oneImageElement,
  }, [downloadIcon()]);
  button.addEventListener('click', () => void controller.exportOneImage());
  return el('div', { class: 'vs-preview-toolbar', 'aria-label': t('oneImage.toolbar') }, [
    zoomOut,
    reset,
    zoomIn,
    el('div', { class: 'vs-toolbar-spacer' }),
    button,
  ]);
}

function viewerTool(icon: ViewerIconName, label: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const button = el('button', {
    class: 'vs-output-tool',
    title: label,
    'aria-label': label,
    'data-tooltip': label,
    disabled,
  }, [viewerIcon(icon)]);
  button.addEventListener('click', onClick);
  return button;
}

type ViewerIconName = 'zoomIn' | 'zoomOut' | 'reset' | 'download' | 'ai' | 'image';

function downloadIcon(): SVGSVGElement {
  return viewerIcon('download');
}

function viewerIcon(name: ViewerIconName): SVGSVGElement {
  const paths: Record<ViewerIconName, string[]> = {
    zoomIn: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35', 'M11 8v6', 'M8 11h6'],
    zoomOut: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35', 'M8 11h6'],
    reset: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v6h6'],
    download: ['M12 3.5v11', 'M7.5 10.5 12 15l4.5-4.5', 'M5 20.5h14'],
    ai: ['M12 3.5l1.35 4.15L17.5 9l-4.15 1.35L12 14.5l-1.35-4.15L6.5 9l4.15-1.35z', 'M18.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'],
    image: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M7 15l3-3 2.5 2.5L15.5 11 19 15'],
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  paths[name].forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}
