import type { GeneratedImage } from '../ai/image/types';
import { imageCache } from '../store/imageCache';
import { stableHash } from '../utils/hash';
import type { OnePagePipelineInput, OnePagePipelineResult } from './types';

export const ONE_IMAGE_PROMPT_TEMPLATE =
  '根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：\n\n{summary}';

export function buildOneImagePrompt(summary: string): string {
  return ONE_IMAGE_PROMPT_TEMPLATE.replace('{summary}', summary.trim());
}

export async function runOnePagePipeline(input: OnePagePipelineInput): Promise<OnePagePipelineResult> {
  const { summary, config, imageAiClient, signal, onProgress } = input;
  const prompt = buildOneImagePrompt(summary.content);
  const cacheKey = stableHash(
    `${summary.video.source}:${summary.video.sourceId}:${summary.content}:${config.imageAi.apiUrl}:${config.imageAi.model}:${ONE_IMAGE_PROMPT_TEMPLATE}`,
  );
  const cached = input.force ? undefined : imageCache.get(cacheKey);
  if (cached) {
    return { prompt: cached.prompt, generatedImage: { dataUrl: cached.dataUrl, url: cached.url } };
  }

  onProgress?.({ type: 'preparing_prompt' });
  onProgress?.({ type: 'generating_image' });
  const generatedImage: GeneratedImage = await imageAiClient.generateImage(
    {
      model: config.imageAi.model,
      prompt,
      size: config.imageAi.size,
      quality: config.imageAi.quality,
      responseFormat: config.imageAi.responseFormat,
      n: 1,
    },
    { signal },
  );
  if (!generatedImage.dataUrl && !generatedImage.url && !generatedImage.blob) {
    throw new Error('图片模型未返回可用图片');
  }
  imageCache.set(cacheKey, { dataUrl: generatedImage.dataUrl, url: generatedImage.url, prompt });
  onProgress?.({ type: 'done' });
  return { prompt, generatedImage };
}
