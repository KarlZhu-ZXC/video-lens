import type { AppController } from '../app/AppController';
import { emptyState } from './components';
import { el } from '../utils/dom';
import { createUiText, getStatusText } from './i18n';
import { renderAiResponse } from './aiResponse';
import { normalizeAssetUrl } from '../utils/url';
import type { Transcript } from '../sources/VideoSourceProvider';

interface SummaryViewOptions {
  thinkingOpen?: boolean;
  onThinkingToggle?: (open: boolean) => void;
}

export function renderSummaryView(controller: AppController, options: SummaryViewOptions = {}): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const summary = controller.state.streamingSummary ?? controller.state.summary;
  const outputContent = el('div', { class: 'vs-output-content' });
  const output = el('div', { class: 'vs-output' });
  outputContent.append(
    summary?.content
      ? renderAiResponse(summary.content, summary.reasoning, {
          language: controller.config.ui.language,
          streaming: Boolean(controller.state.streamingSummary),
          thinkingOpen: resolveThinkingOpen(controller.state.busy, options.thinkingOpen),
          onThinkingToggle: options.onThinkingToggle,
        })
      : controller.state.summaryRequestPending
        ? pendingState(t('summary.pendingTitle'), t('summary.pendingBody'))
      : emptyState(t('summary.emptyTitle'), t('summary.emptyBody')),
  );
  output.append(renderSummaryToolbar(controller), outputContent);
  const status = el('div', { class: `vs-status ${controller.state.busy ? 'busy' : ''}` }, [
    getStatusText(controller.config.ui.language, controller.state.status),
  ]);
  const scrollContent = el('div', { class: 'vs-summary-scroll' }, [
    renderVideoCard(controller),
    renderConfigurationRow(controller),
    renderSubtitleSelector(controller),
    status,
    el('div', { class: `vs-progress ${controller.state.busy ? '' : 'idle'}`, 'aria-label': 'Loading' }, [el('span')]),
    output,
  ]);
  return el('div', { class: 'vs-summary-layout' }, [
    scrollContent,
    el('div', { class: 'vs-bottom-actions' }, [
      startSummaryButton(
        controller.state.summary ? t('actions.regenerate') : t('actions.startSummary'),
        () => controller.generateSummary(),
        controller.state.busy,
      ),
    ]),
  ]);
}

function renderSubtitleSelector(controller: AppController): HTMLElement | string {
  if (controller.state.subtitleOptions.length < 2) return '';
  const select = el('select') as HTMLSelectElement;
  controller.state.subtitleOptions.forEach((option) => {
    const item = el('option', { value: option.id }, [option.label]) as HTMLOptionElement;
    item.selected = option.id === controller.state.selectedSubtitleId;
    select.append(item);
  });
  select.addEventListener('change', () => controller.updateSelectedSubtitle(select.value));
  return el('div', { class: 'vs-subtitle-picker' }, [
    el('span', {}, ['字幕源']),
    select,
  ]);
}

export function resolveThinkingOpen(isBusy: boolean, userPreferredOpen: boolean | undefined): boolean {
  return userPreferredOpen ?? isBusy;
}

function renderVideoCard(controller: AppController): HTMLElement {
  const video = controller.state.video;
  const title = video?.title ?? 'Bilibili';
  const creator = video?.upName ?? 'Bilibili';
  const uploaded = formatPublishedAt(video?.publishedAt);
  const duration = formatDuration(video?.duration);

  return el('article', { class: 'vs-video-card' }, [
    video?.coverUrl
      ? el('div', { class: 'vs-video-thumb' }, [
          el('img', { src: normalizeCoverUrl(video.coverUrl), alt: title }),
          duration ? el('span', { class: 'vs-video-duration' }, [duration]) : '',
        ])
      : el('div', { class: 'vs-video-thumb placeholder' }, [
          el('span', {}, ['AI']),
          duration ? el('span', { class: 'vs-video-duration' }, [duration]) : '',
        ]),
    el('div', { class: 'vs-video-info' }, [
      el('h3', {}, [title]),
      el('div', { class: 'vs-video-meta' }, [
        renderMetaItem('user', creator),
        uploaded ? renderMetaItem('clock', uploaded) : '',
      ]),
    ]),
  ]);
}

function renderConfigurationRow(controller: AppController): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const textModel = controller.config.textAi.model || t('modelUnset');
  const imageModel = controller.config.imageAi.enabled
    ? controller.config.imageAi.model || t('modelUnset')
    : t('summary.imageDisabled');
  const transcriptLabel = formatTranscriptLanguage(controller.state.transcript ?? summaryTranscript(controller));
  return el('section', { class: 'vs-config-row', 'aria-label': t('summary.configuration') }, [
    el('span', { class: 'vs-config-label' }, [t('summary.configuration')]),
    el('div', { class: 'vs-config-chips' }, [
      renderConfigChip('article', textModel),
      renderConfigChip('image', imageModel),
      renderConfigChip('captions', transcriptLabel),
    ]),
  ]);
}

