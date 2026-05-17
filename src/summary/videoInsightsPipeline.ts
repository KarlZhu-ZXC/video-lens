import type { TextAiClient } from '../ai/text/TextAiClient';
import { getPromptById, getPromptTemplate } from '../prompts/defaultPrompts';
import { renderPrompt } from '../prompts/renderPrompt';
import type { LocalConfig } from '../store/types';
import { extractThinkBlocks } from './think';
import type { SummaryResult, VideoInsightsMessage } from './types';

export async function askVideoInsight(
  client: TextAiClient,
  config: LocalConfig,
  summary: SummaryResult,
  history: VideoInsightsMessage[],
  question: string,
  options?: { onDelta?: (partial: { content: string; reasoning?: string }) => void },
): Promise<{ content: string; reasoning?: string }> {
  const promptPreset = getPromptById('video_insights_default')!;
  const prompt = renderPrompt(getPromptTemplate(promptPreset, config.summary.language), {
    title: summary.video.title,
    summary: summary.content,
    transcript: summary.transcript.plainText,
    question,
  });

  const trimmedHistory = history.slice(-config.videoInsights.maxHistoryMessages).map((item) => ({
    role: item.role === 'user' ? 'user' as const : 'assistant' as const,
    content: item.content,
  }));

  const partial = { content: '', reasoning: '', inThink: false };
  const result = await client.complete(
    {
      model: config.textAi.model,
      messages: [...trimmedHistory, { role: 'user', content: prompt }],
      temperature: config.textAi.temperature,
      maxTokens: config.textAi.maxTokens,
      stream: config.textAi.stream,
    },
    {
      onDelta: (delta) => {
        const extracted = extractThinkBlocks(delta.content, partial.inThink);
        partial.content += extracted.content;
        partial.inThink = extracted.inThink;
        partial.reasoning += delta.reasoning ?? '';
        partial.reasoning += extracted.reasoning;
        options?.onDelta?.({ content: partial.content, reasoning: partial.reasoning || undefined });
      },
    },
  );
  const extracted = extractThinkBlocks(result.content);
  const reasoning = `${result.reasoning ?? ''}${extracted.reasoning}`.trim();
  return { content: extracted.content.trim(), reasoning: reasoning || undefined };
}
