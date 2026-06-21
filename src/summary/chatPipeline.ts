import type { TextAiClient } from '../ai/text/TextAiClient';
import { getPromptById, getPromptTemplate } from '../prompts/defaultPrompts';
import { renderPrompt } from '../prompts/renderPrompt';
import type { LocalConfig } from '../store/types';
import { extractThinkBlocks } from './think';
import type { SummaryResult, ChatMessage } from './types';

export const ONE_IMAGE_PROMPT_TEMPLATE =
  '根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：\n\n{summary}';

export function buildOneImagePrompt(summary: string): string {
  return ONE_IMAGE_PROMPT_TEMPLATE.replace('{summary}', summary.trim());
}

export async function askSummaryChat(
  client: TextAiClient,
  config: LocalConfig,
  summary: SummaryResult,
  history: ChatMessage[],
  question: string,
  options?: { onDelta?: (partial: { content: string; reasoning?: string }) => void },
): Promise<{ content: string; reasoning?: string }> {
  const promptPreset = getPromptById('video_insights_default')!;
  const prompt = renderPrompt(getPromptTemplate(promptPreset, config.summary.language), {
    title: summary.video.title,
    creatorName: summary.video.creatorName ?? summary.video.upName,
    upName: summary.video.upName ?? summary.video.creatorName,
    platform: summary.video.platform ?? summary.video.source,
    summary: summary.content,
    transcript: summary.transcript.plainText,
    question,
  });

  const historyWithoutCurrentQuestion = [...history];
  const latest = historyWithoutCurrentQuestion[historyWithoutCurrentQuestion.length - 1];
  if (latest?.role === 'user' && latest.content.trim() === question.trim()) historyWithoutCurrentQuestion.pop();
  const trimmedHistory = historyWithoutCurrentQuestion.slice(-config.chat.maxHistoryMessages).map((item) => ({
    role: item.role === 'user' ? 'user' as const : 'assistant' as const,
    content: item.content,
  }));

  let rawContent = '';
  let nativeReasoning = '';
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
        if (delta.content) rawContent += delta.content;
        if (delta.reasoning) nativeReasoning += delta.reasoning;
        const extracted = extractThinkBlocks(rawContent);
        const combinedReasoning = `${nativeReasoning}${nativeReasoning && extracted.reasoning ? '\n\n' : ''}${extracted.reasoning}`;
        options?.onDelta?.({ content: extracted.content, reasoning: combinedReasoning || undefined });
      },
    },
  );
  const extracted = extractThinkBlocks(result.content);
  const reasoning = `${result.reasoning ?? ''}${extracted.reasoning}`.trim();
  return { content: extracted.content.trim(), reasoning: reasoning || undefined };
}

export function isImageGenerationRequest(question: string): boolean {
  const normalized = question.trim();
  return /(?:生图|生成(?:一张|一个)?(?:图片|图像|插图|配图|海报)|绘制(?:一张|一个)?(?:图|图片)|draw\s+(?:an?\s+)?(?:image|picture)|generate\s+(?:an?\s+)?image|create\s+(?:an?\s+)?(?:image|picture))/i.test(normalized)
    || /^(?:请|帮我|给我)?(?:根据.{0,40})?画(?!风|面)/.test(normalized);
}