function renderSummaryToolbar(controller: AppController): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const copyButton = toolbarButton('copy', t('actions.copySummary'), () => controller.copySummary(), !controller.state.summary);
  const exportButton = toolbarButton(
    'download',
    t('actions.exportMarkdown'),
    () => controller.exportSummaryMarkdown(),
    !controller.state.summary,
  );
  const clearCurrent = toolbarButton('trash', '清除此视频缓存', () => controller.clearCurrentSummaryCache(), !controller.state.video && !controller.state.summary);
  const clearAll = toolbarButton('clearAll', '清空全部缓存', () => controller.clearAllCaches(), false);
  return el('div', { class: 'vs-output-toolbar', 'aria-label': t('summary.toolbar') }, [copyButton, exportButton, clearCurrent, clearAll]);
}

function renderConfigChip(icon: IconName, label: string): HTMLElement {
  return el('span', { class: 'vs-config-chip', title: label }, [
    uiIcon(icon),
    el('span', {}, [label]),
  ]);
}

function toolbarButton(
  icon: IconName,
  label: string,
  onClick: () => void,
  disabled: boolean,
): HTMLButtonElement {
  const button = el('button', { class: 'vs-output-tool', title: label, 'aria-label': label, 'data-tooltip': label, disabled }, [
    uiIcon(icon),
  ]);
  button.addEventListener('click', onClick);
  return button;
}

function renderMetaItem(icon: IconName, label: string): HTMLElement {
  return el('span', { class: 'vs-video-meta-item', title: label }, [
    uiIcon(icon),
    el('span', {}, [label]),
  ]);
}

function startSummaryButton(label: string, onClick: () => void | Promise<void>, disabled: boolean): HTMLButtonElement {
  const button = el('button', { class: 'primary vs-start-button', disabled }, [
    uiIcon('sparkles'),
    el('span', {}, [label]),
  ]);
  button.addEventListener('click', () => void onClick());
  return button;
}

function normalizeCoverUrl(url: string): string {
  return normalizeAssetUrl(url);
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds < 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}:${pad2(minutes)}:${pad2(secs)}`;
  return `${minutes}:${pad2(secs)}`;
}

function formatPublishedAt(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function pendingState(title: string, body: string): HTMLElement {
  return el('div', { class: 'vs-pending' }, [
    el('div', { class: 'vs-pending-dots' }, [el('span'), el('span'), el('span')]),
    el('strong', {}, [title]),
    el('p', {}, [body]),
  ]);
}

export function formatTranscriptLanguage(transcript: Pick<Transcript, 'language'> | undefined): string {
  return `字幕：${transcript?.language || '未读取'}`;
}

function summaryTranscript(controller: AppController): Transcript | undefined {
  return controller.state.summary?.transcript ?? controller.state.streamingSummary?.transcript;
}

type IconName = 'article' | 'captions' | 'clearAll' | 'clock' | 'copy' | 'download' | 'image' | 'sparkles' | 'trash' | 'user';

function uiIcon(name: IconName): SVGSVGElement {
  const paths: Record<IconName, string[]> = {
    article: [
      'M7 3.5h7.2L19 8.3V20.5H7z',
      'M14 3.5V9h5',
      'M10 12.5h6',
      'M10 15.5h5',
      'M10 18.5h3.5',
    ],
    clock: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
      'M12 7.5V12l3 2',
    ],
    copy: [
      'M9 9h10v11H9z',
      'M5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1',
    ],
    download: [
      'M12 3.5v11',
      'M7.5 10.5 12 15l4.5-4.5',
      'M5 20.5h14',
    ],
    image: [
      'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
      'M7 15l3-3 2.5 2.5L15.5 11 19 15',
      'M8.5 9.5h.1',
    ],
    captions: [
      'M4 6.5h16v11H4z',
      'M7 11h4',
      'M13 11h4',
      'M7 14h7',
    ],
    clearAll: [
      'M4 6h16',
      'M8 6V4h8v2',
      'M7 9l1 11h8l1-11',
      'M10 12h4',
    ],
    sparkles: [
      'M12 3.5l1.35 4.15L17.5 9l-4.15 1.35L12 14.5l-1.35-4.15L6.5 9l4.15-1.35z',
      'M18.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
      'M5.5 14l.65 1.85L8 16.5l-1.85.65L5.5 19l-.65-1.85L3 16.5l1.85-.65z',
    ],
    trash: [
      'M4 6h16',
      'M9 6V4h6v2',
      'M7 9l1 11h8l1-11',
    ],
    user: [
      'M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M4.5 20.5a7.5 7.5 0 0 1 15 0',
    ],
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
