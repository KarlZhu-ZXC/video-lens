import { el } from '../utils/dom';

export const IMAGE_PREVIEW_ACTIONS = ['zoomOut', 'zoomIn', 'rotateLeft', 'rotateRight', 'reset', 'download'] as const;

export const IMAGE_PREVIEW_SCALES = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5] as const;

export type ImagePreviewState = {
  scale: number;
  rotation: number;
  x: number;
  y: number;
};

export function nextImagePreviewScale(scale: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    return IMAGE_PREVIEW_SCALES.find((candidate) => candidate > scale)
      ?? IMAGE_PREVIEW_SCALES[IMAGE_PREVIEW_SCALES.length - 1];
  }
  return [...IMAGE_PREVIEW_SCALES].reverse().find((candidate) => candidate < scale) ?? IMAGE_PREVIEW_SCALES[0];
}

export function imagePreviewTransform(state: ImagePreviewState): string {
  return `translate(${state.x}px, ${state.y}px) rotate(${state.rotation}deg) scale(${state.scale})`;
}

type PreviewAction = typeof IMAGE_PREVIEW_ACTIONS[number] | 'close';

const PREVIEW_ACTION_LABELS: Record<PreviewAction, string> = {
  zoomOut: '缩小',
  zoomIn: '放大',
  rotateLeft: '向左旋转',
  rotateRight: '向右旋转',
  reset: '恢复适配尺寸',
  download: '下载图片',
  close: '关闭预览',
};

export function createImagePreview(input: { src: string; alt: string; onDownload: () => void }): HTMLElement {
  let state: ImagePreviewState = { scale: 1, rotation: 0, x: 0, y: 0 };
  let drag: { pointerId: number; x: number; y: number } | undefined;

  const previewImage = el('img', { class: 'vs-image-preview-image', src: input.src, alt: input.alt });
  const scaleValue = el('span', { class: 'vs-image-preview-scale', 'aria-live': 'polite' }, ['100%']);
  const overlay = el('div', {
    class: 'vs-image-preview-overlay',
    hidden: true,
    tabindex: -1,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '图片预览',
  });

  const applyState = () => {
    previewImage.style.transform = imagePreviewTransform(state);
    scaleValue.textContent = `${Math.round(state.scale * 100)}%`;
  };
  const reset = () => {
    state = { scale: 1, rotation: 0, x: 0, y: 0 };
    applyState();
  };
  const close = () => {
    overlay.hidden = true;
    drag = undefined;
    wrapper.append(overlay);
  };
  const open = () => {
    reset();
    const root = trigger.getRootNode();
    if (root instanceof ShadowRoot) root.append(overlay);
    overlay.hidden = false;
    overlay.focus();
  };
  const changeScale = (direction: 'in' | 'out') => {
    state = { ...state, scale: nextImagePreviewScale(state.scale, direction) };
    applyState();
  };

  const toolbarButton = (action: PreviewAction, onClick: () => void): HTMLButtonElement => {
    const label = PREVIEW_ACTION_LABELS[action];
    const button = el('button', { class: 'vs-image-preview-action', type: 'button', title: label, 'aria-label': label }, [
      previewIcon(action),
    ]);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  };

  const stage = el('div', { class: 'vs-image-preview-stage' }, [previewImage]);
  const toolbar = el('div', { class: 'vs-image-preview-toolbar', role: 'toolbar', 'aria-label': '图片预览操作' }, [
    toolbarButton('zoomOut', () => changeScale('out')),
    scaleValue,
    toolbarButton('zoomIn', () => changeScale('in')),
    el('span', { class: 'vs-image-preview-divider', 'aria-hidden': 'true' }),
    toolbarButton('rotateLeft', () => {
      state = { ...state, rotation: state.rotation - 90 };
      applyState();
    }),
    toolbarButton('rotateRight', () => {
      state = { ...state, rotation: state.rotation + 90 };
      applyState();
    }),
    toolbarButton('reset', reset),
    el('span', { class: 'vs-image-preview-divider', 'aria-hidden': 'true' }),
    toolbarButton('download', input.onDownload),
  ]);
  overlay.append(stage, toolbarButton('close', close), toolbar);

  stage.addEventListener('click', (event) => {
    if (event.target === stage) close();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    changeScale(event.deltaY < 0 ? 'in' : 'out');
  }, { passive: false });
  previewImage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    previewImage.setPointerCapture(event.pointerId);
    previewImage.classList.add('dragging');
  });
  previewImage.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    state = {
      ...state,
      x: state.x + event.clientX - drag.x,
      y: state.y + event.clientY - drag.y,
    };
    drag = { ...drag, x: event.clientX, y: event.clientY };
    applyState();
  });
  const stopDragging = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = undefined;
    previewImage.classList.remove('dragging');
    if (previewImage.hasPointerCapture(event.pointerId)) previewImage.releasePointerCapture(event.pointerId);
  };
  previewImage.addEventListener('pointerup', stopDragging);
  previewImage.addEventListener('pointercancel', stopDragging);

  const trigger = el('button', { class: 'vs-chat-image-trigger', type: 'button', 'aria-label': '打开图片预览' }, [
    el('img', { src: input.src, alt: input.alt }),
  ]);
  trigger.addEventListener('click', open);

  const wrapper = el('div', { class: 'vs-chat-image' }, [trigger, overlay]);
  return wrapper;
}

function previewIcon(action: PreviewAction): SVGSVGElement {
  // Lucide icons (ISC), embedded so the userscript has no runtime asset dependency.
  const paths: Record<PreviewAction, string[]> = {
    zoomOut: ['M21 21l-4.35-4.35', 'M8 11h6', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16'],
    zoomIn: ['M21 21l-4.35-4.35', 'M11 8v6', 'M8 11h6', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16'],
    rotateLeft: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
    rotateRight: ['M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5'],
    reset: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2'],
    download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
    close: ['M18 6 6 18', 'm6 6 12 12'],
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  paths[action].forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}
