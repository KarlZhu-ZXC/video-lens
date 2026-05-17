import type { AppController } from '../app/AppController';
import {
  applyTextProviderConfig,
  getTextProvider,
  normalizeApiKey,
  TEXT_PROVIDERS,
  type TextProviderId,
} from '../ai/text/providers';
import { field, selectInput, textInput, actionButton } from './components';
import { el } from '../utils/dom';
import { createUiText, type UiLanguage } from './i18n';

export const CONNECTION_TEST_LABEL = '连通性测试';
const CONNECTION_TEST_TOOLTIP = '会实际发送一次轻量 API 请求，用于检查连通性，可能产生极少量 token 或图片调用消耗。';

export function renderSettingsView(controller: AppController): HTMLElement {
  const config = controller.config;
  const t = createUiText(config.ui.language);
  const textProvider = getTextProvider(config.textAi.provider);
  const providerSelect = selectInput(textProvider.id, TEXT_PROVIDERS.map((provider) => [provider.id, provider.label]));
  const languageSelect = selectInput(config.ui.language, [
    ['zh-CN', t('settings.languageZh')],
    ['en-US', t('settings.languageEn')],
  ]);
  const summaryLanguageSelect = selectInput(config.summary.language, [
    ['zh-CN', t('settings.languageZh')],
    ['en-US', t('settings.languageEn')],
  ]);
  const textSecretInput = resolveSecretInput(config.textAi.apiKey);
  const textKey = textInput(textSecretInput.value, textSecretInput.placeholder, 'password');
  const textModel = textInput(config.textAi.model, 'model-name');
  const textBaseUrl = textInput(config.textAi.apiUrl || textProvider.defaultBaseUrl, 'https://api.example.com/v1');
  const textBaseUrlField = field(t('settings.baseUrl'), textBaseUrl);
  providerSelect.addEventListener('change', () => {
    const provider = getTextProvider(providerSelect.value);
    textModel.value = provider.id === 'custom' ? '' : provider.models[0]?.id ?? '';
    textBaseUrl.value = provider.defaultBaseUrl;
  });
  const imageSecretInput = resolveSecretInput(config.imageAi.apiKey);
  const imageKey = textInput(imageSecretInput.value, imageSecretInput.placeholder, 'password');
  const imageApi = textInput(config.imageAi.apiUrl);
  const imageModel = textInput(config.imageAi.model);
  const mode = selectInput(config.oneImage.mode, [
    ['text_card_only', t('settings.textCardOnly')],
    ['ai_image_background', t('oneImage.modeAiBackground')],
    ['ai_image_only', t('oneImage.modeAiOnly')],
  ]);
  const validation = el('div', { class: 'vs-settings-validation', role: 'alert', hidden: true });
  syncImageFields();
  mode.addEventListener('change', syncImageFields);

  return el('div', { class: 'vs-settings-layout' }, [
    el('div', { class: 'vs-settings-scroll' }, [
      el('section', { class: 'vs-settings-group' }, [
        el('h3', {}, [t('settings.languageGroup')]),
        field(t('settings.language'), languageSelect),
        field(t('settings.summaryLanguage'), summaryLanguageSelect),
      ]),
      el('section', { class: 'vs-settings-group' }, [
        settingsHeader(t('settings.textGroup'), () => controller.testTextConnection()),
        field(t('settings.provider'), providerSelect),
        field(t('settings.model'), textModel),
        textBaseUrlField,
        field('API Key', textKey),
      ]),
      el('section', { class: 'vs-settings-group' }, [
        settingsHeader(t('settings.imageGroup'), () => controller.testImageConnection()),
        field(t('settings.mode'), mode),
        field(t('settings.imageModel'), imageModel),
        field(t('settings.imageApiUrl'), imageApi),
        field(t('settings.imageApiKey'), imageKey),
      ]),
    ]),
    el('div', { class: 'vs-settings-actions' }, [
      validation,
      actionButton(t('actions.discardChanges'), () => resetSettingsForm(), false, {
        disabled: controller.state.busy,
      }),
      actionButton(
        t('actions.saveSettings'),
        () => {
          const error = validateSettings();
          if (error) {
            validation.textContent = error;
            validation.hidden = false;
            return;
          }
          validation.hidden = true;
          controller.updateConfig({
            ui: { ...config.ui, language: languageSelect.value as UiLanguage },
            summary: { ...config.summary, language: summaryLanguageSelect.value as typeof config.summary.language },
            textAi: applyTextProviderConfig(config.textAi, {
              providerId: providerSelect.value as TextProviderId,
              baseUrl: textBaseUrl.value,
              apiKey: resolveSecretValueForSave(config.textAi.apiKey, textKey.value),
              model: textModel.value,
              requestMode: 'auto',
            }),
            imageAi: {
              ...config.imageAi,
              enabled: true,
              apiUrl: imageApi.value,
              apiKey: resolveSecretValueForSave(config.imageAi.apiKey, imageKey.value),
              model: imageModel.value,
              requestMode: 'auto',
            },
            onePage: { ...config.onePage, mode: mode.value as typeof config.onePage.mode },
            oneImage: { ...config.oneImage, mode: mode.value as typeof config.oneImage.mode },
          });
        },
        true,
        { disabled: controller.state.busy },
      ),
    ]),
  ]);

  function resetSettingsForm(): void {
    languageSelect.value = config.ui.language;
    summaryLanguageSelect.value = config.summary.language;
    providerSelect.value = textProvider.id;
    textModel.value = config.textAi.model;
    textBaseUrl.value = config.textAi.apiUrl || textProvider.defaultBaseUrl;
    textKey.value = '';
    textKey.placeholder = resolveSecretInput(config.textAi.apiKey).placeholder;
    imageKey.value = '';
    imageKey.placeholder = resolveSecretInput(config.imageAi.apiKey).placeholder;
    imageApi.value = config.imageAi.apiUrl;
    imageModel.value = config.imageAi.model;
    mode.value = config.oneImage.mode;
    syncImageFields();
  }

  function validateSettings(): string {
    if (!resolveSecretValueForSave(config.textAi.apiKey, textKey.value)) return '请填写文本模型 API Key';
    if (!textModel.value.trim()) return '请填写文本模型名称';
    if (providerSelect.value === 'custom' && !textBaseUrl.value.trim()) return '请填写自定义文本模型 Base URL';
    if (mode.value !== 'text_card_only') {
      if (!resolveSecretValueForSave(config.imageAi.apiKey, imageKey.value)) return '请填写生图模型 API Key';
      if (!imageModel.value.trim()) return '请填写生图模型名称';
      if (!imageApi.value.trim()) return '请填写生图模型 API URL';
    }
    return '';
  }

  function syncImageFields(): void {
    const disabled = mode.value === 'text_card_only';
    [imageKey, imageApi, imageModel].forEach((control) => {
      control.disabled = disabled;
    });
  }
}

function settingsHeader(label: string, onTest: () => void | Promise<void>): HTMLElement {
  return el('div', { class: 'vs-settings-group-header' }, [
    el('h3', {}, [label]),
    actionButton(CONNECTION_TEST_LABEL, onTest, false, {
      className: 'vs-connectivity-test',
      title: CONNECTION_TEST_TOOLTIP,
    }),
  ]);
}

export function resolveSecretInput(savedSecret: string): { value: string; placeholder: string } {
  return savedSecret ? { value: '', placeholder: '已保存；留空则继续使用' } : { value: '', placeholder: 'sk-...' };
}

export function resolveSecretValueForSave(savedSecret: string, inputValue: string): string {
  const normalized = normalizeApiKey(inputValue);
  return normalized || savedSecret;
}

export function connectivityTestTooltip(): string {
  return CONNECTION_TEST_TOOLTIP;
}
