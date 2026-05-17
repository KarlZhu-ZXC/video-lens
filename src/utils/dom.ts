export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') node.className = String(value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  });
  children.forEach((child) => node.append(child instanceof Node ? child : document.createTextNode(child)));
  return node;
}

export function clearNode(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
