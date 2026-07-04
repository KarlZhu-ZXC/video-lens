import type { AppController } from '../app/AppController';
import { applyTextConfig, normalizeApiKey } from '../ai/text/providers';
import type { LocalConfig } from '../store/types';
import { actionButton, field, selectInput, textInput } from './components';
import { el } from '../utils/dom';
import { createUiText, type UiLanguage } from './i18n';
import { normalizeChatGptProjectUrl } from '../ai/image/chatgptBridgeProtocol';
import { getImagePromptPresets, getSummaryPromptPresets } from '../prompts/defaultPrompts.v2';
import type { PromptPreset } from '../prompts/promptTypes';

export const CONNECTION_TEST_LABEL = '模型连通测试';
const CONNECTION_TEST_TOOLTIP = '会实际发送一次轻量 API 请求，用于检查连通性，可能产生少量调用费用。';
const CHATGPT_CONNECTION_TEST_TOOLTIP = '只检查 ChatGPT Project 根页接收端是否在线，不会发送生图请求。';
type SaveScope = 'all' | 'text' | 'image';
const CUSTOM_SUMMARY_PROMPT_ID = 'summary_custom';
const CUSTOM_IMAGE_PROMPT_ID = 'image_custom';

export interface SettingsViewOptions {
  onDirtyChange?: (dirty: boolean) => void;
  registerSave?: (save: () => boolean) => void;
}

