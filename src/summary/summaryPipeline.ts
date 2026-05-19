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
    const partial = { content: '', reasoning: '', inThink: false };
    const result = await ask(textAiClient, config, getPromptTemplate(summaryPrompt, config.summary.language), {
      video,
      transcriptText: transcript.plainText,
      tokenSourceChars: transcript.plainText.length,
      signal,
      onDelta: (delta) => {
        const extracted = extractThinkBlocks(delta.content, partial.inThink);
        partial.content += extracted.content;
        partial.inThink = extracted.inThink;
        partial.reasoning += delta.reasoning ?? '';
        partial.reasoning += extracted.reasoning;
        input.onDelta?.({ content: partial.content, reasoning: partial.reasoning });
      },
    });
    return { video, transcript, promptId: summaryPrompt.id, content: result.content, reasoning: result.reasoning, createdAt: Date.now() };
  }

  const chunkPrompt = getPromptById('chunk_summary')!;
  const mergePrompt = getPromptById('merge_summary')!;
  const chunkSummaries: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    onProgress?.(`分块摘要 ${index + 1}/${chunks.length}`);
    const chunkResult = await ask(textAiClient, config, getPromptTemplate(chunkPrompt, config.summary.language), {
      video,
      transcriptText: chunks[index],
      tokenSourceChars: chunks[index].length,
      chunkIndex: index + 1,
      totalChunks: chunks.length,
      signal,
      stream: false,
    });
    chunkSummaries.push(chunkResult.content);
    input.onDelta?.({ content: chunkSummaries.join('\n\n---\n\n') });
  }

  onProgress?.('合并长视频摘要');
  const partial = { content: '', reasoning: '', inThink: false };
  const chunkSummaryPreview = chunkSummaries.join('\n\n---\n\n');
  const result = await ask(textAiClient, config, getPromptTemplate(mergePrompt, config.summary.language), {
    video,
    transcriptText: transcript.plainText,
    chunkSummaries: chunkSummaryPreview,
    tokenSourceChars: chunkSummaryPreview.length,
    signal,
    onDelta: (delta) => {
      const extracted = extractThinkBlocks(delta.content, partial.inThink);
      partial.content += extracted.content;
      partial.inThink = extracted.inThink;
      partial.reasoning += delta.reasoning ?? '';
      partial.reasoning += extracted.reasoning;
      input.onDelta?.({ content: partial.content || chunkSummaryPreview, reasoning: partial.reasoning });
    },
  });

  return { video, transcript, promptId: summaryPrompt.id, content: result.content, reasoning: result.reasoning, chunkSummaries, createdAt: Date.now() };
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
