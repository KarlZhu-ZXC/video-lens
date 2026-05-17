import { extractThinkBlocks } from '../summary/think';
import { el } from '../utils/dom';
import { createUiText, type UiLanguage } from './i18n';
import { renderMarkdown } from './markdown';

interface AiResponseOptions {
  language: UiLanguage;
  streaming?: boolean;
  thinkingOpen?: boolean;
  onThinkingToggle?: (open: boolean) => void;
}

export type ThinkingPresentation =
  | { mode: 'hidden'; text: '' }
  | { mode: 'active-inline' | 'complete-collapsed'; text: string };

export function renderAiResponse(content: string, reasoning = '', options: AiResponseOptions): HTMLElement {
  const t = createUiText(options.language);
  const extracted = extractThinkBlocks(content);
  const visible = extracted.content.trim();
  const thinking = `${reasoning ?? ''}${extracted.reasoning}`.trim();
  const root = el('div', { class: 'vs-ai-response' });
  const thinkingPresentation = resolveThinkingPresentation(thinking, Boolean(visible), Boolean(options.streaming));

  if (thinkingPresentation.mode === 'active-inline') {
    root.append(el('div', { class: 'vs-thinking-inline', 'aria-live': 'polite' }, [
      el('span', {}, [t('summary.thinking')]),
      el('em', {}, [lastThinkingLine(thinkingPresentation.text)]),
    ]));
  }
  else if (thinkingPresentation.mode === 'complete-collapsed') {
    const details = el('details', {
      class: 'vs-thinking',
      open: options.thinkingOpen ?? false,
    }, [
      el('summary', {}, [t('summary.thinking')]),
      el('pre', {}, [thinkingPresentation.text]),
    ]);
    details.addEventListener('toggle', () => options.onThinkingToggle?.(details.open));
    root.append(details);
  }

  if (visible) root.append(renderMarkdown(visible));
  return root;
}

export function resolveThinkingPresentation(
  thinking: string,
  hasVisibleContent: boolean,
  isStreaming: boolean,
): ThinkingPresentation {
  const text = thinking.trim();
  if (!text) return { mode: 'hidden', text: '' };
  if (isStreaming && hasVisibleContent) return { mode: 'hidden', text: '' };
  if (isStreaming) return { mode: 'active-inline', text };
  return { mode: 'complete-collapsed', text };
}

function lastThinkingLine(thinking: string): string {
  const lines = thinking.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : thinking.trim();
}