export function renderSettingsView(controller: AppController, options: SettingsViewOptions = {}): HTMLElement {
  const config = controller.config;
  const t = createUiText(config.ui.language);
  const languageSelect = selectInput(config.ui.language, [['zh-CN', t('settings.languageZh')], ['en-US', t('settings.languageEn')]]);
  const summaryLanguageSelect = selectInput(config.summary.language, [['zh-CN', t('settings.languageZh')], ['en-US', t('settings.languageEn')]]);
  const summaryAutoRunSelect = selectInput(config.summary.autoRun ? 'true' : 'false', [['true', t('settings.statusOn')], ['false', t('settings.statusOff')]]);
  const customPromptPreset = config.prompts.customPresets.find((preset) => preset.id === CUSTOM_SUMMARY_PROMPT_ID);
  const customPromptTextarea = el('textarea', {
    rows: 7,
    placeholder: t('settings.customPromptPlaceholder'),
  });
  customPromptTextarea.value = customPromptPreset?.template ?? '';
  let customPromptExpanded = customPromptStartsExpanded(
    config.summary.defaultPromptId,
    customPromptTextarea.value,
  );
  let currentPromptId = config.summary.defaultPromptId;
  const presetRadios = getSummaryPromptPresets().map((preset) => createPresetRadio(
    preset.id,
    presetLabel(preset.id),
    preset.icon,
    'vs-summary-preset',
  ));
  presetRadios.push(createPresetRadio(
    CUSTOM_SUMMARY_PROMPT_ID,
    t('settings.summaryPresetCustom'),
    '自',
    'vs-summary-preset',
  ));
  const customPromptToggle = el('button', { type: 'button', class: 'vs-custom-prompt-toggle' });
  const customPromptEditor = el('div', { class: 'vs-custom-prompt-editor' }, [
    customPromptToggle,
    customPromptTextarea,
  ]);
  const presetControl = el('div', { class: 'vs-preset-control' }, [
    el('div', { class: 'vs-preset-radio-group', role: 'radiogroup', 'aria-label': t('settings.summaryPreset') }, presetRadios.map((item) => item.label)),
    customPromptEditor,
  ]);
  const customImagePromptPreset = config.prompts.customPresets.find((preset) => preset.id === CUSTOM_IMAGE_PROMPT_ID);
  const customImagePromptTextarea = el('textarea', {
    rows: 7,
    placeholder: t('settings.customImagePromptPlaceholder'),
  });
  customImagePromptTextarea.value = customImagePromptPreset?.template ?? '';
  let customImagePromptExpanded = customPromptStartsExpanded(
    config.imageAi.promptId,
    customImagePromptTextarea.value,
    CUSTOM_IMAGE_PROMPT_ID,
  );
  let currentImagePromptId = config.imageAi.promptId;
  const imagePresetRadios = getImagePromptPresets().map((preset) => createPresetRadio(
    preset.id,
    imagePresetLabel(preset.id),
    preset.icon,
    'vs-image-preset',
  ));
  imagePresetRadios.push(createPresetRadio(
    CUSTOM_IMAGE_PROMPT_ID,
    t('settings.summaryPresetCustom'),
    '自',
    'vs-image-preset',
  ));
  const customImagePromptToggle = el('button', { type: 'button', class: 'vs-custom-prompt-toggle' });
  const customImagePromptEditor = el('div', { class: 'vs-custom-prompt-editor' }, [
    customImagePromptToggle,
    customImagePromptTextarea,
  ]);
  const imagePresetControl = el('div', { class: 'vs-preset-control' }, [
    el('div', { class: 'vs-preset-radio-group', role: 'radiogroup', 'aria-label': t('settings.imagePromptPreset') }, imagePresetRadios.map((item) => item.label)),
    customImagePromptEditor,
  ]);
  const youtubeConfig = config.source.youtube ?? { captionStrategy: 'auto', apiKey: '', oauthAccessToken: '' };
  const youtubeCaptionStrategy = selectInput(youtubeConfig.captionStrategy, [
    ['auto', t('settings.youtubeStrategyAuto')],
    ['page', t('settings.youtubeStrategyPage')],
    ['official', t('settings.youtubeStrategyOfficial')],
  ]);
  const youtubeApiKey = secretInput(youtubeConfig.apiKey ?? '');
  const youtubeOauthToken = secretInput(youtubeConfig.oauthAccessToken ?? '');
  const textApiStyle = selectInput(config.textAi.apiStyle ?? 'openai', [
    ['openai', t('settings.apiStyleOpenAI')],
    ['anthropic', t('settings.apiStyleAnthropic')],
  ]);
  const textBaseUrl = textInput(config.textAi.apiUrl, 'https://api.example.com/v1');
  const textKey = secretInput(config.textAi.apiKey);
  const textModel = textInput(config.textAi.model, 'model-name');
  const imageApi = textInput(config.imageAi.apiUrl, 'https://api.example.com/v1/images/generations');
  const imageKey = secretInput(config.imageAi.apiKey);
  const imageModel = textInput(config.imageAi.model, 'image-model-name');
  const imageSize = selectInput(config.imageAi.size, imageSizeOptions(t));
  const imageMode = selectInput(config.imageAi.mode, [
    ['api', t('settings.imageModeApi')],
    ['chatgpt_web', t('settings.imageModeChatGpt')],
  ]);
  const chatgptConversationUrl = textInput(
    config.imageAi.chatgptConversationUrl,
    'https://chatgpt.com/g/g-p-your-project/project',
  );
  const validation = el('div', { class: 'vs-settings-validation', role: 'alert', hidden: true });
  const controls = [languageSelect, summaryLanguageSelect, summaryAutoRunSelect, ...presetRadios.map((item) => item.input), customPromptTextarea, ...imagePresetRadios.map((item) => item.input), customImagePromptTextarea, youtubeCaptionStrategy, youtubeApiKey, youtubeOauthToken, textApiStyle, textBaseUrl, textKey, textModel, imageMode, imageApi, imageKey, imageModel, imageSize, chatgptConversationUrl];
  controls.forEach((control) => {
    control.addEventListener('input', notifyDirty);
    control.addEventListener('change', notifyDirty);
  });
  options.registerSave?.(saveSettings);
  presetRadios.forEach(({ input }) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      if (shouldExpandCustomPrompt(currentPromptId, input.value, Boolean(customPromptTextarea.value.trim()))) {
        customPromptExpanded = true;
      }
      currentPromptId = input.value;
      syncCustomPromptVisibility();
    });
  });
  customPromptToggle.addEventListener('click', () => {
    customPromptExpanded = !customPromptExpanded;
    syncCustomPromptVisibility();
  });
  imagePresetRadios.forEach(({ input }) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      if (shouldExpandCustomPrompt(currentImagePromptId, input.value, Boolean(customImagePromptTextarea.value.trim()), CUSTOM_IMAGE_PROMPT_ID)) {
        customImagePromptExpanded = true;
      }
      currentImagePromptId = input.value;
      syncCustomImagePromptVisibility();
    });
  });
  customImagePromptToggle.addEventListener('click', () => {
    customImagePromptExpanded = !customImagePromptExpanded;
    syncCustomImagePromptVisibility();
  });
  syncPresetSelection(config.summary.defaultPromptId);
  syncCustomPromptVisibility();
  syncImagePresetSelection(config.imageAi.promptId);
  syncCustomImagePromptVisibility();

  const imageApiFields = [
    field(t('settings.imageApiUrl'), imageApi),
    field(t('settings.imageApiKey'), imageKey),
    field(t('settings.imageModel'), imageModel),
  ];
  const chatgptFields = [
    fieldWithInlineHint(
      t('settings.chatgptConversationUrl'),
      t('settings.chatgptImageHint'),
      chatgptConversationUrl,
    ),
  ];
  const imageGroup = el('section', { class: 'vs-settings-group' }, [
    settingsHeader(
      t('settings.imageGroup'),
      async () => { if (saveSettings('image')) await controller.testImageConnection(); },
      connectivityTestTooltip(config.imageAi.mode),
    ),
    field(t('settings.imageMode'), imageMode),
    field(t('settings.imagePromptPreset'), imagePresetControl),
    field(t('settings.imageSize'), imageSize),
    ...imageApiFields,
    ...chatgptFields,
  ]);
  applyImageModeVisibility();
  imageMode.addEventListener('change', applyImageModeVisibility);

  return el('div', { class: 'vs-settings-layout' }, [
    el('div', { class: 'vs-settings-scroll' }, [
      group(t('settings.generalGroup'), [
        field(t('settings.summaryAutoRun'), summaryAutoRunSelect),
      ]),
      group(t('settings.languageGroup'), [
        field(t('settings.language'), languageSelect),
        field(t('settings.summaryLanguage'), summaryLanguageSelect),
      ]),
      el('section', { class: 'vs-settings-group' }, [
        settingsHeader(t('settings.textGroup'), async () => { if (saveSettings('text')) await controller.testTextConnection(); }),
        field(t('settings.textApiStyle'), textApiStyle),
        field(t('settings.summaryPreset'), presetControl),
        field(t('settings.baseUrl'), textBaseUrl),
        field('API Key', textKey),
        field(t('settings.model'), textModel),
      ]),
      imageGroup,
      group(t('settings.sourceGroup'), [
        field(t('settings.youtubeCaptionStrategy'), youtubeCaptionStrategy),
        field(t('settings.youtubeApiKey'), youtubeApiKey),
        field(t('settings.youtubeOauthToken'), youtubeOauthToken),
      ]),
    ]),
    el('div', { class: 'vs-settings-actions' }, [
      validation,
      actionButton(t('actions.discardChanges'), resetSettingsForm, false, { disabled: settingsActionsDisabled(controller.state.busy) }),
      actionButton(t('actions.saveSettings'), () => { saveSettings('all'); }, true, { disabled: settingsActionsDisabled(controller.state.busy) }),
    ]),
  ]);

  function saveSettings(scope: SaveScope = 'all'): boolean {
    const error = validateSettings(scope);
    if (error) {
      validation.textContent = error;
      validation.hidden = false;
      return false;
    }
    validation.hidden = true;
    const textAi = applyTextConfig(config.textAi, {
      apiStyle: textApiStyle.value as 'openai' | 'anthropic',
      baseUrl: textBaseUrl.value,
      apiKey: resolveSecretValueForSave(config.textAi.apiKey, textKey.value),
      model: textModel.value,
    });
    const imageAi: LocalConfig['imageAi'] = {
      ...config.imageAi,
      mode: imageMode.value as LocalConfig['imageAi']['mode'],
      apiUrl: imageApi.value.trim(),
      apiKey: resolveSecretValueForSave(config.imageAi.apiKey, imageKey.value),
      model: imageModel.value.trim(),
      size: imageSize.value,
      requestMode: 'auto',
      chatgptConversationUrl: chatgptConversationUrl.value.trim(),
      promptId: selectedImagePromptId(),
    };
    if (scope === 'text') controller.updateConfig({ textAi });
    else if (scope === 'image') controller.updateConfig({
      imageAi,
      prompts: {
        ...config.prompts,
        customPresets: saveCustomImagePrompt(config.prompts.customPresets, customImagePromptTextarea.value),
      },
    });
    else controller.updateConfig({
      ui: { ...config.ui, language: languageSelect.value as UiLanguage },
      source: {
        ...config.source,
        enabledSources: ['bilibili', 'youtube'],
        youtube: {
          captionStrategy: youtubeCaptionStrategy.value as 'auto' | 'page' | 'official',
          apiKey: resolveSecretValueForSave(youtubeConfig.apiKey ?? '', youtubeApiKey.value),
          oauthAccessToken: resolveSecretValueForSave(youtubeConfig.oauthAccessToken ?? '', youtubeOauthToken.value),
        },
      },
      summary: {
        ...config.summary,
        defaultPromptId: selectedPromptId(),
        language: summaryLanguageSelect.value as LocalConfig['summary']['language'],
        autoRun: summaryAutoRunSelect.value === 'true',
      },
      prompts: {
        ...config.prompts,
        customPresets: saveCustomImagePrompt(
          saveCustomPrompt(config.prompts.customPresets, customPromptTextarea.value),
          customImagePromptTextarea.value,
        ),
      },
      textAi,
      imageAi,
    });
    options.onDirtyChange?.(false);
    return true;
  }

  function validateSettings(scope: SaveScope): string {
    if (scope === 'all') {
      const customPromptError = validateCustomPrompt(selectedPromptId(), customPromptTextarea.value);
      if (customPromptError) return customPromptError;
    }
    if (scope === 'all' || scope === 'image') {
      const customImagePromptError = validateCustomPrompt(
        selectedImagePromptId(),
        customImagePromptTextarea.value,
        CUSTOM_IMAGE_PROMPT_ID,
        '请输入自定义生图 Prompt',
      );
      if (customImagePromptError) return customImagePromptError;
    }
    if (scope === 'all' || scope === 'text') {
      if (!textBaseUrl.value.trim()) return '请填写文本模型 Base URL';
      if (!resolveSecretValueForSave(config.textAi.apiKey, textKey.value)) return '请填写文本模型 API Key';
      if (!textModel.value.trim()) return '请填写文本模型名称';
    }
    if (scope === 'all' || scope === 'image') {
      const error = validateImageSettings({
        ...config.imageAi,
        mode: imageMode.value as LocalConfig['imageAi']['mode'],
        apiUrl: imageApi.value.trim(),
        apiKey: resolveSecretValueForSave(config.imageAi.apiKey, imageKey.value),
        model: imageModel.value.trim(),
        chatgptConversationUrl: chatgptConversationUrl.value.trim(),
      });
      if (error) return error;
    }
    return '';
  }

  function resetSettingsForm(): void {
    languageSelect.value = config.ui.language;
    summaryLanguageSelect.value = config.summary.language;
    summaryAutoRunSelect.value = config.summary.autoRun ? 'true' : 'false';
    syncPresetSelection(config.summary.defaultPromptId);
    customPromptTextarea.value = customPromptPreset?.template ?? '';
    customPromptExpanded = customPromptStartsExpanded(config.summary.defaultPromptId, customPromptTextarea.value);
    youtubeCaptionStrategy.value = youtubeConfig.captionStrategy;
    textApiStyle.value = config.textAi.apiStyle ?? 'openai';
    textBaseUrl.value = config.textAi.apiUrl;
    textModel.value = config.textAi.model;
    imageApi.value = config.imageAi.apiUrl;
    imageModel.value = config.imageAi.model;
    imageSize.value = config.imageAi.size;
    imageMode.value = config.imageAi.mode;
    syncImagePresetSelection(config.imageAi.promptId);
    customImagePromptTextarea.value = customImagePromptPreset?.template ?? '';
    customImagePromptExpanded = customPromptStartsExpanded(config.imageAi.promptId, customImagePromptTextarea.value, CUSTOM_IMAGE_PROMPT_ID);
    chatgptConversationUrl.value = config.imageAi.chatgptConversationUrl;
    [youtubeApiKey, youtubeOauthToken, textKey, imageKey].forEach((input) => { input.value = ''; });
    applyImageModeVisibility();
    syncCustomPromptVisibility();
    syncCustomImagePromptVisibility();
    notifyDirty();
  }

  function notifyDirty(): void {
    options.onDirtyChange?.(
      languageSelect.value !== config.ui.language ||
      summaryLanguageSelect.value !== config.summary.language ||
      summaryAutoRunSelect.value !== (config.summary.autoRun ? 'true' : 'false') ||
      selectedPromptId() !== config.summary.defaultPromptId ||
      customPromptTextarea.value !== (customPromptPreset?.template ?? '') ||
      selectedImagePromptId() !== config.imageAi.promptId ||
      customImagePromptTextarea.value !== (customImagePromptPreset?.template ?? '') ||
      youtubeCaptionStrategy.value !== youtubeConfig.captionStrategy ||
      [youtubeApiKey, youtubeOauthToken, textKey, imageKey].some((input) => input.value.trim() !== '') ||
      textApiStyle.value !== (config.textAi.apiStyle ?? 'openai') || textBaseUrl.value !== config.textAi.apiUrl || textModel.value !== config.textAi.model ||
      imageMode.value !== config.imageAi.mode || imageApi.value !== config.imageAi.apiUrl || imageModel.value !== config.imageAi.model || imageSize.value !== config.imageAi.size ||
      chatgptConversationUrl.value !== config.imageAi.chatgptConversationUrl,
    );
  }

  function applyImageModeVisibility(): void {
    applyImageModeFieldVisibility(
      imageMode.value as LocalConfig['imageAi']['mode'],
      imageApiFields,
      chatgptFields,
    );
    imageGroup.querySelector('.vs-connectivity-test')?.setAttribute(
      'title',
      connectivityTestTooltip(imageMode.value as LocalConfig['imageAi']['mode']),
    );
  }

  function createPresetRadio(value: string, label: string, icon: string | undefined, name: string): { input: HTMLInputElement; label: HTMLElement } {
    const input = el('input', { type: 'radio', name, value });
    const labelNode = el('label', { class: 'vs-preset-radio' }, [
      input,
      el('span', { class: 'vs-preset-radio-control' }, [
        icon ? el('i', { 'aria-hidden': 'true' }, [icon]) : '',
        el('strong', {}, [label]),
      ]),
    ]);
    return { input, label: labelNode };
  }

  function presetLabel(id: string): string {
    const labels: Record<string, string> = {
      summary_plain: t('settings.summaryPresetPlain'),
      summary_detailed: t('settings.summaryPresetDetailed'),
      summary_critical: t('settings.summaryPresetCritical'),
      summary_action: t('settings.summaryPresetAction'),
      summary_timeline: t('settings.summaryPresetTimeline'),
    };
    return labels[id] ?? id;
  }

  function imagePresetLabel(id: string): string {
    const labels: Record<string, string> = {
      image_infographic: t('settings.imagePresetInfographic'),
      image_cover: t('settings.imagePresetCover'),
      image_poster: t('settings.imagePresetPoster'),
      image_illustration: t('settings.imagePresetIllustration'),
      image_minimal: t('settings.imagePresetMinimal'),
      image_pixel_rpg: t('settings.imagePresetPixelRpg'),
    };
    return labels[id] ?? id;
  }

  function selectedPromptId(): string {
    return presetRadios.find((item) => item.input.checked)?.input.value ?? config.summary.defaultPromptId;
  }

  function selectedImagePromptId(): string {
    return imagePresetRadios.find((item) => item.input.checked)?.input.value ?? config.imageAi.promptId;
  }

  function syncPresetSelection(id: string): void {
    const fallbackId = getSummaryPromptPresets()[0]?.id ?? 'summary_plain';
    const resolvedId = presetRadios.some((item) => item.input.value === id) ? id : fallbackId;
    presetRadios.forEach((item) => { item.input.checked = item.input.value === resolvedId; });
    currentPromptId = resolvedId;
  }

  function syncImagePresetSelection(id: string): void {
    const fallbackId = getImagePromptPresets()[0]?.id ?? 'image_infographic';
    const resolvedId = imagePresetRadios.some((item) => item.input.value === id) ? id : fallbackId;
    imagePresetRadios.forEach((item) => { item.input.checked = item.input.value === resolvedId; });
    currentImagePromptId = resolvedId;
  }

  function syncCustomPromptVisibility(): void {
    const customSelected = selectedPromptId() === CUSTOM_SUMMARY_PROMPT_ID;
    customPromptEditor.hidden = !customSelected;
    customPromptToggle.textContent = customPromptExpanded
      ? t('settings.customPromptCollapse')
      : t('settings.customPromptEdit');
    customPromptTextarea.hidden = !customPromptExpanded;
  }

  function syncCustomImagePromptVisibility(): void {
    const customSelected = selectedImagePromptId() === CUSTOM_IMAGE_PROMPT_ID;
    customImagePromptEditor.hidden = !customSelected;
    customImagePromptToggle.textContent = customImagePromptExpanded
      ? t('settings.customPromptCollapse')
      : t('settings.customPromptEdit');
    customImagePromptTextarea.hidden = !customImagePromptExpanded;
  }
}

