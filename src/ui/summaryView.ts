import type { AppController } from '../app/AppController';
import { emptyState } from './components';
import { el } from '../utils/dom';
import { createUiText, type UiLanguage } from './i18n';
import { renderAiResponse } from './aiResponse';
import { normalizeAssetUrl } from '../utils/url';
import type { SubtitleOption, Transcript, VideoStats } from '../sources/VideoSourceProvider';
import type { LocalConfig } from '../store/types';

export const SUMMARY_CONTEXT_ORDER = ['video', 'configuration'] as const;
export const FIXED_FOLLOW_UP_INTENTS = [
  { id: 'core-points', label: '提炼核心观点' },
  { id: 'action-items', label: '列出行动建议' },
  { id: 'generate-image', label: '生成配图' },
] as const;

export function shouldShowFollowUpIntents(input: {
  busy: boolean;
  isLatestAssistant: boolean;
  streaming: boolean;
}): boolean {
  return !input.busy && input.isLatestAssistant && !input.streaming;
}

export function summaryComposerState(input: { hasSummary: boolean; busy: boolean }): {
  textareaDisabled: boolean;
  placeholder: string;
  action: 'start_summary' | 'send';
  label: string;
} {
  if (!input.hasSummary) {
    return {
      textareaDisabled: true,
      placeholder: '请先生成总结',
      action: 'start_summary',
      label: '开始总结',
    };
  }
  return {
    textareaDisabled: input.busy,
    placeholder: '问问关于视频的内容... 或输入"画图"',
    action: 'send',
    label: '发送',
  };
}

export function shouldShowSummaryToolbar(input: { hasSummary: boolean; streaming: boolean }): boolean {
  return input.hasSummary && !input.streaming;
}

export function hasRenderableSummaryOutput(summary: {
  content?: string;
  reasoning?: string;
} | undefined): boolean {
  return Boolean(summary?.content?.trim() || summary?.reasoning?.trim());
}

export function renderSummaryView(controller: AppController): HTMLElement {
  const composerState = summaryComposerState({
    hasSummary: Boolean(controller.state.summary),
    busy: controller.state.busy,
  });

  const textarea = el('textarea', {
    rows: 3,
    placeholder: composerState.placeholder,
    disabled: composerState.textareaDisabled,
  }) as HTMLTextAreaElement;

  const submit = () => {
    if (composerState.action === 'start_summary') {
      void controller.generateSummary();
      return;
    }
    const question = textarea.value.trim();
    if (!question) return;
    void controller.askSummaryQuestion(question);
  };

  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submit();
  });

  const messages = el('div', { class: 'vs-agent-chat-container vs-chat' });

  const outputContent = el('div', { class: 'vs-output-content' });
  updateSummaryOutput(controller, outputContent);

  const summaryBubble = el('article', { class: 'vs-message assistant' }, [
    el('div', { class: 'vs-message-content' }, [
      outputContent,
      shouldShowSummaryToolbar({
        hasSummary: Boolean(controller.state.summary),
        streaming: Boolean(controller.state.streamingSummary),
      }) ? renderSummaryToolbar(controller, controller.state.summary?.content) : '',
      shouldShowFollowUpIntents({
        busy: controller.state.busy,
        isLatestAssistant: Boolean(controller.state.summary)
          && !controller.state.summaryChatHistory.some((item) => item.role === 'assistant'),
        streaming: Boolean(controller.state.streamingSummary),
      }) ? renderFollowUpIntents(controller) : '',
    ])
  ]);
  messages.append(summaryBubble);

  const streaming = controller.state.streamingSummaryInsight;
  const history = streaming?.content || streaming?.reasoning || streaming?.generatedImage
    ? [...controller.state.summaryChatHistory, streaming]
    : controller.state.summaryChatHistory;

  if (history.length) {
    const latestAssistantIndex = history.reduce(
      (latest, item, index) => item.role === 'assistant' ? index : latest,
      -1,
    );
    history.forEach((item, index) => {
      const el = renderChatMessage(controller, item, index === latestAssistantIndex);
      if (item === streaming) {
        el.classList.add('vs-streaming-insight');
      }
      messages.append(el);
    });
  }

  if (controller.state.busy && !streaming?.content && !streaming?.reasoning && !streaming?.generatedImage && controller.state.summaryChatHistory.length > 0) {
    messages.append(el('article', { class: 'vs-message assistant typing' }, [
      el('div', { class: 'vs-message-content' }, [
        el('div', { class: 'vs-typing-bubble' }, [el('span'), el('span'), el('span')]),
      ])
    ]));
  }

  const context = el('div', { class: 'vs-summary-context' }, [
    renderVideoCard(controller),
    renderConfigurationRow(controller),
  ]);
  const scrollContent = el('div', { class: 'vs-summary-scroll' }, [messages]);

  return el('div', { class: 'vs-summary-layout' }, [
    context,
    scrollContent,
    el('div', { class: 'vs-chat-input' }, [
      el('div', { class: 'vs-chat-composer' }, [
        textarea,
        sendButton(
          composerState.label,
          submit,
          controller.state.busy || (composerState.action === 'start_summary' && !controller.state.video),
        ),
      ]),
    ]),
  ]);
}

