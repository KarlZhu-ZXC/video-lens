import type { AppController } from '../app/AppController';
import { el } from '../utils/dom';
import { createUiText } from './i18n';
import { renderAiResponse } from './aiResponse';

export function renderVideoInsightsView(controller: AppController): HTMLElement {
  const t = createUiText(controller.config.ui.language);
  const textarea = el('textarea', {
    rows: 3,
    placeholder: t('videoInsights.placeholderReady'),
    disabled: controller.state.busy,
  }) as HTMLTextAreaElement;
  const submit = () => {
    const question = textarea.value.trim();
    if (!question) return;
    void controller.askQuestion(question);
  };
  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submit();
  });
  const messages = el('div', { class: 'vs-chat' });
  const streaming = controller.state.streamingVideoInsight;
  const history = streaming?.content || streaming?.reasoning
    ? [...controller.state.videoInsightsHistory, streaming]
    : controller.state.videoInsightsHistory;
  if (history.length) {
    history.forEach((item) => {
      messages.append(renderMessage(controller, item, t));
    });
  }
  if (controller.state.busy && !streaming?.content && !streaming?.reasoning) {
    messages.append(el('article', { class: 'vs-message assistant typing' }, [
      el('div', { class: 'vs-typing-bubble' }, [el('span'), el('span'), el('span')]),
    ]));
  }
  return el('div', { class: 'vs-stack' }, [
    renderContextStrip(controller, t),
    messages,
    el('div', { class: 'vs-chat-input' }, [
      el('div', { class: 'vs-chat-composer' }, [
        textarea,
        sendButton(t('actions.sendQuestion'), submit, controller.state.busy),
      ]),
    ]),
  ]);
}

function renderMessage(
  controller: AppController,
  item: { role: 'user' | 'assistant'; content: string; reasoning?: string },
  t: ReturnType<typeof createUiText>,
): HTMLElement {
  const body = item.role === 'assistant'
    ? renderAiResponse(item.content, item.reasoning, {
        language: controller.config.ui.language,
        streaming: item === controller.state.streamingVideoInsight,
      })
    : el('p', {}, [item.content]);
  return el('article', { class: `vs-message ${item.role === 'user' ? 'user' : 'assistant'}` }, [
    el('span', {}, [item.role === 'user' ? t('videoInsights.me') : t('videoInsights.assistant')]),
    body,
  ]);
}

function renderContextStrip(controller: AppController, t: ReturnType<typeof createUiText>): HTMLElement {
  const title = controller.state.video?.title ?? t('waitingVideo');
  return el('div', { class: 'vs-insight-context' }, [
    insightIcon('info'),
    el('p', {}, [
      t('videoInsights.contextPrefix'),
      el('span', {}, [title]),
    ]),
  ]);
}

function sendButton(label: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const button = el('button', { class: 'vs-chat-send', title: label, 'aria-label': label, disabled }, [
    insightIcon('send'),
  ]);
  button.addEventListener('click', onClick);
  return button;
}

type InsightIconName = 'info' | 'send';

function insightIcon(name: InsightIconName): SVGSVGElement {
  const paths: Record<InsightIconName, string[]> = {
    info: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
      'M12 10.5v5',
      'M12 7.5h.01',
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
