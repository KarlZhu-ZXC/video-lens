import { el } from '../utils/dom';
import { normalizeAssetUrl } from '../utils/url';

export function renderMarkdown(markdown: string): HTMLElement {
  const root = el('div', { class: 'vs-markdown' });
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: HTMLElement | undefined;
  let codeFence: { lang: string; lines: string[] } | undefined;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    root.append(renderInlineBlock('p', paragraph.join(' ')));
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    root.append(list);
    list = undefined;
  };

  const flushCodeFence = () => {
    if (!codeFence) return;
    const codeText = codeFence.lines.join('\n');
    const copyButton = el('button', { class: 'vs-code-copy', title: 'Copy code' }, ['Copy']);
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(codeText).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
      }).catch(() => {});
    });

    const header = el('div', { class: 'vs-code-header' }, [
      el('span', { class: 'vs-code-lang' }, [codeFence.lang || 'code']),
      copyButton
    ]);

    root.append(el('div', { class: 'vs-code-wrapper' }, [
      header,
      el('pre', { class: 'vs-code-block' }, [
        el('code', {}, [codeText]),
      ])
    ]));
    codeFence = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();

    const fence = /^```(\w+)?\s*$/.exec(trimmed);
    if (fence) {
      if (codeFence) flushCodeFence();
      else {
        flushParagraph();
        flushList();
        codeFence = { lang: fence[1] ?? '', lines: [] };
      }
      continue;
    }
    if (codeFence) {
      codeFence.lines.push(raw);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      root.append(el('hr'));
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph();
      flushList();
      const { table, nextIndex } = renderTable(lines, index);
      root.append(table);
      index = nextIndex - 1;
      continue;
    }

    if (/^\$\$/.test(trimmed)) {
      flushParagraph();
      flushList();
      const formula: string[] = [];
      let cursor = index;
      const first = trimmed.replace(/^\$\$\s*/, '');
      if (first && !first.endsWith('$$')) formula.push(first);
      while (cursor + 1 < lines.length) {
        cursor += 1;
        const formulaLine = lines[cursor].trim();
        if (formulaLine.endsWith('$$')) {
          const cleaned = formulaLine.replace(/\s*\$\$$/, '');
          if (cleaned) formula.push(cleaned);
          break;
        }
        formula.push(formulaLine);
      }
      root.append(el('div', { class: 'vs-math-block' }, [formula.join('\n')]));
      index = cursor;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      root.append(renderInlineBlock(`h${heading[1].length}` as keyof HTMLElementTagNameMap, heading[2]));
      continue;
    }

    const quote = /^>\s+(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushList();
      root.append(el('blockquote', {}, [renderInlineBlock('p', quote[1])]));
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (!list || list.tagName !== 'UL') {
        flushList();
        list = el('ul');
      }
      list.append(renderInlineBlock('li', bullet[1]));
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (!list || list.tagName !== 'OL') {
        flushList();
        list = el('ol');
      }
      list.append(renderInlineBlock('li', ordered[1]));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushCodeFence();
  flushParagraph();
  flushList();
  return root;
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index]?.trim();
  const separator = lines[index + 1]?.trim();
  return Boolean(
    header?.startsWith('|') &&
      header.endsWith('|') &&
      separator &&
      /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator),
  );
}

function renderTable(lines: string[], index: number): { table: HTMLElement; nextIndex: number } {
  const headerCells = splitTableRow(lines[index]);
  const table = el('div', { class: 'vs-table-wrap' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, headerCells.map((cell) => renderInlineBlock('th', cell)))]),
      el('tbody'),
    ]),
  ]);
  const tbody = table.querySelector('tbody')!;
  let cursor = index + 2;
  while (cursor < lines.length && lines[cursor].trim().startsWith('|')) {
    tbody.append(el('tr', {}, splitTableRow(lines[cursor]).map((cell) => renderInlineBlock('td', cell))));
    cursor += 1;
  }
  return { table, nextIndex: cursor };
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderInlineBlock<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const node = el(tag);
  renderInline(text).forEach((child) => node.append(child));
  return node;
}

function renderInline(text: string): Node[] {
  const nodes: Node[] = [];
  const pattern = /(!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\$\$?[^$]+\$?\$|https?:\/\/[^\s)]+)/g;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    if (match.index > index) nodes.push(document.createTextNode(text.slice(index, match.index)));
    nodes.push(renderInlineToken(match[0]));
    index = match.index + match[0].length;
  }
  if (index < text.length) nodes.push(document.createTextNode(text.slice(index)));
  return nodes;
}

function renderInlineToken(token: string): Node {
  if (token.startsWith('**') && token.endsWith('**')) return el('strong', {}, [token.slice(2, -2)]);
  if (token.startsWith('`') && token.endsWith('`')) return el('code', {}, [token.slice(1, -1)]);
  if (token.startsWith('$$') && token.endsWith('$$')) return el('span', { class: 'vs-math-inline' }, [token.slice(2, -2)]);
  if (token.startsWith('$') && token.endsWith('$')) return el('span', { class: 'vs-math-inline' }, [token.slice(1, -1)]);
  const image = /^!\[([^\]]*)]\(([^)]+)\)$/.exec(token);
  if (image?.[2] && /^https?:\/\//i.test(image[2])) return el('img', { src: normalizeAssetUrl(image[2]), alt: image[1] });
  const link = /^\[([^\]]+)]\(([^)]+)\)$/.exec(token);
  if (link?.[2] && /^https?:\/\//i.test(link[2])) return el('a', { href: link[2], target: '_blank', rel: 'noreferrer' }, [link[1]]);
  if (/^https?:\/\//i.test(token)) return el('a', { href: token, target: '_blank', rel: 'noreferrer' }, [token]);
  return document.createTextNode(token);
}
