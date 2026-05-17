import type { TextAiClient } from '../ai/text/TextAiClient';
import { getPromptById } from '../prompts/defaultPrompts';
import { renderPrompt } from '../prompts/renderPrompt';
import { IMAGE_PROMPT_MAX_CHARS, IMAGE_PROMPT_SYSTEM_PROMPT, writeImagePromptTool } from '../prompts/toolPrompts';
import type { LocalConfig } from '../store/types';
import { extractThinkBlocks } from '../summary/think';
import type { OnePageSummaryData } from './onePageSchema';

export async function generateImagePrompt(
  data: OnePageSummaryData,
  client: TextAiClient,
  config: LocalConfig,
): Promise<string> {
  const prompt = getPromptById('image_prompt')!;
  const request = {
    model: config.textAi.model,
    messages: [
      {
        role: 'system' as const,
        content: IMAGE_PROMPT_SYSTEM_PROMPT,
      },
      {
        role: 'user' as const,
        content: renderPrompt(prompt.template, { summary: JSON.stringify(data, null, 2) }),
      },
    ],
    temperature: 0.6,
    maxTokens: 800,
    stream: false,
  };
  let result;
  try {
    result = await client.complete({
      ...request,
      tools: [writeImagePromptTool()],
      toolChoice: { type: 'function', function: { name: 'write_image_prompt' } },
    });
  } catch {
    result = await client.complete(request);
  }

  const cleaned = normalizeImagePromptOutput(extractThinkBlocks(result.content).content);
  const finalPrompt = isMetaImagePrompt(cleaned) ? buildFallbackImagePrompt(data) : cleaned;
  if (!finalPrompt) throw new Error('图片 prompt 为空，请重试或更换文本模型');
  return finalPrompt.slice(0, IMAGE_PROMPT_MAX_CHARS);
}

export function normalizeImagePromptOutput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const json = JSON.parse(trimmed);
    if (typeof json.prompt === 'string') return normalizeImagePromptOutput(json.prompt);
  } catch {
    // Plain text model responses are expected for providers without tool support.
  }
  return trimmed
    .replace(/^```(?:text|prompt)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^\s*(?:final\s+prompt|prompt)\s*:\s*/i, '')
    .trim();
}

export function isMetaImagePrompt(prompt: string): boolean {
  return /^(the user wants|we need to|i need to|given the video|根据以下|用户想要)/i.test(prompt.trim());
}

function buildFallbackImagePrompt(data: OnePageSummaryData): string {
  const subjects = [
    data.title,
    data.subtitle,
    data.conclusion,
    ...data.tags,
    ...data.keyPoints.map((point) => `${point.title}: ${point.detail}`),
  ]
    .filter(Boolean)
    .join('; ');

  return [
    `Abstract editorial infographic background inspired by: ${subjects}.`,
    'Create a cinematic illustrated scene with layered depth, clean composition, atmospheric lighting, subtle texture, and generous negative space for a Chinese information card overlay.',
    'Use a refined modern visual language, balanced contrast, rich but restrained colors, and documentary-inspired details from the topic.',
    'No text, no captions, no Chinese characters, no logo, no watermark, no UI, no readable symbols.',
  ].join(' ');
}