export function customPromptStartsExpanded(
  selectedId: string,
  customText: string,
  customId = CUSTOM_SUMMARY_PROMPT_ID,
): boolean {
  return selectedId === customId && !customText.trim();
}

export function shouldExpandCustomPrompt(
  previousId: string,
  nextId: string,
  hasSavedText: boolean,
  customId = CUSTOM_SUMMARY_PROMPT_ID,
): boolean {
  return previousId !== customId && nextId === customId && !hasSavedText;
}

export function validateCustomPrompt(
  selectedId: string,
  customText: string,
  customId = CUSTOM_SUMMARY_PROMPT_ID,
  message = '请输入自定义 Prompt',
): string {
  return selectedId === customId && !customText.trim() ? message : '';
}

function saveCustomPrompt(customPresets: PromptPreset[], customText: string): PromptPreset[] {
  const withoutCustom = customPresets.filter((preset) => preset.id !== CUSTOM_SUMMARY_PROMPT_ID);
  if (!customText.trim()) return withoutCustom;
  return [
    ...withoutCustom,
    {
      id: CUSTOM_SUMMARY_PROMPT_ID,
      name: '自定义',
      type: 'summary',
      template: customText,
      builtIn: false,
    },
  ];
}

function saveCustomImagePrompt(customPresets: PromptPreset[], customText: string): PromptPreset[] {
  const withoutCustom = customPresets.filter((preset) => preset.id !== CUSTOM_IMAGE_PROMPT_ID);
  if (!customText.trim()) return withoutCustom;
  return [
    ...withoutCustom,
    {
      id: CUSTOM_IMAGE_PROMPT_ID,
      name: '自定义生图',
      type: 'image',
      template: customText,
      builtIn: false,
    },
  ];
}

