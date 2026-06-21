import { chunkText } from '../ai/chunking';
import type { TextAiClient } from '../ai/text/TextAiClient';
import { getPromptById, getPromptTemplate } from '../prompts/defaultPrompts';
import { renderPrompt } from '../prompts/renderPrompt';
import type { LocalConfig } from '../store/types';
import type { Transcript, VideoInfo } from '../sources/VideoSourceProvider';
import { extractThinkBlocks } from './think';
import type { SummaryResult } from './types';

export interface SummaryPipelineInput {
  video: VideoInfo;
  transcript: Transcript;
  textAiClient: TextAiClient;
  config: LocalConfig;
  onProgress?: (message: string) => void;
  onDelta?: (partial: { content: string; reasoning?: string }) => void;
  signal?: AbortSignal;
}

export async function runSummaryPipeline(input: SummaryPipelineInput): Promise<SummaryResult> {
  const { video, transcript, textAiClient, config, onProgress, signal } = input;
  const summaryPrompt = getPromptById(config.summary.defaultPromptId, config.prompts.customPresets);
  if (!summaryPrompt) throw new Error(`找不到摘要 Prompt：${config.summary.defaultPromptId}`);

  const chunks = chunkText(transcript.plainText, {
    targetChars: config.summary.chunkTargetChars,
    overlapChars: config.summary.chunkOverlapChars,
    maxChunks: config.summary.maxChunks,
  });

  if (chunks.length <= 1) {
    onProgress?.('生成摘要');
    let rawContent = '';
    let nativeReasoning = '';
    const result = await ask(textAiClient, config, getPromptTemplate(summaryPrompt, config.summary.language), {
      video,
      transcriptText: transcript.plainText,
      tokenSourceChars: transcript.plainText.length,
      signal,
      onDelta: (delta) => {
        if (delta.content) rawContent += delta.content;
        if (delta.reasoning) nativeReasoning += delta.reasoning;
        const extracted = extractThinkBlocks(rawContent);
        const combinedReasoning = `${nativeReasoning}${nativeReasoning && extracted.reasoning ? '\n\n' : ''}${extracted.reasoning}`;
        input.onDelta?.({ content: extracted.content, reasoning: combinedReasoning || undefined });
      },
    });
    return { video, transcript, promptId: summaryPrompt.id, content: result.content, reasoning: result.reasoning, createdAt: Date.now() };
  }

  const chunkPrompt = getPromptById('chunk_summary')!;
  const mergePrompt = getPromptById('merge_summary')!;
  const chunkSummaries = Array<string>(chunks.length);
  let nextChunkIndex = 0;
  let completedChunks = 0;
  let chunkFailure = false;

  const summarizeChunk = async (index: number): Promise<string> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const chunkResult = await ask(textAiClient, config, getPromptTemplate(chunkPrompt, config.summary.language), {
        video,
        transcriptText: chunks[index],
        tokenSourceChars: chunks[index].length,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
        signal,
        stream: false,
      });
      if (chunkResult.content.trim()) return chunkResult.content;
    }
    throw new Error(`第 ${index + 1}/${chunks.length} 段未返回摘要内容`);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (chunkFailure) return;
      if (signal?.aborted) throw signal.reason ?? new DOMException('任务已取消', 'AbortError');
      const index = nextChunkIndex;
      nextChunkIndex += 1;
      if (index >= chunks.length) return;
      let summary: string;
      try {
        summary = await summarizeChunk(index);
      } catch (error) {
        chunkFailure = true;
        throw error;
      }
      if (chunkFailure) return;
      chunkSummaries[index] = summary;
      completedChunks += 1;
      onProgress?.(`已完成 ${completedChunks}/${chunks.length} 段字幕摘要`);
    }
  };

  await Promise.all(Array.from({ length: Math.min(2, chunks.length) }, () => worker()));

  onProgress?.('合并长视频摘要');
  const chunkSummaryPreview = chunkSummaries.join('\n\n---\n\n');
  let result: { content: string; reasoning?: string } | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      onProgress?.('重新合并长视频摘要');
      // Reset accumulated content so the UI doesn't see the previous attempt's reasoning/content mixed in.
      input.onDelta?.({ content: '', reasoning: undefined });
    }
    let rawContent = '';
    let nativeReasoning = '';
    result = await ask(textAiClient, config, getPromptTemplate(mergePrompt, config.summary.language), {
      video,
      transcriptText: transcript.plainText,
      chunkSummaries: chunkSummaryPreview,
      tokenSourceChars: chunkSummaryPreview.length,
      signal,
      onDelta: (delta) => {
        if (delta.content) rawContent += delta.content;
        if (delta.reasoning) nativeReasoning += delta.reasoning;
        const extracted = extractThinkBlocks(rawContent);
        const combinedReasoning = `${nativeReasoning}${nativeReasoning && extracted.reasoning ? '\n\n' : ''}${extracted.reasoning}`;
        input.onDelta?.({ content: extracted.content, reasoning: combinedReasoning || undefined });
      },
    });
    if (!isIncompleteMerge(result.content, chunkSummaries)) break;
  }
  if (!result || isIncompleteMerge(result.content, chunkSummaries)) {
    throw new Error('整体摘要合并不完整，请重试');
  }
  return { video, transcript, promptId: summaryPrompt.id, content: result.content, reasoning: result.reasoning, chunkSummaries, createdAt: Date.now() };
}

