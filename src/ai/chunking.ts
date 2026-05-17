export interface ChunkOptions {
  targetChars: number;
  overlapChars: number;
  maxChunks: number;
}

export function chunkText(text: string, options: ChunkOptions): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= options.targetChars) return [normalized];

  const target = Math.max(1, options.targetChars);
  const overlap = Math.max(0, Math.min(options.overlapChars, target - 1));
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length && chunks.length < options.maxChunks) {
    const end = Math.min(start + target, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = end - overlap;
  }

  return chunks;
}