export function renderChatMessage(
  controller: AppController,
  item: any,
  isLatestAssistant: boolean,
): HTMLElement {
  let body: HTMLElement;

  if (item.generatedImage) {
    body = el('div', { class: 'vs-chat-image' }, [
      el('img', { src: normalizeAssetUrl(item.generatedImage.dataUrl || item.generatedImage.url || ''), alt: 'Generated Image' })
    ]);
  } else if (item.role === 'assistant') {
    body = renderAiResponse(item.content, item.reasoning, {
      language: controller.config.ui.language,
      streaming: item === controller.state.streamingSummaryInsight,
      reasoningDurationMs: item.reasoningDurationMs,
    });
  } else {
    body = el('p', {}, [item.content]);
  }

  if (item.role === 'user') {
    return el('article', { class: 'vs-message user' }, [body]);
  }

  return el('article', { class: 'vs-message assistant' }, [
    el('div', { class: 'vs-message-content' }, [
      body,
      renderMessageToolbar(controller, item),
      shouldShowFollowUpIntents({
        busy: controller.state.busy,
        isLatestAssistant,
        streaming: item === controller.state.streamingSummaryInsight,
      }) ? renderFollowUpIntents(controller) : '',
    ])
  ]);
}

function sendButton(label: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const startsSummary = label === '开始总结';
  const button = el('button', {
    class: `vs-chat-send${startsSummary ? ' start-summary' : ''}`,
    title: label,
    'aria-label': label,
    disabled,
  }, startsSummary ? [label] : [uiIcon('send')]);
  button.addEventListener('click', onClick);
  return button;
}

export function updateSummaryOutput(controller: AppController, outputContent: HTMLElement): void {
  const t = createUiText(controller.config.ui.language);
  const summary = controller.state.streamingSummary ?? controller.state.summary;
  const renderable = hasRenderableSummaryOutput(summary);
  const newChild = renderable
    ? renderAiResponse(summary?.content ?? '', summary?.reasoning, {
        language: controller.config.ui.language,
        streaming: Boolean(controller.state.streamingSummary),
        reasoningDurationMs: summary?.reasoningDurationMs,
      })
    : controller.state.summaryRequestPending
      ? pendingState(t('summary.pendingTitle'), t('summary.pendingBody'))
      : emptyState(t('summary.emptyTitle'), t('summary.emptyBody'));
  outputContent.replaceChildren(newChild);
}

function renderFollowUpIntents(controller: AppController): HTMLElement {
  return el('div', { class: 'vs-intent-suggestions', 'aria-label': '意图识别' }, [
    el('div', { class: 'vs-intent-options' }, FIXED_FOLLOW_UP_INTENTS.map((intent) => {
      const button = el('button', { type: 'button', class: 'vs-intent-option' }, [intent.label]);
      button.addEventListener('click', () => void controller.askSummaryQuestion(intent.label));
      return button;
    })),
  ]);
}

