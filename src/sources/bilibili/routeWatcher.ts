export function watchBilibiliRouteChange(callback: () => void): () => void {
  let current = location.href;
  const notify = () => {
    window.setTimeout(() => {
      if (location.href !== current) {
        current = location.href;
        callback();
      }
    }, 50);
  };

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  if (!isVideoSummaryHistoryWrapper(history.pushState)) {
    history.pushState = markVideoSummaryHistoryWrapper(function pushState(this: History, ...args) {
      const result = originalPushState.apply(this, args);
      notify();
      return result;
    });
  }
  if (!isVideoSummaryHistoryWrapper(history.replaceState)) {
    history.replaceState = markVideoSummaryHistoryWrapper(function replaceState(this: History, ...args) {
      const result = originalReplaceState.apply(this, args);
      notify();
      return result;
    });
  }
  window.addEventListener('popstate', notify);

  const timer = window.setInterval(notify, 1000);
  return () => {
    if (history.pushState === originalPushState || isVideoSummaryHistoryWrapper(history.pushState)) {
      history.pushState = originalPushState;
    }
    if (history.replaceState === originalReplaceState || isVideoSummaryHistoryWrapper(history.replaceState)) {
      history.replaceState = originalReplaceState;
    }
    window.removeEventListener('popstate', notify);
    window.clearInterval(timer);
  };
}

type HistoryFunction = typeof history.pushState;

export interface VideoSummaryHistoryWrapper extends HistoryFunction {
  __videoSummaryRouteWatcher?: true;
}

export function isVideoSummaryHistoryWrapper(fn: unknown): fn is VideoSummaryHistoryWrapper {
  return typeof fn === 'function' && (fn as VideoSummaryHistoryWrapper).__videoSummaryRouteWatcher === true;
}

function markVideoSummaryHistoryWrapper<T extends HistoryFunction>(fn: T): T {
  (fn as VideoSummaryHistoryWrapper).__videoSummaryRouteWatcher = true;
  return fn;
}
