import type { AppController } from '../app/AppController';
import { normalizeAssetUrl } from '../utils/url';
import { emptyState } from './components';
import { el } from '../utils/dom';
import { createUiText, getStatusText } from './i18n';

export function renderOneImageView(controller: AppController): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const image = controller.state.generatedImage;
  const previewContent = el('div', { class: 'vs-preview-content' });
  const src = image ? normalizeAssetUrl(image.dataUrl ?? image.url ?? '') : '';
  if (src) previewContent.append(el('img', { class: 'vs-generated-image', src, alt: t('oneImage.title') }));
  else previewContent.append(emptyState(t('oneImage.emptyTitle'), t('oneImage.emptyBody')));

  const download = el('button', {
    class: 'vs-output-tool',
    title: t('actions.exportPng'),
    'aria-label': t('actions.exportPng'),
    disabled: !image,
  }, [viewerIcon('download')]);
  download.addEventListener('click', () => void controller.exportOneImage());

  const preview = el('div', { class: 'vs-preview-wrap' }, [
    el('div', { class: 'vs-preview-toolbar', 'aria-label': t('oneImage.toolbar') }, [
      el('div', { class: 'vs-toolbar-spacer' }),
      download,
    ]),
    previewContent,
  ]);
  const scrollContent = el('div', { class: 'vs-one-image-scroll' }, [
    el('div', { class: `vs-status ${controller.state.busy ? 'busy' : ''}` }, [
      getStatusText(controller.config.ui.language, resolveOneImageStatus(controller)),
    ]),
    el('div', { class: `vs-progress ${controller.state.busy ? '' : 'idle'}`, 'aria-label': 'Loading' }, [el('span')]),
    preview,
  ]);
  const generate = el('button', { class: 'primary vs-start-button', disabled: controller.state.busy }, [
    viewerIcon('ai'),
    el('span', {}, [image ? t('actions.regenerate') : t('actions.generateOneImage')]),
  ]);
  generate.addEventListener('click', () => void controller.generateOneImage({ force: Boolean(image) }));
  return el('div', { class: 'vs-one-image-layout' }, [
    scrollContent,
    el('div', { class: 'vs-bottom-actions' }, [generate]),
  ]);
}

export function resolveOneImageStatus(controller: AppController): string {
  const status = controller.state.status;
  if (controller.state.busy || /失败|错误|failed|error/i.test(status) || isOneImageStatus(status)) return status;
  return controller.state.generatedImage ? '一图流已生成' : '等待生成一图流';
}

function isOneImageStatus(status: string): boolean {
  return ['生成一图流', '准备生图提示词', '生成一图流图片', '一图流已生成', 'PNG 已导出', '请先生成摘要'].includes(status);
}

type ViewerIconName = 'download' | 'ai';

function viewerIcon(name: ViewerIconName): SVGSVGElement {
  const paths: Record<ViewerIconName, string[]> = {
    download: ['M12 3.5v11', 'M7.5 10.5 12 15l4.5-4.5', 'M5 20.5h14'],
    ai: ['M12 3.5l1.35 4.15L17.5 9l-4.15 1.35L12 14.5l-1.35-4.15L6.5 9l4.15-1.35z'],
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  paths[name].forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}
