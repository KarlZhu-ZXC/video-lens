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
  if (!isVideoLensHistoryWrapper(history.pushState)) {
    history.pushState = markVideoLensHistoryWrapper(function pushState(this: History, ...args) {
      const result = originalPushState.apply(this, args);
      notify();
      return result;
    });
  }
  if (!isVideoLensHistoryWrapper(history.replaceState)) {
    history.replaceState = markVideoLensHistoryWrapper(function replaceState(this: History, ...args) {
      const result = originalReplaceState.apply(this, args);
      notify();
      return result;
    });
  }
  window.addEventListener('popstate', notify);

  const timer = window.setInterval(notify, 1000);
  return () => {
    if (history.pushState === originalPushState || isVideoLensHistoryWrapper(history.pushState)) {
      history.pushState = originalPushState;
    }
    if (history.replaceState === originalReplaceState || isVideoLensHistoryWrapper(history.replaceState)) {
      history.replaceState = originalReplaceState;
    }
    window.removeEventListener('popstate', notify);
    window.clearInterval(timer);
  };
}

type HistoryFunction = typeof history.pushState;

export interface VideoLensHistoryWrapper extends HistoryFunction {
  __videoLensRouteWatcher?: true;
  __videoSummaryRouteWatcher?: true;
}

export function isVideoLensHistoryWrapper(fn: unknown): fn is VideoLensHistoryWrapper {
  return typeof fn === 'function' && (
    (fn as VideoLensHistoryWrapper).__videoLensRouteWatcher === true
    || (fn as VideoLensHistoryWrapper).__videoSummaryRouteWatcher === true
  );
}

function markVideoLensHistoryWrapper<T extends HistoryFunction>(fn: T): T {
  (fn as VideoLensHistoryWrapper).__videoLensRouteWatcher = true;
  return fn;
}
