import { extractThinkBlocks } from '../summary/think';
import { formatReasoningDuration } from '../summary/reasoningTiming';
import { el } from '../utils/dom';
import type { UiLanguage } from './i18n';
import { renderMarkdown } from './markdown';

interface AiResponseOptions {
  language: UiLanguage;
  streaming?: boolean;
  reasoningDurationMs?: number;
}

export function reasoningDisclosureState(input: {
  reasoning: string;
  streaming?: boolean;
  durationMs?: number;
}): { visible: false } | { visible: true; open: boolean; label: string } {
  if (!input.reasoning.trim()) return { visible: false };
  if (input.streaming) return { visible: true, open: true, label: 'Thinking' };
  return {
    visible: true,
    open: false,
    label: `Thought for ${formatReasoningDuration(input.durationMs)}`,
  };
}

export function renderAiResponse(content: string, reasoning = '', options: AiResponseOptions): HTMLElement {
  const extracted = extractThinkBlocks(content);
  const visible = extracted.content.trim();
  const reasoningText = `${reasoning}\n${extracted.reasoning}`.trim();
  const root = el('div', { class: 'vs-ai-response' });
  const disclosure = reasoningDisclosureState({
    reasoning: reasoningText,
    streaming: options.streaming,
    durationMs: options.reasoningDurationMs,
  });

  if (disclosure.visible) {
    root.append(el('details', { class: 'vs-thinking', open: disclosure.open }, [
      el('summary', {}, [disclosure.label]),
      el('div', { class: 'vs-thinking-content' }, [renderMarkdown(reasoningText)]),
    ]));
  }
  if (visible) root.append(renderMarkdown(visible));
  return root;
}
