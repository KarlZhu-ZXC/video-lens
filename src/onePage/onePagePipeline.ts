import { getPromptById, getPromptTemplate } from '../prompts/defaultPrompts';
import { renderPrompt } from '../prompts/renderPrompt';
import { writeOnePageJsonTool } from '../prompts/toolPrompts';
import { imageCache } from '../store/imageCache';
import { onePageCache } from '../store/onePageCache';
import { stableHash } from '../utils/hash';
import { composeOnePage } from './composeOnePage';
import { generateImagePrompt } from './imagePromptPipeline';
import { parseOnePageJson } from './onePageSchema';
import type { OnePagePipelineInput, OnePagePipelineResult } from './types';
import type { GeneratedImage } from '../ai/image/types';

export async function runOnePagePipeline(input: OnePagePipelineInput): Promise<OnePagePipelineResult> {
  const { summary, config, textAiClient, imageAiClient, signal, onProgress } = input;
  const cacheKey = stableHash(`${summary.video.sourceId}:${summary.content}:${config.onePage.defaultTemplate}`);

  onProgress?.({ type: 'generating_json' });
  let data = input.force ? undefined : onePageCache.get(cacheKey);
  if (!data) {
    const prompt = getPromptById('one_page_json')!;
    const request = {
      model: config.textAi.model,
      messages: [
        {
          role: 'user' as const,
          content: renderPrompt(getPromptTemplate(prompt, config.summary.language), {
            title: summary.video.title,
            upName: summary.video.upName,
            url: summary.video.url,
            summary: summary.content,
          }),
        },
      ],
      temperature: 0.4,
      maxTokens: 1600,
      stream: false,
    };
    let result;
    try {
      result = await textAiClient.complete(
        {
          ...request,
          tools: [writeOnePageJsonTool()],
          toolChoice: { type: 'function', function: { name: 'write_one_page_json' } },
        },
        { signal },
      );
    } catch {
      result = await textAiClient.complete(request, { signal });
    }
    onProgress?.({ type: 'validating_json' });
    data = parseOnePageJson(result.content);
    onePageCache.set(cacheKey, data);
  }

  let imagePrompt: string | undefined;
  const cachedImage = input.force ? undefined : imageCache.get(cacheKey);
  let generatedImage: GeneratedImage | undefined = cachedImage
    ? { dataUrl: cachedImage.dataUrl, url: cachedImage.url }
    : undefined;

  if (config.onePage.mode !== 'text_card_only' && config.imageAi.enabled && imageAiClient) {
    if (!generatedImage) {
      onProgress?.({ type: 'generating_image_prompt' });
      imagePrompt = await generateImagePrompt(data, textAiClient, config);
      onProgress?.({ type: 'generating_ai_image' });
      const image = await imageAiClient.generateImage(
        {
          model: config.imageAi.model,
          prompt: imagePrompt,
          size: config.imageAi.size,
          quality: config.imageAi.quality,
          responseFormat: config.imageAi.responseFormat,
        },
        { signal },
      );
      generatedImage = image;
      imageCache.set(cacheKey, { dataUrl: generatedImage.dataUrl, url: generatedImage.url, prompt: imagePrompt });
    }
  }

  onProgress?.({ type: 'rendering_card' });
  const composedElement = composeOnePage(data, config, generatedImage);
  onProgress?.({ type: 'done' });
  return { data, imagePrompt, generatedImage, composedElement };
}
