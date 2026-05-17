export const logger = {
  info: (...args: unknown[]) => console.info('[video-summary]', ...args),
  warn: (...args: unknown[]) => console.warn('[video-summary]', ...args),
  error: (...args: unknown[]) => console.error('[video-summary]', ...args),
};