function isIncompleteMerge(mergedContent: string, chunkSummaries: string[]): boolean {
  const normalizedMerged = normalizeSummaryComparison(mergedContent);
  if (!normalizedMerged) return true;
  if (chunkSummaries.length <= 1) return false;
  if (chunkSummaries.some((chunk) => normalizeSummaryComparison(chunk) === normalizedMerged)) return true;
  const totalChunks = chunkSummaries.length;
  return new RegExp(`(?:第\\s*\\d+\\s*\\/\\s*${totalChunks}\\s*段|chunk\\s*\\d+\\s*\\/\\s*${totalChunks})`, 'i')
    .test(mergedContent);
}

function normalizeSummaryComparison(value: string): string {
  return value.toLowerCase().replace(/[\s#*_`>\-[\]()]+/g, '');
}

async function ask(
  client: TextAiClient,
  config: LocalConfig,
  template: string,
  params: {
    video: VideoInfo;
    transcriptText: string;
    chunkIndex?: number;
    totalChunks?: number;
    chunkSummaries?: string;
    tokenSourceChars?: number;
    stream?: boolean;
    onDelta?: (delta: { content: string; reasoning?: string }) => void;
    signal?: AbortSignal;
  },
): Promise<{ content: string; reasoning?: string }> {
  const prompt = renderPrompt(template, {
    title: params.video.title,
    creatorName: params.video.creatorName ?? params.video.upName,
    upName: params.video.upName ?? params.video.creatorName,
    platform: params.video.platform ?? params.video.source,
    description: params.video.description,
    url: params.video.url,
    transcript: params.transcriptText,
    chunkText: params.transcriptText,
    chunkIndex: params.chunkIndex,
    totalChunks: params.totalChunks,
    chunkSummaries: params.chunkSummaries,
  });
  const result = await client.complete(
    {
      model: config.textAi.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.textAi.temperature,
      maxTokens: estimateSummaryMaxTokens(config.textAi.maxTokens, params.tokenSourceChars ?? prompt.length),
      stream: params.stream ?? config.textAi.stream,
    },
    { signal: params.signal, onDelta: params.onDelta },
  );
  const extracted = extractThinkBlocks(result.content);
  const reasoning = `${result.reasoning ?? ''}${extracted.reasoning}`.trim();
  return { content: extracted.content.trim(), reasoning: reasoning || undefined };
}

export function estimateSummaryMaxTokens(configuredMaxTokens: number, sourceChars: number): number {
  const dynamicTokens = Math.ceil(sourceChars * 0.45);
  return Math.min(16000, Math.max(configuredMaxTokens, 3000, dynamicTokens));
}
