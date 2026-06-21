import type { LocalConfig } from '../../store/types';
import type { ImageAiClient } from './ImageAiClient';
import type { GeneratedImage, ImageGenerationRequest } from './types';

export class DirectOpenAIImageClient implements ImageAiClient {
  constructor(private readonly config: LocalConfig['imageAi']) {}

  async generateImage(request: ImageGenerationRequest, options?: { signal?: AbortSignal }): Promise<GeneratedImage> {
    if (!this.config.apiKey) throw new Error('请先在设置中填写图片模型 API Key');
    if (this.config.requestMode === 'gm_xhr') return this.generateWithGmXhr(request);
    if (this.config.requestMode === 'fetch') return this.generateWithFetch(request, options);
    if (typeof GM_xmlhttpRequest === 'function') return this.generateWithGmXhr(request);

    try {
      return await this.generateWithFetch(request, options);
    } catch (error) {
      if (typeof GM_xmlhttpRequest !== 'function') throw error;
      return this.generateWithGmXhr(request);
    }
  }

  private async generateWithFetch(
    request: ImageGenerationRequest,
    options?: { signal?: AbortSignal },
  ): Promise<GeneratedImage> {
    const res = await fetch(this.config.apiUrl, {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        prompt: sanitizeImagePrompt(request.prompt),
        size: request.size,
        quality: request.quality,
        response_format: normalizeImageResponseFormat(this.config.apiUrl, request.responseFormat),
        n: request.n ?? 1,
      }),
    });

    if (!res.ok) throw new Error(`Image generation failed: ${res.status} ${await res.text()}`);
    return parseGeneratedImage(await res.json());
  }

  private generateWithGmXhr(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (typeof GM_xmlhttpRequest !== 'function') throw new Error('GM_xmlhttpRequest 不可用');

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: this.config.apiUrl,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        data: JSON.stringify({
          model: request.model,
          prompt: sanitizeImagePrompt(request.prompt),
          size: request.size,
          quality: request.quality,
          response_format: normalizeImageResponseFormat(this.config.apiUrl, request.responseFormat),
          n: request.n ?? 1,
        }),
        onload: (res) => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`Image generation failed: ${res.status} ${res.responseText}`));
            return;
          }
          resolve(parseGeneratedImage(JSON.parse(res.responseText)));
        },
        onerror: () => reject(new Error('Image generation request failed')),
      });
    });
  }
}

export function parseGeneratedImage(json: any): GeneratedImage {
  if (json?.error) {
    const msg = typeof json.error === 'string' ? json.error : json.error.message || JSON.stringify(json.error);
    throw new Error(`API Error: ${msg}`);
  }

  if (json?.base_resp?.status_code && json.base_resp.status_code !== 0) {
    throw new Error(`API Error: ${json.base_resp.status_msg || 'Unknown'} (Code: ${json.base_resp.status_code})`);
  }

  const imageBase64 = firstString(json?.data?.image_base64) ?? firstString(json?.image_base64) ?? firstString(json?.b64_json) ?? firstString(json?.base64);
  if (imageBase64) return { dataUrl: `data:image/png;base64,${imageBase64}`, mimeType: 'image/png', raw: json };

  const url = firstString(json?.data?.url) ?? firstString(json?.url);
  if (url) return { url, raw: json };

  const item = json?.data?.[0];
  if (!item) {
    const payload = JSON.stringify(json).slice(0, 200);
    throw new Error(`No image returned. Response: ${payload}`);
  }

  if (item.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}`, mimeType: 'image/png', raw: json };
  if (item.base64) return { dataUrl: `data:image/png;base64,${item.base64}`, mimeType: 'image/png', raw: json };
  if (item.image_base64) return { dataUrl: `data:image/png;base64,${item.image_base64}`, mimeType: 'image/png', raw: json };
  if (item.url) return { url: item.url, raw: json };

  throw new Error(`Unsupported image response format. Response: ${JSON.stringify(json).slice(0, 200)}`);
}

export function normalizeImageResponseFormat(
  apiUrl: string,
  responseFormat: ImageGenerationRequest['responseFormat'],
): string | undefined {
  if (!responseFormat || responseFormat === 'auto') return undefined;
  if (isMiniMaxImageUrl(apiUrl) && responseFormat === 'b64_json') return 'base64';
  return responseFormat;
}

export function sanitizeImagePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').slice(0, 1200);
}

function isMiniMaxImageUrl(apiUrl: string): boolean {
  return /minimax|minimaxi/i.test(apiUrl);
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}
