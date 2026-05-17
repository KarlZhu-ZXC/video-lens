import { el } from '../utils/dom';

export function actionButton(
  label: string,
  onClick: () => void | Promise<void>,
  primary = false,
  options: { disabled?: boolean; className?: string; title?: string } = {},
): HTMLButtonElement {
  const classes = [primary ? 'primary' : '', options.className ?? ''].filter(Boolean).join(' ');
  const button = el('button', { class: classes, disabled: options.disabled, title: options.title }, [label]);
  button.addEventListener('click', () => void onClick());
  return button;
}

export function field(label: string, input: HTMLElement): HTMLElement {
  return el('div', { class: 'vs-field' }, [el('label', {}, [label]), input]);
}

export function textInput(value: string, placeholder = '', type = 'text'): HTMLInputElement {
  const input = el('input', { value, placeholder, type });
  input.value = value;
  return input;
}

export function selectInput(value: string, options: Array<[string, string]>): HTMLSelectElement {
  const select = el('select');
  options.forEach(([optionValue, label]) => {
    const option = el('option', { value: optionValue }, [label]);
    option.selected = optionValue === value;
    select.append(option);
  });
  return select;
}

export function sectionTitle(title: string, caption?: string): HTMLElement {
  return el('div', { class: 'vs-section-title' }, [
    el('h2', {}, [title]),
    caption ? el('p', {}, [caption]) : '',
  ]);
}

export function emptyState(title: string, body: string, action?: HTMLElement): HTMLElement {
  return el('div', { class: 'vs-empty' }, [
    el('strong', {}, [title]),
    el('p', {}, [body]),
    action ?? '',
  ]);
}
