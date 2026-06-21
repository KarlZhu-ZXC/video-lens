export type AppEvent = 'statechange' | 'streamchange';

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

export function bindPanelRendering(
  events: TinyEmitter,
  render: () => void,
  renderStream: () => void = render,
): () => void {
  const unsubscribeState = events.on('statechange', render);
  const unsubscribeStream = events.on('streamchange', renderStream);
  return () => {
    unsubscribeState();
    unsubscribeStream();
  };
}
