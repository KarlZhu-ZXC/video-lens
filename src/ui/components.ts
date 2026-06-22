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

export interface SelectControl extends HTMLElement {
  value: string;
}

export function selectInput(value: string, options: Array<[string, string]>): SelectControl {
  let currentValue = options.some(([optionValue]) => optionValue === value)
    ? value
    : options[0]?.[0] ?? '';
  const valueNode = el('span', { class: 'vs-settings-select-value' });
  const chevron = selectChevronIcon();
  const trigger = el('button', {
    type: 'button',
    class: 'vs-settings-select-trigger',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
  }, [valueNode, chevron]);
  const menu = el('div', { class: 'vs-settings-select-menu', role: 'listbox', hidden: true });
  const root = el('div', { class: 'vs-settings-select' }, [trigger, menu]) as unknown as SelectControl;

  const optionButtons = options.map(([optionValue, label]) => {
    const option = el('button', {
      type: 'button',
      class: 'vs-settings-select-option',
      role: 'option',
      'data-value': optionValue,
    }, [label]);
    option.addEventListener('click', () => {
      setValue(optionValue);
      closeMenu();
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      trigger.focus();
    });
    menu.append(option);
    return option;
  });

  Object.defineProperty(root, 'value', {
    configurable: false,
    enumerable: true,
    get: () => currentValue,
    set: (nextValue: string) => setValue(String(nextValue)),
  });

  trigger.addEventListener('click', () => {
    if (menu.hidden) openMenu();
    else closeMenu();
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    openMenu();
    const selected = optionButtons.find((option) => option.dataset.value === currentValue);
    selected?.focus();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMenu();
    trigger.focus();
  });
  root.addEventListener('focusout', (event) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && root.contains(nextTarget)) return;
    closeMenu();
  });

  setValue(currentValue);
  return root;

  function setValue(nextValue: string): void {
    const matched = options.find(([optionValue]) => optionValue === nextValue);
    if (!matched) return;
    currentValue = matched[0];
    root.dataset.value = currentValue;
    valueNode.textContent = matched[1];
    optionButtons.forEach((option) => {
      const selected = option.dataset.value === currentValue;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-selected', String(selected));
    });
  }

  function openMenu(): void {
    menu.hidden = false;
    root.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => menu.scrollIntoView({ block: 'nearest' }));
  }

  function closeMenu(): void {
    menu.hidden = true;
    root.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }
}

function selectChevronIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'vs-settings-select-chevron');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm6 9 6 6 6-6');
  svg.append(path);
  return svg;
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