function renderVideoCard(controller: AppController): HTMLElement {
  const video = controller.state.video;
  const title = video?.title ?? 'Video';
  const creator = video?.creatorName ?? video?.upName ?? video?.platform ?? 'Video';
  const uploaded = formatPublishedAt(video?.publishedAt);
  const duration = formatDuration(video?.duration);
  const stats = videoStatItems(video?.stats, controller.config.ui.language);

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
        ...stats.map((item) => renderMetaItem(item.icon, item.label, item.title)),
      ]),
    ]),
  ]);
}

export function formatCompactCount(value: number, language: UiLanguage): string {
  if (!Number.isFinite(value) || value < 0) return '';
  if (language === 'zh-CN') {
    if (value >= 100_000_000) return `${formatCountUnit(value / 100_000_000)}亿`;
    if (value >= 10_000) return `${formatCountUnit(value / 10_000)}万`;
    return String(Math.round(value));
  }
  if (value >= 1_000_000_000) return `${formatCountUnit(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${formatCountUnit(value / 1_000_000)}M`;
  if (value >= 1_000) return `${formatCountUnit(value / 1_000)}K`;
  return String(Math.round(value));
}

function formatCountUnit(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function videoStatItems(
  stats: VideoStats | undefined,
  language: UiLanguage,
): Array<{ key: keyof VideoStats; icon: IconName; label: string; title: string }> {
  const names = language === 'zh-CN'
    ? { views: '播放', danmaku: '弹幕', comments: '评论', likes: '点赞', coins: '投币', favorites: '收藏' }
    : { views: 'Views', danmaku: 'Danmaku', comments: 'Comments', likes: 'Likes', coins: 'Coins', favorites: 'Favorites' };
  const descriptors: Array<{ key: keyof VideoStats; icon: IconName }> = [
    { key: 'views', icon: 'play' },
    { key: 'danmaku', icon: 'danmaku' },
    { key: 'comments', icon: 'comment' },
    { key: 'likes', icon: 'like' },
    { key: 'coins', icon: 'coin' },
    { key: 'favorites', icon: 'favorite' },
  ];
  return descriptors.flatMap(({ key, icon }) => {
    const value = stats?.[key];
    if (value === undefined || !Number.isFinite(value) || value < 0) return [];
    const label = formatCompactCount(value, language);
    return [{ key, icon, label, title: `${names[key]} ${label}` }];
  });
}

function renderConfigurationRow(controller: AppController): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const textModel = controller.config.textAi.model || t('modelUnset');
  const imageModel = imageConfigurationLabel(controller.config.imageAi, t('modelUnset'));
  const transcript = controller.state.transcript ?? summaryTranscript(controller);
  return el('section', { class: 'vs-config-row', 'aria-label': t('summary.configuration') }, [
    el('span', { class: 'vs-config-label' }, [t('summary.configuration')]),
    el('div', { class: 'vs-config-chips' }, [
      renderConfigChip('article', textModel),
      renderConfigChip('image', imageModel),
      renderSubtitleConfigChip(controller, transcript),
    ]),
  ]);
}

export function selectedSubtitleLabel(
  options: Array<Pick<SubtitleOption, 'id' | 'label'>>,
  selectedSubtitleId: string | undefined,
  transcript: Pick<Transcript, 'language'> | undefined,
): string {
  const selected = options.find((option) => option.id === selectedSubtitleId);
  return selected?.label || transcript?.language || '未读取';
}

