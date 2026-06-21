const RUNTIME_KEY = '__VIDEO_SUMMARY_RUNTIME_ACTIVE__';
const RUNTIME_ATTRIBUTE = 'data-video-summary-runtime-active';
const BOOT_ATTRIBUTE = 'data-video-summary-boot';

export function claimVideoSummaryRuntime(target: Record<string, unknown>): boolean {
  if (target[RUNTIME_KEY]) return false;
  target[RUNTIME_KEY] = true;
  return true;
}

export function claimVideoSummaryDocumentRuntime(doc: {
  documentElement: {
    hasAttribute(name: string): boolean;
    setAttribute(name: string, value: string): void;
  };
}): boolean {
  if (doc.documentElement.hasAttribute(RUNTIME_ATTRIBUTE) || doc.documentElement.hasAttribute(BOOT_ATTRIBUTE)) {
    return false;
  }
  doc.documentElement.setAttribute(RUNTIME_ATTRIBUTE, '1');
  return true;
}
