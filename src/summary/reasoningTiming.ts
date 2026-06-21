export interface ReasoningTiming {
  reasoningStartedAt?: number;
  reasoningDurationMs?: number;
}

export function updateReasoningTiming(
  current: ReasoningTiming,
  partial: { content?: string; reasoning?: string },
  now = Date.now(),
): ReasoningTiming {
  let { reasoningStartedAt, reasoningDurationMs } = current;
  if (reasoningStartedAt === undefined && partial.reasoning?.trim()) {
    reasoningStartedAt = now;
  }
  if (reasoningStartedAt !== undefined
    && reasoningDurationMs === undefined
    && partial.content?.trim()) {
    reasoningDurationMs = Math.max(0, now - reasoningStartedAt);
  }
  return { reasoningStartedAt, reasoningDurationMs };
}

export function finalizeReasoningTiming(
  current: ReasoningTiming,
  now = Date.now(),
): ReasoningTiming {
  const { reasoningStartedAt, reasoningDurationMs } = current;
  if (reasoningStartedAt === undefined || reasoningDurationMs !== undefined) {
    return { reasoningStartedAt, reasoningDurationMs };
  }
  return {
    reasoningStartedAt,
    reasoningDurationMs: Math.max(0, now - reasoningStartedAt),
  };
}

export function formatReasoningDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || durationMs < 1_000) return '<1s';
  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