function renderSubtitleConfigChip(
  controller: AppController,
  transcript: Pick<Transcript, 'language'> | undefined,
): HTMLElement {
  const label = selectedSubtitleLabel(
    controller.state.subtitleOptions,
    controller.state.selectedSubtitleId,
    transcript,
  );
  if (controller.state.subtitleOptions.length < 2) return renderConfigChip('captions', `字幕：${label}`);

  const select = el('select', { 'aria-label': '字幕语言' }) as HTMLSelectElement;
  controller.state.subtitleOptions.forEach((option) => {
    const item = el('option', { value: option.id }, [option.label]) as HTMLOptionElement;
    item.selected = option.id === controller.state.selectedSubtitleId;
    select.append(item);
  });
  const wrapper = el('span', { class: 'vs-select-wrapper', 'data-value': label }, [select]);

  select.addEventListener('change', () => {
    wrapper.dataset.value = select.options[select.selectedIndex].text;
    controller.updateSelectedSubtitle(select.value);
  });

  return el('label', { class: 'vs-config-chip vs-subtitle-chip', title: `字幕：${label}` }, [
    uiIcon('captions'),
    el('span', {}, ['字幕：']),
    wrapper,
  ]);
}

export function imageConfigurationLabel(config: LocalConfig['imageAi'], unsetLabel: string): string {
  return config.mode === 'chatgpt_web' ? 'ChatGPT Web' : (config.model || unsetLabel);
}

function renderSummaryToolbar(controller: AppController, contentToCopy?: string): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const copyButton = toolbarButton('copy', t('actions.copySummary'), () => controller.copySummary(contentToCopy), !contentToCopy && !controller.state.summary);
  const exportButton = toolbarButton(
    'download',
    t('actions.exportMarkdown'),
    () => controller.exportSummaryMarkdown(),
    !controller.state.summary,
  );
  const regenerateButton = toolbarButton(
    'sparkles',
    controller.state.summary ? t('actions.regenerate') : t('actions.startSummary'),
    () => void controller.generateSummary(),
    controller.state.busy || !controller.state.video,
  );
  const imageButton = toolbarButton(
    'image',
    '生图',
    () => void controller.askSummaryQuestion('生图'),
    !controller.state.summary,
  );
  const clearCurrent = toolbarButton('trash', '清除此视频缓存', () => controller.clearCurrentSummaryCache(), !controller.state.video && !controller.state.summary);
  const clearAll = toolbarButton('clearAll', '清空全部缓存', () => controller.clearAllCaches(), false);
  return el('div', { class: 'vs-output-toolbar', 'aria-label': t('summary.toolbar') }, [
    copyButton,
    exportButton,
    regenerateButton,
    imageButton,
    clearCurrent,
    clearAll,
  ]);
}

function renderMessageToolbar(controller: AppController, item: any): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const actions = item.generatedImage
    ? [toolbarButton('download', '下载图片', () => controller.downloadGeneratedImage(item.generatedImage), false)]
    : [toolbarButton('copy', t('actions.copySummary'), () => controller.copySummary(item.content), !item.content)];
  return el('div', { class: 'vs-output-toolbar', 'aria-label': t('summary.toolbar') }, actions);
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

function renderMetaItem(icon: IconName, label: string, title = label): HTMLElement {
  return el('span', { class: 'vs-video-meta-item', title }, [
    uiIcon(icon),
    el('span', {}, [label]),
  ]);
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

type IconName = 'article' | 'captions' | 'clearAll' | 'clock' | 'coin' | 'comment' | 'copy' | 'danmaku' | 'download' | 'favorite' | 'image' | 'like' | 'play' | 'sparkles' | 'trash' | 'user' | 'send';

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
    play: [
      'M8 5.5v13l10-6.5z',
    ],
    danmaku: [
      'M3.5 6.5h17v11h-17z',
      'M7 10h3',
      'M13 10h4',
      'M7 14h7',
    ],
    comment: [
      'M4 5.5h16v11H9l-5 3z',
      'M8 10h8',
      'M8 13h5',
    ],
    like: [
      'M8.5 10.5 12 4l2 1v4h4.5a2 2 0 0 1 1.9 2.6l-2.2 6.2a2 2 0 0 1-1.9 1.3H8.5z',
      'M4 10.5h4.5v8.6H4z',
    ],
    coin: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
      'M9 8.5h5a2 2 0 0 1 0 4H9z',
      'M9 12.5h5.5a2 2 0 0 1 0 4H9z',
    ],
    favorite: [
      'm12 3.5 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
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
    send: [
      'M12 19V5',
      'M6.5 10.5 12 5l5.5 5.5',
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