function fieldWithInlineHint(label: string, hint: string, input: HTMLElement): HTMLElement {
  return el('div', { class: 'vs-field' }, [
    el('label', { class: 'vs-field-label-inline' }, [
      el('span', {}, [label]),
      el('small', { class: 'vs-field-inline-hint' }, [hint]),
    ]),
    input,
  ]);
}

export function applyImageModeFieldVisibility(
  mode: LocalConfig['imageAi']['mode'],
  apiFields: Array<{ hidden: boolean }>,
  chatgptFields: Array<{ hidden: boolean }>,
): void {
  const webMode = mode === 'chatgpt_web';
  apiFields.forEach((item) => { item.hidden = webMode; });
  chatgptFields.forEach((item) => { item.hidden = !webMode; });
}

export function validateImageSettings(config: LocalConfig['imageAi']): string {
  if (config.mode === 'chatgpt_web') {
    try {
      normalizeChatGptProjectUrl(config.chatgptConversationUrl);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : '请填写有效的 ChatGPT Project URL';
    }
  }
  if (!config.apiUrl.trim()) return '请填写生图模型 Base URL';
  if (!config.apiKey.trim()) return '请填写生图模型 API Key';
  if (!config.model.trim()) return '请填写生图模型名称';
  return '';
}

export function settingsActionsDisabled(_busy: boolean): boolean {
  return false;
}

