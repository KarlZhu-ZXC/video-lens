import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DirectOpenAIImageClient } from '../src/ai/image/DirectOpenAIImageClient';
import { DEFAULT_CONFIG } from '../src/store/configStore';

function readLocalEnv(name: string): string | undefined {
  const file = resolve(process.cwd(), '.env.local');
  try {
    const line = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((item) => item.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim();
  } catch {
    return undefined;
  }
}

const runIntegration = process.env.RUN_MINIMAX_INTEGRATION === '1' ? describe : describe.skip;

runIntegration('MiniMax image generation integration', () => {
  it(
    'generates an image with MiniMax response_format=base64',
    async () => {
      const apiKey = process.env.MINIMAX_API_KEY || readLocalEnv('MINIMAX_API_KEY');
      if (!apiKey) throw new Error('Missing MINIMAX_API_KEY in environment or .env.local');

      const client = new DirectOpenAIImageClient({
        ...DEFAULT_CONFIG.imageAi,
        apiUrl: 'https://api.minimaxi.com/v1/image_generation',
        apiKey,
        model: 'image-01',
        responseFormat: 'b64_json',
        requestMode: 'fetch',
      });

      const image = await client.generateImage({
        model: 'image-01',
        prompt: '简洁金融市场风险主题插画背景，无文字，无 logo，深色桌面，红蓝行情光线。',
        size: '16:9',
        responseFormat: 'b64_json',
      });

      expect(image.dataUrl?.startsWith('data:image/png;base64,')).toBe(true);
      expect(image.raw).toBeTruthy();
    },
    120_000,
  );
});
