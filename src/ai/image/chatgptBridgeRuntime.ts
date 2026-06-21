export interface ChatGptBridgeRuntime {
  now(): number;
  getValue<T>(key: string, fallback: T): T;
  setValue(key: string, value: unknown): void;
  deleteValue(key: string): void;
  addValueChangeListener(key: string, callback: (newValue: unknown) => void): number;
  removeValueChangeListener(id: number): void;
  openTab(url: string): void;
}

const FALLBACK_POLL_INTERVAL_MS = 500;
const fallbackListeners = new Map<number, ReturnType<typeof setInterval>>();
let nextFallbackListenerId = 1_000_000_000;

export const gmChatGptBridgeRuntime: ChatGptBridgeRuntime = {
  now: () => Date.now(),
  getValue<T>(key: string, fallback: T): T {
    if (typeof GM_getValue !== 'function') return fallback;
    return parseBridgeValue(GM_getValue(key, fallback), fallback);
  },
  setValue(key: string, value: unknown): void {
    if (typeof GM_setValue !== 'function') throw new Error('当前脚本缺少 GM_setValue 权限');
    GM_setValue(key, value);
  },
  deleteValue(key: string): void {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
  },
  addValueChangeListener(key: string, callback: (newValue: unknown) => void): number {
    if (typeof GM_addValueChangeListener === 'function') {
      return GM_addValueChangeListener(key, (_name, _oldValue, newValue) => callback(newValue));
    }
    if (typeof GM_getValue !== 'function') {
      throw new Error('当前脚本缺少 GM_addValueChangeListener 和 GM_getValue 权限');
    }
    const id = nextFallbackListenerId++;
    let previous = bridgeValueSnapshot(GM_getValue(key, undefined));
    const timer = globalThis.setInterval(() => {
      const nextValue = GM_getValue(key, undefined);
      const nextSnapshot = bridgeValueSnapshot(nextValue);
      if (nextSnapshot === previous) return;
      previous = nextSnapshot;
      callback(nextValue);
    }, FALLBACK_POLL_INTERVAL_MS);
    fallbackListeners.set(id, timer);
    return id;
  },
  removeValueChangeListener(id: number): void {
    const fallbackTimer = fallbackListeners.get(id);
    if (fallbackTimer) {
      globalThis.clearInterval(fallbackTimer);
      fallbackListeners.delete(id);
      return;
    }
    if (typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(id);
  },
  openTab(url: string): void {
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: false, insert: true, setParent: true });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};

function bridgeValueSnapshot(value: unknown): string {
  try {
    return `${typeof value}:${JSON.stringify(value)}`;
  } catch {
    return `${typeof value}:${String(value)}`;
  }
}

export function parseBridgeValue<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}
