import type { AppController } from '../app/AppController';
import { emptyState } from './components';
import { el } from '../utils/dom';
import { createUiText, type UiLanguage } from './i18n';
import { renderAiResponse } from './aiResponse';
import { normalizeAssetUrl } from '../utils/url';
import type { SubtitleOption, Transcript, VideoInfo, VideoStats } from '../sources/VideoSourceProvider';
import type { LocalConfig } from '../store/types';
import { createImagePreview } from './imagePreview';

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
    body = createImagePreview({
      src: normalizeAssetUrl(item.generatedImage.dataUrl || item.generatedImage.url || ''),
      alt: 'Generated Image',
      onDownload: () => controller.downloadGeneratedImage(item.generatedImage),
    });
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
  const duration = formatDuration(video?.duration);
  const metadata = videoMetadataItems(video, controller.config.ui.language);

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
        ...metadata.map((item) => renderMetaItem(item.icon, item.label, item.title)),
      ]),
    ]),
  ]);
}

type VideoMetadataKey = 'creator' | 'followers' | 'uploaded' | keyof VideoStats;

export function videoMetadataItems(
  video: VideoInfo | undefined,
  language: UiLanguage,
): Array<{ key: VideoMetadataKey; icon: IconName; label: string; title: string }> {
  if (!video) return [];
  const items: Array<{ key: VideoMetadataKey; icon: IconName; label: string; title: string }> = [];
  const creator = video.creatorName ?? video.upName ?? video.platform;
  if (creator) items.push({ key: 'creator', icon: 'user', label: creator, title: creator });

  if (video.creatorFollowers !== undefined && Number.isFinite(video.creatorFollowers) && video.creatorFollowers >= 0) {
    const label = formatCompactCount(video.creatorFollowers, language);
    const title = language === 'zh-CN' ? `粉丝 ${label}` : `Followers ${label}`;
    items.push({ key: 'followers', icon: 'followers', label, title });
  }

  const uploaded = formatPublishedAt(video.publishedAt);
  if (uploaded) items.push({ key: 'uploaded', icon: 'clock', label: uploaded, title: uploaded });
  return [...items, ...videoStatItems(video.stats, language)];
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

export function shouldRenderSubtitleSelect(optionCount: number): boolean {
  return optionCount > 0;
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
  if (!shouldRenderSubtitleSelect(controller.state.subtitleOptions.length)) {
    return renderConfigChip('captions', `字幕：${label}`);
  }

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

type IconName = 'article' | 'captions' | 'clearAll' | 'clock' | 'coin' | 'comment' | 'copy' | 'danmaku' | 'download' | 'favorite' | 'followers' | 'image' | 'like' | 'play' | 'sparkles' | 'trash' | 'user' | 'send';

const BILIBILI_STAT_ICON_SPECS: Partial<Record<IconName, { viewBox: string; paths: string[] }>> = {
  play: {
    viewBox: '0 0 20 20',
    paths: [
      'M10 4.04c-2.103 0-3.938.107-5.234.212-.959.078-1.705.812-1.79 1.764A44.42 44.42 0 0 0 2.792 10c0 1.527.089 2.924.184 3.982.085.952.831 1.686 1.79 1.764 1.296.105 3.131.212 5.234.212 2.103 0 3.939-.107 5.235-.212.958-.078 1.704-.812 1.79-1.764.095-1.058.183-2.455.183-3.983 0-1.528-.088-2.924-.183-3.983-.086-.952-.832-1.686-1.79-1.764A65.74 65.74 0 0 0 10 4.04zm0-1c2.136 0 4 .109 5.316.215 1.437.117 2.575 1.228 2.705 2.671.097 1.08.187 2.507.187 4.073 0 1.565-.09 2.992-.187 4.072-.13 1.443-1.268 2.554-2.705 2.67A67.42 67.42 0 0 1 10 16.957c-2.135 0-3.999-.109-5.315-.215-1.438-.117-2.576-1.228-2.705-2.671A45.33 45.33 0 0 1 1.792 10c0-1.566.09-2.993.188-4.073.129-1.443 1.267-2.554 2.705-2.67A67.4 67.4 0 0 1 10 3.04z',
      'M12.233 9.196a.928.928 0 0 1 0 1.608L9.58 12.336a.929.929 0 0 1-1.392-.804V8.468a.929.929 0 0 1 1.392-.803l2.653 1.531z',
    ],
  },
  danmaku: {
    viewBox: '0 0 20 20',
    paths: [
      'M10 4.04c-2.103 0-3.938.107-5.234.212-.959.078-1.705.812-1.79 1.764A44.42 44.42 0 0 0 2.792 10c0 1.527.089 2.924.184 3.982.085.952.831 1.686 1.79 1.764 1.296.105 3.131.212 5.234.212 2.103 0 3.939-.107 5.235-.212.958-.078 1.704-.812 1.79-1.764.095-1.058.183-2.455.183-3.983 0-1.528-.088-2.924-.183-3.983-.086-.952-.832-1.686-1.79-1.764A65.74 65.74 0 0 0 10 4.04zm0-1c2.136 0 4 .109 5.316.215 1.437.117 2.575 1.228 2.705 2.671.097 1.08.187 2.507.187 4.073 0 1.565-.09 2.992-.187 4.072-.13 1.443-1.268 2.554-2.705 2.67A67.42 67.42 0 0 1 10 16.957c-2.135 0-3.999-.109-5.315-.215-1.438-.117-2.576-1.228-2.705-2.671A45.33 45.33 0 0 1 1.792 10c0-1.566.09-2.993.188-4.073.129-1.443 1.267-2.554 2.705-2.67A67.4 67.4 0 0 1 10 3.04z',
      'M13.292 7.833a.5.5 0 0 1 0 1H8.167a.5.5 0 0 1 0-1h5.125z',
      'M14.542 11.167a.5.5 0 0 1 0 1H9.417a.5.5 0 0 1 0-1h5.125z',
      'M6 7.833a.5.5 0 0 1 0 1h-.542a.5.5 0 0 1 0-1H6z',
      'M7.25 11.167a.5.5 0 0 1 0 1h-.542a.5.5 0 0 1 0-1h.542z',
    ],
  },
  comment: {
    viewBox: '0 0 24 24',
    paths: ['M5.75 3.5h12.5A3.75 3.75 0 0 1 22 7.25v7.5a3.75 3.75 0 0 1-3.75 3.75H11l-5.65 3.23A.9.9 0 0 1 4 20.95V18.1a3.75 3.75 0 0 1-2-3.35v-7.5A3.75 3.75 0 0 1 5.75 3.5zm1.5 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4.75 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4.75 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
  },
  like: {
    viewBox: '0 0 36 36',
    paths: ['M9.772 30.857v-19.11H7.546a3.687 3.687 0 0 0-3.689 3.678V27.18a3.687 3.687 0 0 0 3.689 3.678h2.226zm2.218 0V11.705c3-1.078 4.704-3.82 5.116-8.369.16-1.781 1.857-2.522 3.474-1.741 1.605.775 2.663 2.73 2.663 5.344 0 1.564-.195 3.166-.585 4.808h7.074a3.696 3.696 0 0 1 3.59 4.581l-2.334 9.468a6.66 6.66 0 0 1-6.46 5.061H11.99z'],
  },
  favorite: {
    viewBox: '0 0 28 28',
    paths: ['M19.807 9.262c-1.063-.163-2.045-.894-2.454-1.868l-1.88-3.897c-.573-1.299-2.373-1.299-3.027 0l-1.8 3.897c-.49.974-1.39 1.705-2.453 1.868l-4.253.649c-1.308.162-1.881 1.786-.9 2.76l3.19 3.248a3.23 3.23 0 0 1 .9 2.842l-.736 4.546c-.246 1.38 1.227 2.354 2.453 1.705l3.599-1.949a3.28 3.28 0 0 1 3.19 0l3.599 1.949c1.226.649 2.617-.325 2.453-1.705l-.818-4.546a3.23 3.23 0 0 1 .9-2.842l3.19-3.248c.981-.974.409-2.598-.9-2.76l-4.253-.65z'],
  },
};

const UI_ICON_PATHS: Record<IconName, string[]> = {
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
      // Tabler Coin Bitcoin (MIT) stays legible at the 15px metadata size.
      'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
      'M9 8h4.09c1.055 0 1.91.895 1.91 2s-.855 2-1.91 2c1.055 0 1.91.895 1.91 2s-.855 2-1.91 2H9',
      'M10 12h4',
      'M10 7v10',
      'M13 7v1',
      'M13 16v1',
    ],
    favorite: [
      'm12 3.5 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    ],
    followers: [
      // Lucide Users (ISC) communicates an audience count rather than a follow action.
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M16 3.128a4 4 0 0 1 0 7.744',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
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

export function videoMetadataIconSpec(name: IconName): { viewBox: string; filled: boolean; paths: string[] } {
  const filledSpec = BILIBILI_STAT_ICON_SPECS[name];
  return {
    viewBox: filledSpec?.viewBox ?? '0 0 24 24',
    filled: Boolean(filledSpec),
    paths: filledSpec?.paths ?? UI_ICON_PATHS[name],
  };
}

function uiIcon(name: IconName): SVGSVGElement {
  const spec = videoMetadataIconSpec(name);
  const filledSpec = BILIBILI_STAT_ICON_SPECS[name];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', spec.viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (filledSpec) svg.setAttribute('data-filled', 'true');
  spec.paths.forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}
