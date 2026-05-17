export type AppEvent = 'statechange';

export class TinyEmitter {
  private readonly listeners = new Map<AppEvent, Set<() => void>>();

  on(event: AppEvent, listener: () => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }

  emit(event: AppEvent): void {
    this.listeners.get(event)?.forEach((listener) => listener());
  }
}