function group(label: string, children: HTMLElement[]): HTMLElement {
  return el('section', { class: 'vs-settings-group' }, [el('h3', {}, [label]), ...children]);
}

function settingsHeader(
  label: string,
  onTest: () => void | Promise<void>,
  tooltip = CONNECTION_TEST_TOOLTIP,
): HTMLElement {
  return el('div', { class: 'vs-settings-group-header' }, [
    el('h3', {}, [label]),
    actionButton(CONNECTION_TEST_LABEL, onTest, false, { className: 'vs-connectivity-test', title: tooltip }),
  ]);
}

function secretInput(savedSecret: string): HTMLInputElement {
  const secret = resolveSecretInput(savedSecret);
  return textInput(secret.value, secret.placeholder, 'password');
}

function imageSizeOptions(t: ReturnType<typeof createUiText>): Array<[string, string]> {
  return [
    ['16:9', t('settings.imageSizeWide')],
    ['4:3', t('settings.imageSizeClassic')],
    ['1:1', t('settings.imageSizeSquare')],
    ['9:16', t('settings.imageSizePortrait')],
    ['9:21', t('settings.imageSizeTall')],
  ];
}

export function resolveSecretInput(savedSecret: string): { value: string; placeholder: string } {
  return savedSecret ? { value: '', placeholder: '已保存；留空则继续使用' } : { value: '', placeholder: 'sk-...' };
}

export function resolveSecretValueForSave(savedSecret: string, inputValue: string): string {
  return normalizeApiKey(inputValue) || savedSecret;
}

export function connectivityTestTooltip(mode: LocalConfig['imageAi']['mode'] = 'api'): string {
  return mode === 'chatgpt_web' ? CHATGPT_CONNECTION_TEST_TOOLTIP : CONNECTION_TEST_TOOLTIP;
}
