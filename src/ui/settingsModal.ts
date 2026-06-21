import type { AppController } from '../app/AppController';
import { applyTextConfig, normalizeApiKey } from '../ai/text/providers';
import type { LocalConfig } from '../store/types';
import { actionButton, field, selectInput, textInput } from './components';
import { el } from '../utils/dom';
import { createUiText, type UiLanguage } from './i18n';
import { normalizeChatGptProjectUrl } from '../ai/image/chatgptBridgeProtocol';

export const CONNECTION_TEST_LABEL = '连通性测试';
const CONNECTION_TEST_TOOLTIP = '会实际发送一次轻量 API 请求，用于检查连通性，可能产生少量调用费用。';
const CHATGPT_CONNECTION_TEST_TOOLTIP = '只检查 ChatGPT Project 根页接收端是否在线，不会发送生图请求。';
type SaveScope = 'all' | 'text' | 'image';

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
  const imageMode = selectInput(config.imageAi.mode, [
    ['api', t('settings.imageModeApi')],
    ['chatgpt_web', t('settings.imageModeChatGpt')],
  ]);
  const chatgptConversationUrl = textInput(
    config.imageAi.chatgptConversationUrl,
    'https://chatgpt.com/g/g-p-your-project/project',
  );
  const validation = el('div', { class: 'vs-settings-validation', role: 'alert', hidden: true });
  const controls = [languageSelect, summaryLanguageSelect, summaryAutoRunSelect, youtubeCaptionStrategy, youtubeApiKey, youtubeOauthToken, textApiStyle, textBaseUrl, textKey, textModel, imageMode, imageApi, imageKey, imageModel, chatgptConversationUrl];
  controls.forEach((control) => {
    control.addEventListener('input', notifyDirty);
    control.addEventListener('change', notifyDirty);
  });
  options.registerSave?.(saveSettings);

  const imageApiFields = [
    field(t('settings.imageApiUrl'), imageApi),
    field(t('settings.imageApiKey'), imageKey),
    field(t('settings.imageModel'), imageModel),
  ];
  const chatgptFields = [
    field(t('settings.chatgptConversationUrl'), chatgptConversationUrl),
    el('p', { class: 'vs-settings-hint' }, [t('settings.chatgptImageHint')]),
  ];
  const imageGroup = el('section', { class: 'vs-settings-group' }, [
    settingsHeader(
      t('settings.imageGroup'),
      async () => { if (saveSettings('image')) await controller.testImageConnection(); },
      connectivityTestTooltip(config.imageAi.mode),
    ),
    field(t('settings.imageMode'), imageMode),
    ...imageApiFields,
    ...chatgptFields,
  ]);
  applyImageModeVisibility();
  imageMode.addEventListener('change', applyImageModeVisibility);

  return el('div', { class: 'vs-settings-layout' }, [
    el('div', { class: 'vs-settings-scroll' }, [
      group(t('settings.languageGroup'), [
        field(t('settings.language'), languageSelect),
        field(t('settings.summaryLanguage'), summaryLanguageSelect),
        field(t('settings.summaryAutoRun'), summaryAutoRunSelect),
      ]),
      group(t('settings.sourceGroup'), [
        field(t('settings.youtubeCaptionStrategy'), youtubeCaptionStrategy),
        field(t('settings.youtubeApiKey'), youtubeApiKey),
        field(t('settings.youtubeOauthToken'), youtubeOauthToken),
      ]),
      el('section', { class: 'vs-settings-group' }, [
        settingsHeader(t('settings.textGroup'), async () => { if (saveSettings('text')) await controller.testTextConnection(); }),
        field(t('settings.textApiStyle'), textApiStyle),
        field(t('settings.baseUrl'), textBaseUrl),
        field('API Key', textKey),
        field(t('settings.model'), textModel),
      ]),
      imageGroup,
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
      requestMode: 'auto',
      chatgptConversationUrl: chatgptConversationUrl.value.trim(),
    };
    if (scope === 'text') controller.updateConfig({ textAi });
    else if (scope === 'image') controller.updateConfig({ imageAi });
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
      summary: { ...config.summary, language: summaryLanguageSelect.value as LocalConfig['summary']['language'], autoRun: summaryAutoRunSelect.value === 'true' },
      textAi,
      imageAi,
    });
    options.onDirtyChange?.(false);
    return true;
  }

  function validateSettings(scope: SaveScope): string {
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
    youtubeCaptionStrategy.value = youtubeConfig.captionStrategy;
    textApiStyle.value = config.textAi.apiStyle ?? 'openai';
    textBaseUrl.value = config.textAi.apiUrl;
    textModel.value = config.textAi.model;
    imageApi.value = config.imageAi.apiUrl;
    imageModel.value = config.imageAi.model;
    imageMode.value = config.imageAi.mode;
    chatgptConversationUrl.value = config.imageAi.chatgptConversationUrl;
    [youtubeApiKey, youtubeOauthToken, textKey, imageKey].forEach((input) => { input.value = ''; });
    applyImageModeVisibility();
    notifyDirty();
  }

  function notifyDirty(): void {
    options.onDirtyChange?.(
      languageSelect.value !== config.ui.language ||
      summaryLanguageSelect.value !== config.summary.language ||
      summaryAutoRunSelect.value !== (config.summary.autoRun ? 'true' : 'false') ||
      youtubeCaptionStrategy.value !== youtubeConfig.captionStrategy ||
      [youtubeApiKey, youtubeOauthToken, textKey, imageKey].some((input) => input.value.trim() !== '') ||
      textApiStyle.value !== (config.textAi.apiStyle ?? 'openai') || textBaseUrl.value !== config.textAi.apiUrl || textModel.value !== config.textAi.model ||
      imageMode.value !== config.imageAi.mode || imageApi.value !== config.imageAi.apiUrl || imageModel.value !== config.imageAi.model ||
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

export function resolveSecretInput(savedSecret: string): { value: string; placeholder: string } {
  return savedSecret ? { value: '', placeholder: '已保存；留空则继续使用' } : { value: '', placeholder: 'sk-...' };
}

export function resolveSecretValueForSave(savedSecret: string, inputValue: string): string {
  return normalizeApiKey(inputValue) || savedSecret;
}

export function connectivityTestTooltip(mode: LocalConfig['imageAi']['mode'] = 'api'): string {
  return mode === 'chatgpt_web' ? CHATGPT_CONNECTION_TEST_TOOLTIP : CONNECTION_TEST_TOOLTIP;
}
