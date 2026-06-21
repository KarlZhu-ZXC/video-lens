export const logger = {
  info: (...args: unknown[]) => console.info('[video-lens]', ...args),
  warn: (...args: unknown[]) => console.warn('[video-lens]', ...args),
  error: (...args: unknown[]) => console.error('[video-lens]', ...args),
};
