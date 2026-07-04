import { safeJsonParse } from '../utils/json';
import type { CacheEnvelope } from './types';

export function makeJsonCache<T>(storageKey: string, legacyStorageKey?: string) {
  function loadAll(): Record<string, CacheEnvelope<T>> {
    const usesGmStorage = typeof GM_getValue === 'function';
    let raw = usesGmStorage ? GM_getValue(storageKey, '') : localStorage.getItem(storageKey);
    if (!raw && legacyStorageKey) {
      raw = usesGmStorage ? GM_getValue(legacyStorageKey, '') : localStorage.getItem(legacyStorageKey);
      if (raw) {
        if (usesGmStorage && typeof GM_setValue === 'function') GM_setValue(storageKey, String(raw));
        else if (!usesGmStorage) localStorage.setItem(storageKey, String(raw));
      }
    }
    return safeJsonParse<Record<string, CacheEnvelope<T>>>(String(raw || ''), {});
  }

  function saveAll(data: Record<string, CacheEnvelope<T>>): void {
    const raw = JSON.stringify(data);
    if (typeof GM_setValue === 'function') GM_setValue(storageKey, raw);
    else localStorage.setItem(storageKey, raw);
  }

  return {
    get(key: string): T | undefined {
      return loadAll()[key]?.value;
    },
    find(predicate: (value: T, key: string, updatedAt: number) => boolean): T | undefined {
      return Object.entries(loadAll())
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
        .find(([key, envelope]) => predicate(envelope.value, key, envelope.updatedAt))?.[1].value;
    },
    set(key: string, value: T): void {
      const data = loadAll();
      data[key] = { updatedAt: Date.now(), value };
      saveAll(data);
    },
    delete(key: string): void {
      const data = loadAll();
      delete data[key];
      saveAll(data);
    },
    deleteWhere(predicate: (value: T, key: string, updatedAt: number) => boolean): void {
      const data = loadAll();
      let changed = false;
      Object.entries(data).forEach(([key, envelope]) => {
        if (!predicate(envelope.value, key, envelope.updatedAt)) return;
        delete data[key];
        changed = true;
      });
      if (changed) saveAll(data);
    },
    clear(): void {
      saveAll({});
    },
  };
}
